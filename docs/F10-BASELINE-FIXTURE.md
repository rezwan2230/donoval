# The F-10 baseline fixture — how a baseline change is made

**Order ADAM-DEPLOY-GATE-NETWORK-R1 · issue #152**

`test/perch-frame-headers.test.mjs` is a differential test. It proves that with the
Perch router **off**, `donovan-legal-site/functions/_middleware.js` emits response
headers byte-identical to the middleware as it shipped before #59 — the state called
**F-10**. It proves this by importing the F-10 middleware itself and driving it
through the same harness, so the claim is measured against real code rather than
against a hand-written expected header block.

The F-10 bytes are committed at **`test/fixtures/f10-middleware.baseline.js`**.

This document exists because **a fixture that nobody knows how to regenerate becomes
a reason to delete the test.** The next person who legitimately needs the baseline to
move should find a procedure here, not a puzzle.

---

## 1. Read this before you change anything

> A differential baseline may not follow the code under test.

That sentence is the whole reason the pin exists. The failure it prevents already
happened once, and it is worth understanding before touching either constant.

The test first shipped reading `origin/main:_middleware.js`. That was true while #59
was a branch and became false the instant #59 merged — `origin/main` then **was** the
#59 middleware, so "before" and "after" were the same code. The `notDeepEqual` in the
CONTROL test went false, its `x-frame-options === undefined` assertion went false, and
the suite reddened on main and on every branch cut from it, taking CI and every
Preview deploy down with it.

So:

- ✅ Change the baseline because an order decided that "unchanged" now means something
  different, and says so in its report.
- ⛔ Never change the baseline to make a red suite green. A red suite here means the
  router-off headers **drifted**, which is the defect the test was written to catch.
  Regenerating the fixture in that situation deletes the finding and reports success.

If you are unsure which situation you are in: the fixture is not the thing to change.

---

## 2. What the two constants mean

In `test/perch-frame-headers.test.mjs`:

| Constant | Value | Role |
|---|---|---|
| `BASELINE_COMMIT` | `f833826217d6449b7a812476304029abed828b8c` | **Provenance.** Which commit these bytes came from. Since #152 nothing resolves it at test time; it is what lets a reviewer audit the fixture's origin. |
| `BASELINE_BLOB` | `146284f47271013fef2e12c52bbd614f36abe990` | **The live check.** The content address the fixture must still hash to on every run. |

`f833826` is main's tip immediately before #59 (PR #85) merged, i.e. the last
pre-frame-headers middleware that ever served production.

They are changed **together or not at all**. `BASELINE_COMMIT` without
`BASELINE_BLOB` is an unverifiable claim; `BASELINE_BLOB` without `BASELINE_COMMIT`
is a hash with no story.

---

## 3. The procedure

From the repo root, with `<newSHA>` the commit whose middleware is the new baseline:

```bash
# 1. Overwrite the fixture with the new baseline's bytes.
#    cat-file emits the raw blob — no autocrlf smudge, unlike a checkout.
git cat-file blob <newSHA>:donovan-legal-site/functions/_middleware.js \
  > test/fixtures/f10-middleware.baseline.js

# 2. Stage it, so .gitattributes `-text` applies and the index holds the raw bytes.
git add test/fixtures/f10-middleware.baseline.js

# 3. Read the new blob id. This is the value for BASELINE_BLOB.
git rev-parse :test/fixtures/f10-middleware.baseline.js

# 4. Sanity-check the bytes on disk match the object git stored. These must agree;
#    if they do not, `-text` is not applying and step 6 will fail on Windows only.
node -e "const{readFileSync}=require('fs'),{createHash}=require('crypto');\
const b=readFileSync('test/fixtures/f10-middleware.baseline.js');\
console.log(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'));"
```

Then, in `test/perch-frame-headers.test.mjs`:

5. Set `BASELINE_COMMIT` to `<newSHA>` and `BASELINE_BLOB` to step 3's output. Update
   the `F-10` prose above them so the comment still describes what the commit *is* —
   a stale comment on a fresh pin is how the next reader gets misled.

6. Run the suite:

   ```bash
   npm test                                    # whole deploy-gating suite
   node --test test/perch-frame-headers.test.mjs   # just this file
   ```

7. **Re-prove the control.** This is not optional — see §4.

---

## 4. Re-proving the control

A fixture that no test can break is a rubber stamp, not a control. After any baseline
change, prove the assertion still bites by mutating the middleware away from the
fixture and confirming the suite goes red:

```bash
# Commit your real work FIRST — step 3 discards uncommitted changes to this file.
git add -A && git commit -m "wip"

# 1. Mutate the live middleware away from the baseline (any observable header change).
#    e.g. in donovan-legal-site/functions/_middleware.js, change
#      "base-uri 'self'"  ->  "base-uri 'self' https://example.invalid"

# 2. Confirm the mutation actually landed — a mutation that silently failed to apply
#    reports a pass, and a pass is exactly what you must not accept here.
git diff --stat donovan-legal-site/functions/_middleware.js

# 3. The suite MUST fail, naming the router-off drift.
node --test test/perch-frame-headers.test.mjs   # expect: not ok

# 4. Revert.
git checkout -- donovan-legal-site/functions/_middleware.js
```

If step 3 passes, stop. Either the mutation did not apply, or the fixture is no longer
being compared against anything, and in both cases the deploy gate is inert.

---

## 5. Constraints that are easy to break by accident

| Constraint | Why | What breaks if ignored |
|---|---|---|
| The fixture carries **no header comment** | It must stay byte-identical to the blob it is pinned to | The blob check fails; the fixture cannot be verified at all |
| It is pinned **`-text`** in `.gitattributes` | The hash is over raw bytes and this repo runs `core.autocrlf=true` | A Windows checkout rewrites 220 LF to CRLF: red locally, green in CI (which checks out LF on Linux) |
| It lives under **`test/`**, never under `donovan-legal-site/` | `donovan-legal-site` **is** the Pages deploy root and `wrangler pages deploy` has no `--exclude` | A second middleware copy anywhere under it gets published and compiled into the Worker |
| It is named `*.baseline.js`, not `*.test.mjs` | `npm test` is `node --test "test/**/*.test.mjs"` | A `.test.mjs` name would make the runner try to execute the fixture |
| The test must run **no git and no network** | `deploy-pages.yml`'s `production` job declares `needs: [test, guard]` | A network blip or a GC'd SHA reds a production deploy for a reason unrelated to the site |

---

## 6. Why the read moved off the network (#152)

Before #152 the baseline was read through git at test time:

```js
git(['rev-parse', `${BASELINE_COMMIT}:${MIDDLEWARE}`]);          // usually local
git(['fetch', '--depth=1', '--no-tags', 'origin', BASELINE_COMMIT]); // …but not in CI
```

`.github/workflows/deploy-pages.yml` checks out with a bare `actions/checkout@v4` —
depth 1, no `fetch-depth` — so `f833826` is **not** in the CI clone, and the fetch ran
on every run. Since `npm test` is the `test` job and `production` declares
`needs: [test, guard]`, three things unrelated to the site could red a production
deploy: a transient network failure, a GitHub outage, or garbage collection of an
unreferenced SHA.

The assertion deliberately fails rather than skips when it cannot read the baseline —
a green run that never measured the byte-identity claim is the same class of defect as
the moving baseline. That correctness is exactly what made the network dependency
load-bearing.

**Nothing was weakened to remove it.** The check got harder to fool. The test now
recomputes the fixture's git blob SHA-1 and compares it to `BASELINE_BLOB`. Because a
blob id is a content address, this proves the bytes *are* the F-10 bytes irrespective
of path, filename, or peer — whereas `git rev-parse <commit>:<path>` proved only that
some commit still names that blob, then trusted git to return matching content.

The fixture is not a copy of that blob; it is the same git object:

```console
$ git rev-parse :test/fixtures/f10-middleware.baseline.js
146284f47271013fef2e12c52bbd614f36abe990
```

The test stays in the deploy-gating suite. It is behavioural — it drives `onRequest`
and asserts on what the Worker puts on the response — and that is where it belongs.
What it no longer does is make a production deploy depend on the network being up.
