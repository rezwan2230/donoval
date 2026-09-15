# Deploy-drift check (ADAM-DEPLOY-DRIFT-R3, hardened in R4)

Answers one question without anybody opening the Actions tab: **is the site
visitors are loading built from the same commit as `main`?**

## Why guessing does not work

Production for the `donovan-site` Pages project ships **only** on a manual
`workflow_dispatch` of `deploy-pages.yml` on `main` with
`confirm=deploy-production`. Any other run of that workflow — including a plain
push to `main` — still finishes **green**, because the `production` job's `if:`
does not match and GitHub records that job as **skipped**.

So "the newest successful `deploy-pages` run on main" is a different question
from "the newest production deploy". Reading it by eye is how a handoff document
came to assert the last deploy was run 258 when it was in fact run **276**, which
sent a full session chasing a fix that was already live.

The discriminator is the **production job's own conclusion**, which the Actions
API does expose:

```
GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs
  -> jobs[] { name, status, conclusion }
```

A real deploy is `conclusion: success`. A run that skipped the deploy is
`conclusion: skipped`. Verified live on 2026-08-04:

| Run | Event | Overall | `Deploy PRODUCTION (manual)` | Deployed? |
|---|---|---|---|---|
| 276 | `workflow_dispatch` | success | **success** | yes — `73852d0` |
| 275 | `workflow_dispatch` | success | success | yes — `73852d0` |
| 273 | `push` | success | **skipped** | **no** |

Run 273 is the trap in one line: a green run on `main` that deployed nothing.

## What counts as drift

Only commits touching `donovan-legal-site/` change what a visitor loads. Commits
to `docs/`, `test/`, `infra/` or `bin/` can sit unshipped indefinitely with no
visible difference, so they are reported but do not fail the check.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | `main` and production match, or the only unshipped commits are non-site |
| `1` | Site-affecting drift — visitors are on an older `donovan-legal-site` |
| `2` | The check could not be completed (no token, no deploy found, truncated comparison, **truncated per-commit file list**). Fails closed: an unanswerable check is never reported as "no drift". |

## The two truncation frontiers

Both are places where the GitHub API hands back a **partial answer that looks
like a complete one**. Both route to exit `2`.

**1. The comparison.** `GET /repos/{o}/{r}/compare/{base}...{head}` caps at 250
commits. The body does report `total_commits`, so the shortfall is detectable by
comparing it against `commits.length`.

**2. The per-commit file list.** `GET /repos/{o}/{r}/commits/{sha}` caps `files[]`
at **300 entries and says nothing about it**. Measured 2026-08-04 against the
Linux initial-import commit `1da177e` (~17,000 files):

| Field | Value |
|---|---|
| `files.length` | `300` — exactly the cap |
| `stats.total` | `6718755` — **lines**, not files. Not a file count. |
| `total_files` / `truncated` / `incomplete` | **absent — no such key exists** |
| `Link` response **header** | `<…page=2>; rel="next", <…page=10>; rel="last"` |

So the body carries no signal at all; the signal lives in the `Link` **header**,
which the client previously discarded by calling `res.json()` and nothing else.
Left unguarded, one commit touching more than 300 files whose
`donovan-legal-site/` paths sort past the cutoff is classified **non-site** — the
report says "none that visitors can see" and exits `0`. That is precisely the
false all-clear this tool exists to prevent.

The check now guards twice, and **either one alone fails closed**:

1. `files.length >= 300` — the boundary itself. Transport-independent.
2. `Link: rel="next"` — explicit, and survives GitHub moving the cap.

Guard 1 is `>=`, not `>`, on purpose: a commit of *exactly* 300 files is
indistinguishable from a truncated one by count alone, so it resolves to "cannot
tell" (exit `2`) rather than to "clean" (exit `0`). A false `UNKNOWN` costs one
manual look; a false `NONE` is the bug.

Because the two guards fire **independently**, the warning is assembled the same
way (ADAM-TEST-SCOPE-R1, Task 4). Guard 2 can fire well below the boundary — that
is the whole point of keeping it, it survives GitHub moving the cap — and the
warning previously stated the real count and then asserted it was "at or above
the 300-file per-commit API cap" in the same sentence:

```text
Commit bbbbbbb returned 5 file(s), at or above the 300-file per-commit API cap and
the Link header advertises another page.
```

The count is now stated once as a fact, and the cap clause sits behind the
condition that makes it true:

| Which guard fired | What the warning says |
|---|---|
| Count only (`>= 300`) | `returned 300 file(s); that is at or above the 300-file per-commit API cap.` |
| Header only (any count) | `returned 5 file(s); the Link header advertises another page.` |
| Both | `returned 300 file(s); that is at or above the 300-file per-commit API cap, and the Link header advertises another page.` |

A warning that is visibly wrong about the number it just printed is a warning an
operator learns to skip — and this one is the last thing standing between them
and a false all-clear.

## Known limitation — `main` BEHIND production reads as clean, exit `0`

**Status: not guarded. Recorded here as a known limitation.** (ADAM-TEST-SCOPE-R1,
Task 5.)

The check asks one directional question: *what is on `main` that production has
not shipped?* It does that with
`GET /repos/{o}/{r}/compare/{deployedSha}...{mainHead}`. If `main` is rewound
**below** the deployed SHA — a force-push, or a revert of the merge commit that
shipped — then `mainHead` is an **ancestor** of `deployedSha`, and GitHub answers:

| Field | Value |
|---|---|
| `status` | `behind` |
| `commits` | `[]` — empty |
| `total_commits` | `0` |

Nothing is truncated, so no warning fires. The two SHAs differ, so `drift` is
`true`. There are no site-affecting commits, because there are no commits at all.
So the report lands in the `NON-SITE-ONLY` branch and prints:

```text
DEPLOY DRIFT: none that visitors can see (0 unshipped commit(s), all outside donovan-legal-site/).
```

…and **exits `0`**, over a state where production is *ahead* of `main` and the
next production deploy would **remove** shipped code from the live site.

**Why it is not guarded here.** `compare` does return `status: "behind"`, so the
fix is small — but the classification logic in `bin/check-deploy-drift.mjs` gated
clean in R4 and this order does not open it. Adding a fifth verdict also touches
the four-branch completeness assertion in `test/deploy-drift.test.mjs`, which is
deliberately written to red when a verdict is added without covering it.

**How to recognise it by eye until then.** A `NON-SITE-ONLY` verdict reporting
**zero** unshipped commits is only reachable in the behind direction. Every
genuine non-site drift lists at least one commit. Zero commits plus a drift
verdict means `main` moved backwards, not that production is stale.

The behaviour is measured, not assumed:
`test/deploy-drift.test.mjs` → *"deploy drift — KNOWN LIMITATION: main behind
production"* drives the real `checkDeployDrift` against a rewound-`main` fixture
and asserts exit `0`. That test asserts the **current** behaviour, not the
desired one. Whoever guards this direction will see it go red, which is the point
— it forces this section to be updated in the same change.

## Scope limit — read before trusting a green result

The check compares **git refs** via the GitHub API. It proves "the commit
production was built from" against "`main` HEAD". It does **not** fetch the site,
so it cannot see edge-level divergence — the apex host `donovan.law` is known to
serve different content from `www.donovan.law`. A green result means `main` and
the last production build agree; it does **not** mean both hostnames serve that
build.

**Every report prints this caveat**, on all four verdict branches (`NONE`,
`NON-SITE-ONLY`, `SITE-AFFECTING`, `UNKNOWN`) *and* on the top-level failure
path, in both text and `--json` output. In `--json` it is also its own
`scopeLimit` field. `test/deploy-drift.test.mjs` asserts all six.

Until R4 this claim was false: the top-level `catch` printed the caveat in
neither mode. The report an operator reads while already unsure was the one that
never mentioned no hostname had been checked.

## Run-retention horizon — what "no deploy found" actually means

The check finds the last production deploy by walking `workflow_dispatch` runs of
`deploy-pages.yml` newest-first. It paginates at 100 runs/page up to 5 pages
(**500 runs**); before R4 it took a single page of 50 and anything older was
invisible.

Three limits remain, and none of them can be fixed from inside this tool:

- **500 runs**, the pagination bound above.
- **1,000 results**, GitHub's hard cap on the workflow-runs listing regardless of
  paging.
- **90 days**, the default Actions run-retention window. A deploy older than
  retention is not in the API at all, at any page.

A deploy beyond any of these reads as *"no production deploy found"* → exit `2`,
never as "no drift". The warning states how many runs were listed and examined so
the horizon searched is on the face of the report rather than assumed.

## Running it by hand

```bash
GITHUB_TOKEN="$(gh auth token)" node bin/check-deploy-drift.mjs
GITHUB_TOKEN="$(gh auth token)" node bin/check-deploy-drift.mjs --json
```

## Scheduling caveat

GitHub runs `schedule` triggers **only from the default branch**. While
`.github/workflows/deploy-drift.yml` lives on a feature branch its cron is inert
— it begins firing once David merges it to `main`. `workflow_dispatch` works on
any branch.

## Which lane checks this doc — and why it is not the deploy lane

The block below is asserted byte-for-byte against the workflow file. That
assertion lives in **`hygiene/deploy-drift-record.test.mjs`**, run by
**`npm run test:hygiene`**, wired into **`.github/workflows/ci.yml` only**.

It used to live in `test/deploy-drift.test.mjs`, which `npm test` runs — and
`npm test` is the `test` job of `deploy-pages.yml`, whose `production` job
declares `needs: [test, guard]`. So editing the cron in `deploy-drift.yml`
without mirroring the edit into this file made **production undeployable over a
documentation mismatch**. A doc you cannot correct without a deploy window is a
worse doc, not a safer one.

So the assertion did not get weaker and it did not get deleted — it moved, and
picked up two mutation bites on the way (a one-character cron drift, and a fence
that closes early and silently truncates the record). It now gates **pull
requests**, which is where a docs mismatch is actually fixed.

| Lane | Command | Runs in | Gates |
|---|---|---|---|
| Behavioural | `npm test` | `ci.yml` **and** `deploy-pages.yml` | PRs **and** every production deploy |
| Repo hygiene / meta | `npm run test:hygiene` | `ci.yml` only | PRs only — **never** a deploy |

`hygiene/deploy-drift-record.test.mjs` asserts both halves of that split: that
`ci.yml` runs the hygiene lane, and that `deploy-pages.yml` does **not**. If the
step ever lands in the deploy workflow, that test reds.

**Related hazard, not addressed by this split.**
`test/perch-frame-headers.test.mjs` is behavioural — it proves the router-off
response headers are byte-identical to the F-10 baseline — so it correctly stays
in `npm test` and therefore in the deploy gate. But it reconstructs that baseline
from git history, and `actions/checkout@v4` clones at depth 1, so in CI it
performs a `git fetch` of the pinned SHA and **hard-fails** (deliberately, rather
than skipping) if that fetch cannot be made. That is a network dependency sitting
in front of a production deploy. It is the same hazard from the other direction —
a non-site condition able to block a deploy — and it is out of scope here because
the assertion itself *is* about what the site serves.

## The workflow

Recorded verbatim from `.github/workflows/deploy-drift.yml`.

````yaml
name: Deploy drift (scheduled)

# READ-ONLY. This workflow never deploys anything and never writes to the repo.
# It answers one question on a schedule so nobody has to open the Actions tab and
# guess: is the site visitors are loading built from the same commit as main?
#
# Production for `donovan-site` ships ONLY via a manual workflow_dispatch of
# deploy-pages.yml on main with confirm=deploy-production. Every other run of that
# workflow still goes GREEN with the `production` job recorded as *skipped*, so
# "newest green run on main" is not the same thing as "newest deploy". Reading it
# by eye is how a handoff came to assert run 258 when 276 was live.
#
# Exit codes from bin/check-deploy-drift.mjs:
#   0  main and production match, or the only unshipped commits are non-site
#   1  site-affecting drift — visitors are on an older donovan-legal-site
#   2  the check could not be completed (fails closed; never reports "no drift")
#
# NOTE ON SCHEDULING: GitHub only runs `schedule` triggers from the DEFAULT
# branch. While this file lives on a feature branch the cron is inert; it starts
# firing when David merges it to main. `workflow_dispatch` works on any branch.

on:
  schedule:
    # 13:17 UTC on weekdays — an odd minute to stay off the top-of-hour pileup.
    - cron: "17 13 * * 1-5"
  workflow_dispatch:

# Least privilege. `actions: read` is the one non-default scope required: the
# check reads workflow runs and their per-job conclusions. No write scopes.
permissions:
  contents: read
  actions: read

concurrency:
  group: deploy-drift
  cancel-in-progress: true

jobs:
  drift:
    name: Is production behind main?
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      # No `npm ci`: the check uses only Node builtins and global fetch, so it has
      # no dependency on the lockfile resolving.

      - name: Check deploy drift
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Deliberately NOT `set -e`: we want the report in the job summary even
          # when the check exits non-zero, then we re-raise its exit code.
          rc=0
          node bin/check-deploy-drift.mjs > drift.txt 2>&1 || rc=$?
          cat drift.txt
          {
            echo "## Deploy drift"
            echo
            echo '```text'
            cat drift.txt
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"
          if [ "$rc" -eq 1 ]; then
            echo "::error::Site-affecting deploy drift: production is behind main. See the job summary."
          elif [ "$rc" -ne 0 ]; then
            echo "::error::Deploy-drift check could not be completed (exit $rc). This is NOT a clean result."
          fi
          exit "$rc"
````
