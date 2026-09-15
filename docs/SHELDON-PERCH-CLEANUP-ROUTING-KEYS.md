# SHELDON — post-cutover cleanup: the routing trap and the unreachable keys

**Order** SHELDON-PERCH-CLEANUP-ROUTING-KEYS · post-cutover cleanup. The site is
live and working; these are two loose ends from the A5.1 cutover.
**Baseline** `36f683e` (`main`, after #94).
**Companion** [ADAM-PERCH-KEY-AUDIT](./ADAM-PERCH-KEY-AUDIT.md) (PR #96, doc-only)
— this PR is the code half of that audit's H3 finding and of its
"retire-or-wire" note on `highlight` / selector-`scroll`.

---

## 1 · The homepage was a permanent cache trap during a rollback

### What was wrong

With the router **off** — production today, and every rollback window — `/` was
answered **`308 → /perch`**.

308 is a *permanent* redirect. The browser stores `/ → /perch` against the URL
and, on every later visit, short-circuits **before making a request**. So a
visitor who loaded `/` while the switch was off kept being sent to the noindex
shell after the promote put the real homepage back, and nothing on the server
could reach them, because no request left their machine. David hit it.

The 308 is not written by `_redirects`. That file carries `/  /perch.html  200`
— a *rewrite*. Cloudflare Pages' clean-URL canonicaliser runs on the rewrite
**target** and answers with its own 308 to `/perch`. The status code is
Cloudflare's, so editing `_redirects` cannot choose it.

### The fix

`functions/_lib/perch-shell-retire.js` gains `homepageRedirect()`, called from
`functions/_middleware.js` after the CSP and frame headers are set. It converts a
**301 or 308 at `/` only** into a **307** and adds **`Cache-Control: no-store`**.
Everything else is returned untouched.

### Measured, not reasoned

The switched-off answer is not observable on any live deployment: production has
been switched **on** since #90, and a Preview is *always* switched on because
`routerEnabled()` is true for every `*.pages.dev` hostname. So the before/after
was taken in the real workerd runtime, over the real `_redirects`, one commit
apart — same command, same tree:

```bash
npx wrangler pages dev donovan-legal-site --binding PERCH_ROUTER=off --port 8791
curl -sS -o /dev/null -D - http://127.0.0.1:8791/
```

| path | `main` @`36f683e`, **off** | this branch, **off** | this branch, **on** |
|---|---|---|---|
| `/` | **`308 → /perch`**, no cache-control | **`307 → /perch`**, `cache-control: no-store` | `200`, `no-store` |
| `/perch` | `200`, `no-store` | `200`, `no-store` — identical | `200`, `no-store` |
| `/perch.html` | `308 → /perch` | `308 → /perch` — identical | `308 → /perch` |
| `/index.html` | `301 → /` | `301 → /` — identical | — |

Bodies at `/perch`, `/contact` and `/book` are byte-identical between `main` and
this branch in the switched-off state (9423 / 36637 / 29079 bytes, nonce
stripped). On the live Preview the same equality is checked against the shipped
`perch.html` (verifier §A3) and every other redirect on the site is re-measured
(§A4).

Three things worth stating plainly:

* **307, not 302.** 307 is the exact temporary counterpart of the 308 it
  replaces — same method-preserving semantics, minus the permanence. 302 would
  additionally license a client to rewrite the method, a behavioural change
  nobody asked for.
* **`_redirects` is not touched.** Lever 1 in the cutover runbook is still a
  genuine kill switch for exactly the reason it always was, and every SEO model
  built on that file (`test/seo-crawlability.test.mjs`, `test/perch-main.test.mjs`)
  is unaffected.
* **It is scoped by path and status, not by the router switch.** The trap is
  *created* by the switched-off state, so a fix that only ran with the switch on
  would fix nothing. With the switch on, `/` is a 200 and the branch never runs —
  which is what keeps the retired state and `/perch` byte-unchanged.

### What it does not fix

**A browser that already cached the 308 still has it.** There is no server-side
cure. Hard-reload `/`, or clear site data; an incognito window is the quickest
way to tell a stale client from a live regression. This is now in
[the cutover runbook](./PERCH-CUTOVER-RUNBOOK.md#2-rollback).

---

## 2 · Keys Paula could not see, and consumers Paula could not reach

Three lists have to agree — what the **relay** dispatches, what **discovery**
publishes, and what the **browser** can execute. Two disagreements, opposite
directions:

### 2.1 Four working booking keys were invisible (ADAM's H3)

`booking_prefill`, `booking_show_date`, `booking_select_slot` and
`booking_select_type` have been dispatched by `/fn/do_page_action` since #56/#77
and were **absent from `/fn/get_page_actions`**. Discovery drift hides a working
feature: an agent that cannot see a key never reaches for it. Added.

### 2.2 `scroll` and `highlight` had consumers and no key

Both have had browser-side executors for the entire life of the project —
`perch-inject.js:51/54` inside the shell's iframe, and `js/perch/page-control.js`
against the live document under the router (`PAGE_COMMANDS = scroll · scrollby ·
highlight`, shipped in #92). Both are reached through the one
`host.drive(cmd, target)` fall-through in `js/perch/command-channel.js`.

So the wire was complete end to end **except for its first inch**: no `ACTION_MAP`
entry emitted either `cmd`, so nothing Paula could say ever produced one.
`scroll_down` and friends exist because `scrollby` takes a fixed enum target and
could be spelled as four static keys; these two take a **selector**, so they need
a parameterized branch, and nobody wrote it.

Two new keys, both published:

| action_key | args | queues | executed by |
|---|---|---|---|
| `scroll_to` | `target` (or `selector`) | `{cmd:'scroll', target}` | `page-control.js` → `scrollIntoView` · `perch-inject.js` in the shell |
| `highlight` | `target` (or `selector`) | `{cmd:'highlight', target}` | `page-control.js` → 2600 ms gold ring · same in the shell |

**The selector is bounded at the edge.** `sanitizeTarget()` strips control
characters, caps at 100 chars and 6 parts, and accepts only `#id` / `.class` /
`tag` (and compounds like `section#faq`) joined by a descendant space or `>`.
Quotes, brackets, parens, commas and colons are refused with a reason and never
queued — `:has()` and attribute selectors are matching cost and surprise for no
benefit, since the consumers were written for `#id` and plain paths. A selector
is page structure, never PII, so unlike the booking args the outcome **is**
logged, which is what makes "Paula asked for a section that does not exist on
this page" findable without a live call.

**It validates by splitting, not by one big regex — CodeQL `js/redos`, high.**
The first cut was a single anchored pattern:

```js
/^[#.]?[A-Za-z0-9_-]+(?:\s*(?:>\s*)?[#.]?[A-Za-z0-9_-]+)*$/
```

Both halves of the repeated group are optional, so `[A-Za-z0-9_-]+` sits inside a
`*` with no mandatory separator between iterations — the classic `(a+)*` shape. A
long run of `-` followed by one rejected character makes the engine try every way
of splitting that run. **The 100-char cap does not save it**: 2^100 is not a
smaller number for being bounded, and this runs on the edge, on a path an agent
can call. Splitting on the combinator first removes the ambiguity rather than
hiding it: each part is then matched by a pattern whose only repetition must
begin with `#` or `.`, characters that cannot appear in `[A-Za-z0-9_-]`, so there
is exactly one parse per input. The regression test asserts the pathological
inputs are **refused** *and* return promptly — a future rewrite cannot pass by
being merely fast or merely strict.

### 2.3 The list is now checked, not eyeballed

`test/page-action.test.mjs` drives **every key `get_page_actions` publishes**
through the **real** `do_page_action` handler and fails if any of them comes back
`not_available`. The two lists cannot drift apart again without CI going red.

---

## 3 · Task 6 — what Paula's config still asks for that the relay lacks

### The honest answer: **the list is empty, because no sample exists yet.**

There is **no `NOT_AVAILABLE` log sample anywhere in this repository or in any
capture attached to it.** Searched: the whole tree, every `docs/*.md`, and every
`test/preview/*-evidence.json`. The single occurrence of a missing key in the
tree is `open_calendar` at `test/perch-qualifier-booking.test.mjs:264`, and that
is the **fixture value the instrument's own unit test feeds it** — it proves the
log line fires, and it is *not* evidence Paula emits that key. ADAM's audit says
the same thing and says not to seed the table with it. So does this document.

After this PR the reconciliation stands at:

| | count | delta |
|---|---|---|
| dispatched by `do_page_action` | **41** | 39 + `scroll_to` + `highlight` |
| advertised by `get_page_actions` | **41** | 35 + 4 booking + the 2 new |
| **published but dead** | **0** | asserted in CI |
| **dispatched but hidden** | **0** | asserted in CI |
| offered by Paula's Retell config | **unknown** | not in this repo — see below |

### A live call plus a log grep is the definitive source, and nothing else is

Stated plainly, because it is the whole point of this section:

* **Paula's action-key enum lives in the Retell tool config, not in this
  repository.** Nothing in the tree can enumerate it. No amount of code reading
  produces the list. The only way to learn a key is to watch her emit it.
* The instrument that captures it is server-side and writes to the **deployed**
  Function's log:
  `[do_page_action] NOT_AVAILABLE action_key=<key>` (`do_page_action.js:325`,
  added in #94). A local `wrangler pages dev` run exercises a different tree and
  a Preview only sees what is asked of a Preview.
* Reading that log needs `wrangler pages deployment tail` with **David's own
  Cloudflare credentials**. This order forbids entering or reading a secret, so
  the capture is David's to run — not an agent's.

**The runbook already exists and should be run as written:**
[`docs/ADAM-PERCH-KEY-AUDIT.md`](./ADAM-PERCH-KEY-AUDIT.md) — **it lands with PR #96, which is
open and unmerged, so until then read it on that branch** — §2.2 for the tail
command, §2.4 for the grep, §3 for the 29-line call script, §4.2 for the table
the capture fills in. Two amendments from this PR:

* **row #16** of ADAM's call script ("Can you highlight that for me?") is no
  longer a pure probe. If Paula's config has a highlight key **spelled
  `highlight`**, it now works. If a `NOT_AVAILABLE` line still appears there, her
  config uses a *different spelling* — and that spelling is the deliverable:
  adding an alias is a one-line change to the branch in `do_page_action.js`.
* **rows #20–#24** (the booking legs) now correspond to keys Paula can also
  *discover*, so a config regenerated from `/fn/get_page_actions` will carry
  them.

Add a row for the same reason on any scroll-to-a-section phrasing: `scroll_to` is
this repo's spelling and Paula's config may say something else.

### The hazard this PR deliberately did not touch

ADAM's **H2** stands: `goto_gold`, `goto_platinum`, `goto_diamond` and
`goto_reserve` target `/gold/`…`/reserve/`, which match `tier-basic-auth` in
`js/perch/swap-policy.js:57`. Excluded paths take `location.assign()` → a full
document load → **the live WebRTC call dies**, while the log reads
`navigate → done`. All four are advertised. `goto_home` has the same shape and is
mitigated by `homeTarget()` (`js/perch-layer.js:576`); these four have no
equivalent.

It is left alone here on purpose: this order's hard do-nots include tier-auth and
"do not break navigation", the fix is a navigation change on tier-gated paths,
and it is ADAM's finding on an open PR. It should be its own ticket.
