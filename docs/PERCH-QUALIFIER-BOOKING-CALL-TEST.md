# SHELDON — Qualifier + booking calendar: manual call test

**Order** SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING · priority live regression,
follow-up to the merged command-channel fix (#92).
**Who runs this** a human, on a phone or a laptop with a microphone.
**Why a human** a Retell web call needs a Turnstile solve and Turnstile refuses
automation by design ([[feedback_turnstile_not_agent_verifiable]]). Everything a
browser can prove without a call is already proved by
`test/preview/verify-qualifier-booking.mjs` (25/25 GO) and by
`test/perch-qualifier-booking.test.mjs`. **This checklist covers the one leg
neither can reach: Paula's own tool calls writing to the bridge Durable Object,
two of them in the same turn.**

---

## What changed, in one paragraph

The qualifier and the booking calendar were never unwired in the browser. The
bridge holds **one** pending command per call (`perch-do` stores `a:<call_id>`
with `put()`), and the page drains it once every 1.2 s — so any two commands
Paula issues inside one poll window destroyed each other, and the second one won.
That is exactly `goto_booking` + `booking_prefill`, and exactly a `goto_*` paired
with `open_qualifier`. `/fn/do_page_action` now drains the slot before writing and
queues both, in order, as one `batch`; `js/perch/command-channel.js` executes a
batch through the same dispatch table. **The rows below are chosen to make Paula
fire two commands in one turn** — that is the whole point of this run.

---

## Before you start

| | |
|---|---|
| **URL** | the pinned `https://<hash>.donovan-site.pages.dev` form in the PR body — **not** the branch alias (Pages truncates the alias hostname and it can serve a stale asset) |
| **Start page** | `/contact` — do **not** start on `/perch`. `/perch` is the old shell; the regression is on content pages. |
| **Browser console** | open it. Paula's commands log as `[perch] page-control → {…}`. |
| **Consent** | you will be asked to consent to recording before the mic opens. That is FL §934.03 and it is meant to be there. |

**Sanity check before you dial** — paste into the console on `/contact`:

```js
window.Perch.layer.probe().commandChannel   // → an object, NOT null
window.__perch.probe().mounted              // → true
```

`commandChannel: null` or `window.__perch` undefined means the build under test
does not carry the #92 fix at all. Stop and check the URL.

While no call is live, `commandChannel.polling` is `false`. That is correct — it
flips to `true` when the call connects.

---

## The call

Tap the gold Paula orb, bottom-right. Consent. Wait for "connected".

**Immediately after connecting**, in the console:

```js
window.Perch.layer.probe().commandChannel.polling   // → true
window.__perchCallId                                // → a call id string
```

Both must be true/set **before you speak**. If `polling` is still `false`, the
launcher never handed the call to the layer and nothing below will work.

---

## What to say, and what must happen on screen

| # | Say this | Command(s) | What MUST happen on screen |
|---|---|---|---|
| 1 | "Can you show me your tax controversy page?" | `goto_tax_controversy` | The content changes to **Tax Controversy**. The orb does not blink, reload or disconnect, and Paula keeps talking through it. |
| 2 | **"I'd like to talk about buying a rental property — can you pull that up for me?"** → answer her language question → answer "how did you hear about us" | `goto_re_acquisition` **and** `open_qualifier` **in one turn** | **BOTH must land.** The page changes to Real Estate Acquisition **and** a card slides over it: "Donovan Legal — What type of matter would you like to discuss?" with tappable options. **This is the regression row: before this change one of the two was silently destroyed.** |
| 3 | Tap through the card: **Real estate → Acquisition → your state → Yourself → an income band → a net-worth band** | — | The card shows "**Paula has it.** She'll pull up the calendar so you can pick a time." and closes itself after a few seconds. |
| 4 | Stay silent ~5 s, then "Did you get all that?" | `get_qualifier_result` | **Paula reads your answers back or acknowledges them specifically** (she knows it is a real-estate acquisition matter). If she says she is still waiting for you, the submit did not reach the bridge. |
| 5 | **"Let's book a time — my name is <your name> and my email is <your email>."** | `goto_booking` **and** `booking_prefill` **in one turn** | **BOTH must land.** The **booking page** loads with no reload and the call still up, the "a quick step first" gate is **gone**, and the calendar (a date strip) is on screen. **This is the second regression row.** |
| 6 | "How about the 27th?" (pick a day she offers) | `booking_show_date` | That date opens and its **time buttons appear**. The form does **not** open yet — browse, don't commit. |
| 7 | "11 in the morning, please." | `booking_select_slot` | That time is taken and the **form opens**. |
| 8 | Look at the form | — | **Your name and email are already typed into the fields** — the ones you gave her at step 5, carried across the navigation. |
| 9 | **STOP HERE. Do not press "Confirm Appointment".** | — | Nothing is booked. This test does not create a Clio appointment. |
| 10 | "That's all, thanks." | — | Call ends. Orb returns from green to gold. |

**After hanging up**, in the console:

```js
window.Perch.layer.probe().commandChannel.polling   // → false
```

A poll still running after the call ended is a leak — report it.

### If a row fails, this is the line that tells you which half broke

```js
JSON.stringify(window.Perch.layer.probe().commandChannel.log, null, 2)
```

* An entry `{cmd:"batch", n:2, ran:["navigate","open_qualifier"]}` means the
  coalescer worked and the browser ran both — any remaining failure is in the
  browser half.
* **No entry at all** for a command Paula says she fired means it never reached
  the page: the write side, not the consumer. Note which two commands she paired.

---

## The rollback target

`/perch` is the old iframe shell and it is what we roll back to. Confirm in the
**same session**, in a second tab:

| Check | Expected |
|---|---|
| Open `<preview>/perch` | Loads. Gold Paula orb bottom-right, site inside the frame. |
| Tap the orb, consent, connect | Call connects. |
| "Show me your tax controversy page" | The **framed** page navigates. |
| "I'd like to talk about buying a rental property" | The qualifier card appears **over the frame**. |
| "Let's book a time" | The framed booking page loads with the calendar revealed. |
| Hang up | Clean. |

`/perch` runs the same `js/perch/command-channel.js`, so it gains the `batch`
branch in this deploy too. If any row above fails, **this PR is not the
rollback-safe change it claims to be** — say so on the PR and do not gate it.

---

## Reporting

For each numbered row: **PASS / FAIL**, plus the `[perch] page-control →` console
line that accompanied it. For a FAIL, paste:

```js
JSON.stringify(window.Perch.layer.probe(), null, 2)
JSON.stringify(window.Perch.layer.bookingProbe(), null, 2)
JSON.stringify(window.Perch.router.probe(), null, 2)
```

None of these print the call id — the probes report it as `'set'` — so all three
are safe to paste into the PR.

---

## What this checklist deliberately does NOT cover

* **Production.** The router gate is unchanged: with `PERCH_ROUTER` unset nothing
  in the consumer stack is built, `commandChannel` is `null`, there is no
  qualifier card and no `window.__perch`. That off-state is asserted in CI
  (`test/perch-command-consumer.test.mjs` §1), not here.
* **Booking a real appointment.** Row 9 stops short on purpose.
* **A burst of more than eight commands in one poll window.** The coalescer keeps
  the newest eight (`MAX_BATCH`) and drops the oldest, which is asserted in CI.
  Paula has never been observed issuing more than three.
* **The Vantage lead forward.** `qualifier_submit` fires it and this test lets it
  through as a normal caller would; it is a Preview deployment writing one
  synthetic lead. If that is not acceptable, say so before running and it can be
  blocked at the browser.
