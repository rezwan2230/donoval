# SHELDON — `perch-do` append-queue deploy handover

Order **SHELDON-PERCHDO-QUEUE**. Post-cutover hardening, defence in depth.
**David runs the deploy.** Agents do not deploy and do not merge.

---

## 1. What ships, and what does not

| | |
|---|---|
| Changed | `perch-do/src/index.js` — one file, the `PerchBridge` Durable Object class |
| Unchanged | `perch-do/wrangler.jsonc` (byte-identical — same class name, same `BRIDGE` binding, same `migrations: [{tag:"v1", new_sqlite_classes:["PerchBridge"]}]`) |
| Unchanged | **every file under `donovan-legal-site/`** — zero Pages diff, so there is nothing to promote on the Pages side |
| Unchanged | `.github/workflows/` — untouched; `perch-do` still has **no CI lane** |

No DO migration. No stored-slot reset. The deploy is a code swap on a live class
whose storage persists across it, which is why §4 below is about the storage the
instance is already holding.

> **One instance serves production and every Preview** (`functions/_lib/tenant.js`
> names it `donovan`). This deploy is therefore **global the moment it lands**, and
> it cannot be rehearsed on a Preview first. Pick the window deliberately.

---

## 2. Capture the rollback target FIRST

```bash
cd perch-do && npx wrangler versions list --name perch-do
```

Write down the **current** version id before deploying. That id is the rollback
target in §5 — there is no way to recover it afterwards from the deployed worker.

---

## 3. Deploy

```bash
cd perch-do && CLOUDFLARE_ACCOUNT_ID=aad3aed11a2118a035263e9469e2da1d npx wrangler deploy
```

(Account id is documented in-repo, not a secret. Wrangler 3.114.17 and 4.114.0 both
build this clean; 4.114.0 reports `Total Upload: 4.03 KiB`, one binding
`env.BRIDGE (PerchBridge)`.)

---

## 4. Verification — one line, no secret

```bash
cd perch-do && npx wrangler deploy --dry-run --outdir=/tmp/perch-do-build && grep -c 'MAX_QUEUE' /tmp/perch-do-build/index.js
```

Expect **`2`**, and the build banner to list `env.BRIDGE (PerchBridge)`. The bundle
is unminified, so identifiers survive; scanning it is what proves the queue code is
in the artefact rather than only in the repo
(`[[feedback_prove_code_ships_by_scanning_the_binary]]`). A fuller scan should show
all three routes plus both key prefixes:

```
"/set"  "/get"  "/has"   "q:"  "a:"   MAX_QUEUE ×2   _serialize ×4
```

**Why the check is not a curl.** A Durable Object has no public HTTP path
(`[[feedback_durable_object_has_no_public_http_path]]`); `perch-do.david-aad.workers.dev`
answers `perch-do` from the default export and never reaches the class. The only
behavioural confirmation is through the Pages functions, which needs
`PERCH_TOOL_SECRET` — see §6.

---

## 5. Rollback

```bash
cd perch-do && npx wrangler rollback <VERSION_ID_FROM_STEP_2> --name perch-do
```

**Rollback is safe and needs no migration handling.** The queue is written under a
**new** key prefix `q:<call_id>`; the previous build reads `a:<call_id>` only. So
after a rollback it finds nothing and answers `{}` — "no command queued" — rather
than deserialising an array it has no code path for. A rollback drops whatever was
in flight at that instant (Paula re-issues; the caller sees a command not land
once); it cannot emit a malformed action.

The reverse direction is handled too: anything the **current** build already stored
under `a:<call_id>` is still read by the new class, is ordered **first** because it
was queued first, and is cleared on the next drain. Nothing pending at the moment of
the deploy is lost.

---

## 6. Post-deploy behavioural check (David / a live call)

The queue is invisible to a black-box probe. Confirm it the way the command channel
was confirmed — one live call, `docs/PERCH-COMMAND-CHANNEL-CALL-TEST.md` step 7:

1. Paula: **`goto_booking`** then **`booking_prefill`** in the same turn.
   Expect: the caller lands on `/book` **and** the form is filled. (This already
   works via the #94 coalesce; after this deploy it works even if the coalesce
   does not.)
2. Paula: a **`goto_*`** paired with **`open_qualifier`**.
   Expect: the page moves **and** the card comes up.

Nothing else should change. If either flow regresses, roll back with §5 — the Pages
side is untouched, so a Pages rollback is neither needed nor useful here.
