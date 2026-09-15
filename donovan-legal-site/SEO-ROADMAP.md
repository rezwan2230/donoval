# SEO & Google Ads Roadmap — Donovan Legal

**Goal:** a 100%-complete SEO foundation and an Ads-ready site. Paul confirmed on the
2026-07-17 call that the firm wants **full SEO and Google Ads** — which retires the
earlier "Option C now, Option B later" decision. Option B is now in scope.

**Non-negotiable constraint:** the **Perch concierge (orb + persistent Retell voice
call) must keep overlaying the site.** Nothing in this plan removes it — Option B
actually makes it a *truer* overlay (see §3).

---

## 1. Audit — verified against the repo 2026-07-17

### Already in place (stronger than the old checklist implied)
| Item | State |
|---|---|
| Canonicals | ✅ every content page. The only three without (`404`, `nav-block`, `perch`) *should not* have them |
| Meta descriptions | ✅ same three exceptions |
| `Article` schema | ✅ all **40** blog articles |
| `LegalService` schema | ✅ 28 pages · `Attorney` ×2 · `BreadcrumbList` ×8 · `Organization` ×80 |
| `robots.txt` | ✅ clean, references the sitemap |
| `404.html` | ✅ exists |
| Legacy 301s | ✅ in `_redirects` |
| Inner-page crawlability | ✅ practice areas + 40 articles — ~90% of organic value already works |

### Confirmed gaps
| # | Gap | Evidence | Impact |
|---|---|---|---|
| **G1** | **No analytics or ad tracking at all** | 0 hits for `gtag(` / `googletagmanager` / `AW-` across 103 pages | **Ads cannot launch.** No conversion tracking, no SEO baseline |
| **G2** | **Sitemap incomplete + no `lastmod`** | 71 `<loc>` vs 103 pages; `lastmod` count = 0 | Pages uncrawled; no freshness signal |
| **G3** | **Homepage is an iframe shell** | `_redirects`: `/ → /perch.html 200`, which iframes `home.html` | `/` is thin for SEO **and** a weak Ads landing page |
| **G4** | **No local signals in schema** | `geo` 0 · `openingHours` 0 · `sameAs` 0 · `aggregateRating` 0 | Weak local pack for a Delray Beach firm |
| **G5** | **No `FAQPage` / `Person` schema** | both 0 | Missed rich results + E-E-A-T on attorney bios |
| **G6** | **NAP inconsistency (live now)** | site says (561) 666-6022; GBP/directories still show the old 866 | Actively harms local ranking **today** |

---

## 2. Why the iframe now blocks **Ads**, not just SEO

Google Ads scores **landing page experience** as a Quality Score input, and the Ads
crawler evaluates the destination URL. An iframe shell as the landing page means:

- lower Quality Score → **higher CPC for the same ad position** (the firm pays more per click), and
- real risk of low-value-content / destination disapprovals.

That converts Option B from "nicer SEO" into **ad-budget efficiency**.

---

## 3. Option B — remove the iframe, keep Perch overlaying

Today Perch is a frame that **wraps** the site. After B it is a persistent layer that
**sits above** real pages — same UX, better implementation.

1. Drop shell-at-`/`; every URL serves real HTML at its real URL (no cloaking).
2. Orb + Retell call live in a persistent layer **outside** a swappable `<main>`.
3. **Swup** (~5 KB) intercepts internal links → swaps `<main>`, updates the URL, **the call never drops**.
4. Re-init per swap: Bootstrap nav/dropdowns, booking widget, tool calculators, Vantage beacon, **GA4 `page_view`**.
5. **Hardest part:** rewire Wendy's screen control from iframe `postMessage` → direct DOM
   (`do_page_action`, `booking_show_date`, `booking_prefill`), then re-test booking end-to-end.
6. Retire `home.html` — under B it duplicates `/`.

**Perch improves:** no iframe boundary, direct DOM access, no postMessage brittleness.

**Risk:** step 5 touches the booking flow stabilised 2026-07-15 → 07-17. It needs a full
re-test pass, not a smoke test.

---

## 4. Programme

Ordered so we **measure before we change**, do zero-risk work while dependencies clear,
and isolate the risky architecture change.

### Phase 1 — Crawl foundation *(no dependencies, zero risk)* — **IN PROGRESS**
- [ ] Rebuild `sitemap.xml`: every indexable page (exclude `perch`, `nav-block`, `404`), with `lastmod`
- [ ] Local signals on the `LegalService` block: `geo`, `openingHours`, `sameAs`, `areaServed`, `priceRange`
- [ ] `FAQPage` schema where Q&A content exists
- [ ] `Person` schema on attorney bio pages (Paul, Wendy, Leidy, Tefera)
- **Done when:** sitemap covers 100% of indexable pages and Rich Results Test passes for LegalService / FAQ / Person / Article.

### Phase 2 — Measurement *(blocked on Elroy — see §5)*
- [ ] GA4 base tag, implemented **SPA-aware from day one** so it survives Option B
- [ ] Google Search Console verified, sitemap submitted
- [ ] Google Ads tag (`AW-`) + conversions imported from GA4
- [ ] Conversion events: `booking_confirmed`, `call_started`, `qualifier_submitted`, `message_taken`
- **Done when:** a test booking and a test call both register as conversions.

### Phase 3 — Option B *(the architecture unlock)*
- Scope per §3.
- **Done when:** `/` serves real content, the voice call survives navigation, and the full booking flow passes re-test.

### Phase 4 — Ads readiness
- [ ] Dedicated landing page **per ad group** (tax controversy / real-estate tax / planning) — not the homepage
- [ ] Geo-targeting (FL / Palm Beach), negative-keyword list
- [ ] Call-conversion tracking on the 561-666-6022 line
- [ ] **Ad copy + landing pages reviewed against `launch/legal/FL-BAR-ADVERTISING-CHECKLIST.md`**

### Phase 5 — Content & authority *(ongoing)*
- Keyword-map the 40 articles, fill gaps, strengthen internal linking, Core Web Vitals baseline.

---

## 5. Needed from Elroy / the firm (external — blocks Phase 2, fixes G6)

1. **GA4 measurement ID** (`G-XXXXXXX`)
2. **Google Ads conversion ID** (`AW-XXXXXXX`)
3. **Search Console access** (or a DNS TXT / HTML-file verification)
4. ⚠️ **Update the phone number on Google Business Profile and every directory** to
   **(561) 666-6022**. Free, and wrong as of 2026-07-17 when the site changed.

---

## 6. Compliance

Florida Bar advertising rules apply to **ad copy and landing pages**, not just the
website. Existing controls: `launch/legal/FL-BAR-ADVERTISING-CHECKLIST.md`,
`AI-DISCLOSURE.md`, `UPL-GUARDRAIL-PROMPT-BLOCK.md`. Ads copy must clear the checklist
before launch. The Perch assistant's AI self-disclosure requirement is unchanged.

---

## 7. Decision log
- **2026-07-15 (Elroy):** ship Option C; defer Option B until the homepage must rank for competitive non-brand terms.
- **2026-07-17 (Paul, on call):** firm wants full SEO **and** Google Ads → trigger met; **Option B moves into scope** and this roadmap supersedes the C-only plan.
