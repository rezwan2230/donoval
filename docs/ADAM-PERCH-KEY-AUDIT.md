# ADAM — Paula action-key reconciliation

**Order** ADAM-PERCH-KEY-AUDIT · post-cutover reconciliation, follow-up to the
merged command-channel work (#92, #94).
**Who runs the live call** David. **Who runs the tail** David, with his own
Cloudflare credentials.
**What this PR changes** this document. **No product code changes.**

---

## 1 · Why a live call is the only source

`/fn/do_page_action` answers a tool call whose `action_key` it does not recognise
with `{status:"not_available"}` — and, since #94, also writes one line to the
Function log:

```
[do_page_action] NOT_AVAILABLE action_key=<key>
```

`functions/fn/do_page_action.js:325`. That line is the instrument this audit
consumes. It exists because a `not_available` return is **silent to the caller**:
Paula typically carries on as though the page moved, so a tool config that has
drifted ahead of `ACTION_MAP` is invisible on the call and invisible in CI.

Two facts make a live call unavoidable:

* **Paula's action-key enum lives in the Retell tool config, not in this repo.**
  Nothing in the tree can enumerate it. The only way to learn a key is to watch
  Paula emit it.
* **The instrument writes to the deployed Function's log**, so only a production
  (or Preview) deployment's log carries the output. A local `wrangler pages dev`
  run would exercise a different tree.

`test/perch-qualifier-booking.test.mjs:264` asserts the instrument fires, using
the fixture key `open_calendar`. **That is a synthetic test value, not evidence
Paula emits it.** Do not seed the table below with it.

---

## 2 · Task 1 — the tail

### 2.1 Prerequisites (David runs these; ADAM never touches the credential)

```bash
npx wrangler --version     # expect 4.x — this repo is on 4.114.0
npx wrangler whoami        # must print an account; if not:
npx wrangler login         # browser OAuth, David's own Cloudflare account
```

`whoami` printing an account is the only auth check needed. **Do not paste an API
token into the shell** — `wrangler login` stores it out of band.

### 2.2 The capture command

Pages project name is `donovan-site` (`donovan-legal-site/wrangler.jsonc:2`).
Run this from `donovan-legal-site/`, **in its own terminal, before you dial**:

Git Bash:

```bash
cd donovan-legal-site
npx wrangler pages deployment tail \
  --project-name donovan-site \
  --environment production \
  --format json \
  --method POST \
  | tee ~/perch-tail-$(date +%Y%m%d-%H%M).jsonl
```

PowerShell:

```powershell
cd donovan-legal-site
npx wrangler pages deployment tail --project-name donovan-site --environment production --format json --method POST |
  Tee-Object -FilePath "$HOME\perch-tail-$(Get-Date -Format yyyyMMdd-HHmm).jsonl"
```

Flag-by-flag, because each one is load-bearing:

| Flag | Why |
|---|---|
| `--project-name donovan-site` | the Pages project. Not the branch, not the hostname. |
| `--environment production` | grabs the **latest production deployment** without needing its id. Tailing a Preview instead? Replace with the deployment id as the positional argument: `npx wrangler pages deployment tail <deployment-id> --project-name donovan-site …` |
| `--format json` | one JSON object per line, so the grep below is exact. `pretty` emits ANSI colour that survives a pipe and breaks a literal grep. |
| `--method POST` | **the noise filter that makes this readable.** `js/perch/command-channel.js` polls `GET /fn/page-poll` every 1.2 s — ~50 events a minute per live call, which buries everything. Every Paula tool call is a POST, so no `do_page_action` event is lost. |
| `tee` | the tail is a stream; without a file you cannot re-grep, and you get one chance per call. **The file is the evidence.** |

Deliberately **not** used: `--search NOT_AVAILABLE`. It would work, but it makes
"the config is clean" and "the tail was never attached" look identical, and it
throws away the surrounding `COALESCED` / status lines that tell you which
commands Paula paired. Filter after the fact, not on the wire.

### 2.3 Liveness check — do this before you speak

Within the first few seconds of the call connecting, the tail must show
**something**. If the screen is completely empty after Paula's first navigation
request, the tail is not attached to the deployment serving you — stop the call
and fix that first, because a silent tail and a clean config are the same
picture.

### 2.4 The grep — isolate the missing keys

After the call, against the captured file:

```bash
# every NOT_AVAILABLE line, with context, in order
grep -o 'NOT_AVAILABLE action_key=[^"\\]*' ~/perch-tail-*.jsonl

# just the distinct key list — this is what goes in the table
grep -o 'NOT_AVAILABLE action_key=[^"\\]*' ~/perch-tail-*.jsonl \
  | sed 's/.*action_key=//' | sort | uniq -c | sort -rn
```

PowerShell equivalent:

```powershell
Select-String -Path "$HOME\perch-tail-*.jsonl" -Pattern 'NOT_AVAILABLE action_key=([^"\\]*)' -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } |
  Group-Object | Sort-Object Count -Descending | Format-Table Count, Name
```

`[^"\\]*` rather than `\w+`: the key is sliced to 64 chars but not otherwise
constrained, and the terminator inside a JSON string is the closing quote or an
escape. A `\w+` pattern would silently truncate a hyphenated or dotted key.

### 2.5 Second grep — a missing TOOL, not a missing key

`NOT_AVAILABLE` only covers `do_page_action`'s `action_key` enum. If Paula's
config names an endpoint this repo does not have at all (`/fn/whatever`), that is
a **404**, not a `not_available`. Same file:

```bash
grep -o '/fn/[a-z_-]*' ~/perch-tail-*.jsonl | sort -u           # every /fn/ path she touched
grep -o '"outcome":"[a-z]*"' ~/perch-tail-*.jsonl | sort | uniq -c
```

The path pattern is unanchored on purpose: wrangler logs the **full URL**
(`https://donovanlegal.com/fn/do_page_action`), so a pattern anchored on an
opening quote — `'"/fn/…'` — matches nothing and reads as "she called no
endpoints". The `-` in the class is there for `page-poll`.

Compare the first list against the ten endpoints that exist:
`booking_confirmed`, `booking_result`, `do_page_action`, `get_availability`,
`get_page_actions`, `page-poll`, `qualifier_result`, `qualifier_submit`,
`save_lead`, `take_message`. Anything else is a config-level gap and belongs in
the report alongside the missing keys.

---

## 3 · Task 2 — the runbook

**Goal: make Paula emit every action key her config offers, once, in one call.**
This is not a QA pass — nothing here has to *work*. A key that fires and does the
wrong thing is a Sheldon bug; a key that fires and logs `NOT_AVAILABLE` is what
this run exists to find. Ask for everything, note nothing, keep talking.

### Before you dial

| | |
|---|---|
| **URL** | production — the live site. `PERCH_ROUTER` is on in production (SARAH-A42, #90), so the layer's consumer stack is built. |
| **Tail** | running, in its own terminal, per §2.2. Confirm §2.3. |
| **Browser console** | open. Paula's commands log as `[perch] page-control → {…}`. |
| **Start page** | `/contact`. Not `/perch` — that is the rollback shell. |
| **Consent** | you will be asked to consent to recording. FL §934.03; it is meant to be there. |

Sanity check in the console before you dial:

```js
window.Perch.layer.probe().commandChannel   // → an object, NOT null
```

`null` means the consumer stack never booted and nothing below will be observed
in the browser. **The tail still works** — the instrument is server-side — so if
this is `null`, continue anyway and say so in the report.

### What to say

Say these in order. **Do not stop to check whether anything happened.** If Paula
asks a clarifying question, answer it briefly and move on. Say each line even if
you are already on that page — a redundant navigation still emits the key.

| # | Say this | Aims at | Notes |
|---|---|---|---|
| 1 | "Take me to your home page." | `goto_home` | |
| 2 | "Tell me about the firm." | `goto_about` | |
| 3 | "Who is Paul?" / "…Tefera?" / "…Wendy?" / "…Leidy?" | `goto_paul` `goto_tefera` `goto_wendy` `goto_leidy` | four separate asks |
| 4 | "What practice areas do you have?" | `goto_practice` | |
| 5 | "Show me tax." then "tax planning", "tax compliance", "tax controversy" | `goto_tax` `goto_tax_planning` `goto_tax_compliance` `goto_tax_controversy` | four separate asks |
| 6 | "Show me real estate." then "acquisition", "ownership", "disposition" | `goto_real_estate` `goto_re_acquisition` `goto_re_ownership` `goto_re_disposition` | four separate asks |
| 7 | "What is special counsel?" | `goto_special_counsel` | |
| 8 | "Show me your experience." / "…testimonials." | `goto_experience` `goto_testimonials` | |
| 9 | "Show me your resources." then "your blog." | `goto_resources` `goto_blog` | two asks; both map to `/blog.html` |
| 10 | "Do you have any tools or calculators?" | `goto_tools` | |
| 11 | "Tell me about membership." | `goto_membership` | |
| 12 | "What is the gold tier?" then platinum, diamond, reserve | `goto_gold` `goto_platinum` `goto_diamond` `goto_reserve` | **expect the call to drop** — see §5, hazard H2. If it drops, hang up, restart the tail is **not** needed (it is still streaming), redial and resume at #13. |
| 13 | "How do I contact you?" | `goto_contact` | |
| 14 | "I'd like to fill out an intake form." | `open_intake` | |
| 15 | **"Scroll down."** then "scroll up", "go to the top", "go to the bottom" | `scroll_down` `scroll_up` `scroll_to_top` `scroll_to_bottom` | four separate asks |
| 16 | **"Can you highlight that for me?"** / "Point at the phone number." | *(no key exists)* | **This is a probe, not a check.** Nothing in `ACTION_MAP` produces a `highlight`. If a `NOT_AVAILABLE` line appears here, her config has a highlight key and the relay does not — exactly the finding this run wants. If nothing appears, her config has no highlight key either. Either answer is useful. |
| 17 | "I want to talk about buying a rental property." → answer her language question → answer "how did you hear about us" | `goto_re_acquisition` + `open_qualifier` | the qualifier card should slide over the page |
| 18 | Tap through the card to the end | — | so `qualifier_submit` fires |
| 19 | "Did you get all that?" | `get_qualifier_result` | a **tool**, not an action key |
| 20 | "Let's book a time — my name is `<name>`, my email is `<email>`." | `goto_booking` + `booking_prefill` | |
| 21 | "What days do you have?" | `get_availability` | a **tool** |
| 22 | "How about the 27th?" (pick a day she offers) | `booking_show_date` | |
| 23 | "11 in the morning, please." | `booking_select_slot` | |
| 24 | "Is there a different type of consultation?" | `booking_select_type` | may not fire — note it either way |
| 25 | "Actually, can you just take a message?" | `take_message` | a **tool** |
| 26 | **"Is there anything else you can do on the page for me? Anything at all?"** | **the whole point of the run** | Paula usually reads her tool list back. **Write down everything she names.** Then ask for each one she names that is not already in this table. |
| 27 | For each thing she named in #26 that is not above: ask for it by name | — | one at a time |
| 28 | **STOP. Do not press "Confirm Appointment".** | — | nothing is booked; this run creates no Clio appointment |
| 29 | "That's all, thanks." | — | call ends |

### What to send back

1. **The capture file** — or, if it is large, the output of both greps in §2.4
   and §2.5.
2. **Row #26 verbatim**: the list of capabilities Paula read back. This is the
   closest thing to her config enum that a call can produce, and it catches keys
   that never fired because no prompt in this runbook triggered them.
3. **Any row where the call dropped**, and which row it was.

**Nothing in the capture is a secret.** `do_page_action` never logs PII — it logs
action keys and validation outcomes only (`functions/fn/do_page_action.js:264`),
and the `call_id` is not in the `NOT_AVAILABLE` line. The file is safe to paste
onto the PR. Skim it once before you do.

---

## 4 · Task 3 — the reconciliation table

Two columns are already known and are filled in below: what
`/fn/do_page_action` **dispatches** and what `/fn/get_page_actions` **advertises**.
The third — what Paula's Retell config **offers** — is filled in from the capture.

**How to fill it in:**

* A key in the table that Paula fired and that did **not** appear in the
  `NOT_AVAILABLE` grep → mark Paula column ✅.
* A key in the table that Paula **never** fired across the whole run and that she
  did not name in row #26 → mark ❔. It is a **retire candidate**, not a
  confirmed one — one call is not proof of absence.
* A key in the `NOT_AVAILABLE` grep that is **not** in the table → add a new row
  at the bottom. **These are the missing keys. This is the deliverable.**

### 4.1 Keys the code knows about (39)

Legend — **Dispatch**: `MAP` = static `ACTION_MAP` entry · `BRANCH` = its own
parameterized branch. **Discovery**: whether `get_page_actions` returns it.

| # | action_key | Dispatch (`do_page_action.js`) | Discovery (`get_page_actions.js`) | Paula emits? | Hazard |
|---|---|---|---|---|---|
| 1 | `goto_home` | MAP → `navigate /index.html` | ✅ advertised | | **H1** |
| 2 | `goto_about` | MAP → `navigate /ourfirm.html` | ✅ advertised | | |
| 3 | `goto_paul` | MAP → `navigate /profile.html` | ✅ advertised | | |
| 4 | `goto_tefera` | MAP → `navigate /tefera.html` | ✅ advertised | | |
| 5 | `goto_wendy` | MAP → `navigate /wendy.html` | ✅ advertised | | |
| 6 | `goto_leidy` | MAP → `navigate /leidy.html` | ✅ advertised | | |
| 7 | `goto_practice` | MAP → `navigate /practice.html` | ✅ advertised | | |
| 8 | `goto_tax` | MAP → `navigate /tax.html` | ✅ advertised | | |
| 9 | `goto_tax_planning` | MAP → `navigate /tax-planning.html` | ✅ advertised | | |
| 10 | `goto_tax_compliance` | MAP → `navigate /tax-compliance.html` | ✅ advertised | | |
| 11 | `goto_tax_controversy` | MAP → `navigate /tax-controversy.html` | ✅ advertised | | |
| 12 | `goto_real_estate` | MAP → `navigate /real-estate.html` | ✅ advertised | | |
| 13 | `goto_re_acquisition` | MAP → `navigate /re-acquisition.html` | ✅ advertised | | |
| 14 | `goto_re_ownership` | MAP → `navigate /re-ownership.html` | ✅ advertised | | |
| 15 | `goto_re_disposition` | MAP → `navigate /re-disposition.html` | ✅ advertised | | |
| 16 | `goto_special_counsel` | MAP → `navigate /special-counsel.html` | ✅ advertised | | |
| 17 | `goto_experience` | MAP → `navigate /experience.html` | ✅ advertised | | |
| 18 | `goto_testimonials` | MAP → `navigate /testimonials.html` | ✅ advertised | | |
| 19 | `goto_resources` | MAP → `navigate /blog.html` | ✅ advertised | | dup of #20 |
| 20 | `goto_blog` | MAP → `navigate /blog.html` | ✅ advertised | | dup of #19 |
| 21 | `goto_tools` | MAP → `navigate /tools.html` | ✅ advertised | | |
| 22 | `goto_membership` | MAP → `navigate /engagement.html` | ✅ advertised | | |
| 23 | `goto_gold` | MAP → `navigate /gold/` | ✅ advertised | | **H2** |
| 24 | `goto_platinum` | MAP → `navigate /platinum/` | ✅ advertised | | **H2** |
| 25 | `goto_diamond` | MAP → `navigate /diamond/` | ✅ advertised | | **H2** |
| 26 | `goto_reserve` | MAP → `navigate /reserve/` | ✅ advertised | | **H2** |
| 27 | `goto_contact` | MAP → `navigate /contact.html` | ✅ advertised | | dup of #28 |
| 28 | `open_intake` | MAP → `navigate /contact.html` | ✅ advertised | | dup of #27 |
| 29 | `goto_booking` | MAP → `navigate /book.html` | ✅ advertised | | dup of #30 |
| 30 | `book_consult` | MAP → `navigate /book.html` | ✅ advertised | | dup of #29 |
| 31 | `scroll_down` | MAP → `scrollby down` | ✅ advertised | | |
| 32 | `scroll_up` | MAP → `scrollby up` | ✅ advertised | | |
| 33 | `scroll_to_top` | MAP → `scrollby top` | ✅ advertised | | |
| 34 | `scroll_to_bottom` | MAP → `scrollby bottom` | ✅ advertised | | |
| 35 | `open_qualifier` | BRANCH → `open_qualifier {matter,lang,source}` | ✅ advertised | | |
| 36 | `booking_prefill` | BRANCH → `booking_prefill {name,email,phone,notes}` | ❌ **NOT advertised** | | **H3** |
| 37 | `booking_select_slot` | BRANCH → `booking_select_slot` (ISO \| `{day,time}`) | ❌ **NOT advertised** | | **H3** |
| 38 | `booking_select_type` | BRANCH → `booking_select_type {typeId}` | ❌ **NOT advertised** | | **H3** |
| 39 | `booking_show_date` | BRANCH → `booking_show_date {day}` | ❌ **NOT advertised** | | **H3** |

### 4.2 Keys Paula emits that the code does not handle — **fill from the capture**

Every distinct key from the §2.4 grep goes here. One row each.

| # | action_key (from `NOT_AVAILABLE`) | Times seen | What David asked for | Nearest existing key | Proposed dispatch |
|---|---|---|---|---|---|
| M1 | | | | | |
| M2 | | | | | |
| M3 | | | | | |
| M4 | | | | | |
| M5 | | | | | |

*(add rows as needed — do not cap the list at five)*

### 4.3 Client capabilities with no key at all

Reachable only if someone adds an `ACTION_MAP` entry. Not `NOT_AVAILABLE`
candidates today, because Paula has no key to emit.

| Capability | Implemented at | Key that would reach it | Status |
|---|---|---|---|
| `highlight` (ring a selector for 2600 ms) | `js/perch/page-control.js:110` | none exists | **unreachable from Paula** |
| `scroll` (scroll a selector into view) | `js/perch/page-control.js:103` | none exists — the four `scroll_*` keys all emit `scrollby`, not `scroll` | **unreachable from Paula** |

Runbook row #16 probes whether Paula's config nevertheless has a highlight key.
If it does, this becomes an M-row in §4.2 and the wiring is a two-line
`ACTION_MAP` addition. If it does not, these two are §5 R2 retire candidates.

---

## 5 · Findings already provable without the call

These do not need David's call. They are stated now so the call does not have to
rediscover them.

**H1 · `goto_home` targets a path the router excludes — mitigated, not fixed.**
`ACTION_MAP.goto_home` → `/index.html`, which matches the `no-container-index`
rule in `js/perch/swap-policy.js:89`. An excluded path takes
`location.assign()`, and a full document load destroys the WebRTC session. The
layer repairs this in the client: `homeTarget()` (`js/perch-layer.js:576`)
rewrites any homepage spelling to `/home` before the router sees it. So the live
behaviour is correct **on the layer**. The server-side map still names the
call-killing spelling, and the repair is one function call away from being
bypassed. Worth normalising at the source; not urgent.

**H2 · The four tier keys hard-navigate and end the call.**
`goto_gold` / `goto_platinum` / `goto_diamond` / `goto_reserve` target
`/gold/` … `/reserve/`, which match `tier-basic-auth`
(`js/perch/swap-policy.js:57`). That exclusion is correct and deliberate — a
401 + `WWW-Authenticate` pair only raises the browser credential prompt on a real
document navigation, so Swup must not intercept it. There is **no `homeTarget`
equivalent** for these four. Consequence: Paula taking a caller to a membership
tier drops the call, and the log reads `navigate → done`. All four are
advertised by `get_page_actions`, so Paula is actively told she can do this.
**This is the highest-value item in this document and it is not a missing key —
it is four present keys that should not be reachable mid-call.**

**H3 · `get_page_actions` under-reports by four.**
`do_page_action` dispatches **39** keys. `get_page_actions` advertises **35**.
The four missing are exactly the booking family — `booking_prefill`,
`booking_select_slot`, `booking_select_type`, `booking_show_date`. They work
today only because Paula's static tool config names them directly. Any flow that
uses `get_page_actions` as the source of truth cannot discover the booking
controls at all, and the drift is in the direction that hides a working feature.

**H4 · Six keys are pure duplicates.** `goto_resources`/`goto_blog` →
`/blog.html`; `goto_contact`/`open_intake` → `/contact.html`;
`goto_booking`/`book_consult` → `/book.html`. Harmless, but they are three extra
enum entries Paula has to choose between, and enum size is a real cost in her
prompt.

---

## 6 · Task 4 — the handoff

### 6.1 To Sheldon — wire these

**Fill after the call.** The list is the §4.2 M-rows, plus, unconditionally:

| Item | What | Where | Why now |
|---|---|---|---|
| **W1** | Add the four booking keys to `KEYS` | `functions/fn/get_page_actions.js:14` | H3. Four strings. Closes the discovery gap. |
| **W2** | Decide the tier-key posture | `functions/fn/do_page_action.js:112` + `get_page_actions.js` | H2. Either remove the four keys (Paula stops offering a call-killing action), or give them a spoken handoff instead of a navigation. **David's call — it is a product decision, not a code one.** |
| **W3** | *(from §4.2)* | `ACTION_MAP` | every confirmed missing key |

W3 is mechanical for anything that is a navigation or a scroll — one
`ACTION_MAP` line. A missing key that needs *arguments* is a new parameterized
branch alongside `open_qualifier`, and needs its own sanitizer in the shape of
`sanitizeBookingArgs`; flag those separately when the list arrives.

### 6.2 Retire candidates — keys the code has and Paula may not use

**R1 · The ❔ rows in §4.1.** Any key Paula never emitted across the full runbook
*and* did not name at row #26. **One call is not proof of absence** — a key can
be real and simply never prompted. Treat R1 as a shortlist for a second call, not
as a delete list.

**R2 · `highlight` and selector-`scroll`** (§4.3). Implemented, tested,
unreachable. Either wire a key (cheap) or delete the branches. Do **not** delete
on the strength of this document alone — `js/perch/page-control.js` is shared
with the `/perch` rollback shell, and `perch-inject.js` may drive those commands
by a path this audit did not trace.

**R3 · One of each duplicate pair** (H4). Only worth doing as part of a
deliberate enum-trimming pass on Paula's config, and only with W1/W3 in the same
change, so her config and `get_page_actions` move together.

---

## 7 · Constraints this run honours

* No product code changed. This PR adds one document.
* No secret read, entered, or logged. David authenticates his own `wrangler`.
* Nothing under `.github/workflows/` touched.
* Nothing merged, nothing promoted. **Zane gates, David merges.**
* The runbook creates **no** Clio appointment (row #28) and **no** Vantage lead
  beyond what a normal caller would create at row #18.
