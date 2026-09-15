# Donovan Legal PLLC — Website Enhancement Plan
**Client:** Paul Donovan, CPA, Esq. — Donovan Legal PLLC  
**Location:** Delray Beach, FL  
**Bar Admissions:** Florida & Massachusetts (plus SCOTUS, 1st Cir., D. Mass.)  
**Tagline (Paul's, shipped):** "A tax-first practice focused on real estate."  
**Practice Pillars (Paul's, shipped):** Tax Planning · Tax Compliance · Tax Controversy · Real Estate  
**Reference Sites:** advisoryconnect.net (ConnexUS voice agent reference architecture)  
**Document Date:** April 2026 · *Revised May 13, 2026 — post-kickoff*

---

## ⚠️ MAJOR STATUS CHANGE — May 13, 2026 (Post-Kickoff Meeting)

**Paul has already rebuilt donovan.law himself.** Between the April redesign plan and today's kickoff meeting with the full team (Paul, David, Elroy, Veronica, Wendy, Leidy), Paul shipped a substantially complete new site that supersedes most of the "Phase 1" recommendations in the original plan below.

### What Paul Already Built (and that we should NOT rebuild)

- **Positioning tagline:** "A tax-first practice focused on real estate."
- **Four-pillar practice structure** (replaces the original three-equal-silos framing): Tax Planning · Tax Compliance · Tax Controversy · Real Estate
- **Custom SVG lifecycle wheel** (outer ring: Planning/Compliance/Controversy · inner ring: Acquisition/Ownership/Disposition · center: "One Firm")
- **"Donovan-Structured. Donovan-Defended."** signature callout — written opinions defended through exam at no extra charge
- **Three-tier Engagement page** (Gold / Platinum / Reserve) with full scope-of-work breakdown by Acquisition / Ownership / Disposition
- **Full bio page** — JD (Suffolk, *cum laude*), CPA (MA), CCM, Licensed RE Broker (MA), bars in FL/MA/SCOTUS/1st Cir./D. Mass., *Donovan v. Massachusetts Parole Board* 1st-Circuit reversal
- **Authority Magazine pull-quote** establishing the bilingual numbers-and-words CPA-attorney positioning
- **Seven interactive tools** (1031, FIRPTA, capital gains, cost seg, rental analyzer, OIC RCP, IRS notice guide)
- **Five tax-notes blog posts** live
- **Team pages** for Wendy Cardenas and Leidy Meza
- **Structured intake form** with practice-area dropdown and pre-contact legal notice

### What's Still Missing on donovan.law (THIS is our scope of work)

1. **`/gold/`, `/platinum/`, `/reserve/` are blank white pages** — nav links land on nothing
2. **No calendar / scheduling widget anywhere** — the single biggest conversion gap
3. **No AI voice concierge or chat intake** — the centerpiece of the ConnexUS engagement
4. **No CRM integration on the contact form** — submissions go nowhere structured
5. **No TCPA consent language anywhere**
6. **No Florida Bar attorney-advertising disclaimers** (mandatory before paid traffic launches)
7. **Footer is one line only** — needs NAP, phone, email, social, secondary nav, disclaimer
8. **No analytics installed** — no GA4, GTM, Meta Pixel, or conversion tracking
9. **Three blog posts are future-dated** (Oct–Nov 2026) — data error to fix
10. **Hand-coded static HTML on Bootstrap 4 + jQuery** — workable for now, but the interactive layer (agent, scheduler, CRM hooks) must be designed to coexist with that stack OR drive a phased migration to a modern build

### Revised Strategic Posture

**We are NOT redesigning donovan.law. We are enhancing it.** The visual redesign plan documented below is shelved. Our scope of work is now:

1. **AI voice concierge + intake funnel** (ConnexUS SDK, adapted from advisoryconnect.net's `portal.theconnexus.ai` agent)
2. **Calendar booking integration** via GoHighLevel (GHL) embedded on the site
3. **GHL CRM** behind the intake — Paul gets logins, encryption keys isolated, SOC 2/PII compliant
4. **Florida Bar advertising compliance layer** — disclaimers, TCPA consent, referral-agency registration
5. **Build out the three blank tier pages** (`/gold/`, `/platinum/`, `/reserve/`)
6. **Footer rebuild** + analytics + tracking
7. **Two intake funnels on the same site**: Tax Planning funnel + Tax Controversy funnel — visitor self-selects
8. **Optional Phase 2**: retool advisoryconnect.net as a parallel ad-traffic landing platform funneling qualified leads into donovan.law

The sections below are RETAINED as reference for design language, color palette, typography, and pattern-library decisions — useful when we build the tier subpages and any new interactive surfaces — but the homepage / profile / firm / contact rebuild is no longer on the roadmap. Paul shipped it.  

---

## OFFICIAL POSITIONING STATEMENT (Approved by Paul Donovan)

> Donovan Legal PLLC advises real estate developers, investors, funds, operating businesses, and the high-net-worth families behind them on the federal, state, and international tax issues that drive the economics of their structures — and represents those same clients when those structures, returns, or positions come under examination. The firm is built around a simple integration: **planning, compliance, and controversy** under one practitioner who is both a **Certified Public Accountant and an attorney admitted to practice law in Florida and Massachusetts**.

**What this means for the site (strategic implications):**

1. **Tax is the spine.** Real Estate and Business work are positioned as the *contexts* in which the firm's tax-driven counsel operates — not as three coequal silos. Every practice page should make the tax-economics connection explicit.
2. **CPA + JD is the headline credential.** This is the single most differentiating fact about Paul. It belongs in the hero eyebrow, the stats strip, the profile H1 subtitle, the footer, and the schema markup.
3. **"Planning · Compliance · Controversy"** becomes the firm's organizing triad — a three-pillar visual we can use on the homepage and the firm page in place of generic "why us" copy.
4. **"Federal · State · International"** becomes the tax scope signal — a small label/badge pattern that appears on the Taxation page hero and in case-result eyebrows.
5. **Audience hierarchy reorders:** real estate developers → investors → funds → operating businesses → HNW families. This is the order "Who We Serve" should be presented in.
6. **Two-state practice (FL + MA)** is a material credential — multi-jurisdictional capability for clients with northeast roots and Florida assets is a real-world fit for the Delray Beach HNW migration story.

---

## TABLE OF CONTENTS

1. [Design Direction](#1-design-direction)
2. [Page-by-Page Redesign Spec](#2-page-by-page-redesign-spec)
3. [Photography & Artwork Needed](#3-photography--artwork-needed)
4. [Content Needed from Paul Donovan](#4-content-needed-from-paul-donovan)
5. [Technical Implementation Plan](#5-technical-implementation-plan)
6. [Priority Order & Phasing](#6-priority-order--phasing)

---

## 1. DESIGN DIRECTION

### Strategic Framing

Both reference sites share the same target audience as Donovan Legal — high-net-worth Florida clients who are sophisticated, wealth-conscious, and expect institutional-grade presentation. The synthesis goal is to take NJP's architectural gravitas (city skyline heroes, floating CTA card, Playfair Display headings) and layer in Jesani's warmth and human credibility signals (alternating cream/sage sections, case results with dollar amounts, process transparency). Paul Donovan's solo-attorney status is not a weakness — it is a positioning differentiator: personal access, undivided attention, dual CPA + JD credentials without the overhead of a large firm.

**Brand positioning headline direction (updated to reflect positioning statement):**
> "Tax-Driven Legal Counsel for Real Estate, Operating Businesses, and the Families Behind Them."

**Supporting line:**
> "Planning. Compliance. Controversy. One CPA-Attorney. Florida and Massachusetts."

**Tone:** Authoritative without being stiff. Premium without being cold. Specific without being boastful. The voice is that of a trusted advisor who has seen serious money move and knows exactly what to do with it — and who can also defend it when the IRS shows up.

---

### 1.1 Color Palette

Paul's existing brand colors — Gold `#c1a221` and Dark Green `#074c23` — are strong raw materials. They need to be modernized: the green is too dark and slightly muddy; the gold is too yellow and reads as budget. The reference sites show exactly how to evolve this two-color formula.

**Recommended Donovan Legal Color System:**

| Role | Name | Hex | Rationale |
|------|------|-----|-----------|
| **Primary** | Deep Hunter Green | `#0D3D21` | Evolved from `#074c23` — slightly lighter, richer, more saturated. Closer to Jesani's `#1B3B2B`. Authority, wealth management, trust. |
| **Primary Hover** | Forest Green | `#164F2C` | Hover/interactive state for primary. |
| **Accent** | Antique Gold | `#B8942A` | Evolved from `#c1a221` — warmer, slightly desaturated, closer to Jesani's `#C5A059`. Reads as refined rather than cheap. Used for CTAs, eyebrows, stat numbers, phone links, icon highlights. |
| **Accent Hover** | Deep Gold | `#9E7D22` | Hover state for gold buttons. |
| **Section Alt (Light)** | Cream | `#F7F3EC` | Warm off-white for alternating sections. Pulled from Jesani's cream `#F5F0E8`. Warmer and more premium than pure white. |
| **Section Alt (Sage)** | Light Sage | `#E5EDE5` | Subtle sage green for secondary alternating sections. Mirrors Jesani's `#D9E4D7`. |
| **Background** | White | `#FFFFFF` | Primary page background for content-heavy sections. |
| **Text** | Near-Black | `#1C1C1C` | Body copy, headings on light backgrounds. |
| **Text Muted** | Warm Gray | `#5C5C5C` | Supporting copy, captions, meta text. |
| **Border** | Sage Border | `#C8D8C8` | Card borders, section dividers — subtle green tint. |
| **Dark Section BG** | Deep Green (same as Primary) | `#0D3D21` | Footer, CTA banners, hero overlays. |
| **Hero Overlay** | — | `rgba(8, 28, 15, 0.72)` | Dark green-tinted overlay on hero photography. |

**Section background rhythm (top to bottom, per page):**
1. Hero — full-bleed photography + dark green overlay
2. Stats strip — slightly lighter dark green (`#164F2C`)
3. Practice areas — White
4. Why Donovan — Cream (`#F7F3EC`)
5. Representative matters — Sage (`#E5EDE5`)
6. CTA banner — Deep Green (`#0D3D21`)
7. Footer — Deep Green (`#0D3D21`)

This alternating rhythm is the key pattern from both reference sites. It creates visual interest without using imagery in every section, and it gives the eye natural pause points.

---

### 1.2 Typography

**Font Pairing: Playfair Display + Inter**

This is the exact pairing used by NJP Legal (the closer reference for a HNW law firm), and it is the best choice for Donovan's positioning. Playfair Display carries the editorial authority of legal and financial publications. Inter is the cleanest, most readable body sans-serif on the web.

| Role | Font | Weight | Treatment | Size (desktop) |
|------|------|--------|-----------|----------------|
| **Hero H1 / Display** | Playfair Display | 700–800 | Normal + Italic accent word | 56–72px |
| **Page Banner H1** | Playfair Display | 700 | Normal, white on dark | 40–52px |
| **Section H2** | Playfair Display | 700 | Normal, dark on light | 32–44px |
| **Section H3** | Playfair Display | 600 | Normal | 22–28px |
| **Body copy** | Inter | 400 | Normal, 1.7 line-height | 16–18px |
| **Navigation links** | Inter | 600 | All-caps, 0.06em letter-spacing | 13px |
| **CTA Buttons** | Inter | 700 | All-caps, 0.05em letter-spacing | 14px |
| **Section eyebrows** | Inter | 700 | ALL-CAPS, gold color, 0.12em tracked | 11–13px |
| **Stat numbers** | Playfair Display or Inter ExtraBold | 800 | Gold color | 48–64px |
| **Stat labels** | Inter | 600 | ALL-CAPS, white/muted, tracked | 11px |
| **Card headings** | Playfair Display | 600 | Normal | 18–22px |
| **Footer headings** | Inter | 700 | ALL-CAPS, gold, tracked | 12px |
| **Footer body** | Inter | 400 | White, 0.9 opacity | 14px |

**Google Fonts import (two fonts, 6 total weights):**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,700&display=swap" rel="stylesheet">
```

**The italic accent technique:** Following NJP's pattern, key words in hero headlines should be set in Playfair Display italic to create visual contrast. Example: "Strategic Counsel for *High-Net-Worth* Real Estate, Business & Tax Matters."

**Eyebrow / section label pattern:** Every section and page hero begins with a small gold all-caps label above the heading. This is consistent across both reference sites and creates a strong rhythm.

Examples for Donovan:
- `OUR PRACTICE AREAS`
- `WHY DONOVAN LEGAL`
- `REPRESENTATIVE MATTERS`
- `THE FIRM`
- `REAL ESTATE LAW`
- `BUSINESS LAW`
- `TAXATION`
- `CONTACT US`
- `SCHEDULE A CONSULTATION`

---

### 1.3 Layout Patterns

**Hero sections (all pages):**
- Full-width, full-viewport height on homepage; 380–450px tall on inner pages
- Background: professional photography with `rgba(8, 28, 15, 0.72)` dark green overlay
- White H1 headline in Playfair Display
- White body/subheadline in Inter
- Gold accent eyebrow above H1
- Homepage only: floating dark card on right side (the NJP "consultation card" pattern)

**Stats strip:**
- Dark green band, full width, ~120px tall
- 4 horizontal stats: large number in gold (Playfair Display 800), label below in Inter all-caps white
- Appears directly below the hero on the homepage and profile page

**Content sections:**
- Max-width container: `1200px`, centered, `0 auto` margin, `0 24px` horizontal padding
- Section vertical padding: `80–100px`
- Two-column sections: 50/50 or 60/40 splits, generous `48–64px` gap
- Card grids: 2-column or 3-column, `24–32px` gap

**CTA floating card (homepage hero, right column):**
- Dark semi-transparent panel: `rgba(8, 20, 10, 0.88)` with 1px `rgba(255,255,255,0.12)` border
- "FREE & CONFIDENTIAL" overline (gold, all-caps, Inter)
- H3: "How Can We Protect What You've Built?" (Playfair Display, white)
- Brief description
- Primary CTA button (gold fill, white text, uppercase)
- Secondary CTA (outline white, phone icon, phone number)
- Micro-copy: "100% Confidential · No Obligation · Attorney-Client Privilege"

**CTA banner sections:**
- Full-width, deep green background
- Two-column: headline left, action right
- Headline: large Playfair Display white + gold italic accent word
- Right: stacked CTA buttons

**Card design system:**
- Border-radius: `8px` (cards), `4px` (buttons), `9999px` (pill elements)
- Card background: `#FFFFFF` on cream sections, `#F7F3EC` on white sections
- Card border: `1px solid #C8D8C8`
- Card shadow: `0 2px 16px rgba(13, 61, 33, 0.07)`
- Card padding: `28–36px`
- Card hover: `box-shadow: 0 6px 24px rgba(13, 61, 33, 0.14)`, `translateY(-2px)`, 200ms ease

**Practice area cards:**
- Icon at top-left: sage green square (`#E5EDE5`), dark green line icon, `48×48px`, `8px` radius
- Card heading: Playfair Display, dark
- Body: Inter, muted gray
- "Learn More →" in gold

**Case result cards (like Jesani's pattern):**
- Gold eyebrow label with practice area (e.g., `REAL ESTATE • COMMERCIAL`)
- Large result headline in Playfair Display dark green (e.g., "$12M Mixed-Use Development Financed and Closed")
- Brief description in Inter body
- No dollar amounts for active matters; use transaction descriptions

---

### 1.4 Navigation Structure

**Utility bar (top, dark green strip):**
```
Left: "Delray Beach, Florida · Serving HNW Clients Statewide"
Right: ☎ (561) XXX-XXXX  |  paul@donovan.law
```

**Main nav (white, sticky):**
```
[Donovan Legal PLLC Logo]  |  ABOUT  |  PRACTICE AREAS ▾  |  EXPERIENCE  |  CLIENTS  |  CONTACT  |  [SCHEDULE CONSULTATION] button
```

Practice Areas dropdown:
- Real Estate
- Business Law
- Taxation

**Mobile:** Hamburger → full-screen slide-out overlay menu, dark green, white links.

---

## 2. PAGE-BY-PAGE REDESIGN SPEC

---

### 2.1 Homepage (index.html)

**Purpose:** Qualify the visitor immediately as HNW, establish authority, and drive them to schedule a consultation.

---

#### Section 1: Utility Bar
- Dark green (`#0D3D21`), full width, 36px tall
- Left: "Delray Beach, Florida · Serving Florida's High-Net-Worth Community"
- Right: phone icon + `(561) XXX-XXXX` in gold · pipe · `paul@donovan.law`
- Inter, 12px, white/cream text

#### Section 2: Navigation
- White background, sticky on scroll, 72px tall
- Logo: "DONOVAN LEGAL PLLC" wordmark (Playfair Display caps + Inter all-caps subtext "ATTORNEYS AT LAW")
- Nav links: ABOUT · PRACTICE AREAS ▾ · EXPERIENCE · CLIENTS · CONTACT
- CTA button: "SCHEDULE CONSULTATION" — dark green fill, white text, `6px` radius, uppercase Inter 700
- On scroll: slight box-shadow to separate from page

#### Section 3: Hero
**Full viewport height. Background: professional South Florida hero image (Intracoastal waterway, Palm Beach skyline, or luxury real estate aerial). Dark green overlay ~72% opacity.**

**Two-column layout:**

Left column (55%):
- Eyebrow: `CPA · ATTORNEY · FLORIDA & MASSACHUSETTS` (gold, Inter 700, all-caps, 11px, 0.14em tracked)
- H1 (Playfair Display, 700, 64px, white, line-height 1.15):
  ```
  Tax-Driven Legal Counsel
  for Real Estate, Operating Businesses,
  and the Families Behind Them.
  ```
  (The word "Tax-Driven" or "Families" in Playfair Display 700 Italic, same white — creates the NJP-style typographic accent)
- Subheadline (Inter, 400, 18px, white, 0.9 opacity, line-height 1.7, max-width 480px):
  "Federal, state, and international tax issues drive the economics of complex structures — and we represent those same clients when those structures come under examination. Planning, compliance, and controversy under one CPA-Attorney."
- Vertical gold left-border accent rule (4px wide, 48px tall, `#B8942A`) — left-side accent before attorney thumbnails
- Attorney photo: Paul Donovan circular headshot, grayscale, 64×64px — with name "Paul Donovan, Esq." in white Inter and bar admissions in gold
- No stacked CTAs in left column — drive to the right card

Right column (45%):
- Floating consultation card (dark semi-transparent panel):
  - Overline: `FREE & CONFIDENTIAL` (gold, Inter 700, 11px, tracked)
  - Heading: "How Can We Protect What You've Built?" (Playfair Display, 600, 22px, white)
  - Body: "Your first consultation is fully confidential and carries no obligation — just clear answers on your legal exposure and next steps." (Inter 400, 14px, white, 0.85 opacity)
  - **Primary CTA button:** "GET YOUR FREE ASSESSMENT" (gold fill `#B8942A`, white text, full-width, uppercase, 14px Inter 700, 48px height)
  - **Secondary CTA:** "📞 CALL (561) XXX-XXXX" (outline white border, white text, full-width, same height)
  - Micro-copy: "100% Confidential · No Obligation · Attorney-Client Privilege" (Inter, 12px, white, 0.6 opacity, centered)

#### Section 4: Stats Strip
**Dark green band, slightly lighter than hero overlay (#164F2C), full width, ~130px tall.**

4 stats in a horizontal row, centered:

| Stat | Label |
|------|-------|
| **CPA + JD** | Dual Credentialed Practitioner |
| **FL + MA** | Two-State Bar Admissions |
| **25+** | Years of Practice |
| **Federal · State · International** | Tax Scope |

*Alt configuration if Paul prefers numeric stats throughout:*
| **CPA + JD** | Dual Credentialed |
| **2** | State Bars (FL & MA) |
| **25+** | Years of Practice |
| **$XXM+** | Transactions Closed |

- Numbers: Playfair Display 800 or Inter 800, gold `#B8942A`, 52px
- Labels: Inter 600, white, all-caps, 11px, 0.12em tracked, muted opacity

*Note: Replace placeholder numbers with Paul's real figures (see Section 4).*

#### Section 5: Practice Areas
**White background. Eyebrow + H2 centered above a 3-column card grid.**

- Eyebrow: `OUR PRACTICE AREAS`
- H2: "Planning. Compliance. *Controversy.*" (Playfair Display 700, 40px, dark — "Controversy" in italic)
- Subhead: "From entity structuring through return positions to IRS examination — Donovan Legal handles the full lifecycle of tax-driven legal work for real estate, operating businesses, and the families behind them." (Inter 400, 18px, muted gray, max-width 620px, centered)

*Note: This three-pillar headline replaces the previous "Real Estate / Business Law / Taxation" framing. The three cards below now represent the three lifecycle stages, with real estate / business / HNW family contexts referenced within each card.*

**3 cards:**

**Card 1 — Planning**
- Icon: blueprint / structure icon in sage square
- Heading: "Planning"
- Body: "Federal, state, and international tax structuring for real estate developers, funds, operating businesses, and the families behind them. Entity selection, transaction structuring, and the economic analysis that drives every decision."
- Link: "How We Plan →" (gold)

**Card 2 — Compliance**
- Icon: document / checklist icon in sage square
- Heading: "Compliance"
- Body: "Return positions, disclosure analysis, and ongoing compliance for complex structures — the kind of work most firms outsource and most CPAs can't fully advise on. Dual CPA + JD perspective on every filing decision."
- Link: "How We Comply →" (gold)

**Card 3 — Controversy**
- Icon: shield / scales icon in sage square
- Heading: "Controversy"
- Body: "Representation when structures, returns, or positions come under examination — IRS audits, state tax controversies, and federal court matters. The same practitioner who built the structure defends it."
- Link: "How We Defend →" (gold)

*Practice contexts (Real Estate / Business / HNW Families) are referenced as audience cohorts elsewhere on the site — in the "Who We Serve" section, the navigation, and dedicated practice pages.*

#### Section 6: Why Donovan Legal
**Cream background (`#F7F3EC`). Two-column layout.**

Left column (heading block):
- Eyebrow: `WHY DONOVAN LEGAL`
- H2: "The Caliber of Counsel Your Interests Require." (Playfair Display 700, 38px)
- Body: "Paul Donovan brings Big Four accounting experience, multi-state bar admissions, and 25+ years of practice to every engagement. This is boutique representation — not high-volume churn." (Inter 400, 17px, muted)
- CTA: "Learn About the Firm →" (gold, arrow link)

Right column (2×3 icon grid of differentiators):
1. **Big Four Alumni** — "Trained at [Firm Name], with deep accounting and financial fluency that most attorneys simply don't have."
2. **Personal Access** — "You work with Paul Donovan directly — not an associate, not a paralegal. Your matter has his full attention."
3. **Multi-Disciplinary** — "Real estate, business, and tax law handled under one roof. No need to manage multiple firms."
4. **Florida HNW Focus** — "Built exclusively for high-net-worth clients in South Florida's most demanding real estate and business markets."
5. **Absolute Discretion** — "Attorney-client privilege governs every engagement. Your financial matters stay confidential."
6. **Multi-State Licensed** — "Admitted to practice in [states], enabling counsel across state lines for complex transactions."

Each differentiator: heading in Playfair Display 600, body in Inter 400 muted, teal/gold dot accent or small icon.

#### Section 7: Representative Matters (Featured Experience)
**Sage green background (`#E5EDE5`). Case result-style cards, like Jesani's results page.**

- Eyebrow: `REPRESENTATIVE MATTERS`
- H2: "Experience That Speaks for Itself." (Playfair Display 700, 38px)
- Subhead: "A selection of notable transactions and matters across our core practice areas." (Inter 400, 17px)

**2-column card grid (4–6 cards total):**

Populate from Paul's existing experience page. Example card structure:
```
[REAL ESTATE · COMMERCIAL]                    ↗
$12M Mixed-Use Development Closed
Represented developer in acquisition, financing, 
and closing of a [X]-unit mixed-use development 
in [City], FL.
```
```
[TAXATION · CONTROVERSY]                      ↗
Multi-Year IRS Matter Resolved
Represented high-net-worth client in resolution 
of multi-year federal tax controversy involving 
[X]-figure disputed liability.
```

Cards use gold eyebrow, Playfair Display heading, Inter body, white card, sage section background.

"View All Representative Matters →" gold link below grid.

#### Section 8: CTA Banner
**Full-width, deep green background (`#0D3D21`). Two-column layout.**

Left:
- H2 (Playfair Display 700, 44px, white): "Schedule a *Confidential* Consultation."
- Body (Inter 400, 17px, white, 0.85 opacity): "Your first conversation with Paul Donovan is free, fully confidential, and carries no obligation. We'll assess your legal exposure and outline a clear path forward."
- Micro-copy: "No obligation · 100% confidential · Prompt response"

Right:
- Primary CTA: "SCHEDULE YOUR CONSULTATION" (gold fill button)
- Secondary CTA: "📞 (561) XXX-XXXX" (white outline button)

#### Section 9: Footer
**Deep green background (`#0D3D21`). Four-column layout.**

Column 1 — Brand:
- Logo: "DONOVAN LEGAL PLLC" wordmark, white
- Tagline: "Boutique Legal Counsel for High-Net-Worth Individuals."
- Phone (gold): (561) XXX-XXXX
- Email: paul@donovan.law
- Address: [Street], Delray Beach, FL XXXXX

Column 2 — PRACTICE AREAS (gold heading):
- Real Estate Law
- Business Law
- Taxation
- Representative Matters

Column 3 — THE FIRM (gold heading):
- About Paul Donovan
- The Firm
- Our Clients
- Contact

Column 4 — ADMISSIONS & CREDENTIALS (gold heading):
- Admitted: Florida Bar · [Other State] Bar
- [Federal courts if applicable]
- [Relevant affiliations]

Bottom strip (border-top, white 10% opacity):
- Copyright © 2026 Donovan Legal PLLC
- Privacy Policy · Terms of Use
- Attorney Advertising Disclaimer: "The information on this website is for general informational purposes only and does not constitute legal advice. No attorney-client relationship is formed by visiting this site. Results described are not a guarantee of future outcomes."

---

### 2.2 Attorney Profile (profile.html)

**Purpose:** Build personal trust and credential authority. This is Paul's most important conversion page after the homepage.

#### Section 1: Hero
- Full-width banner, ~420px tall
- Background: Paul's professional headshot (studio, dark backdrop) — with dark green overlay ~60% so text reads clearly, but his face is visible through the overlay at one side
- Alternative: Separate headshot image floated right, no overlay obstructing the face — hero background is solid dark green + abstract South Florida imagery
- Breadcrumb: `Home · About Paul Donovan`
- Eyebrow: `ATTORNEY PROFILE`
- H1: "Paul Donovan, CPA, Esq." (Playfair Display 700, 52px, white)
- Subheadline: "Certified Public Accountant · Attorney admitted in Florida & Massachusetts · Founder, Donovan Legal PLLC" (Inter 400, 18px, gold)

#### Section 2: Bio
**Two-column layout. White background.**

Left column (65%):
- Eyebrow: `ABOUT PAUL DONOVAN`
- H2: "Strategic Counsel. Personal Access. 25+ Years of Experience." (Playfair Display 700, 34px)
- Polished bio (3–4 paragraphs, Inter 400, 17px, muted gray):

  *Paragraph 1 — Who he is:*
  "Paul Donovan is the founder of Donovan Legal PLLC, a boutique law firm serving high-net-worth individuals, real estate developers, and business owners in South Florida. With more than 25 years of legal experience spanning real estate, business law, and taxation, Paul brings a depth of expertise that few attorneys — and no large firm — can replicate."

  *Paragraph 2 — Big Four + accounting angle:*
  "Before focusing exclusively on private legal practice, Paul honed his financial acumen at [Big Four Firm], where he worked on complex tax and transactional matters. That background gives him a fluency with accounting, financial structures, and tax implications that informs every engagement — whether negotiating a commercial acquisition, structuring a business entity, or resolving a tax controversy."

  *Paragraph 3 — Practice + client focus:*
  "Paul's practice is deliberately boutique. He serves a select group of clients — real estate investors, business principals, and families with significant assets — who expect direct attorney access, absolute discretion, and counsel that anticipates problems before they arise. He is admitted to practice in [States] and handles matters across South Florida and beyond."

  *Paragraph 4 — Location + personal:*
  "Paul is based in Delray Beach, Florida, in the heart of Palm Beach County's high-net-worth community. He is actively involved in [professional associations/community involvements, if any]."

  *(Fix "visting" typo from original bio; rewrite any awkward phrasing)*

Right column (35%):
- Professional headshot card (framed, white border, subtle shadow)
- Name + title beneath photo
- Quick-access info: Phone · Email · Schedule button

#### Section 3: Credentials Grid
**Cream background. 3-column card layout.**

- Eyebrow: `CREDENTIALS & ADMISSIONS`
- H2: "Training, Credentials, and Bar Admissions" (Playfair Display 600, 32px)

Card 1 — Admitted to Practice:
- List of bar admissions (Florida, [other states], federal courts if applicable)
- Court admission dates if notable

Card 2 — Education:
- Law school name, degree, year
- Undergraduate institution, degree, year
- [Any honors, law review, etc.]

Card 3 — Professional Affiliations:
- Florida Bar Association
- [Real Property, Probate and Trust Law Section — if applicable]
- [Business Law Section]
- [Tax Law Section]
- [Local bar associations]
- [Any CPA credential if still maintained]

#### Section 4: Career Highlights
**White background. Numbered or timeline-style layout.**

- Eyebrow: `CAREER HIGHLIGHTS`
- H2: "A Career Built on Complex, High-Stakes Matters"
- 3–4 milestone cards or horizontal timeline:
  - [Big Four firm] — Tax and transactional work
  - Massachusetts practice — [Description of focus]
  - Florida practice — Donovan Legal PLLC, Delray Beach
  - [Any notable matter or achievement]

#### Section 5: Consultation CTA
- Full-width dark green banner
- "Work Directly with Paul Donovan"
- Subhead + two CTAs (form or link + phone)

---

### 2.3 The Firm (ourfirm.html)

**Purpose:** Establish institutional credibility for a solo practice. Frame the boutique model as a feature, not a limitation.

#### Section 1: Hero
- Background: South Florida imagery — Atlantic Avenue, Delray Beach, or Palm Beach. The geography signals local roots and premium market.
- H1: "The Firm Behind the Counsel" (echoing NJP's "The Firm Behind the Fortress")
- Subhead: "A boutique practice built for the complexity of high-net-worth legal matters."

#### Section 2: Firm Overview
**Two-column. White background.**

Left:
- Eyebrow: `DONOVAN LEGAL PLLC`
- H2: "Boutique. Selective. Comprehensive."
- Expanded firm narrative (3 paragraphs):

  *Paragraph 1 — The firm's identity:*
  "Donovan Legal PLLC is a boutique law firm based in Delray Beach, Florida, serving a deliberately selective clientele of high-net-worth individuals, real estate developers, and business owners. Founded by Paul Donovan, the firm provides the integrated legal counsel that complex wealth and business interests demand — across real estate, business law, and taxation."

  *Paragraph 2 — The boutique advantage:*
  "Large firms charge large-firm rates and route matters through teams of associates. At Donovan Legal, every engagement is handled personally by Paul Donovan — with 25+ years of experience, Big Four accounting training, and multi-state bar admissions brought directly to your matter. There are no hand-offs. There is no assembly line."

  *Paragraph 3 — Market and client:*
  "The firm's clients include real estate developers closing transactions across South Florida, business owners navigating formation, acquisition, and exit, and high-net-worth individuals with tax planning and controversy needs. Many clients retain the firm for ongoing counsel across multiple practice areas."

Right:
- Key fact cards (3 stacked):
  - Founded: [Year], Delray Beach, FL
  - Practice Areas: Real Estate · Business Law · Taxation
  - Bar Admissions: [States listed]

#### Section 3: Practice Philosophy
**Cream background. Centered headline + 2×2 philosophy cards.**

- Eyebrow: `OUR PHILOSOPHY`
- H2: "The Principles That Define Us"

4 cards:
1. **Proactive, Not Reactive** — "We anticipate issues before they become problems. Clients with complex assets and active transactions need counsel that stays ahead of the curve."
2. **Holistic Strategy** — "Real estate, business, and tax are interconnected. Our integrated practice means you receive counsel that accounts for the full picture."
3. **White-Glove Service** — "Every client receives direct access to Paul Donovan. Your calls are returned. Your questions are answered. Your matters are prioritized."
4. **Absolute Discretion** — "Attorney-client privilege governs everything. The financial and transactional details of our clients' lives are held in strictest confidence."

#### Section 4: Client Focus
**Sage green background. 3-column icon cards.**

- Eyebrow: `WHO WE SERVE`
- H2: "Clients With Complex Needs and High Stakes"

Columns:
1. Real Estate Investors & Developers — Acquisition, development, financing, and disposition of residential and commercial real estate throughout Florida.
2. Business Owners & Entrepreneurs — Entity formation, operational agreements, M&A, and succession planning for closely held businesses.
3. High-Net-Worth Individuals & Families — Tax planning, controversy representation, and estate-connected legal matters for individuals with substantial assets.

#### Section 5: Location
**White background. Two-column: text left, embedded Google Map right.**

- Office address: [Full address], Delray Beach, FL
- Phone, email
- Hours: [Business hours]
- Google Maps embed (right column, rounded corners, border)
- Nearby: Palm Beach County, Boca Raton, Fort Lauderdale, West Palm Beach

#### Section 6: CTA Banner (standard)

---

### 2.4 Real Estate (real-estate.html)

**Purpose:** Establish authority in the largest practice area by transaction volume. Target developers, investors, and institutional buyers.

#### Section 1: Hero
- Background: Luxury real estate photography — aerial of a South Florida development, luxury waterfront property, or Palm Beach skyline at dusk
- Eyebrow: `REAL ESTATE LAW`
- H1: "Real Estate Counsel for *High-Stakes* Florida Transactions."
- Subhead: "Residential, commercial, development, financing, and landlord-tenant matters for investors, developers, and institutions."

#### Section 2: Stat Strip
- Dark green, 3–4 stats related to real estate work:
  - `$XXM+` in Transactions Closed
  - `XX+` Years in FL Real Estate Law
  - `Residential & Commercial` Practice Scope
  - `Multi-State` Transaction Experience

#### Section 3: Services Offered
**White background. 2×3 card grid.**

- Eyebrow: `PRACTICE SCOPE`
- H2: "Full-Service Real Estate Representation"

6 service cards:
1. **Residential Transactions** — Buyer/seller representation, contract review, title matters, and closings for luxury residential property across South Florida.
2. **Commercial Transactions** — Acquisition, disposition, and leasing of commercial property, including office, retail, industrial, and mixed-use.
3. **Real Estate Development** — Legal support for developers from site acquisition through entitlement, financing, and sale, including formation of development entities.
4. **Real Estate Financing** — Representation of borrowers and lenders in mortgage, mezzanine, and construction financing for commercial and residential transactions.
5. **Landlord-Tenant** — Drafting and negotiating commercial leases, landlord representation in disputes, and tenant rights counsel for high-value rental situations.
6. **1031 Exchanges** — Guidance on like-kind exchange requirements, timing, and qualified intermediary coordination for real estate investors.

#### Section 4: Representative Matters
**Cream background. Case result cards.**

- Eyebrow: `REPRESENTATIVE MATTERS`
- H2: "Real Estate Experience That Speaks for Itself."
- 4–6 case result cards, filtered to real estate matters from Paul's experience page
- Each card: practice sub-area label, transaction description (dollar amounts where permitted), brief narrative
- "View All Matters →" link

#### Section 5: "Why Donovan Legal for Real Estate"
**Sage background. 3-column differentiator grid.**

- Big Four tax background means every real estate transaction is analyzed for its tax implications
- Deep familiarity with Florida real estate law, title practice, and local market dynamics
- Direct attorney involvement — not delegated to a junior associate
- Integrated business and tax counsel available for structuring and entity matters

#### Section 6: CTA Banner (standard — "Schedule a Confidential Consultation")

---

### 2.5 Business Law (business-law.html)

#### Section 1: Hero
- Background: Corporate imagery — contract signing, boardroom, handshake — luxury setting, South Florida context preferred
- Eyebrow: `BUSINESS LAW`
- H1: "Business Legal Counsel for *Serious* Entrepreneurs and Operators."
- Subhead: "Entity formation, M&A advisory, contracts, governance, and partnership matters for closely held businesses and their owners."

#### Section 2: Services
**White background. 2×3 card grid.**

6 service cards:
1. **Entity Formation & Structuring** — Formation of LLCs, corporations, and partnerships for new ventures and business restructurings, with attention to tax treatment and liability protection.
2. **Mergers & Acquisitions Advisory** — Legal representation in the acquisition and sale of closely held businesses, including due diligence, structuring, and closing.
3. **Commercial Contracts** — Drafting, reviewing, and negotiating commercial agreements, vendor contracts, services agreements, and terms of sale.
4. **Corporate Governance** — Operating agreements, shareholder agreements, board resolutions, and governance documents for operating businesses.
5. **Partnership & JV Agreements** — Joint venture structuring and partnership agreements for real estate and business ventures, including profit-sharing and dispute mechanisms.
6. **Business Succession Planning** — Ownership transition planning, buy-sell agreements, and succession structures for closely held businesses with multi-generational considerations.

#### Section 3: Representative Matters
**Cream background. Case result cards — business law matters from experience page.**

#### Section 4: Why Donovan Legal for Business
- Big Four accounting background directly applicable to M&A, valuation, and entity structuring
- Tax and real estate law integration — most business matters have both dimensions
- Direct counsel — owners and principals deserve direct attorney access
- Florida-specific entity and governance expertise

#### Section 5: CTA Banner (standard)

---

### 2.6 Taxation (taxation.html)

#### Section 1: Hero
- Background: Financial imagery — tax documents, consultation meeting, professional advisory setting
- Eyebrow: `TAXATION`
- H1: "Tax Counsel with *Big Four* Depth and Personal Attention."
- Subhead: "Tax planning, controversy representation, and business formation tax strategy for high-net-worth individuals and their enterprises."

#### Section 2: Services
**White background. 2×3 card grid.**

6 service cards:
1. **Tax Planning** — Proactive planning for high-net-worth individuals, real estate investors, and business owners, including entity selection, income timing, and deduction strategies.
2. **Tax Controversy & IRS Representation** — Representation in IRS audits, appeals, and collection matters, with particular experience in complex individual and business returns.
3. **Business Formation Tax Strategy** — Tax-optimized structuring of new entities, considering pass-through treatment, self-employment tax, and state tax exposure.
4. **Real Estate Tax Matters** — Depreciation, passive activity, like-kind exchange, and state and local tax issues specific to real estate investors and developers.
5. **State & Local Tax** — Florida, Massachusetts, and multi-state tax compliance and controversy issues for businesses and individuals operating across state lines.
6. **Business Acquisitions & Sales** — Tax structuring of M&A transactions, including asset vs. stock elections, earnout arrangements, and installment sale planning.

#### Section 3: Representative Matters
**Cream background. Case result cards — taxation matters.**

The differentiating card here (mirroring Jesani's qualifier): "Paul Donovan has represented clients in multi-year IRS matters involving six- and seven-figure disputed liabilities." Dollar amounts where permitted and appropriate.

#### Section 4: Why Donovan Legal for Tax
- Big Four training (not just law school theory — real-world tax practice)
- Integrated real estate and business law means tax strategy is never siloed
- Direct attorney representation — no enrolled agent intermediary
- Admitted in [states] — handles multi-state matters

#### Section 5: CTA Banner (standard)

---

### 2.7 Experience (experience.html)

**Purpose:** Full inventory of representative matters, organized and presented like case results — borrowing Jesani's card treatment aggressively.

#### Section 1: Hero
- Dark green background (no photo needed — full solid dark green)
- Eyebrow: `REPRESENTATIVE MATTERS`
- H1: "Real Cases. Real Transactions. Real Results."
- Subhead: "A selection of representative matters across real estate, business, and taxation. Outcomes described are specific to those matters and do not guarantee future results."

#### Section 2: Filter Bar
- 4 pill/tab buttons: ALL | REAL ESTATE | BUSINESS LAW | TAXATION
- JavaScript filter — show/hide cards by category tag
- Dark green active state, white inactive

#### Section 3: Case Result Cards (Full Grid)
**White background. 2-column grid.**

All matters from Paul's existing experience page, reformatted as case result cards:

Card anatomy:
```
[REAL ESTATE · COMMERCIAL]                                    ↗
$15M Office Complex Acquisition and Financing Closed

Represented purchaser in the acquisition and permanent financing 
of a 120,000 sq ft office complex in [City], FL. Transaction 
involved negotiation of purchase agreement, due diligence 
coordination, and review of $15M construction and permanent 
financing package.
```

Organize under implicit section dividers (no literal dividers, just category eyebrow on each card):
- Real Estate cards first (most by volume, likely)
- Business Law cards
- Taxation cards

"More matters available upon request" statement at bottom.

#### Section 4: CTA Banner

---

### 2.8 Contact (contact.html)

**Purpose:** Lowest friction conversion. Match Jesani's contact page structure — calendar/booking anchor with sidebar info.

#### Section 1: Hero
- Dark green, moderate height (~280px)
- Eyebrow: `CONTACT US`
- H1: "Schedule a Confidential Consultation."
- Subhead: "Your first conversation is free, fully confidential, and carries no obligation."

#### Section 2: Consultation Booking (Main Content)
**White background. Two-column: booking widget left, info sidebar right.**

Left (main, 65%):
- Calendar icon (sage square, dark green icon)
- H2: "Request Your Free Strategy Call" (Playfair Display 600, 28px)
- Body: "Complete the form below or call directly to schedule. Paul Donovan will personally review your inquiry and respond promptly." (Inter 400)
- **Intake form fields:**
  - First Name* | Last Name*
  - Email* | Phone*
  - Practice Area (dropdown): Real Estate · Business Law · Taxation · Multiple / Not Sure
  - Brief Description of Your Matter (textarea, 4 rows)
  - Preferred Contact Method: Phone · Email · Either
  - Best Time to Reach You: Morning · Afternoon · Evening
  - [Submit button: "SEND INQUIRY" — gold fill, white text, full-width]
- **SMS consent language (TCPA):** "By submitting this form, you consent to receive text messages from Donovan Legal PLLC at the phone number provided. Message and data rates may apply. Reply STOP to unsubscribe. [Privacy Policy]"
- Micro-copy: "No obligation · 100% confidential · We respond within [X] business hours"

Right sidebar (35%):
- **Contact Information card** (white, border, padding):
  - Phone icon + (561) XXX-XXXX (gold, clickable tel: link)
  - Email icon + paul@donovan.law
  - Hours: Monday–Friday, 9:00am–6:00pm ET; Evenings by appointment
- **Office Location card:**
  - Address block: [Street], Delray Beach, FL XXXXX
  - "Serving Palm Beach, Broward, and Miami-Dade Counties"

#### Section 3: Map
- Full-width Google Maps embed, ~350px tall, rounded corners
- Centered on Donovan Legal office address, Delray Beach
- Standard Maps pin

#### Section 4: CTA Banner (lighter version — "Call Us Directly")
- Dark green, simpler — just phone number centered in large gold type, with "or email paul@donovan.law" below

---

### 2.9 Clients (the-cmm.html)

**Purpose:** Describe who Donovan Legal serves, create identification and belonging for ideal clients, and begin building a trust signal layer.

*Note: The existing URL slug "the-cmm.html" should be updated to "clients.html" or "who-we-serve.html" for clarity.*

#### Section 1: Hero
- Background: Aspirational South Florida imagery — private waterfront, corporate event, or financial district aerial
- Eyebrow: `WHO WE SERVE`
- H1: "Clients Who Expect Counsel That Matches Their Ambitions."
- Subhead: "Donovan Legal PLLC serves a select group of high-net-worth individuals, real estate developers, and business principals across Florida."

#### Section 2: Client Types
**White background. 3-column icon cards — who we serve.**

Card 1: **Real Estate Developers & Investors**
"Real estate principals — from individual investors closing luxury residential transactions to developers managing multi-million dollar commercial projects — rely on Donovan Legal for counsel that covers the full transaction lifecycle."

Card 2: **Business Owners & Entrepreneurs**
"Closely held business owners, operating company principals, and entrepreneurs in formation or transition stages engage Donovan Legal for entity structuring, M&A support, governance, and contract work."

Card 3: **High-Net-Worth Individuals & Families**
"Individuals and families with significant assets — often including both real estate holdings and operating businesses — benefit from the integrated approach Donovan Legal brings to tax planning, legal structuring, and transactional work."

Additional row (or sub-cards):
- Private Equity & Equity Fund Managers (as noted in existing "the-cmm.html" content)
- Multi-State Operators (Florida-based with interests or operations in other jurisdictions)

#### Section 3: Industries Served
**Cream background. Pill/tag cloud or 2-column list.**

- Residential Real Estate
- Commercial Real Estate
- Mixed-Use Development
- Hospitality & Hotels
- Technology & SaaS
- Professional Services
- Healthcare & Medical Practices
- Family Office & Private Wealth
- Private Equity Backed Businesses

#### Section 4: Trust Signals (Placeholder — Content Dependent)
**Sage background.**

Options depending on what Paul can provide:
- **Option A (preferred):** 3 anonymized client testimonials — "A real estate developer in Palm Beach County," "A technology company founder in Boca Raton," etc. Pull real quotes with permission, anonymized.
- **Option B (if no testimonials):** 3 case result vignettes (from experience page) framed as client success narratives, without identifying details.
- **Option C (minimal):** Section removed; replace with a "How We Work" 3-step process section.

Testimonial card design (if used):
- White card, quote mark in gold (large, decorative, Playfair Display)
- Quote text in Playfair Display italic, 20px
- Attribution: "— Real Estate Developer, Palm Beach County" (Inter, small, muted)

#### Section 5: CTA Banner (standard)

---

## 3. PHOTOGRAPHY & ARTWORK NEEDED

### 3.1 Professional Photography (Must Schedule Shoot)

**A. Paul Donovan — Studio Portrait Session**

Primary deliverable. This is the most important shoot.

- **Setting:** Professional studio, dark or charcoal backdrop — matching the aesthetic of both reference sites (dark, premium, authoritative)
- **Wardrobe:** Dark suit, white or light blue shirt, conservative tie (or open collar for one alternative set). Avoid patterns that photograph poorly.
- **Lighting:** Rembrandt or split lighting — directional, shadows that add depth and authority
- **Poses required:**
  1. **Primary headshot** — Straight-on, professional expression, 3/4 crop from chest up. This is the homepage and profile page main photo.
  2. **Relaxed ¾ turn** — Looking slightly off-camera, slight smile. Approachable variation.
  3. **Seated at desk** — Arms resting on desk surface, legal materials or documents in soft-focus background. Good for "why choose me" sections.
  4. **Standing in office or library** — Full-length or 3/4 length, bookshelf background. Conveys gravitas and experience.
- **Output requirements:** Minimum 3000×4000px raw + edited. Deliver in both color and black-and-white (for grayscale card treatment like reference sites).
- **Photographer guidance:** Look for portrait photographers specializing in attorney or executive headshots in the Palm Beach/Boca Raton area. Budget: $800–$1,500 for a proper session.

**B. Paul Donovan — Environmental Portraits**

Secondary set, used in interior page sections and "How We Work" areas:
- At desk reviewing documents (legal pad, pen, laptop)
- In consultation pose (across desk from implied client position)
- Walking toward camera in office hallway (movement shot)
- Outside courthouse or professional building in Delray Beach

**C. Office Interior (If Applicable)**
- If Paul has a presentable office, shoot: reception area, conference/meeting space, desk with city view or windows, law library if available
- These images can anchor the "The Firm" page and the contact page
- Minimum 2000×1500px, natural light preferred

### 3.2 Stock Photography (Can Source Immediately)

Source from Unsplash (free), Pexels (free), or Shutterstock/Getty ($) at appropriate license level.

**Hero images needed by page:**

| Page | Image Direction | Search Terms |
|------|----------------|--------------|
| Homepage | South Florida skyline, Intracoastal waterway at dusk, Palm Beach aerial | "palm beach aerial luxury", "intracoastal waterway florida sunset", "south florida skyline dusk" |
| Homepage (alt) | Luxury residential property exterior, waterfront estate | "luxury waterfront home florida", "palm beach estate aerial" |
| Profile Page | Dark professional backdrop OR attorney library | "attorney office dark", "legal library books" |
| The Firm | Atlantic Avenue Delray Beach, downtown Delray, local South Florida landmark | "Delray Beach Atlantic Avenue", "Palm Beach County architecture" |
| Real Estate | Commercial real estate, luxury development, skyline | "luxury commercial real estate aerial", "construction development site florida", "commercial building closing" |
| Business Law | Professional handshake, contract signing, boardroom | "business handshake luxury", "contract signing professional", "corporate boardroom" |
| Taxation | Financial documents, tax consultation meeting, professional | "tax consultation meeting", "financial documents desk", "irs documents professional" |
| Experience | Abstract or neutral dark professional background | Same as Profile or solid dark green |
| Contact | Welcoming professional environment | "modern law office reception", "professional waiting area" |
| Clients | Private waterfront, financial district, luxury setting | "private estate south florida", "palm beach financial district" |

**Stock selection criteria:**
- No generic clip-art or cheesy legal imagery (no gavel close-ups, no law books stacked artificially)
- Warm tones that work with the dark green overlay (avoid blue-tinted or cool images)
- South Florida context where possible (water, palm trees, warm light)
- Professional and aspirational — the client in these images is implicitly wealthy

### 3.3 Design Assets to Create

**A. Logo / Wordmark**
- "DONOVAN LEGAL PLLC" in Playfair Display Small Caps or Inter 700, all-caps
- Tagline beneath: "ATTORNEYS AT LAW" in Inter 600, smaller, tracked
- Color versions: Full color (white on dark green, dark green on white), gold on dark green, monochrome
- File formats: SVG (primary), PNG at 2×, favicon ICO/SVG
- Size guide: 200×60px standard, 40×40px favicon

**B. Practice Area Icons (3)**
- Style: Line icons, thin stroke (~2px), clean and minimal
- Size: 32×32px, displayed in 48×48px sage green rounded square container
- Icons needed:
  - Real Estate: Building outline or house-with-key
  - Business Law: Briefcase or handshake outline
  - Taxation: Document with dollar sign or scales of justice
- Source: Lucide React (already used by Jesani), Heroicons, or Phosphor Icons — all free

**C. "Why Donovan" Differentiator Icons (6)**
- Same style as practice area icons — line, thin, sage square background
- Icons: person with briefcase, shield, grid/holistic, map pin, lock, scale/balance

**D. Social Proof / Stat Backgrounds**
- The stats strip needs no special artwork — it is CSS only (dark green section + styled text)

**E. Open Graph / Social Sharing Image**
- 1200×630px
- Dark green background
- "DONOVAN LEGAL PLLC" centered wordmark
- Tagline: "Strategic Legal Counsel for High-Net-Worth Clients"
- Gold accent line or detail

**F. Favicon**
- "DL" monogram in Playfair Display or simple "D" initial
- 32×32px and 16×16px ICO
- Dark green background, gold letterform

---

## 4. CONTENT NEEDED FROM PAUL DONOVAN

The following is an exhaustive list of content items that must be obtained from Paul Donovan before the site can go live. Items are marked by priority.

### 4.1 MUST HAVE (Block Launch)

**[ ] 1. Bio Approval**
- Review and approve the rewritten bio (this document provides a draft)
- Confirm: Big Four firm name, dates, specific role
- Confirm: Which states he is admitted to practice in (FL + MA + others?)
- Confirm: Whether he wants to mention his Massachusetts practice years explicitly
- Correct "visting" → "visiting" (and review all other current bio content)

**[ ] 2. Bar Admissions — Complete List**
- All state bars he is admitted to with admission dates
- Federal court admissions (U.S. District Court(s), U.S. Tax Court if applicable)
- U.S. Tax Court admission is a significant credential for the Taxation page — confirm

**[ ] 3. Education — Complete Details**
- Law school: name, degree (J.D.), graduation year
- Undergraduate: institution, degree, graduation year
- Any honors (magna/summa cum laude, law review, moot court, etc.)
- Any advanced degree (LL.M. in Taxation? — this would be a major credential)

**[ ] 4. Real Statistics for Stats Strip**
- Number of years in practice (estimated 25+ — confirm)
- Dollar volume of real estate transactions (total career if possible, or estimate)
- Number of states served/admitted
- Any other notable quantitative credential

**[ ] 5. Professional Headshot**
- Approve use of existing headshot for placeholder (or schedule new shoot)
- Provide highest-resolution version available

**[ ] 6. Office Address**
- Complete mailing address: street number, suite, Delray Beach, FL, ZIP
- Confirm office is presentable (for map pin and potential photo)
- Hours of operation for Contact page

**[ ] 7. Contact Information**
- Primary phone number for the site
- Preferred email (paul@donovan.law if active, or alternative)
- Whether to display a fax number (unusual but some real estate and legal matters still use fax)

**[ ] 8. Complete Representative Matters List**
- Full list of matters he is willing to disclose (dollar amounts where permitted)
- Grouped by: Real Estate | Business Law | Taxation
- For each: type of matter, role (represented purchaser/seller/borrower/lender/client), general dollar size or outcome description, jurisdiction
- Note which matters can be described with dollar amounts vs. which need anonymization

### 4.2 SHOULD HAVE (Significantly Improve the Site)

**[ ] 9. Big Four Firm Name**
- Is he willing to identify the specific Big Four firm? This is a major credential signal.
- If not, "Big Four accounting firm" is still effective

**[ ] 10. Professional Affiliations**
- Florida Bar sections (Real Property, Probate & Trust Law Section; Business Law Section; Tax Law Section — which does he belong to?)
- Local bar associations (Palm Beach County Bar Association, etc.)
- Any real estate industry associations (ULI, ICSC, NAIOP)
- Any CPA license (if maintained — extremely rare and valuable for a tax attorney)

**[ ] 11. Awards & Recognitions**
- Florida Super Lawyers, AV Preeminent by Martindale-Hubbell, Best Lawyers, or similar ratings
- Peer recognition publications
- Any speaking engagements, publications, or quoted press coverage

**[ ] 12. Firm Description — Expanded**
- Year the firm was founded
- Whether he has any of-counsel relationships, affiliated counsel, or other firm infrastructure
- Whether he has staff (paralegal, legal assistant, office manager)

**[ ] 13. Client Testimonials**
- Even 2–3 anonymized testimonials ("A Palm Beach real estate developer told us...") make a significant impact
- Can use verbatim quotes with client approval + anonymization, or paraphrase with approval
- Must comply with Florida Bar advertising rules on testimonials

**[ ] 14. Case Results with Dollar Amounts**
- Specific transaction amounts or resolution figures (where client consents and rules permit)
- Format: "Represented [client type] in [matter type] with [outcome description] involving [dollar amount]"
- Examples from his experience page can be expanded with amounts if permitted

### 4.3 NICE TO HAVE (Phase 2–3 Addition)

**[ ] 15. Press Mentions**
- Any press coverage, interviews, or media mentions
- Publications that have quoted him as an expert

**[ ] 16. Community Involvement**
- Any board memberships, nonprofit involvement, local civic roles
- Adds human dimension and local roots to the profile page

**[ ] 17. Long-Form Practice Area Descriptions**
- 500–800 word descriptions for each of the 3 practice pages
- Can be drafted from interview notes — but Paul must review and approve for accuracy

**[ ] 18. FAQ Content**
- 5–10 frequently asked questions per practice area (for an FAQ page in Phase 3)
- These drive significant organic search traffic

**[ ] 19. Specific Dollar Volume Stats**
- The NJP site uses "$2B+ in Assets Protected" — does Paul have a comparable career-total real estate transaction volume?
- Even a conservative "$XXM+ in Real Estate Transactions Closed" is a strong credential

---

## 5. TECHNICAL IMPLEMENTATION PLAN

### 5.1 Framework Recommendation: React + Vite + Tailwind CSS

**Recommendation: Rebuild in React + Vite + Tailwind.**

Rationale:
- Both reference sites (NJP Legal and Neil Jesani Tax Resolution) are built in React SPA architecture with Vite — confirming this is the modern standard for this tier of legal website
- Component-based architecture makes it trivial to maintain consistent section patterns across 9+ pages
- Tailwind CSS enables the exact token-based design system described in Section 1 without writing custom CSS from scratch
- The existing GCP Cloud Run + Cloud Build infrastructure is fully compatible — Vite builds to a static `/dist` folder that deploys identically to the current HTML site
- Framer Motion (or CSS animations) integrates naturally for scroll-triggered fade-ins and stat count-ups
- Future Legal Concierge widget integration is simpler in a component-based architecture

**Alternative (not recommended):** Enhancing current static HTML + CSS — possible but results in unmaintainable duplicated markup across all 9+ pages. Every global change (nav update, footer update, CTA wording) would require editing every file individually.

### 5.2 Project Structure

```
donovan-law/
├── public/
│   ├── favicon.ico
│   ├── og-default.png
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── UtilityBar.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Footer.jsx
│   │   ├── sections/
│   │   │   ├── Hero.jsx              # Reusable hero with configurable content
│   │   │   ├── StatsStrip.jsx        # Dark green stats row
│   │   │   ├── PracticeCards.jsx     # 3-column practice area cards
│   │   │   ├── DifferentiatorGrid.jsx # Why Donovan Legal section
│   │   │   ├── CaseResults.jsx       # Case result card grid
│   │   │   ├── CTABanner.jsx         # Full-width dark green CTA
│   │   │   └── ConsultationCard.jsx  # Floating hero intake card
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Card.jsx
│   │       ├── Eyebrow.jsx
│   │       └── SectionHeader.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Profile.jsx
│   │   ├── OurFirm.jsx
│   │   ├── RealEstate.jsx
│   │   ├── BusinessLaw.jsx
│   │   ├── Taxation.jsx
│   │   ├── Experience.jsx
│   │   ├── Contact.jsx
│   │   └── Clients.jsx
│   ├── data/
│   │   ├── matters.js           # All representative matters (filterable)
│   │   ├── credentials.js       # Bar admissions, education, affiliations
│   │   └── content.js           # Site-wide copy strings
│   ├── styles/
│   │   └── globals.css          # Tailwind @layer base, fonts, custom utilities
│   ├── App.jsx                  # Router + layout wrapper
│   └── main.jsx                 # Vite entry point
├── index.html                   # Vite HTML shell
├── tailwind.config.js           # Token-based design system
├── vite.config.js
└── package.json
```

### 5.3 Tailwind Design Tokens

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D3D21',
          hover:   '#164F2C',
        },
        accent: {
          DEFAULT: '#B8942A',
          hover:   '#9E7D22',
        },
        cream:  '#F7F3EC',
        sage:   '#E5EDE5',
        border: '#C8D8C8',
        body:   '#1C1C1C',
        muted:  '#5C5C5C',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
}
```

### 5.4 Routing

Use React Router v6 with these routes:

| Route | Component | Legacy URL |
|-------|-----------|------------|
| `/` | Home | index.html |
| `/about` | Profile | profile.html |
| `/the-firm` | OurFirm | ourfirm.html |
| `/real-estate` | RealEstate | real-estate.html |
| `/business-law` | BusinessLaw | business-law.html |
| `/taxation` | Taxation | taxation.html |
| `/experience` | Experience | experience.html |
| `/contact` | Contact | contact.html |
| `/clients` | Clients | the-cmm.html |

Set up 301 redirects for legacy `.html` URLs → new clean paths.

### 5.5 Legal Concierge Widget Integration

Embed point is a `<div id="legal-concierge-widget" />` rendered conditionally on:
- Homepage: Below the stats strip (before Practice Areas section)
- Contact page: Below the intake form
- Any practice area page: As a sidebar or inline section

Widget toggle via environment variable `VITE_SHOW_CONCIERGE=true/false` so it can be enabled/disabled without code changes. Script tag loads asynchronously in `<head>` only when the env variable is enabled.

### 5.6 SEO Implementation

**Meta tags (per page):**
```html
<!-- Example: Homepage -->
<title>Donovan Legal PLLC | Real Estate, Business & Tax Law | Delray Beach, FL</title>
<meta name="description" content="Boutique legal counsel for high-net-worth individuals in South Florida. Real estate, business law, and taxation. Paul Donovan, Esq. — Delray Beach. Schedule a free confidential consultation." />
<link rel="canonical" href="https://donovan.law/" />

<!-- Open Graph -->
<meta property="og:title" content="Donovan Legal PLLC — Strategic Legal Counsel" />
<meta property="og:description" content="Boutique representation for high-net-worth real estate, business, and tax matters in South Florida." />
<meta property="og:image" content="https://donovan.law/og-default.png" />
<meta property="og:url" content="https://donovan.law/" />
```

**Schema Markup — LocalBusiness + Attorney:**
```json
{
  "@context": "https://schema.org",
  "@type": ["LegalService", "LocalBusiness"],
  "name": "Donovan Legal PLLC",
  "description": "Boutique legal counsel for high-net-worth individuals. Real estate, business law, and taxation.",
  "priceRange": "$$$$",
  "url": "https://donovan.law",
  "telephone": "+1-561-XXX-XXXX",
  "email": "paul@donovan.law",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[Street Address]",
    "addressLocality": "Delray Beach",
    "addressRegion": "FL",
    "postalCode": "XXXXX",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "XX.XXXXX",
    "longitude": "-XX.XXXXX"
  },
  "openingHours": "Mo-Fr 09:00-18:00",
  "areaServed": ["Delray Beach, FL", "Palm Beach County, FL", "South Florida", "Florida"],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Legal Services",
    "itemListElement": [
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Real Estate Law"}},
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Business Law"}},
      {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "Taxation"}
    ]
  }
}
```

**Person schema for Paul Donovan:**
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Paul Donovan",
  "jobTitle": "Attorney",
  "worksFor": {"@type": "LegalService", "name": "Donovan Legal PLLC"},
  "alumniOf": [{"@type": "CollegeOrUniversity", "name": "[Law School Name]"}],
  "knowsAbout": ["Real Estate Law", "Business Law", "Taxation", "Tax Controversy"]
}
```

**Sitemap.xml** — auto-generated with Vite plugin `vite-plugin-sitemap` for all 9 routes.

**Robots.txt:**
```
User-agent: *
Allow: /
Sitemap: https://donovan.law/sitemap.xml
```

### 5.7 Analytics & Conversion Tracking

**Google Analytics 4:**
- Property ID: [TBD — create or connect existing GA4 property]
- Load via `requestIdleCallback` with 3.5s delay (following Jesani's performance pattern)
- Key events to track:
  - `consultation_form_submit` (Contact page form submission)
  - `phone_click` (all `tel:` link clicks)
  - `email_click` (all `mailto:` link clicks)
  - `cta_click` — parametrized by location (hero, stats, banner, etc.)
  - `practice_area_view` (pageview events for each practice page)

**Google Tag Manager:**
- Manage GA4 and any future pixels (Meta Pixel if paid social is added later) through GTM
- Container ID: [TBD]

**Facebook/Meta Pixel:**
- Defer until paid social strategy is confirmed
- Integration point is the GTM container — add pixel through GTM, no code change required

### 5.8 Performance Targets

| Metric | Target | How to Hit It |
|--------|--------|---------------|
| LCP (Largest Contentful Paint) | < 2.0s | Preload hero image in `<head>`, use WebP, serve via CDN |
| FID / INP | < 100ms | Defer analytics, lazy-load non-critical components |
| CLS | < 0.05 | Reserve space for images with explicit width/height |
| Lighthouse Score | 90+ on all categories | Audit after build; address any issues |
| Hero image format | WebP | Export all hero images as WebP with JPEG fallback |
| Font loading | `display=swap` | Already in the Google Fonts import |

**GCP Cloud Run configuration:**
- Cloud Run serves the static Vite build via an nginx container
- Cloud Build pipeline: `git push main` → build → deploy (existing infrastructure, no changes needed)
- Set `Cache-Control: max-age=31536000, immutable` on hashed JS/CSS assets; `no-cache` on HTML
- Optional: Add Cloudflare CDN in front of Cloud Run for edge caching and DDoS protection

### 5.9 Mobile-First Responsive Design

Breakpoints (Tailwind defaults, aligned with design needs):

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| `sm` | 640px+ | — |
| `md` | 768px+ | 2-column layouts activate |
| `lg` | 1024px+ | Full desktop layout |
| `xl` | 1280px+ | Max content width containers |

Mobile-specific decisions:
- Hero: Single column, CTA card stacks below text, full-width buttons
- Stats strip: 2×2 grid instead of 4 horizontal
- Practice cards: Single column stack
- Nav: Hamburger → full-screen overlay menu (dark green background, white text, gold CTAs)
- Floating intake card: Converts to full-width section on mobile
- All touch targets: minimum 44×44px

---

## 6. PRIORITY ORDER & PHASING

### Phase 1 — Core Site Launch (Weeks 1–6)

**Goal:** Replace the dead splash page with a professional, conversion-ready site. Must have these pages live before any other work.

**Pages:**
1. Homepage (`/`) — Full spec as above; hero, stats, practice cards, why section, matters preview, CTA
2. Attorney Profile (`/about`) — Bio, credentials, career, CTA
3. Contact (`/contact`) — Form, map, sidebar, CTA

**Also required for Phase 1:**
- Logo / wordmark
- Google Fonts integration
- Tailwind design system tokens
- Navbar + Footer components (these appear on every page)
- Paul's professional headshot (use existing at minimum)
- At minimum 1 hero image per Phase 1 page (can be stock)
- Basic SEO meta tags + LocalBusiness schema
- GA4 tracking connected
- Cloud Build pipeline verified (likely already works with static output)

**Definition of done:** The site loads at donovan.law, passes Lighthouse 90+, and Paul's phone and email are clickable on every page.

---

### Phase 2 — Practice Area Pages (Weeks 6–10)

**Goal:** Establish SEO presence for each practice area keyword cluster. Rank for "[practice area] attorney Delray Beach FL."

**Pages:**
4. Real Estate (`/real-estate`)
5. Business Law (`/business-law`)
6. Taxation (`/taxation`)

**Also in Phase 2:**
- The Firm (`/the-firm`) — Firm overview, philosophy, client focus, office map
- Experience (`/experience`) — Full representative matters grid with filter
- New professional headshot if not done in Phase 1 (schedule shoot)
- Additional stock photography for practice page heroes
- Practice-area-specific schema markup (LegalService type per practice)

---

### Phase 3 — Supporting Pages (Weeks 10–14)

**Goal:** Complete the full site and add social proof + depth.

**Pages:**
7. Clients (`/clients`) — Who we serve, industries, testimonials
8. Experience page updates (add any new matters)

**Also in Phase 3:**
- Client testimonials (if obtained by this point)
- Case result dollar amounts (if approved)
- Open Graph image
- Full sitemap.xml
- Robots.txt
- Complete TCPA-compliant SMS consent language verified

---

### Phase 4 — Legal Concierge Widget (Weeks 14–18)

**Goal:** Integrate the Legal Concierge widget as a lead engagement and intake tool.

**Integration points:**
- Homepage: Below stats strip, before practice area cards
- Contact page: Below or alongside the intake form
- Each practice area page: Bottom section or sidebar CTA

**Steps:**
1. Obtain widget embed code / script from Legal Concierge team
2. Implement `VITE_SHOW_CONCIERGE` environment variable toggle in Cloud Run
3. Test widget on staging before enabling on production
4. Connect GA4 event tracking for widget interactions (`concierge_open`, `concierge_submit`)

---

### Phase 5 — Blog & Resources (Future — Weeks 18+)

**Goal:** Build organic search authority and demonstrate thought leadership in HNW real estate, business, and tax law.

**Structure:**
- `/blog` — Article listing, filterable by practice area
- `/blog/[slug]` — Individual articles
- Article topics: Florida real estate topics, business entity comparisons, tax planning basics for HNW individuals, 1031 exchange guides, entity selection overview

**Content note:** NJP Law Group has 40+ blog articles; Neil Jesani has 100+. Paul's blog should target 20–30 high-quality long-form articles in Year 1. Quality over quantity. Each article should be 1,200–2,500 words, optimized for a specific keyword (e.g., "commercial real estate attorney Delray Beach," "LLC vs S-Corp Florida tax").

**Production model options:**
- Paul drafts; developer publishes
- Law content writer drafts; Paul reviews and approves
- AI-assisted drafting; Paul edits and approves (most efficient for Phase 5)

---

## QUICK REFERENCE: WHAT TO BUILD TOMORROW

A developer and designer starting fresh should do the following, in order:

**Day 1 — Setup:**
1. `npm create vite@latest donovan-law -- --template react`
2. Install Tailwind CSS, React Router v6, Framer Motion (optional)
3. Configure `tailwind.config.js` with the color tokens from Section 1.3
4. Add Google Fonts import for Playfair Display + Inter to `index.html`
5. Create `UtilityBar`, `Navbar`, and `Footer` components
6. Create `Hero`, `StatsStrip`, `CTABanner` reusable section components
7. Wire up React Router with all 9 routes

**Day 2 — Homepage:**
1. Build Homepage layout using the section components
2. Write all copy strings in `src/data/content.js`
3. Source placeholder hero image (South Florida skyline — Unsplash)
4. Build the floating consultation card
5. Implement the stats strip with placeholder numbers
6. Build practice area 3-card grid
7. Build "Why Donovan Legal" 2-column section
8. Build featured matters preview (4 cards)
9. CTA banner component

**Day 3 — Profile + Contact:**
1. Profile page: hero with headshot, bio, credentials grid, career section
2. Contact page: form, sidebar cards, map embed
3. Verify all `tel:` and `mailto:` links are correct

**Day 4 — Polish + Deploy:**
1. Mobile responsive pass on all 3 pages
2. Meta tags + LocalBusiness schema on all 3 pages
3. Connect GA4
4. `npm run build` → verify dist output
5. Deploy to Cloud Run via Cloud Build → verify at donovan.law

**Design note for the designer:** The visual direction is fully defined in Section 1. Start with the color tokens, load the fonts, and build the homepage hero first — it sets the tone for everything. The floating consultation card is the most critical UI element on the site; get that right before moving to secondary sections.

---

*Document prepared April 2026. All placeholder values (phone, email, address, dollar figures, Big Four firm name, bar admission details, education) must be replaced with confirmed information from Paul Donovan before publication. Representative matters are directional examples only; actual experience page content must be reviewed by Paul Donovan for accuracy and Florida Bar advertising compliance.*
