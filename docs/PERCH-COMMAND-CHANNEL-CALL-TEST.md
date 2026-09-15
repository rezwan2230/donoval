# SHELDON — Perch command channel: manual call test

**Order** SHELDON-PERCH-COMMAND-CHANNEL · priority regression from the A5.1 cutover (#62).
**Who runs this** a human, on a phone or a laptop with a microphone.
**Why a human** a Retell web call needs a Turnstile solve, and Turnstile refuses
automation by design ([[feedback_turnstile_not_agent_verifiable]]). Everything a
browser can prove without a call is already proved by
`test/preview/verify-command-channel.mjs`; **this checklist covers the half that a
live voice session is the only way to reach** — Paula's own tool calls writing to
the bridge Durable Object, and `get_qualifier_result` reading it back.

---

## Before you start

| | |
|---|---|
| **URL** | the Preview deployment URL in the PR body — the pinned `https://<hash>.donovan-site.pages.dev` form, **not** the branch alias (Pages truncates the alias hostname and it can serve a stale asset) |
| **Start page** | `/contact` — do **not** start on `/perch`. `/perch` is the old shell and it always worked; the regression is on content pages. |
| **Browser console** | open it. Paula's commands log as `[perch] page-control → {…}`. |
| **Consent** | you will be asked to consent to recording before the mic opens. That is FL §934.03 and it is meant to be there. |

**Sanity check before you dial** — paste into the console on `/contact`:

```js
window.Perch.layer.probe().commandChannel   // → an object, NOT null
window.__perch.probe().mounted              // → true
```

`commandChannel: null` or `window.__perch` undefined means the build under test
does **not** carry this fix. Stop and check the URL.

While no call is live, `commandChannel.polling` is `false` — that is correct.
It flips to `true` the moment the call connects.

---

## The call

Tap the gold Paula orb, bottom-right. Consent. Wait for "connected".

**Immediately after connecting**, in the console:

```js
window.Perch.layer.probe().commandChannel.polling   // → true
window.__perchCallId                                // → a call id string
```

Both must be true/set **before** you speak. If `polling` is still `false`, the
launcher never handed the call to the layer and nothing below will work.

---

## What to say, and what must happen on screen

Say these as a caller would — Paula does not need the exact wording, only the
intent. The **Command** column is what she should fire; check the console line to
confirm which one she actually chose.

| # | Say this | Command | What MUST happen on screen |
|---|---|---|---|
| 1 | "Can you show me your tax controversy page?" | `goto_tax_controversy` | The page content changes to **Tax Controversy**. The URL bar changes. **The orb does not blink, reload or disconnect, and Paula keeps talking through it.** |
| 2 | "Scroll down a bit." | `scroll_down` | The page scrolls down about one screen, smoothly. |
| 3 | "Take me back to the home page." | `goto_home` | The homepage content loads. **URL becomes `/home`** (this is expected — see note below). **No reload; the call stays up.** |
| 4 | "I'd like to talk about buying a rental property." → answer her language question → answer "how did you hear about us" | `open_qualifier` | A **card slides over the page**: "Donovan Legal — What type of matter would you like to discuss?" with tappable options. |
| 5 | Tap through the card: **Real estate → Acquisition → your state → Yourself → an income band → a net-worth band** | — | The card shows "**Paula has it.** She'll pull up the calendar so you can pick a time." and closes itself after a few seconds. |
| 6 | Stay silent for ~5 seconds, then: "Did you get all that?" | `get_qualifier_result` | **Paula reads your answers back or acknowledges them specifically** (e.g. she knows it is a real-estate acquisition matter). If she says she is still waiting for you, the submit did not reach the bridge — **this is the step the automated verifier cannot reach, and it is the whole reason this checklist exists.** |
| 7 | "Let's book a time." | `goto_booking` + `booking_prefill` | The **booking page** loads (no reload, call still up), the "a quick step first" gate is **gone**, and the calendar is visible. |
| 8 | Give her your name and email when she asks | `booking_prefill` | Your name and email appear **typed into the form fields**. |
| 9 | "How about the 10th at 11am?" (pick a day she offers) | `booking_show_date` / `booking_select_slot` | That date opens and that time is selected in the widget. |
| 10 | **STOP HERE. Do not press "Confirm Appointment".** | — | Nothing is booked. This test does not create a Clio appointment. |
| 11 | "That's all, thanks." | — | Call ends. Orb returns from green to gold. |

**After hanging up**, in the console:

```js
window.Perch.layer.probe().commandChannel.polling   // → false
```

A poll still running after the call ended is a leak — report it.

### Note on step 3 (`goto_home`)

`do_page_action` maps `goto_home` to `/index.html`, and `/index.html` is on the
router's **exclusion list** — left alone, the router would hard-navigate it and
**that hard navigation would hang the caller up mid-sentence.** The layer rewrites
it to `/home`, which is the spelling Pages serves 200 and the one `/` itself
serves after A5.1. So a URL bar reading `/home` is the fix working, not a defect.
A **reload** at step 3 — the orb blinking, Paula going silent — is the defect.

---

## The rollback target

`/perch` is the old iframe shell and it is what we roll back to if any of the
above fails. Confirm in the **same session**, in a second tab:

| Check | Expected |
|---|---|
| Open `<preview>/perch` | Loads. Gold Paula orb bottom-right, site inside the frame. |
| Tap the orb, consent, connect | Call connects. |
| "Show me your tax controversy page" | The **framed** page navigates. |
| "I'd like to talk about buying a rental property" | The qualifier card appears **over the frame**. |
| Hang up | Clean. |

If `/perch` fails any of these, **this PR is not the rollback-safe change it
claims to be** — say so on the PR and do not gate it.

---

## Reporting

For each numbered row: **PASS / FAIL**, plus the `[perch] page-control →` console
line that accompanied it. For a FAIL, paste:

```js
JSON.stringify(window.Perch.layer.probe(), null, 2)
JSON.stringify(window.Perch.router.probe(), null, 2)
```

Neither prints the call id — the probes report it as `'set'` — so both are safe to
paste into the PR.

---

## What this checklist deliberately does NOT cover

* **Production.** `PERCH_ROUTER` is unset in production, so none of the above is
  built there — `commandChannel` is `null`, there is no qualifier card and no
  `window.__perch`, exactly as today. That off-state is asserted in CI
  (`test/perch-command-consumer.test.mjs` §1), not here.
* **Booking a real appointment.** Step 10 stops short on purpose.
* **The Vantage lead forward.** `qualifier_submit` fires it and this test lets it
  through as a normal caller would; it is a Preview deployment writing one
  synthetic lead. If that is not acceptable, say so before running and it can be
  blocked at the browser.
