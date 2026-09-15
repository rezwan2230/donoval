# JORDAN-LAUNCHER-FOCUS-OUTLINE — evidence

Produced by `test/preview/verify-launcher-focus.mjs`. Both sets are raw output —
regenerate either with:

```
node test/preview/verify-launcher-focus.mjs <baseUrl> <outDir>
```

| Set | Captured against | Verdict |
|---|---|---|
| `before/` | `https://www.donovan.law` — production, i.e. `main` without this change | **NO-GO 7/14** |
| `after/`  | the PR's Cloudflare Pages Preview (hash pinned in `verdict.json`) | **GO 14/14** |

The Preview is pinned by deployment hash, never by branch alias: the alias slug
truncates at 28 characters and can serve a stale asset
(`feedback_pages_alias_serves_stale_asset`, `feedback_pages_alias_slug_truncation`).

## Reading the shots

| File | State |
|---|---|
| `A1-idle.png` | idle |
| `A2-hover.png` | hover |
| `A3-mouse-click.png` | after a real mouse click on the orb |
| `B_esc_decline.png` | consent modal dismissed with **Esc**, focus restored to the orb |
| `C_mouse_decline.png` | consent modal dismissed with the **mouse**, focus restored |
| `E1-restore-after-mouse.png` | the gate's `prevFocus.focus()` replayed after a mouse gesture |
| `E2-restore-after-keyboard.png` | the same, after a keyboard gesture |
| `D1-keyboard-focus.png` | focus reached by **Tab** |
| `D2-keyboard-focus-live.png` | Tab focus with `.live` set — the connected call |

`B_*` and `C_*` **abstain** on Preview. The consent gate there fails closed with
`CONSENT_TICKET_SECRET` unset ("no consent ticket issued — refusing to start a
recorded call"), so the modal never renders and those arms never reach the state
they exist to measure. Arm E exists precisely so the comparison does not depend
on that: it replays `js/consent-gate.js:278` directly, under both input
modalities, and therefore measures the identical state on both deployments.

## The comparison that settles it

Arm E, same state both sides — a focused launcher after the gate's script restore:

| | button box (116px, square) | disc (92px, round) |
|---|---|---|
| before | `outline: rgb(16,16,16) auto 5px` — **paints** | none |
| after | `outline-style: none` — **paints nothing** | `rgb(255,202,24) solid 3px` |

## Recorded, not scored

`verdict.json` carries a `residual` block. A real mouse click leaves the orb
clean (`:focus` true, `:focus-visible` **false**, nothing painted). The gate's
restore is different — Chrome grants `:focus-visible` to a script focus whatever
modality preceded it — so a ring is still on screen for the rest of the call. It
is the round brand ring on the disc, never the UA rectangle around the button.
Suppressing it would hide the indicator from a keyboard caller mid-call, so it is
surfaced for a reviewer to judge rather than silently removed.

## Safety

Neither run minted a token or booked anything. `/web-call` and the Retell CDN are
aborted at the route layer before any gesture is dispatched, every arm that
reaches the consent gate **declines**, and `mintAttempts` is reported in
`verdict.json` so the claim is checked rather than asserted.
`feedback_negative_path_probe_can_write`.
