# VERA — BRANCH ADJUDICATION

**Order:** VERA-BRANCH-ADJUDICATION-R1
**Repo:** `TicoAI/DonovanLegal`
**Adjudicated:** 2026-08-04, against a live `git ls-remote --heads origin` read
**`main` head at read time:** `73852d04a7bc18cb27badadd92047cd8f004f612`
**Worktree:** `DonovanLegal-wt-vera-adjudication`, branch `vera/branch-adjudication-r1` off `origin/main`

Agents do not merge. This document gates; David merges.

---

## 0. STOP CONDITION — RAISED

**`sheldon/booking-harden` cannot be landed as a merge. It is a rewrite.**

Its merge base with `main` is `ca79bd4` — *"feat: import live production source from GoDaddy cPanel (Jun 12 2026)"*, the repo's near-root import. The branch carries 71 commits from that base while `main` carries 68 along a different path. `git merge-tree --write-tree --name-only origin/main <head>` reports **conflicts in 148 files** — **38 add/add, 106 content, 4 modify/delete**.

> **CORRECTION — this number was published wrong.** The first version of this document (`e969cda`) recorded **452** conflicting files in this section, in the §3 row for the branch, and in the §6C residue block. **The true count is 148.** The 452 was a parse artifact: `git merge-tree --write-tree --name-only` prints the tree OID, then the conflicted paths, then a **blank line**, then its `Auto-merging` / `CONFLICT` message lines — and counting every line after the OID instead of stopping at the blank line added the 156 `Auto-merging` and 148 `CONFLICT` messages (304 lines) to the 148 real paths, giving 148 + 304 = 452. Re-derived and cross-checked against `grep -c '^CONFLICT'`, which returns **148**, matching the path count exactly.
>
> **The verdict does not move and the STOP stands.** The stop condition never rested on the size of the number. It rests on the merge base being `ca79bd4`, the near-root cPanel import: 148 conflicted files — 106 of them content conflicts inside files both sides edited independently across 71 and 68 commits — is a rewrite, not a merge. A number that is 3× too large in the direction the reader already expects is precisely the failure §2 exists to catch, which is why it is corrected here in place rather than quietly.

No merge of this branch is proposed anywhere in this document. Its verdict below rests on content that already shipped by other routes, not on landing it.

That is the only branch that trips the stop condition. Every other branch either merges clean or conflicts in a bounded, reviewable way (`jordan/members-gate-branding` 2 files, `zane/ci-pages-fix` 1 file, `sarah/perch-a41-cutover-qa` 5 files).

---

## 1. Corrections to the order's stated premises

The order carried four premises. Three hold. Two need correction, and one of them changes a verdict.

| Premise as stated | Finding |
|---|---|
| A live ref read returns 18 refs = 17 branches + main, not 19 | **CONFIRMED.** `git ls-remote --heads origin` returns exactly 18 lines. |
| `sheldon/clio-contact-mapping` no longer exists; any list naming it is stale | **CONFIRMED.** Absent from the live read. Its work landed in `main` at `81f31b4`, *"map the whole intake onto the Clio contact… (CLIO-CONTACT-MAPPING + R2) (#124)"*. |
| `jordan/perch-photo-paula` appears in no prior triage | **CONFIRMED** as to triage. But see the correction below — it is not unlanded work. |
| `adam/clio-scope-verifier-r2` holds the newest commits in the repo | **CORRECTED.** It does not. Its head is dated 2026-08-03 16:15:40 -0400. Three refs are newer: `sheldon/booking-safety` (19:26:49), `zane/paul-content-lane` (18:41:56), and `main` itself (18:35:33). It holds the newest commits *on an ADAM branch*, not in the repo. |
| `jordan/perch-photo-paula` — implied unlanded | **CORRECTED, and this changes the verdict.** Its *product code* is already on `main`, byte-identical. Only its Preview verifier and evidence are branch-only. Details in §4. |

The order's premise that `.agentos` is either "deliberately kept off main" **or** "stale snapshots" is a false choice. Both are true at once, of different things. See §5.

---

## 2. Method, and what counts as proof here

Every verdict below cites a blob, a file path, or a commit SHA. Three techniques, and three traps worth recording because each produced a wrong answer that was published before it was caught:

- **Reachability** — `git merge-base --is-ancestor <head> origin/main`. This is mechanical and not open to interpretation.
- **Blob identity** — comparing `git ls-tree <ref> -- <path>` object names between branch and `main`. Identical object name means byte-identical content; no reading required.
- **Behaviour** — for the two LAND verdicts, the branch's own suite was executed in an isolated detached worktree, not read.

> **The trap.** `git rev-parse origin/main:<absent-path>` does **not** fail cleanly on Windows Git Bash — it emits a mangled string to stdout and the `|| echo ABSENT` guard never fires. My first identity table for `jordan/perch-photo-paula` therefore reported four files as "differs from main" when they are in fact **absent from main entirely**. That is the opposite conclusion, and it would have sent a branch holding the only copy of eleven evidence artefacts to the delete list. Every identity claim in this document was re-derived with `git ls-tree`, which returns empty for an absent path and cannot be misread.

> **The second trap, and the one that survived into the published document.** `git merge-tree --write-tree --name-only` emits three sections in one stream: the tree OID, the conflicted paths, a **blank-line separator**, and then its `Auto-merging` / `CONFLICT` narration. The separator is the only thing marking where the path list ends. Counting every line after the OID silently folds 156 `Auto-merging` lines and 148 `CONFLICT` lines into the file list and reports **452** where the answer is **148** — see §0. It went unchallenged because `sheldon/booking-harden` was *expected* to conflict enormously, so an enormous number read as confirmation instead of as a result. A conflict count from this command must be taken from above the blank line and cross-checked against `grep -c '^CONFLICT'`; the two agree at 148.

> **The third trap — the same family as the second, and it also survived into the published document.** §6 computed a classification of the branch's **246 touched files** and found **15 absent from `main`**. That number is correct *for the question it answers*: of the paths the branch touched since `ca79bd4`, fifteen do not exist on `main` today. §7 Block C then reused that same 15 to answer a **different** question — *what does deleting this branch destroy?* — by restating it as "15 files branch-only." It is not. Eleven of the fifteen are absent from the **branch** as well: both sides deleted them since the merge base, so they are `D`/`D`, present in neither head. They appear in the touched set precisely *because* the branch deleted them. Only **four** are `M` on the branch against `D` on `main`, and those four are — exactly, with no remainder — the **4 modify/delete conflicts** §0 already reports. Corrected in §6 and §7 Block C below.
>
> This is the second trap's shape, not a new one: **a number that was true of one measurement, reused for a different question, and never re-derived against that question.** 452 was a real line count answering "how many lines did the command print"; 15 is a real file count answering "how many touched paths are missing from `main`". Both were then read as answers to something else.
>
> The prescription, because Block C's whole purpose is to answer *what does deleting this destroy*: a diff against a base cannot answer it, since a diff counts **deletions as touches**. Nor can a head-vs-head path listing, which here returns **5** — it counts a file whose blob is byte-identical to the merge base, and the merge base `ca79bd4` is an **ancestor of `main`**, so that content survives in `main`'s history regardless. The question is answered only at the **blob** level: a path is at risk iff its blob on the branch head appears nowhere reachable from `main`. Run that way the answer is **4**, and the four coincide exactly with the modify/delete conflicts — two independent derivations agreeing, which is the only reason to trust the number this time. Re-derived on the same basis, the other two Block C residues hold: `zane/paul-content-lane` = 1 (`ZANE-WRITE-PROBE.md`), and `zane/session-handoff` = **2** (`.agentos/ZANE_BOOT.md`, `.agentos/ZANE_HANDOFF.md`) — its head also carries 20 cPanel-era paths absent from `main`, but every one is blob-identical to `ca79bd4` and therefore not at risk.

**Confirmed** below means observed directly by one of the three techniques. **Inferred** means reasoned from confirmed observations. The two are separated in §7 and never mixed inside a verdict.

---

## 3. Task 1 — All 17 non-main branches, live

Reachability is from `main` @ `73852d04`. "Ahead/behind" are commit counts relative to that head.

| # | Branch | Head SHA | Reachable from `main` | Ahead | Behind | Merges clean | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `adam/clio-scope-verifier-r2` | `c820cee6cd7f64af6a8454f09b254ece426f0c9d` | no | 2 | 3 | yes | **PORT TO VANTAGE** |
| 2 | `jordan/members-gate-branding` | `08c985c413be65ad67210dabba15e526456a9374` | no | 2 | 60 | 2 files conflict | **DISPOSE** |
| 3 | `jordan/perch-novoice-book` | `3705715b911cd3385ae1f05d98d53b357b672393` | no | 3 | 9 | yes | **LAND** |
| 4 | `jordan/perch-photo-paula` | `63451fbeda3aa3f2b41573dda96d86c1e321d5bf` | no | 3 | 12 | yes | **PRESERVE AS DOC** |
| 5 | `perch-draft` | `ca79bd493da0b9e42de369da7690fc7a40e5fdf8` | **YES** | 0 | 68 | yes | **DISPOSE** |
| 6 | `preview-main-checkpoint` | `58387293f71d0b8bc66c1b97635f29794091309a` | **YES** | 0 | 33 | yes | **DISPOSE** |
| 7 | `sarah/perch-a41-cutover-qa` | `4c691231edb5298a9111d9eee982937b30462a1f` | no | 2 | 30 | 5 files conflict | **DISPOSE** |
| 8 | `sheldon/booking-harden` | `1aa58484bbbb9170483cee6f17b890cafe1b2966` | no | 71 | 68 | **148 files conflict** | **DISPOSE** (gated — §6C) |
| 9 | `sheldon/booking-safety` | `84adc05481b75113f3237c15c94212ed7e601ad3` | no | 1 | 0 | yes | **LAND** |
| 10 | `sheldon/perch-a25-spike` | `989cff48d289543ab7b48a8a5b20004a18f52f09` | no | 5 | 37 | yes | **PRESERVE AS DOC** |
| 11 | `v2` | `e2eb0b440825cb641538ff0815d1c1ef491a9cfd` | no | 7 | 3 | yes | **PRESERVE** (active lane — §4) |
| 12 | `zane/ci-all-branches` | `9c3230bdee7cacf8e0f26815fe931e4dd4bbfce6` | **YES** | 0 | 6 | yes | **DISPOSE** |
| 13 | `zane/ci-pages-fix` | `9484b945e7ce1496c998ff9c10304a9274298f6a` | no | 3 | 68 | 1 file conflicts | **DISPOSE** |
| 14 | `zane/handoff-0722` | `ad54ab7267417703df7e028d3fbb1407459550ad` | no | 3 | 67 | yes | **PRESERVE AS DOC** |
| 15 | `zane/handoff-perch-0722` | `63031ee3a74a04ef0b7e93ec6649163112ef5fea` | no | 3 | 62 | yes | **PRESERVE AS DOC** |
| 16 | `zane/paul-content-lane` | `24cc7260669167be453483027dddcbc391681bce` | no | 1 | 2 | yes | **DISPOSE** (gated — §6C) |
| 17 | `zane/session-handoff` | `4423c1ff489b5a400f922065e5f2e46f70af1fd2` | no | 4 | 68 | yes | **DISPOSE** (gated — §6C) |

Three branches are strict ancestors of `main` — zero commits ahead, nothing to lose: `perch-draft`, `preview-main-checkpoint`, `zane/ci-all-branches`.

One structural note: `perch-draft`'s head `ca79bd4` **is** `sheldon/booking-harden`'s merge base. `perch-draft` is the June 12 cPanel import point, which is why deleting it is free and why `booking-harden` conflicts so violently.

---

## 4. Tasks 2 and 3 — The four branches holding work absent from `main`

### 4.1 `adam/clio-scope-verifier-r2` → **PORT TO VANTAGE**

**Is it finished work or an abandoned spike? Finished work.** Not close.

Two unlanded commits:

| SHA | Date | Subject |
|---|---|---|
| `ccec1bad3680dc3db17fae28b60e0b30e1c25f48` | 2026-08-03 15:48 | `feat(clio): ADAM — bracket the Clio reconnect with a read-only scope verifier, on controls the app actually holds (R2)` |
| `c820cee6cd7f64af6a8454f09b254ece426f0c9d` | 2026-08-03 16:15 | `fix(clio): ADAM — contain the network, split the mint states, and name the contact outage (R3)` |

2,682 lines across four files, and **nothing under `donovan-legal-site/`** — it adds no production code:

- `test/preview/verify-clio-scope.mjs` (1,309 lines) — the instrument
- `test/clio-scope-verifier.test.mjs` (1,063 lines) — its suite
- `test/helpers/clio-scope-stub.mjs` (304 lines) — the recording stub
- `.gitignore` (+6) — ignores `*-evidence.json` so a live run cannot commit grant state

**The evidence that it is finished, not abandoned:**

1. **Its suite passes, completely.** Executed at `c820cee6` in an isolated detached worktree: **139 tests, 139 pass, 0 fail**, 71.9s. An abandoned spike does not carry 139 green assertions.
2. **It already absorbed a design defect and shipped the correction.** `verify-clio-scope.mjs:29-37` records that the R1 order named `GET /users/who_am_i` as the liveness control; that endpoint needs the Users scope, which the app does not request, so it answers 403 unconditionally and a verdict built on it reads a *healthy* grant as dead. The file cites the shipped adapter's own note at `donovan-legal-site/functions/booking/_lib/provider-clio.js:30` and the suite pins the fix: `test('users/who_am_i is never requested — it needs a scope this app does not hold')` at line 278. Iterating past a falsified premise is the signature of finished work.
3. **Its safety properties are asserted on recorded behaviour, not claimed in comments.** The suite drives the instrument as a child process against a recording stub and asserts on the requests that actually went out — off-host cursor refused (line 209), off-path cursor refused (line 231), redirect on mint refused (line 243), redirect on read refused (line 252), `redirect:'error'` asserted *"on what was passed, not on the source"* (line 728). The redaction check carries a **positive arm** — `test('POSITIVE ARM: the detector sees a sentinel when one is deliberately printed')` at line 303 — so the "no credential leaked" assertion is not vacuous.
4. **It imports its contract rather than retyping it.** `verify-clio-scope.mjs:194` imports `INTAKE_CUSTOM_FIELDS` from `donovan-legal-site/functions/booking/_lib/clio-custom-fields.js`, so the verifier cannot drift from what actually binds.
5. **It merges clean into `main` today.**

**Why LAND is nonetheless unavailable, and PORT is right.** Standing doctrine places the Clio integration's home in Vantage. Confirmed against `TicoAI/vantage` @ `origin/main`: Vantage owns the Clio provider abstraction at `server/lib/booking/provider-clio.js`, with `GET /api/v4/calendar_entries` (line 63) and `GET /api/v4/contacts` (line 79) both marked VERIFIED. Those are exactly the verifier's two controls. Vantage holds **no** scope verifier of any kind — the port is not duplicative.

**The port carries a real cost, and it should be named before David commits to it.** Vantage's Clio surface has no `custom_fields` and no `INTAKE_CUSTOM_FIELDS` contract — `git grep -in "custom_field|INTAKE_CUSTOM_FIELDS" origin/main -- server/lib/booking/` returns nothing. The verifier's two *controls* port directly; its *subject read* and the contract it imports at line 194 have no counterpart in Vantage and must be built or carried across. This is a port with a genuine gap in it, not a file move.

**Recommendation:** port to `TicoAI/vantage`. Keep the branch alive in DonovanLegal until the port lands — it is the only copy of 2,682 lines of passing, self-corrected work.

---

### 4.2 `jordan/perch-novoice-book` → **LAND**

**Confirmed: `novoice` returns zero hits anywhere on `main`.** `git grep -il novoice origin/main` returns nothing. The feature is entirely unlanded.

Three commits, all 2026-07-30:

| SHA | Subject |
|---|---|
| `488e564` | `feat(perch): every intake answer on the invite, and intake without a call` |
| `b5b9676` | `fix(perch): the book-intent listener has to run in the CAPTURE phase` |
| `3705715` | `test(perch): Preview verifier evidence, before/after, desktop + mobile` |

**Nothing on `main` supersedes it.** It is a follow-on to `perch-native-book`, which *is* on `main` (`test/perch-native-book.test.mjs`) — the branch extends that suite by 42 lines rather than replacing it. Branch-only content confirmed by `git ls-tree`:

- `test/perch-novoice-book.test.mjs` (908 lines) — absent from `main`
- `test/preview/verify-novoice-book.mjs` (603 lines) — absent from `main`
- `test/preview/novoice-book-{before,after}-evidence.json` — both absent from `main`
- **24 Preview screenshots** — all absent from `main`, covering before/after × cta/decline × desktop/mobile

The `before` screenshots are the ones worth noting: `novoice-before-decline-desktop-03-dead-end.png` and `novoice-before-cta-desktop-03-unqualified-calendar.png` capture the defect the branch fixes — a caller who declines the voice call hits a dead end. That is a fixture that reproduces the defect, not a screenshot of the happy path.

**Behaviour confirmed.** `node --test test/perch-novoice-book.test.mjs` at `3705715b`: **38 tests, 38 pass, 0 fail**, 28.5s. (First run errored `ERR_MODULE_NOT_FOUND: jsdom` in the fresh worktree — a missing dev dependency in a clean checkout, not a regression; `jsdom ^24.1.0` is declared at `package.json:16`. Installed, re-ran, green.)

**Merges clean into `main`.** Verdict: LAND.

---

### 4.3 `sheldon/perch-a25-spike` → **PRESERVE AS DOC**

**Confirmed: `main` has no `spike/` directory at all.** `git ls-tree -r origin/main -- spike` returns empty.

Branch-only (`git ls-tree`):

- `spike/SHELDON-PERCH-A25-SPIKE-MEMO.md` (273 lines) — the GO/NO-GO memo
- `spike/a25-evidence.json` (535 lines)
- `spike/verify-a25.mjs` (409 lines)
- `donovan-legal-site/js/spike/perch-swup-spike.js` (395 lines) and `js/spike/swup.umd.js`

**The spike's conclusion shipped; its evidence did not.** The memo's verdict is **"GO — conditional"** (line 12), with *"No NO-GO blocker was found"* (line 233). That GO was consumed. `main` carries the production implementation — `donovan-legal-site/js/perch-swup-router.js`, `js/vendor/swup.umd.js`, `test/perch-swup-router.test.mjs`, `docs/SHELDON-PERCH-A22-SWUP.md`.

And `main`'s own doc **cites this spike as its basis without containing it**:

- `docs/SHELDON-PERCH-A22-SWUP.md:4` — `**Depends:** … A2.5 spike (#55)`
- line 58 — *"A2.5 spike ran on Preview to earn the GO"*
- line 75 — *"Verified against a DEEP tier URL, never a root (spike C5/F3)"*
- line 141 — *"Spike F2 is closed for the formatter"*
- line 170 — table row *"Spike F2 — formatter re-attached on return | PASS"*

So `main` depends on findings labelled C5, F3 and F2 whose only record is `spike/SHELDON-PERCH-A25-SPIKE-MEMO.md` on this branch. Deleting the branch would leave `main` citing evidence that no longer exists anywhere.

The spike *code* (`js/spike/perch-swup-spike.js`) is superseded by `js/perch-swup-router.js` and has no further use. The memo and evidence are the load-bearing part.

**Verdict: PRESERVE AS DOC.** Preferably promoted — landing `spike/SHELDON-PERCH-A25-SPIKE-MEMO.md` and `spike/a25-evidence.json` onto `main` under `docs/` would let the branch go. The branch merges clean, so that is a small, safe PR. Until then, do not delete.

---

### 4.4 `jordan/perch-photo-paula` → **PRESERVE AS DOC**

**This is the verdict the order's framing would have gotten wrong, and it is the one my own first pass got wrong too.**

The product code is **already on `main`, byte-identical**. Blob-identity check, branch vs `main`:

| Path | Status |
|---|---|
| `donovan-legal-site/img/Paula.jpg` | identical on `main` |
| `donovan-legal-site/js/perch/brand.js` | identical on `main` |
| `donovan-legal-site/js/perch/chrome.js` | identical on `main` |
| `donovan-legal-site/css/perch-layer.css` | identical on `main` |
| `donovan-legal-site/js/donovan-widget.js` | identical on `main` |
| `donovan-legal-site/perch.html` | identical on `main` |
| `test/perch-paula-canonical.test.mjs` | identical on `main` |
| `donovan-legal-site/js/perch/qualifier.js` | differs — `main` advanced further |

The one differing file still **contains** the branch's change: `main:donovan-legal-site/js/perch/qualifier.js:21` has `import { PAULA_FACE } from './brand.js'`, line 238 has `emb.src = PAULA_FACE`, line 244 has `emb.alt = 'Paula, your Donovan Legal concierge'` — the exact hunk. `main` simply carries later work in the same file. The canonical asset constant is defined at `main:donovan-legal-site/js/perch/brand.js:48`.

**But eleven artefacts exist only on this branch:**

- `test/preview/verify-photo-paula.mjs` (364 lines) — absent from `main`
- `test/preview/photo-paula-evidence/evidence.json` (659 lines) — absent from `main`
- 9 PNGs under `test/preview/photo-paula-evidence/` — all absent from `main`

The verifier is not redundant with the landed unit test. Its own header states why (lines 14-28): `test/perch-paula-canonical.test.mjs` proves the DOM *names* the right asset and that both stylesheets declare `object-fit: cover` — neither of which is the claim. Two things need a real browser against a live deployment: that the photograph **decoded** (`naturalWidth > 0`, because a 404 or truncated JPEG yields an `<img>` that is present, styled, sized — and blank), and that the **crop** actually frames her face at 92px and 30px. It also records that the old and new assets are both 512×512, so dimensions cannot tell them apart, and hashes the bytes the edge served instead.

That reasoning is sound and the artefact is the only copy of it. Landing the verifier would be consistent with `main`'s conventions — `test/preview/verify-native-book.mjs` and `test/preview/verify-qualifier-booking.mjs` are both already there.

**Verdict: PRESERVE AS DOC**, with the same note as §4.3 — landing `verify-photo-paula.mjs` plus its evidence directory would free the branch. Do **not** merge the branch wholesale: that would revert `main`'s later `qualifier.js` work.

---

### 4.5 `v2` — **PRESERVE (active lane)**

Recorded here because the order's four-verdict vocabulary does not fit it and forcing a fit would be wrong.

`v2` is a **live lab lane**, not a stale branch: head `e2eb0b44` dated 2026-08-03 15:10, only 3 behind `main`, and it carries `8f81c56 Merge branch 'main' into v2 (ADAM-V2-CATCHUP)` — it is actively kept current. It adds `LAB-README.md`, `functions/_lib/lab-channel.js`, `functions/_lib/perch-kv.js`, and holds work from two personas (`ADAM-V2-PREVIEW-LAB`, `ADAM-V2-KVSCOPE`, `SHELDON-V2-AGENT-FAILCLOSED` via #125).

It is deliberately isolated from production state by design. LAND would collapse the isolation that is its purpose; DISPOSE would destroy current work. **Keep as-is.** Not on any delete list.

---

## 5. Task 4 — The three `zane` branches and `.agentos`

**The question as posed is a false choice. Both answers are true, of different things.**

### Confirmed facts

- `.agentos` does **not** exist on `main`: `git ls-tree -r --name-only origin/main -- .agentos` returns empty (0 paths).
- `.agentos` is **not** gitignored — not on `main` (`main:.gitignore` is five lines: `node_modules/`, `.wrangler/`, `*.env`, `.dev.vars`, `.DS_Store`) and not on any of the three branches.
- All commits on all three branches are authored `David Pierce`, dated 2026-07-21 → 2026-07-22.

### The mechanism is deliberate — `.agentos` is branch-addressed agent memory

`zane/handoff-0722:.agentos/SESSION_BOOT.md` is a boot prompt for the next session, and its STEP 1 reads:

> Using the GitHub connector, read these two files verbatim:
> 1. `TicoAI/DonovanLegal` @ branch `zane/handoff-0722` → `.agentos/ZANE_HANDOFF.md` (master ledger)
> 2. `TicoAI/vantage` @ branch `zane/handoff-0722` → `.agentos/ZANE_HANDOFF.md` (Vantage plan)

**The branch name is the address.** The design reads the ledger at a named branch ref, in two repositories, by identical path. That is not an accident of a branch never being merged — a merge to `main` would break the addressing scheme it was built on. The same file's STEP 3 records *"`.github/workflows/*` are Human-Only"* and *"You gate, David merges"*, which is the same instinct: some paths are deliberately kept out of the ordinary merge flow.

So: **`.agentos` was deliberately kept off `main` as agent-local memory.** Confirmed from the file that defines how it is consumed.

### The snapshots are nonetheless stale — and the ledgers say so themselves

Being deliberate does not make them current. `SESSION_BOOT.md` STEP 2 is titled *"Reconcile against live truth (trust nothing stale)"* — the design assumes the ledger decays and must be re-checked. It has decayed. Spot-checked against `main` today:

| Board item (as at 2026-07-22) | State on `main` today |
|---|---|
| D-C — Paula page-control broken | `donovan-legal-site/js/perch/page-control.js` ships |
| D-D — member tier 503 + Members dropdown | `css/members-gate.css` + `js/members-gate.js` ship, restyled twice since |
| D-G — rename write-path header to `x-write-secret` | Done: `functions/booking/_lib/vantage-lead.js:10`, `:36` |
| V-A — rotate `ADMIN_SECRET` | Ledger itself marks it COMPLETE at `ad54ab7` |
| D-E — delete orphaned `/fn/take_message` | **Not done** — `functions/fn/take_message.js` still on `main` |

Note the last row. One board item is genuinely still open, which is a further reason not to destroy the ledgers before their contents are transcribed somewhere durable.

### Per-branch verdicts

| Branch | Content | Verdict |
|---|---|---|
| `zane/handoff-0722` | `.agentos/ZANE_HANDOFF.md` (blob `9414c63c`, 190 lines) + `SESSION_BOOT.md` (46 lines) | **PRESERVE AS DOC** |
| `zane/handoff-perch-0722` | `.agentos/ZANE_HANDOFF_PERCH.md` (80 lines) + `donovan-perch-fix-tracker.html` (143 lines) | **PRESERVE AS DOC** |
| `zane/session-handoff` | `.agentos/ZANE_BOOT.md` (29) + `ZANE_HANDOFF.md` (blob `74f70c91`, 138 lines) | **DISPOSE** (gated — §6C) |

**`zane/session-handoff` is superseded by its own successor, in writing.** The last line of `zane/handoff-0722:.agentos/SESSION_BOOT.md` reads:

> *(Generated by Zane 2026-07-22. Supersedes branch `zane/session-handoff`.)*

That is an explicit authored disposition naming the branch, not an inference from a branch name or a commit message. Note the two `ZANE_HANDOFF.md` blobs are **different** (`74f70c91` vs `9414c63c`), so this is supersession, not duplication — which is why it is gated in §6C rather than listed as mechanically safe.

`zane/handoff-perch-0722` is preserved because it is the only copy of the F1–F12 Perch punch-down board, and it carries a live infrastructure warning worth not losing: *"VANTAGE: DO NOT DEPLOY… Deploying without provisioning `READ_SECRET` + `WRITE_SECRET`… would 503 every write → break lead capture."*

**Recommendation:** transcribe the two preserved ledgers into `docs/` on `main` (or into project memory), then dispose of all three. Until that transcription exists, deleting them destroys the only record of an open item (D-E) and a standing deploy hazard.

---

## 6. Task 5 — Verdicts for the remaining branches, including `sheldon/booking-harden`

### `sheldon/booking-harden` → **DISPOSE** (gated)

**The order describes it as carrying "a stale deploy blocker note about `TURNSTILE_SECRET_KEY`". The note is real and it is stale — but it is not branch-unique, and that changes what deleting the branch accomplishes.**

The note is `sheldon/booking-harden:HANDOFF.md:27`:

> ⚠️ `TURNSTILE_SECRET_KEY` is the ONE name the code reads (`_lib/abuse.js`, used by both `/web-call` and `/booking/create`). An earlier build of `/booking/create` read `TURNSTILE_SECRET` and fell OPEN when it was unset; that name is gone. If the dashboard still holds the value under the old name, **rename it** — both endpoints now return 503 rather than run unverified. Set it on Production AND Preview.

**That exact text is already on `main`, byte-identical.** `HANDOFF.md` has the same blob object name on both refs; a line-by-line `diff` of the surrounding block returns empty. It sits at `main:HANDOFF.md:27` and `main:HANDOFF.md:148`.

**So deleting this branch does not remove the stale note.** If the note is to be corrected, that is an edit to `main:HANDOFF.md` and a separate order. Flagging that explicitly because the order's framing implies branch disposal would deal with it, and it would not.

The hardening the note describes **shipped**:

- `main:donovan-legal-site/functions/_lib/abuse.js` — **blob-identical to the branch**; `:145` reads `env?.TURNSTILE_SECRET_KEY`, `:148` refuses the request when unset
- `main:test/abuse.test.mjs` — **blob-identical to the branch**; `:153` `test('FAILS CLOSED (503) when TURNSTILE_SECRET_KEY is unset')`
- `main:test/booking-create.test.mjs:175` — `test('THE DEFECT: an unset TURNSTILE_SECRET_KEY is 503, not a pass-through')`
- `main:donovan-legal-site/functions/booking/create.js:34` — the deploy requirement comment

Full classification of the branch's 246 touched files against `main`: **75 identical, 156 differ (`main` advanced), 15 absent from `main`.** All 15 are pre-migration cPanel artefacts that `main` deliberately dropped — four `.htaccess` files (Apache directives, inert on Cloudflare Pages), `index.php`, `main.css`, `css/tools.html`, `equitable.html`, `equitable2.html`, `realestate.html`, two `.backup.html` files, and three superseded tool builders.

> **"Absent from `main`" is not "branch-only," and the two were conflated.** Eleven of these fifteen are absent from the **branch** as well — both sides deleted them since `ca79bd4`, so they survive in neither head and deleting the branch loses nothing of them. They enter the 246 *because the branch deleted them*; a deletion is a touch. Only **four** exist on the branch head. See §7 Block C for the enumeration and §2 for the trap.

**Verdict: DISPOSE** — its value shipped, and its residue is dead Apache-era files. **Gated**, because the branch head still holds files absent from `main` and it therefore fails the mechanical delete test. See §6C.

### `jordan/members-gate-branding` → **DISPOSE**

Superseded **by name, in `main`'s own source**. `main:donovan-legal-site/css/members-gate.css:2`:

> `* JORDAN / ORDER JORDAN-PORTAL-RESKIN (re-skin of JORDAN-MEMBERS-GATE-BRANDING)`

`main` names this branch's order as the thing it re-skins, and the file header records the re-skin as *"PRESENTATION ONLY… nothing in js/members-gate.js's behaviour… is touched by it."* The branding was carried forward and then restyled. `main` is 652 insertions ahead across the two files. Nothing on the branch is unrepresented.

### `sarah/perch-a41-cutover-qa` → **DISPOSE**

All six of its files exist on `main`, and `main`'s versions supersede them. The branch's verdict was **NO-GO** (`docs/SARAH-PERCH-A41-CUTOVER-QA.md:8`, restated line 271). `main`'s version of the same file **incorporates and overturns it**:

- `main:docs/SARAH-PERCH-A41-CUTOVER-QA.md:7` — *"That verdict was NO-GO. Both blockers it named have shipped, and this re-run measures…"*
- `:12` — **`## VERDICT: GO for the production promote`**
- `:218` — *"symptom alone would have produced a false NO-GO"*

The prior NO-GO is preserved *inside* `main`'s document. The 5-file add/add conflict is exactly this: two versions of the same paths, and `main` holds the later one.

### `zane/ci-pages-fix` → **DISPOSE**

All three commits' changes are present on `main:.github/workflows/ci.yml`:

| Branch commit | Change | On `main` |
|---|---|---|
| `7474cb7` | repoint pipeline at `donovan-legal-site` | `:1`, `:9` |
| `bc7c20d` | keep job id `build-and-test` so the required check name survives | `:30` (comment: *"Job id MUST stay `build-and-test`"*), `:33` |
| `9484b94` | least-privilege `permissions` block | `:26` |

Landed by re-implementation. `.github/workflows/*` is Human-Only under standing rules, which is the likely reason it was re-applied by hand rather than merged.

### `perch-draft`, `preview-main-checkpoint`, `zane/ci-all-branches` → **DISPOSE**

Strict ancestors of `main` — 0 commits ahead. Nothing to lose. Mechanically provable.

### `zane/paul-content-lane` → **DISPOSE** (gated)

One commit ahead, adding one file. `ZANE-WRITE-PROBE.md` in full:

> Scratch file. Probing whether the MCP connector can write non-workflow paths.
> Delete this branch.

Author's own written instruction. The lane it probed for landed — `main`'s tip `73852d04` is *"Paul's content lane: @claude -> PR -> preview -> David merges (#136)"*. Gated only because the scratch file is technically branch-unique. See §6C.

---

## 7. Task 6 — The delete list

Split into three blocks by strength of proof. **Only Blocks A and B satisfy the order's stated criterion** — head SHA reachable from `main`, or content provably duplicated. Block C carries DISPOSE verdicts that fail that mechanical test and needs David's explicit nod.

### Block A — Reachable from `main`. Mechanically safe.

Proof is `git merge-base --is-ancestor <head> origin/main` returning true. Zero commits ahead. Deleting these cannot lose a byte.

```
perch-draft                 ca79bd493da0b9e42de369da7690fc7a40e5fdf8   ancestor of main; 0 ahead, 68 behind
preview-main-checkpoint     58387293f71d0b8bc66c1b97635f29794091309a   ancestor of main; 0 ahead, 33 behind
zane/ci-all-branches        9c3230bdee7cacf8e0f26815fe931e4dd4bbfce6   ancestor of main; 0 ahead,  6 behind
```

> One caution on `perch-draft`: its head `ca79bd4` is the merge base of `sheldon/booking-harden`. Deleting the branch ref does not delete the commit while `booking-harden` still exists, but if both go, `ca79bd4` becomes unreferenced except through `main`'s history — where it remains reachable. Safe; recorded for completeness.

### Block B — Not reachable, but every change is present on `main`. Verified file-by-file.

```
jordan/members-gate-branding  08c985c413be65ad67210dabba15e526456a9374
    proof: main:donovan-legal-site/css/members-gate.css:2 names this branch's order —
           "JORDAN-PORTAL-RESKIN (re-skin of JORDAN-MEMBERS-GATE-BRANDING)".
           Both touched files carried forward and restyled; 652 insertions ahead on main.

sarah/perch-a41-cutover-qa    4c691231edb5298a9111d9eee982937b30462a1f
    proof: all 6 added paths present on main. main:docs/SARAH-PERCH-A41-CUTOVER-QA.md:7
           quotes the branch's NO-GO and overturns it; :12 records "VERDICT: GO".
           The superseded verdict survives inside main's copy.

zane/ci-pages-fix             9484b945e7ce1496c998ff9c10304a9274298f6a
    proof: all 3 commits' changes on main:.github/workflows/ci.yml —
           donovan-legal-site repoint (:1, :9), job id build-and-test (:30, :33),
           least-privilege permissions block (:26).
```

### Block C — DISPOSE verdict, but content is branch-unique. **Requires David's explicit nod.**

These fail the mechanical gate. I am not putting them in the delete list proper; I am recommending them with the residue named so the decision is informed.

```
sheldon/booking-harden        1aa58484bbbb9170483cee6f17b890cafe1b2966
    value shipped: abuse.js and test/abuse.test.mjs are BLOB-IDENTICAL on main;
                   HANDOFF.md blob-identical; booking-create fail-closed test at
                   main:test/booking-create.test.mjs:175.
    residue: FOUR files. Deleting this branch destroys these four blobs and
             nothing else. Each is MODIFIED on the branch and DELETED on main —
               donovan-legal-site/tool-operating-agreement-builder.html
                 blob 96b9ee89 (was 5e2cbf39 at ca79bd4)
               donovan-legal-site/diamond/tool-operating-agreement-builder.html
                 blob 833405cb (was 5c9a0bd1 at ca79bd4)
               donovan-legal-site/reserve/tool-operating-agreement-builder.html
                 blob 833405cb (was 5c9a0bd1 at ca79bd4)
               donovan-legal-site/reserve/tool-entity-formation.backup.html
                 blob b036b2b4 (was 40e7474b at ca79bd4)
             These four ARE the 4 modify/delete conflicts named in §0 — the two
             sets coincide exactly with no remainder, which is the cross-check
             that the count is right.
             Main carries their successors under the un-suffixed names
             (reserve/ and diamond/tool-operating-agreement.html,
             reserve/tool-entity-formation.html). The branch's edits to all four
             are the same site-wide sweep applied everywhere else on the branch
             — root-relative asset paths, canonical + JSON-LD, the perch.js and
             donovan-widget.js tags — not bespoke work. The root-level page
             sources js/tool-operating-agreement-builder.js, which exists on
             NEITHER head: that page is already broken on the branch.
    CORRECTION: the first two versions of this document said "15 files
             branch-only" here. That is false. Eleven of that 15 are absent
             from the BRANCH too — deleted by both sides since ca79bd4
             (css/tools.html; the four gold/platinum/reserve/diamond .htaccess;
             index.php; main.css; equitable.html; equitable2.html;
             realestate.html; reserve/tool-operating-agreement.backup.html).
             They are already gone from this branch; deleting it cannot lose
             them. The 15 in §6 is correct for what §6 measures — touched paths
             absent from main — and false as a statement of what delete
             destroys. See §2, third trap.
    ONE MORE, and it does NOT add to the loss:
             donovan-legal-site/css/tool-operating-agreement-builder.css exists
             on the branch head and not on main, so a head-vs-head listing
             returns 5, not 4. But its blob 9308d973 is byte-identical to the
             ca79bd4 copy, and ca79bd4 is an ANCESTOR OF MAIN — so
             `git show ca79bd4:donovan-legal-site/css/tool-operating-agreement-builder.css`
             retrieves it from main's own history after this branch is gone.
             Recorded because "on the branch and not on main" and "lost if the
             branch is deleted" are themselves two different questions, and the
             gap between 5 and 4 is exactly that difference. Only new blobs are
             at risk, and this one is not new.
    ALSO: this branch trips the STOP condition (148-file conflict: 38 add/add,
          106 content, 4 modify/delete — corrected from 452, see §0). Do not merge it.
    NOTE: deleting it does NOT remove the stale TURNSTILE note — that text is on
          main verbatim at HANDOFF.md:27 and needs a separate edit.

zane/paul-content-lane        24cc7260669167be453483027dddcbc391681bce
    proof: ZANE-WRITE-PROBE.md reads in full "Scratch file. Probing whether the MCP
           connector can write non-workflow paths. Delete this branch." — the author's
           own instruction. The lane landed as main tip 73852d04 (#136).
    residue: that one scratch file, absent from main.

zane/session-handoff          4423c1ff489b5a400f922065e5f2e46f70af1fd2
    proof: zane/handoff-0722:.agentos/SESSION_BOOT.md, final line —
           "(Generated by Zane 2026-07-22. Supersedes branch zane/session-handoff.)"
           Explicit authored supersession naming this branch.
    residue: ZANE_HANDOFF.md blob 74f70c91 differs from the successor's 9414c63c,
             so this is supersession, not duplication. ZANE_BOOT.md is branch-only.
    recommend: transcribe, then delete.
```

### Not on any delete list

`adam/clio-scope-verifier-r2` (PORT), `jordan/perch-novoice-book` (LAND), `sheldon/booking-safety` (LAND), `jordan/perch-photo-paula` (PRESERVE), `sheldon/perch-a25-spike` (PRESERVE), `zane/handoff-0722` (PRESERVE), `zane/handoff-perch-0722` (PRESERVE), `v2` (active lane).

---

## 8. Confirmed vs. inferred

### Confirmed — observed directly

- The live ref read returns 18 refs; `sheldon/clio-contact-mapping` is absent.
- Every head SHA and every reachability result in §3 (`git merge-base --is-ancestor`).
- Every conflict count in §3 (`git merge-tree --write-tree --name-only`, paths read from above the blank-line separator and cross-checked against `grep -c '^CONFLICT'`). The `sheldon/booking-harden` count was **wrong in the first published version of this document** and is corrected in §0: 148, not 452.
- Every "identical on main" / "absent on main" claim (`git ls-tree` object-name comparison).
- The `sheldon/booking-harden` residue is **4 blobs**, derived at blob level against `main`'s reachable history and cross-checked against the modify/delete conflict list, which it matches exactly. `git ls-tree -r` head-vs-head returns 5 paths; the fifth (`css/tool-operating-agreement-builder.css`) carries the `ca79bd4` blob and `ca79bd4` is an ancestor of `main`, so it is not at risk. The other **11** of §6's 15 are `D` on both sides. The published "15 files branch-only" in Block C was **wrong in the first two versions of this document** and is corrected in §7.
- `ca79bd4` is an ancestor of `origin/main` (`git merge-base --is-ancestor`), which is what makes merge-base-identical blobs recoverable after any of these branches is deleted.
- The other two Block C residues, re-derived on the same blob basis: `zane/paul-content-lane` = 1 file, `zane/session-handoff` = 2 files. Both as published.
- Every quoted line, with its file path and line number.
- Three suite executions, in an isolated detached worktree at the exact head SHA:
  - `adam/clio-scope-verifier-r2` @ `c820cee6` — 139/139 pass
  - `sheldon/booking-safety` @ `84adc054` — 23/23 pass
  - `jordan/perch-novoice-book` @ `3705715b` — 38/38 pass
- Vantage `origin/main` holds `server/lib/booking/provider-clio.js` with `calendar_entries` and `contacts`, and holds no scope verifier and no `custom_fields`/`INTAKE_CUSTOM_FIELDS`.

### Inferred — reasoned from the above, and defeasible

- **`adam/clio-scope-verifier-r2` is "finished" rather than "abandoned."** Inferred from 139 passing tests, an absorbed and corrected design defect, and clean mergeability. No ADAM sign-off document was found on the branch; the inference rests on the artefact's condition, not on a declaration.
- **The 4 files `sheldon/booking-harden` would actually lose on delete are safely discardable.** Corrected from "15 branch-only" — see §2 (third trap) and §7 Block C. The four are three `tool-operating-agreement-builder.html` pages and `reserve/tool-entity-formation.backup.html`. Inferred safe from `main` carrying un-suffixed successors of all of them, from the `.backup.html` naming, and from the root-level builder page sourcing a `.js` that exists on neither head. That the count is **4** is confirmed, not inferred; that the four are *discardable* is the inference. I did **not** verify that no live route serves them, and I did not diff the builder pages against their un-suffixed successors to prove the successors are functionally complete.
- **`.agentos` was deliberately kept off `main`.** Strongly supported by `SESSION_BOOT.md` STEP 1 addressing it by branch ref in two repos — but that is a design read, not a policy statement. No written policy forbidding `.agentos` on `main` was found, and it is not gitignored.
- **The `zane` ledgers are stale.** Confirmed for four of five spot-checked board items; **D-E is still open** (`functions/fn/take_message.js` remains on `main`). "Stale" is not "fully superseded."
- **Landing `jordan/perch-novoice-book` is safe.** Its suite passes and it merges clean, but I did not run the full repository suite against the merge result. Zane's gate should.
- **Porting the verifier to Vantage is the right call.** This follows the standing doctrine given in the order. I confirmed the port is non-duplicative and identified the `custom_fields` gap; I did not independently verify the doctrine itself.

---

## 9. Recommended sequence

1. **Gate and land `sheldon/booking-safety`** — 1 commit, parent *is* `main`, 23/23 green, fast-forward.
2. **Gate and land `jordan/perch-novoice-book`** — 38/38 green, merges clean, entirely unlanded.
3. **Delete Block A** (3 branches) — mechanically safe, no further review needed.
4. **Delete Block B** (3 branches) after spot-checking the three cited proofs.
5. **Promote the preserved evidence** — land the a25 memo + evidence, and `verify-photo-paula.mjs` + its evidence directory, onto `main` under `docs/` and `test/preview/`. Both branches merge clean; these are small PRs. Then those two branches can be deleted.
6. **Transcribe the two `zane` ledgers** (note the open D-E item and the Vantage DO-NOT-DEPLOY hazard), then dispose of all three `zane` handoff branches.
7. **Rule on Block C** (3 branches).
8. **Open a separate order** for the Clio scope verifier port to `TicoAI/vantage`, scoped to include building the `custom_fields` subject read and the `INTAKE_CUSTOM_FIELDS` contract that Vantage lacks.
9. **Open a separate order** to correct the stale `TURNSTILE_SECRET_KEY` note at `main:HANDOFF.md:27`.

**Nothing in this document has been merged, deleted, pushed to `main`, or opened as a PR against `main`.** Vera gates; David merges.
