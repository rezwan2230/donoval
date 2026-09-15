# Perch Qualifier → Vantage — Data Handoff Spec

**Owner (Perch side):** Elroy · **Owner (Vantage side):** David
**Status:** v2 — FULL qualifier in the modal (residency, situation, income, net
worth, and for first-time investors income-type + available-time). Paula no longer
asks any qual question by voice; all fields now arrive from `qualifier_submit` (the
modal), with `tier` and `strategy_path` derived server-side. Vantage side is
unchanged from v1 — same `/upsert-lead` fields below; only the sender changed.
**Purpose:** When Paula (the Donovan voice concierge) qualifies a **domestic real-estate**
lead, some answers are collected as tap-through cards in a modal (figures callers don't
want to say out loud) and the rest are collected by voice. All of it must land as
**structured fields on the same Vantage lead** so Leidy/Paul see a qualified, tiered lead —
not a call recording to re-listen to.

This document is the contract. Nothing here changes Vantage's existing `/upsert-lead`
linkage model — it only **adds fields** to the record.

---

## 1. Why a modal at all

Paul's Real-Estate intake script (the AI-agent version, v2.1) asks callers their household
**income band** and **net-worth band**. On a voice call people hate saying those out loud —
especially on a web call in a shared space. So Paula pops a small tap-through card on the
caller's screen: they tap a range, nobody says a number. Same for the international gate
(a compliance branch, below). Everything else Paula still asks by voice.

**Human-only tracks never touch this modal:** tax-controversy and international-inbound
investors are, per Paul, *never automated*. Paula detects them and books an orientation
call / hands off to a person. The modal is **domestic RE only**.

---

## 2. Flow

```
Paula (voice)                        Perch shell + modal                 Vantage
──────────────                       ───────────────────                 ───────
1. discloses AI, asks RE vs tax
2. RE → "let me pop a couple of
   quick tap questions on your
   screen so you don't have to
   say figures out loud"
        │ open_qualifier ───────────► modal opens (in the shell,
        │  (do_page_action)             above the iframe — survives
        │                               page nav like the call does)
                                     3. Screen 1: are you a US citizen /
                                        green-card holder, or investing
                                        from abroad / on a visa?
                                          ├─ foreign/visa ─► modal shows
                                          │   handoff card; Paula routes
                                          │   to human intake. STOP. ◄── (no $ questions)
                                          └─ citizen/GC ─► continue
                                     4. Screen 2: income band (tap)
                                     5. Screen 3: net-worth band (tap)
                                     6. "Done" ─── POST /fn/qualifier_submit ──────►
                                                     stores in bridge DO (qual:<callId>)
                                                     + forwards to /upsert-lead ────► lead gets
                                                                                      residency/income/
                                                                                      net-worth fields
        │ get_qualifier_result ◄──── reads DO (qual:<callId>), once
        │  (custom tool)
7. "Great, got it — " (she now
   has the tier signal for notes)
8. asks immersion 'track' by voice
   (first investment / portfolio /
   business) → Gold/Platinum/Reserve
9. if Gold: 2 voice follow-ups
   (income character, available time)
        │ upsert_lead ──────────────────────────────────────────────► lead gets
        │  (existing tool, extended)                                    immersion/tier/
                                                                        strategy fields
10. pulls up calendar, books
```

**Two writes, one lead.** The modal writes the sensitive fields; Paula's existing
`upsert_lead` tool writes the verbal fields. Both target the **same** Vantage lead, linked
the same way `/upsert-lead` already links today (the live call-window / `call_id`). David
does **not** need a second endpoint.

---

## 3. What David needs to do (Vantage side)

**Extend `/upsert-lead` to persist these additional fields** on the contact/lead record
(all optional; ignore unknowns). They arrive as query params (same convention as today's
`name`/`email`/`phone`) from two callers: the Perch `qualifier_submit` function and Paula's
`upsert_lead`. Link by the existing call-window mechanism (or `call_id` if present).

| Field (param) | Source | Values |
|---|---|---|
| `residency_status` | modal | `us_citizen_or_green_card` \| `foreign_or_visa` |
| `classification` | modal | `domestic` \| `international_inbound` |
| `income_band` | modal | `under_500k` \| `500k_1_5m` \| `1_5m_3m` \| `above_3m` \| `declined` |
| `net_worth_band` | modal | `under_2m` \| `2m_5m` \| `5m_15m` \| `above_15m` \| `declined` |
| `immersion_track` | Paula (voice) | `first_investment` \| `portfolio_alongside_career` \| `real_estate_is_business` \| `unsure_escape_hatch` |
| `tier` | Paula (voice) | `Gold` \| `Platinum` \| `Reserve` \| `escape_hatch` |
| `income_character` | Paula (voice, Gold only) | `w2_dominant` \| `business_dominant` \| `mixed` |
| `available_time` | Paula (voice, Gold only) | `spouse_available` \| `both_career_committed` |
| `strategy_path` | Paula (voice, Gold only) | `A` \| `B` \| `C` \| `unclear` |
| `routing_outcome` | Paula (voice) | `consultation_booked` \| `general_consultation_booked` \| `international_handoff` \| `orientation_call_booked_tax` \| `nurture_track` \| `escalated_human` |
| `qual_flags` | Paula (voice) | comma-separated, e.g. `near_miss,possible_reserve_scope` |
| `qual_source` | either | free text, e.g. `perch-web` |

**That's the whole Vantage ask:** accept + persist ~12 new optional fields on the lead.
No new endpoint, no schema migration beyond adding columns/fields. Display them in the
lead view so Leidy/Paul see `Gold · income 1.5–3M · net worth 5–15M` at a glance.

### Contract shape (OpenAPI 3.1 fragment — per house convention)

```yaml
# extends the existing GET /upsert-lead
paths:
  /upsert-lead:
    get:
      parameters:
        # ... existing: deployment, name, email, phone, visitor_id, notes ...
        - { name: residency_status, in: query, schema: { type: string, enum: [us_citizen_or_green_card, foreign_or_visa] } }
        - { name: classification,   in: query, schema: { type: string, enum: [domestic, international_inbound] } }
        - { name: income_band,      in: query, schema: { type: string, enum: [under_500k, 500k_1_5m, 1_5m_3m, above_3m, declined] } }
        - { name: net_worth_band,   in: query, schema: { type: string, enum: [under_2m, 2m_5m, 5m_15m, above_15m, declined] } }
        - { name: immersion_track,  in: query, schema: { type: string, enum: [first_investment, portfolio_alongside_career, real_estate_is_business, unsure_escape_hatch] } }
        - { name: tier,             in: query, schema: { type: string, enum: [Gold, Platinum, Reserve, escape_hatch] } }
        - { name: income_character, in: query, schema: { type: string, enum: [w2_dominant, business_dominant, mixed] } }
        - { name: available_time,   in: query, schema: { type: string, enum: [spouse_available, both_career_committed] } }
        - { name: strategy_path,    in: query, schema: { type: string, enum: [A, B, C, unclear] } }
        - { name: routing_outcome,  in: query, schema: { type: string } }
        - { name: qual_flags,       in: query, schema: { type: string, description: comma-separated } }
        - { name: qual_source,      in: query, schema: { type: string } }
      responses: { '200': { description: lead upserted } }
```

---

## 4. What Elroy builds (Perch side) — already/in this change

- `functions/fn/qualifier_submit.js` — modal POSTs here on Done. Stores answers in the
  bridge DO under `qual:<callId>` (strongly consistent, read-once) so Paula can read them,
  **and** forwards the sensitive fields to Vantage `/upsert-lead` (fire-and-forget, no
  dead-air mid-call — same pattern as `save_lead.js`).
- `functions/fn/qualifier_result.js` — Paula's `get_qualifier_result` tool reads the DO
  slot once and returns `{status, residency_status, income_band, net_worth_band, tier_hint}`.
- Modal UI in the persistent shell (survives iframe navigation like the call does).
- `open_qualifier` added to the `do_page_action` action map so Paula can trigger the modal.
- Two Retell tools registered on Paula: `open_qualifier` (fire) + `get_qualifier_result` (read).
- `save_lead.js` param whitelist extended with the verbal fields above.

## 5. Field derivation notes (so the tier is consistent)

- **tier** is derived from **immersion_track**, not asked directly:
  `first_investment→Gold`, `portfolio_alongside_career→Platinum`,
  `real_estate_is_business→Reserve`, `unsure→escape_hatch`.
- **strategy_path** (Gold only) from income_character × available_time:
  business+spouse→A, w2+spouse→B, w2+no-spouse→C, else unclear.
- **Soft gate, never a screen-out:** low income/net-worth still books (Paul wants every
  lead while volume is low). Bands are recorded for prioritization, not gating.
