# SHELDON — Perch tier-key handoff

**Order** `SHELDON-PERCH-TIER-KEY-HANDOFF` · ticket **#95 W2** · from **ADAM key
audit finding H2** (`docs/ADAM-PERCH-KEY-AUDIT.md`, PR #96).
Branch `sheldon/perch-tier-key-handoff`, PR **#101**, baseline **`ed358ac`**
(rebased onto `main` after PR #99 landed — see §8).
Preview **`https://a2eef1e9.donovan-site.pages.dev`** (CI `Deploy Preview`) — verifier
**29/29 GO, 0 writes**. The same 29 checks passed identically on the pre-rebase
builds `55acca25` and `eb72902a`, so the rebase changed no measured behaviour.

---

## 1. The defect, traced end to end

A caller asks Paula about the Gold membership.

| # | Layer | What happens | What the log says |
|---|-------|--------------|-------------------|
| 1 | Retell tool config | Paula calls `goto_gold` — `get_page_actions` advertised it | tool call ok |
| 2 | `functions/fn/do_page_action.js` | `ACTION_MAP.goto_gold` → `{cmd:'navigate', target:'/gold/'}`, queued on the bridge | `navigate → done` |
| 3 | `perch-do` Durable Object | accepts the write | ok |
| 4 | `/fn/page-poll` | returns the command 1.2 s later | ok |
| 5 | `js/perch/command-channel.js` | `host.go('/gold/')` | `via: host.go` |
| 6 | `js/perch-swup-router.js:276` | `if (excludeReason(path)) { location.assign(href); return; }` | — |
| 7 | the browser | **full document load** | — |
| 8 | the caller | **the WebRTC call is dead, mid-sentence** | nothing |

`/gold/`, `/platinum/`, `/diamond/` and `/reserve/` are the first entry on
swap-policy's exclusion list (`tier-basic-auth`, `js/perch/swap-policy.js`)
because they sit behind HTTP Basic auth (`functions/_lib/tier-auth.js`). A 401 +
`WWW-Authenticate` pair only raises the browser credential prompt on a **real
document navigation**; Swup fetches with `fetch()`, so an intercepted tier link
yields an opaque 401 and the member is never asked for a password.

So the exclusion is right, and it is **not what changed here**. The only thing
these four keys could ever do was end the call — and every log on the path read
success. See [[feedback_advertised_key_can_kill_the_live_call]].

`goto_home` had the same shape and was repaired by *retargeting*
(`homeTarget()`, `/index.html` → `/home`, PR #92). No such rewrite exists for a
tier: the destination is not a spelling problem, it is a locked door, and a
caller on the phone does not have the password.

## 2. The posture David chose

**A spoken handoff.** Paula describes the tier out loud from the membership KB
and points to the public membership overview. She never navigates to the gated
page.

## 3. What this PR changes

| Task | File | Change |
|------|------|--------|
| 1 | `functions/fn/do_page_action.js` | the four keys leave `ACTION_MAP` and become `TIER_HANDOFF` — the endpoint queues **nothing** and answers `{status:'handoff', mode:'speak', navigated:false, instruction, membership_action_key:'goto_membership'}` |
| 1 | `functions/fn/do_page_action.js` | **backstop**: `refusesTierNavigation()` refuses *any* navigate whose target matches `TIER_PATH_RE`, whatever key produced it — a four-key list would be re-openable by a one-line map edit |
| 1 | `js/perch/command-channel.js` | **consumer half**: `isTierPath()` refuses a tier navigate before `host.go`, so a command queued by an older deployment cannot navigate a newer browser |
| 2 | `functions/fn/get_page_actions.js` | the four keys are removed from `KEYS`; `goto_membership` stays |
| 4 | `test/perch-tier-key-handoff.test.mjs` | 28 tests, §1–§5 |
| 5 | `test/preview/verify-tier-key-handoff.mjs` | Preview verifier |

**Nothing else moved.** No booking write path, no `tier-auth.js`, no CSP, no
`.github/workflows`, no secret read.

### The handoff payload

```json
{
  "status": "handoff",
  "mode": "speak",
  "action_key": "goto_gold",
  "navigated": false,
  "tier": "gold",
  "tier_label": "Gold",
  "tier_tagline": "The Playbook for Your First Move Into Real Estate.",
  "instruction": "Do not navigate. The Gold pages are members-only, behind a password the caller does not have, and opening one would end this call. Describe Gold out loud from the membership knowledge base, then offer to show the public membership overview — call goto_membership only if the caller says yes.",
  "membership_action_key": "goto_membership"
}
```

`navigated:false` is stated explicitly because the failure being replaced was an
agent that believed the page had moved. The taglines are the KB's own
(`Donovan_Legal_KB.md` §Membership levels), so Paula reads back the firm's
language. Every field is static public marketing copy — no secret, no caller data.

## 4. Why the tier keys are still *answered* after being unadvertised

Paula's enum lives in the **Retell tool config**, edited in David's dashboard, not
in this repo (ADAM key audit, task 6). Removing a key from `get_page_actions`
stops it being *offered*; it does not stop a config that has not caught up from
*sending* it. `do_page_action` therefore keeps answering all four — with the
handoff — so a stale config is harmless rather than lethal.

> ### DAVID — dashboard task (not code, cannot be done from this repo)
> Update **Paula's Retell prompt** so she *speaks* the tier and points to
> membership instead of calling the navigation tool at all, and drop
> `goto_gold` / `goto_platinum` / `goto_diamond` / `goto_reserve` from the tool
> enum. Until then this PR's handoff branch is what keeps the stale enum safe.

## 5. Task 3 — a real member still reaches the tier pages

The change is entirely on the **agent-driven** path. The pages themselves were
not touched:

* `functions/_lib/tier-auth.js` and the four `functions/<tier>/_middleware.js`
  files are **not in the diff** (`git diff --stat` shows it).
* swap-policy's `tier-basic-auth` exclusion is **unchanged** — asserted in
  §4 of the test file — so a member clicking a tier link still gets a full
  document navigation, which is what raises the browser's credential prompt.
* The Preview verifier probes all four tier roots unauthenticated and requires a
  `401` + `WWW-Authenticate: Basic` (or `503`, the fail-closed answer when a
  tier's credentials are unset for that environment). **No credential is ever
  sent or read** — this order forbids entering or reading a secret.

## 6. The broken control

28/28 green proves nothing on its own — a relay that queued nothing at all would
pass §1 just as happily. So the same assertions were run against `origin/main`'s
**unfixed** copies of the three files:

```
FAIL-on-main   §1 goto_gold queues NOTHING :: status was "done"
FAIL-on-main   §1 goto_platinum queues NOTHING :: status was "done"
FAIL-on-main   §1 goto_diamond queues NOTHING :: status was "done"
FAIL-on-main   §1 goto_reserve queues NOTHING :: status was "done"
FAIL-on-main   §2 the four keys are unadvertised :: still advertised: goto_gold, goto_platinum, goto_diamond, goto_reserve
FAIL-on-main   §3 navigate /gold/ does not call host.go :: host.go was called with ["/gold/"] → location.assign → dead call
FAIL-on-main   §3 navigate /platinum/ … ["/platinum/"]
FAIL-on-main   §3 navigate /diamond/ … ["/diamond/"]
FAIL-on-main   §3 navigate /reserve/ … ["/reserve/"]

9/9 assertions FAIL on main — a control that distinguishes the trees.
```

The in-tree equivalents are §3's `THE CONTROL` (an ordinary navigate must still
reach `host.go`) and §5 (every other key still queues), which together fail if
the fix is implemented by breaking navigation.

## 7. What the Preview can and cannot prove

**Can** (`test/preview/verify-tier-key-handoff.mjs`, no writes, no secrets):

* the four tier roots still answer `401`/`503` unauthenticated — the members'
  own door is intact;
* the **deployed** `js/perch/command-channel.js`, imported from the Preview and
  driven in the browser, refuses `navigate /gold/` and still performs
  `navigate /contact.html` — the deployed bytes, not the local ones
  ([[feedback_prove_code_ships_by_scanning_the_binary]]);
* the **deployed** `js/perch/swap-policy.js` still excludes the tier paths as
  `tier-basic-auth`;
* `/engagement` (the handoff destination) and the ordinary nav destinations
  answer 200;
* `/fn/do_page_action` and `/fn/get_page_actions` answer `401` unauthenticated.

**Cannot**, and this is stated rather than papered over:

* the **authenticated** tool responses. Reading them requires
  `PERCH_TOOL_SECRET`, and this order forbids entering or reading a secret. The
  handoff body and the advertised list are held in CI instead, against the real
  handlers (§1, §2).
* a **live Retell call**. It needs a Turnstile solve, which refuses automation by
  design ([[feedback_turnstile_not_agent_verifiable]]). The one thing a call
  would add — that Paula's *enum* no longer contains the keys — is David's
  dashboard task above, not something this repo can change or observe.

### The Preview result — `https://a2eef1e9.donovan-site.pages.dev`, 29/29 GO

```
1.<tier>       /gold|platinum|diamond|reserve/ → HTTP 401
               WWW-Authenticate: Basic realm="Donovan Legal - <Tier> Members"   ← Task 3
2.<tier>       the DEPLOYED channel refuses navigate /<tier>/ — host.go calls: [] · refused: tier_basic_auth
2.control      an ordinary navigate STILL reaches host.go — ["/contact.html"]
2.control-book /book still navigates — ["/book.html"]
3.<tier>       the DEPLOYED swap-policy still excludes /<tier>/ as tier-basic-auth
3.control      /engagement.html and /contact.html are still interceptable (null)
4.<path>       /engagement /contact /book /real-estate /home /tools → 200, real bytes
5.<fn>         /fn/do_page_action and /fn/get_page_actions → 401 unauthenticated (nothing queued)
```

Evidence: `test/preview/tier-key-handoff-evidence.json`. The tier roots answered
**401 with a live Basic challenge**, not 503 — so the members' credentials are
configured on Preview and the door a real member walks through is demonstrably
still there and still prompting. Nothing was written.

## 8. The rebase onto PR #99 — `ORDER SHELDON-PERCH-TIER-KEY-REBASE`

PR #99 (`SHELDON-PERCH-CLEANUP-ROUTING-KEYS`) merged to `main` as `ed358ac` while
this PR was open, and it edits the same two tables this PR edits. GitHub reported
`mergeable_state: dirty`. Rebased onto `ed358ac`; two files conflicted and both
sides survive.

### The two changes are orthogonal — they only *looked* like one conflict

#99 widened what Paula can discover. This PR narrows it by four keys. The lists
overlap, the intent does not, so neither edit is a revert of the other.

| File | Region | Resolution |
| --- | --- | --- |
| `get_page_actions.js` | `KEYS` | git auto-merged: #99's `scroll_to`, `highlight`, `booking_prefill`, `booking_show_date`, `booking_select_slot`, `booking_select_type` all kept; the four tier keys removed; `goto_membership` kept |
| `get_page_actions.js` | header comment | hand-merged — **both** facts kept: #99's `GET` answers **404** (not 405) correction, and this PR's unadvertised-tier note |
| `do_page_action.js` | `ACTION_MAP` tier rows | auto-merged to this PR's side: the four rows replaced by the do-not-re-add comment |
| `do_page_action.js` | exports | hand-merged — `export { ACTION_MAP, PARAMETERIZED_KEYS }` **once**. This PR's separate `export { ACTION_MAP }` was dropped as a duplicate declaration; its reason (CI runs `excludeReason()` over the map) was folded into the surviving export's comment |
| `do_page_action.js` | dispatch branches | hand-merged — **both** branches, in sequence: #99's `scroll_to`/`highlight`, then this PR's `TIER_HANDOFF` lookup, both still ahead of the `ACTION_MAP` lookup |

`TIER_PATH_RE`, `TIER_HANDOFF`, `refusesTierNavigation`, `tierFromPath`,
`tierHandoff` and `MEMBERSHIP_ACTION_KEY` are new names #99 never touched, so they
rebased clean. `command-channel.js` did not conflict — #99 does not touch it.

Untouched, per the order: the booking write path, `tier-auth.js`, the tier
middlewares, the CSP, and everything under `.github/workflows`.

### The both-directions check still balances — 37 = 37

`test/page-action.test.mjs` asserts discovery and relay agree in **both**
directions, including on *size*. Both sides shed the same four keys, so it still
balances at the smaller number:

```
advertised (KEYS)              = 37
dispatched (ACTION_MAP 30 + PARAMETERIZED_KEYS 7) = 37
```

The four tier keys are on **neither** list, and that is deliberate: they are
*answered* by `TIER_HANDOFF` without being *advertised*. That is the one
asymmetry #99's rule tolerates, because it points the safe way —
served-but-unadvertised is a refusal, advertised-but-unserved is a dead tool call
([[feedback_unadvertised_key_still_arrives]]). Putting them on
`PARAMETERIZED_KEYS` to "balance the lists" would make CI demand that
`get_page_actions` publish them again, which is the defect this PR exists to fix.

### Post-rebase evidence

- Full local suite: **910 tests, 909 pass, 0 fail, 1 skip** (the skip is the
  pre-existing `CHECK_DEPLOY_CONFIG` Clio gate, which needs a secret this order
  forbids reading).
- `test/perch-tier-key-handoff.test.mjs` + `test/page-action.test.mjs` together:
  **60/60 pass**, including *THE OTHER DIRECTION* and *every advertised navigation
  key still resolves to a queueable action*.
- Preview `a2eef1e9`: **29/29 GO**, byte-identical results to the pre-rebase run —
  only the `base` URL changed in the evidence file.
- All 9 PR checks green; `mergeable: MERGEABLE` (no longer `CONFLICTING`).

## 9. Verdict

Not merged. Zane gates, David merges.
