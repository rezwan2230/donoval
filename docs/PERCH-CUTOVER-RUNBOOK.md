# Perch cutover — production runbook

**Owner:** Sarah (QA) / ADAM (DevOps) · **Ticket:** #61 (A4.2) · **Written:** 2026-07-25, after
David's A5.1 promote.

What is live on `https://www.donovan.law`, how to take it back, and the one thing about
rolling back that is not true.

Post-promote smoke evidence: [`SARAH-A42-POST-PROMOTE-SMOKE.md`](./SARAH-A42-POST-PROMOTE-SMOKE.md)
· `test/preview/a42-evidence.json`.

---

## 1. What the promote changed

One environment variable, `PERCH_ROUTER=on`, flipped three behaviours at once. They share a
single gate — `routerEnabled(env, url)` in `functions/_lib/perch-router-inject.js` — deliberately,
so they cannot drift into disagreeing about which deployment they are on.

| Behaviour | Gate | Before | After |
|---|---|---|---|
| `/` serves the real indexable homepage | `shellRetired()` → `routerEnabled()` | `noindex` Perch shell | `home.html`, 200, indexable |
| Soft navigation (Swup) | `routerTags()` → `routerEnabled()` | off in production | on |
| `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` | `routerEnabled()` | permissive `frame-ancestors` | narrowed to `'self'` |

`/perch` and `/perch.html` are **unchanged and still live** — that is the route Paula connects
on. A5.1 retired the shell from `/`, not the shell.

---

## 2. Rollback

Two levers. Reach for the first one.

### Lever 1 — `PERCH_ROUTER=off` (seconds, no redeploy)

Cloudflare dashboard → Pages → `donovan-site` → Settings → Environment variables → Production →
set `PERCH_ROUTER=off`. Takes effect on the next request.

This is a genuine kill switch, not a best-effort one, because **`_redirects` was never touched**.
The rule that made `/` the shell is still in the file:

```
/    /perch.html    200
```

With the flag off, `homepageRequest()` returns `null`, the middleware calls `next()` bare, the
asset handler applies that rule again, and `/` is the shell exactly as it was. Nothing to
redeploy and nothing to revert.

> Setting the variable to any value other than `on` or `off` — including deleting it — does **not**
> mean "off" on production. Unset falls through to the hostname rule, which is `*.pages.dev` and
> localhost only, so production ends up off anyway; but say `off` explicitly, because that is the
> only spelling that also holds on a Preview.

#### The rollback used to leave a trap in every visitor's browser

**Fixed by SHELDON-PERCH-CLEANUP-ROUTING-KEYS. Read this if you rolled back before that shipped.**

The switched-off answer at `/` was **`308 → /perch`**. A 308 is a *permanent* redirect: the
browser writes `/ → /perch` into its own redirect cache and, on every later visit, stops before
making a request. So anyone who loaded `/` during a rollback window kept being sent to the shell
**after** the promote put the real homepage back — and no server-side change could reach them,
because the request never left their machine. David hit exactly this.

`/` now answers **`307` with `Cache-Control: no-store`** in the switched-off state. Same
destination, same rollback behaviour, nothing cached. Verify after any deploy that lands on
production while the switch is off:

```bash
curl -sS -o /dev/null -D - https://www.donovan.law/ | grep -Ei '^(HTTP|location|cache-control)'
# expect:  HTTP/2 307   ·   location: /perch   ·   cache-control: no-store
# a 301 or 308 on that first line is the trap, back again
```

**Anyone who already has the 308 cached still has it.** There is no server-side cure. Tell them
to hard-reload `/` (Ctrl+Shift+R / Cmd+Shift+R), or clear the site's cached data — Chrome:
DevTools → Application → Storage → *Clear site data*. Checking with a fresh incognito window is
the fastest way to tell a stale client from a live regression.

### Lever 2 — re-promote the prior production deployment

Cloudflare dashboard → Pages → `donovan-site` → Deployments → the previous production deployment
→ **Rollback**. Use this when the problem is in shipped code rather than in the switch.

`perch-do` is a **separate Worker with a separate deploy** (`wrangler deploy` from `perch-do/`,
no CI lane). A Pages rollback does not touch it. Its own rollback is safe and needs no migration
handling: the pre-`/has` version answers `{}` for unknown paths, which `probeBridge` reads as
"unknown", degrading the call_id bind to KV-only — the documented path, not a failure.

---

## 3. ⚠️ SECRETS DO NOT ROLL BACK WITH A DEPLOYMENT

**This is the caveat this runbook exists for. Rolling back the deployment does not restore a
rotated secret.**

A Cloudflare Pages deployment is a snapshot of **code and static assets**. Environment variables
and secrets are **project-level configuration**, stored and versioned separately, and they are
resolved at **request time** from whatever the project currently holds. So:

- Rolling back to yesterday's deployment runs **yesterday's code against today's secret values**.
- If a secret was rotated after the deployment you are rolling back to, the rollback does **not**
  un-rotate it. The old value is gone unless someone kept it.
- Equally, rolling back does not *undo* a rotation you wanted undone. There is no "previous
  value" to restore to — a rotation is not a deployment event and has no deployment to revert.

**The practical consequence.** "Roll it back" is a complete remedy for a bad *build*. It is not a
remedy for a bad *rotation*. Those are two different incidents with two different fixes, and
treating the second as the first burns the outage window on a lever that was never connected to
the problem.

### What that looks like on this project

Rotating any of these and then rolling back leaves the rotation in force:

| Secret | Rotated-and-rolled-back symptom |
|---|---|
| `TIER_GOLD` / `TIER_PLATINUM` / `TIER_DIAMOND` / `TIER_RESERVE` | members' saved Basic-Auth credentials 401; `tier-auth.js` is fail-closed, so a *missing* value is 503, not open |
| `VANTAGE_WRITE_SECRET` | booking → Vantage lead upserts start failing; the booking itself still confirms |
| Clio provider credentials | `/booking/create` cannot write the appointment — this is the one that reaches Paul's calendar |
| Retell API key | Paula cannot connect; `/web-call` stops minting sessions |
| Turnstile secret key | every booking is refused `403 TURNSTILE_REQUIRED`, silently to the caller |
| tool-auth / admin secrets | Paula's server-side tools 401 mid-call |

### Rules

1. **Record the rotation somewhere the deployment history does not.** A rotation leaves no trace
   in the Pages deployment list. Write down what was rotated, when, and by whom, or the next
   person debugging a 401 will read a green deployment history and conclude nothing changed.
2. **Never roll back as the first response to an auth-shaped failure** (401/403/503 on a path
   that was working). Check whether a secret moved first — a rollback cannot fix it and costs you
   the time.
3. **Rotate secrets on their own, never in the same change window as a promote.** If both move
   together you cannot tell which one broke it, and the rollback only rewinds one of them.
4. **A secret that is absent is not the same as a secret that is wrong.** This codebase is
   fail-closed on the paths that matter, but the general shape `if (secret && …)` is fail-**open**
   — an unset secret disables the gate rather than refusing. When restoring, verify the name is
   *present*, not merely that the deploy went green.
5. **Values are write-only in the dashboard.** You cannot read a secret back to check it. Verify
   by behaviour — a tier that authenticates, a booking that confirms — not by inspection.

`PERCH_ROUTER` itself is a plain environment **variable, not a secret**: readable, and safe to
flip on its own. It is the one lever in this system that genuinely is instant and reversible.

---

## 4. Post-rollback verification

After either lever, re-run the smoke and read the verdict rather than the exit code (it exits 0
either way):

```
node test/preview/verify-a42.mjs https://www.donovan.law
```

With the router **on**, expect 46/46 and `verdict: HEALTHY`.

With the router **off** (Lever 1), the S1/S3.5 steps are *expected* to fail — `/` is the
`noindex` shell again by design. The steps that must still pass are S4.1 (`/perch` serves the
shell), S4.2 (its same-origin iframe loads) and every S5 accounting step.

The smoke writes nothing: the booking write path is severed in three layers and §S5 fails unless
zero write-path requests reached the network. It is safe to run against production at any time.

Two things it cannot prove, by construction, and which stay manual:

- **A full voice call.** Clicking the launcher mints a real metered Retell session and a real
  Vantage lead. Retell refuses automation.
- **A completed booking.** The Turnstile token is not obtainable by any driver. Cloudflare
  refuses Playwright's bundled Chromium with `TurnstileError 600010` — driver-side, not
  site-side; the same sitekey on the same origin issues a token normally in real Chrome and Edge.
