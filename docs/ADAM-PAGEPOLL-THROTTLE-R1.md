# ADAM-PAGEPOLL-THROTTLE-R1 — /fn/page-poll invocation + log volume

**Agent:** ADAM (DevOps) · **Branch:** `adam/page-poll-throttle-r1` · **Gate:** Zane · **Merge:** David

---

## 1. The cost, and where it came from

| | before |
|---|---|
| Client | `js/perch/command-channel.js` → `setInterval(…, 1200)` for the length of the call |
| Server | `donovan-legal-site/functions/fn/page-poll.js` → one bridge drain, one answer |
| Per 3-minute call | **~150 Worker invocations, ~147 of them answering `{}`** |
| Log | one `/fn/page-poll` request line per invocation — the noise the `call_id` drop has to be diagnosed through |

The client caller is `createCommandChannel().start()` in
`donovan-legal-site/js/perch/command-channel.js`. It is bound by
`js/perch-layer.js` → `bindCall()`, which `js/donovan-widget.js` calls from the
Retell SDK's `call_started`. The `/perch` shell reaches the same module through
`createCall()` in `js/perch/call.js`.

## 2. What changed — the waiting moved, the cadence did not

Lowering the cadence was rejected. On a voice call the poll interval **is** the
latency between Paula saying *"let me pull that up"* and the calendar appearing;
the ~12 s interval a 10× cut would need is a caller staring at a page that has
not moved. That is the degradation the order's STOP clause names.

So `/fn/page-poll` now **holds the connection open** and answers the moment the
bridge has something:

* **Opt-in.** The client asks with `X-Perch-Wait: 25000`. Without that header the
  Function is byte-for-byte what shipped before. This is load-bearing: a browser
  holds its page for the whole call while Pages swaps the Function underneath it,
  and an unconditional hold would meet an old client's `setInterval(1200)` with a
  25 s answer and stack ~20 open requests per caller.
* **Same body.** Every byte returned is a body the Durable Object produced — the
  queued command verbatim, or `{}`. The hold moves *when*, never *what*.
* **Same bridge load.** `HOLD_TICK_MS` is 1200 ms, the browser's old interval to
  the millisecond, so the Durable Object sees the read rate it always saw and the
  Worker cut is not paid for at the DO.
* **Self-clocking client.** The next poll is scheduled from the *end* of the last
  one, so exactly one request is ever in flight.
* **It ends.** `stop()` (from `call_ended` / `error`) aborts the open request,
  which collapses the held request server-side. Plus three ceilings: a 400 halts
  it, `MAX_FAILS` consecutive failures halt it, and `MAX_SESSION_MS` (45 min)
  halts it if `call_ended` never arrives.

## 3. Measured, before and after

`node test/preview/measure-page-poll.mjs --legacy` — a 180 s call with three
commands (`open_qualifier` at 20 s, the coalesced `goto_booking` + prefill batch
at 45 s, `booking_show_date` at 80 s), driving the **real** loop and the **real**
Function on a virtual clock.

```
arm                                 invocations  DO drains   [perch]  after stop  delivered
------------------------------------------------------------------------------------------
origin/main setInterval loop                150        150         3           0        yes
BEFORE — no server hold (1.2 s)             150        150         3           0        yes
AFTER  — server holds 25 s                    8        156         3           0        yes
------------------------------------------------------------------------------------------
reduction: 150 → 8 invocations = 18.8x fewer
```

Delivery latency, measured from the moment Paula queued each command:

| arm | open_qualifier | navigate | booking_prefill | booking_show_date |
|---|---|---|---|---|
| `origin/main` | 400 ms | 600 ms | 600 ms | 400 ms |
| BEFORE (no hold) | 400 ms | 600 ms | 600 ms | 400 ms |
| **AFTER (hold)** | **400 ms** | **550 ms** | **550 ms** | **450 ms** |

No regression: the ±50 ms is bridge-read phase, and both arms stay inside the
one-interval worst case they always had. `test/page-poll-throttle.test.mjs` gates
the ratio (≥10×), the latency bound, the delivered-command shape, and every stop
condition — 23 tests. Full suite: **1780 pass, 0 fail**.

> Fidelity limit, stated so no number over-claims: the harness counts invocations
> and orders events. It says nothing about what a request *cost* in CPU or
> wall-clock, and its bridge is `makeDurableObject()`, not a live Durable Object.

## 4. Confirming the log cut on the deployment (post-merge, David)

The invocation count and the log-line count are the same event seen from two
sides — one request to `/fn/page-poll` is one Worker invocation and one request
record. To confirm on the live deployment, take one call with the tail open:

```sh
# one terminal — watch only the poll
npx wrangler pages deployment tail --project-name donovan-site \
  --format pretty | grep -c 'fn/page-poll'
```

Place one ~3-minute test call through the launcher, drive at least one
`goto_booking` from Paula, then hang up. Expected: **single-digit** `page-poll`
lines for the whole call (was ~150), the queued commands still executing on the
page, and **zero** further `page-poll` lines after the call ends.

## 5. Not done, and why

* **`perch-do/src/index.js` is untouched.** A `/wait` endpoint on the Durable
  Object would additionally collapse the bridge reads, but perch-do has no CI
  lane, is deployed by hand, and **one instance serves production and every
  Preview at once**. The order's target is met without that risk, entirely inside
  the Pages CI lane, with nothing to hand-deploy. Tracked as a follow-up, not
  smuggled into this PR.
* **No `.github` or workflow file was touched.** No secret was read.
