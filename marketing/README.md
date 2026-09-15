# Marketing — Donovan Legal PLLC

Everything about acquiring clients: what we are doing, why, what was decided, and
what still needs a decision. Not a plan document — a working folder.

**⚠️ This folder is at the repo ROOT on purpose.** `donovan-legal-site/` is the
deployed output directory (`pages_build_output_dir: "."` in `wrangler.jsonc`), so
anything placed there is published to the public web. Budget figures, strategy
and practice-area deliberations do not belong on the firm's website.

---

## What is in here

| | |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | Every decision taken, dated, with the reasoning. **Read this first when reconsidering something** — the *why* is what you need, and it is the thing that always gets lost |
| [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) | What is blocked, and on whom |
| [`keywords/`](keywords/) | Search terms, grouped into campaigns, with landing pages and negatives |

Measurement lives in [`../docs/MARKETING-TRACKING-HANDOFF.md`](../docs/MARKETING-TRACKING-HANDOFF.md)
rather than being duplicated here. Campaign structures and creative land here when
there is something real to put in them.

---

## Where things stand — 2026-08-10

### Measurement — built, not switched on

Five PRs with David (#234, #236, #237, #238, #235). Nothing merged, nothing
deployed, nothing tracking. Switching on is a Cloudflare Secret plus a redeploy,
after Paul approves the disclaimer wording.

Until that happens the firm has **no idea** where any of its web traffic comes
from, and the four Google Ads conversion actions read Inactive.

### Advertising — nothing exists

The Google Ads account (`975-339-9396`) is fully plumbed and completely empty:
zero campaigns, zero keywords, zero spend. Conversion actions are configured
correctly — `booking_confirmed` primary, the other three secondary — and that is
the whole of it.

### The practice being marketed

Per the live site: **"a tax-first practice focused on real estate."** Tax
(planning / compliance / controversy), Real Estate (acquisition / ownership /
disposition), Special Counsel. Delray Beach, clients nationwide. Paul Donovan is
JD **and** CPA, admitted in **Florida and Massachusetts**.

Paul has also asked about **sexual harassment** and **immigration**. Neither
appears anywhere on the site or in any bio. See `OPEN-QUESTIONS.md` — this is the
oldest unanswered question in the whole effort and it shapes everything.

---

## The assets most firms do not have

Worth stating plainly, because the strategy leans on all three:

1. **~14 working calculators** — 1031, cost segregation, FIRPTA withholding, OIC estimator, STR analyzer, capital gains, entity formation. These are *landing pages*, not decoration. A FIRPTA calculator converts a foreign seller far better than any services page will.
2. **~45 counsel-approved articles**, including an eight-part controversy roadmap. Real Quality Score weight and real organic surface.
3. **A qualifier that scores the lead at the moment it converts.** Tier and matter are derived server-side during the booking. That is what lets Google bid for the *right* client instead of the *most* clients — and it is the thing almost no law firm can do, because almost none of them know what a lead is worth until months later.

---

## How to use this folder

- Something changed? Add a line to `DECISIONS.md` with the date and the reason.
- Something is stuck? It belongs in `OPEN-QUESTIONS.md` with an owner, not in someone's head.
- Numbers from Google Keyword Planner go into the keyword files, in the columns left empty for them. Estimates stay labelled as estimates until they are replaced by real figures.
