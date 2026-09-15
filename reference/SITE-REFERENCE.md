# Donovan Legal PLLC — Complete Site Reference

**Source:** https://www.donovan.law  
**Extracted:** March 28, 2026  

---

## 1. COLOR PALETTE

| Color | Hex | Usage |
|-------|-----|-------|
| **Brand Gold** | `#c1a221` | Primary accent — headings, sidebar links, accordion icons, buttons, tagline, map markers |
| **Dark Green** | `#074c23` | Secondary accent — quote block backgrounds, green text class, button hover state |
| **Bright Yellow** | `#ffca18` | Hover state — nav links, mobile menu items |
| **White** | `#ffffff` | Page background, navbar, cards, dropdowns, mobile nav overlay |
| **Black** | `#000000` | Body text, nav links, hamburger icon |
| **Dark Text** | `#222222` | HTML default text color |
| **Near-Black** | `#090909` | Firm image background fallback |
| **Light Border** | `#dddddd` | Page frame border (`.border-inside`), internal borders |
| **HR Rule** | `#cccccc` | Horizontal rule borders |
| **Dropdown Text** | `#212529` | Bootstrap dropdown default |
| **Selection Blue** | `#b3d4fc` | Text selection highlight |
| **Dropdown Active** | `#f9f9f9` | Active dropdown item background |
| **Gold Transparent** | `rgba(193,162,33,0.5)` | Map marker background |
| **Gold Solid** | `rgba(193,162,33,1)` | Pin-popup connector line |
| **Shadow** | `rgba(0,0,0,0.15)` | Dropdown border |
| **Box Shadow** | `rgba(0,0,0,0.22)` | Pin-popup shadow |

---

## 2. TYPOGRAPHY

### Font Families

| Font | Source | Weight | Usage |
|------|--------|--------|-------|
| **Trajan Pro** (Bold) | Custom @font-face — `webfonts/TrajanPro-Bold.*` | Bold | Tagline (27px, letter-spacing 4px), "Coming Soon" text (40px) |
| **Gotham Light** | Custom @font-face — `webfonts/Gotham-Light.*` | 300 | Title first word ("PRACTICE" in "PRACTICE AREAS") |
| **Gotham Medium** | Custom @font-face — `webfonts/Gotham-Medium.*` | 500 | Body default, navigation links, accordion headers, sidebar labels |
| **Gotham Bold** | Custom @font-face — `webfonts/Gotham-Bold.*` | 500 | Title bold word ("AREAS" in "PRACTICE AREAS"), Twitter/CTA buttons |
| **Open Sans** | Google Fonts (300, 400, 600, 700, 800) | Various | Paragraphs, list items, footer, quote blocks |

### Type Scale

| Element | Font | Size | Weight | Letter-Spacing | Other |
|---------|------|------|--------|----------------|-------|
| `body` | Gotham Medium | 1em (16px) | normal | normal | color: #000 |
| `.tagline` | Trajan Pro | 27px | bold | 4px | color: #c1a221, centered |
| `.coming-soon` | Trajan Pro | 40px | — | 4px | color: #000 |
| `.title` | Mixed | 40px | — | 3px | margin: 25px 0 |
| `.title-inside` | Mixed | 30px | — | 3px | margin-bottom: 25px |
| `.navbar-nav .nav-link` | Gotham Medium | 16px | normal | — | uppercase, color: #000 |
| `h5.bold.yellow` | Gotham Medium | ~20px | bold | — | color: #c1a221 |
| `#pa-accordion .card-header` | Gotham Medium | 20px | bold | — | — |
| `p` | Open Sans | 16px | normal | — | — |
| `.experience-list` | Open Sans | 16px | normal | — | list-style: disc |
| `.quote` | Open Sans | 25px | 300 | — | background: #074c23, color: #fff |
| `.quote-pa` | Open Sans | 18px | 300 | — | background: #074c23, color: #fff |
| `.copy-inside` (footer) | Open Sans | 13px | normal | 2px | uppercase, centered |
| `a.btn-twitter` | Gotham Bold | 16px | — | — | uppercase, bg: #c1a221, color: #fff |

---

## 3. LAYOUT STRUCTURE

### Global Page Wrapper
```
.big-screen (padding: 10px, min-height: 930px, width: 100%)
  └── .border-inside (border: 1px solid #ddd, min-height: 930px)
        ├── .container > nav.navbar (logo left, links right)
        ├── Main content area (varies by page)
        └── Footer (.copy-inside or .copy)
```

### Experience Page Layout (2-Column)
```
.content-pa.keep-m (margin-top: 150px)
  └── .container > .row
        ├── col-lg-4 order-lg-1 [LEFT SIDEBAR — 33%]
        │     ├── h2.title-inside "PRACTICE AREAS"
        │     └── #pa-accordion
        │           ├── REAL ESTATE + (expandable)
        │           ├── BUSINESS LAW + (expandable)
        │           ├── TAXATION + (expandable)
        │           └── EXPERIENCE (current page, no expand)
        └── col-lg-8 order-lg-2 [RIGHT CONTENT — 67%]
              ├── h5.bold.yellow "EXPERIENCE"
              ├── p "Below is a sample..."
              └── ul.experience-list (10 bullet items)
```

### Homepage Layout (Centered Splash)
```
.box > .border-body-home (flex, centered)
  └── .box-center-home
        ├── .base-logo (large centered logo, max-height: 420px)
        ├── ul.menu (horizontal nav: THE FIRM | THE PRACTICE | CLIENTS | CONTACT)
        └── .copy (footer, absolute positioned bottom: 30px)
```

### Navigation
- **Desktop:** Bootstrap navbar, logo left (max-width: 150px), nav items right
- **Links:** HOME, THE FIRM (dropdown: PAUL DONOVAN), THE PRACTICE (dropdown: REAL ESTATE, BUSINESS LAW, TAXATION, EXPERIENCE), CLIENTS, CONTACT
- **Mobile:** Hamburger → full-screen overlay (.nav-mobile-overlay), slide-in from left
- **Dropdown styling:** border-radius: 0, border: 1px solid rgba(0,0,0,.15), font-size: 14px

### Key Spacing
- Content top margin: 75px (`.content-pa`) or 150px (`.keep-m`)
- Footer top margin: 180px (`.copy-inside`)
- Experience list item spacing: margin-bottom: 15px
- Accordion HR separators: margin: 10px 0, border-top: 1px solid #ccc

### Responsive Breakpoints
- `≥992px` (lg): Two-column layout, desktop nav
- `≥768px`: Hide mobile menu
- `576px–768px`: Stack to single column
- `≤575.98px`: Full mobile — stacked layout, smaller fonts, hamburger menu

---

## 4. ASSETS & EXTERNAL RESOURCES

### Images
| Asset | URL | Usage |
|-------|-----|-------|
| Site Logo | `https://www.donovan.law/img/base-hover.png` | Header + homepage (hover-fade effect) |
| Favicon | `https://www.donovan.law/img/favicon.png` | Browser tab + apple-touch-icon |
| Firm Image | `https://www.donovan.law/img/firm-img.png` | Background on firm/about pages |
| Paul Donovan Headshot | `https://www.donovan.law/img/PKD%20Headshot.jpg` | Profile page |

### External Libraries
| Library | URL |
|---------|-----|
| Bootstrap CSS | `bootstrap.min.css` (local) |
| Font Awesome | `fontawesome.min.css` (local) |
| Animate.css | `animate.min.css` (local) |
| jQuery 3.3.1 | `https://code.jquery.com/jquery-3.3.1.min.js` |
| Anime.js 2.0.2 | `https://cdnjs.cloudflare.com/ajax/libs/animejs/2.0.2/anime.min.js` |
| Google Fonts | `https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700,800` |
| Modernizr | `js/vendor/modernizr-3.6.0.min.js` (local) |

### Custom Web Fonts (local files)
- `webfonts/TrajanPro-Bold.woff2`, `.woff`, `.ttf`
- `webfonts/Gotham-Light.woff2`, `.woff`, `.ttf`
- `webfonts/Gotham-Medium.woff2`, `.woff`, `.ttf`
- `webfonts/Gotham-Bold.woff2`, `.woff`, `.ttf`

---

## 5. PAGE-BY-PAGE TEXT CONTENT

### Homepage (/)
- Large centered logo with hover effect
- Navigation: THE FIRM | THE PRACTICE | CLIENTS | CONTACT
- Footer: © DONOVAN LEGAL PLLC. 2022. | DISCLAIMER
- Animations: logo fades in, nav items zoom in, footer fades in after 3s

### The Firm (/ourfirm.html)
**Heading:** THE FIRM  
**Link:** PAUL DONOVAN  
**Body:**
> Donovan Legal PLLC offers real estate, tax and business services to select high net worth individuals and small businesses. We take a results-oriented approach to resolving matters efficiently and successfully.

*Features green card design with firm description.*

### Paul Donovan (/profile.html)
**Heading:** PAUL DONOVAN  
**Bio:**
> Originally from Boston, Paul Donovan moved to Delray Beach, Florida. Former Big Four tax advisor in New York and Chicago. Practiced law in Massachusetts before moving his Florida practice in 2019. Handles real estate acquisitions, private equity fund formations, high net worth tax and business counsel, and divorce litigation support.

**Admitted to Practice:**
- Florida
- Massachusetts
- U.S. Court of Appeals – 1st Circuit
- U.S. District Court - Massachusetts

**Affiliations:**
- ABA (American Bar Association)
- Florida Bar
- Massachusetts Bar
- American Academy for Certified Financial Litigators
- AICPA

**Education:**
- Suffolk Law School JD (Cum Laude) — Boston
- Northeastern University CCM — Boston
- Northeastern University BS (Cum Laude) — Boston

**Other:**
- CPA (Massachusetts)
- Licensed Real Estate Broker (Massachusetts)
- Dual Citizen USA/Ireland

**Social:** @DONOVANLEGAL (Twitter button, gold bg)

### The Practice (/the-cmm.html)
**Heading:** THE PRACTICE  
**Links:** REAL ESTATE (+), BUSINESS LAW (+), TAXATION (+), EXPERIENCE  
**Body:**
> Donovan Legal PLLC offers real estate, tax and business planning, compliance and dispute resolution...

*Accordion-style expandable list with + icons.*

### Real Estate (/realestate.html)
**Breadcrumb:** Family Matters / Real Estate  
**Heading:** REAL ESTATE  
**Body:**
> In high net worth family law matters the valuation, allocation, protection and use of personal and investment real estate is often key to a successful resolution of the case.

> At Donovan Legal LLC we have experience with all aspects of real estate matters to assist divorce counsel in advising their clients.

**Sidebar Practice Areas:** FAMILY MATTERS, REAL ESTATE, BUSINESS LAW, TAXATION, EXPERIENCE  
*Features green info box on right side.*

### Business Law (/businesslaw.html)
**STATUS: 404 — Page not found**

### Taxation (/taxation.html)
**Headings:** THE PRACTICE / Taxation  
**Sub-topics:** BUSINESS FORMATION, REAL ESTATE TRANSACTIONS, TAX CONTROVERSIES  
**Body:**
> We provide advice to our clients on a wide variety of federal, state, international, state, and local tax planning, compliance and dispute resolution matters. Our practical business experience enables us to provide advice that extends beyond technical application of the tax rules.

*Green description box on right.*

### Experience (/experience.html)
**Heading:** EXPERIENCE  
**Intro:** Below is a sample of the legal services we offer our clients.

**Bullet List (10 items):**
1. Currently representing client in the formation of US based real estate investment fund.
2. Currently providing consulting services to multi-national professional services firm regarding complex tax matters related to various investment fund clients.
3. Currently representing client in the formation of low-income housing investment fund focusing on investment in opportunity zones.
4. Represented developer in all respects during the planning, financing, permitting, construction, and sale of successful downtown luxury condominium project. The project involved complex environmental and site remediation issues.
5. Represented developer in eminent domain matter utilizing novel jurisdictional technique to move the case to a favorable forum resulting in a substantial settlement.
6. Represented developer during the acquisition, financing, development, and sale of several multi-family housing projects throughout the southeastern United States.
7. Provided counsel to developer regarding the formation of private equity fund for the acquisition of residential properties.
8. Provided tax counsel to owners of hotel investment company of complex partnership tax matters during the initial public offering of shares in a real estate investment trust resulting in successful IPO.
9. Provided co-counsel services to prominent South Florida law firm in various multifaceted divorce litigation matters with marital estates comprised of sophisticated real estate holdings owned by a maze of estate planning instruments and creditor protection entities. The matters involved reviewing thousands of entity formation documents, tax returns, and contracts; advanced analysis and negotiation of valuation, tax, estate planning, and jurisdictional issues; and interpreting and drafting sophisticated post-nuptial and/or settlement agreements.
10. Represented defendant pro bono who was sentenced to life without the possibility of parole as a juvenile. We investigated the history of the case, interviewed the original witnesses for the prosecution, discovered "Brady" violations, presented newly discovered evidence to the court, filed motions to correct the sentence and for a new trial applying recent Supreme Court decisions. As a result, after 23 years our client was released from prison.

### Clients (/login.html)
**Content:** "Coming Soon" — placeholder page with no login form.

### Contact (/contact.html)
**Heading:** CONTACT  
**Address:** Donovan Legal PLLC, 55 SE 2nd Avenue, Delray Beach, FL 33444  
**Phone:** T: 561-666-6022  
**Fax:** F: 833-829-9993  
**Email:** info@donovan.law  
**Social:** @DONOVANLEGAL (Twitter)  
*Three-column layout with custom SVG icons (address, phone, mail).*

### Disclaimer (/desclimer.html)
> The information provided on this website is for general informational purposes only and is not intended to be, nor should it be construed as, legal advice. Further, nothing on the website should be viewed as a prediction or guaranty of success or other specific results in any particular case.

*Note: URL contains typo ("desclimer" vs "disclaimer").*

---

## 6. SITE MAP & NAVIGATION STRUCTURE

```
donovan.law/
├── index.html (Homepage — splash/landing)
├── ourfirm.html (The Firm)
│   └── profile.html (Paul Donovan)
├── the-cmm.html (The Practice)
│   ├── realestate.html (Real Estate)
│   ├── businesslaw.html (Business Law — 404!)
│   ├── taxation.html (Taxation)
│   └── experience.html (Experience)
├── login.html (Clients — Coming Soon)
├── contact.html (Contact)
└── desclimer.html (Disclaimer)
```

---

## 7. NOTABLE ISSUES IN CURRENT SITE

1. **businesslaw.html returns 404** — broken link in navigation
2. **URL typo:** `desclimer.html` should be `disclaimer.html`
3. **Copyright year:** Still shows 2022
4. **Gotham fonts** are commercially licensed — may need licensing for rebuild
5. **Trajan Pro** is commercially licensed (Adobe) — may need licensing
6. **No meta descriptions** on pages
7. **No Open Graph / social media tags**
8. **No Google Analytics or tracking**
9. **Animations** use older Animate.css + Anime.js approach

---

## 8. FILES IN WORKSPACE

### Extracted HTML Pages
- `donovan_experience_full_html.html` — Experience page (full rendered HTML)
- `donovan_law_source.html` — Homepage (full rendered HTML)
- `donovan_ourfirm.html` — The Firm page
- `donovan_profile.html` — Paul Donovan profile
- `donovan_practice.html` — The Practice page
- `donovan_realestate.html` — Real Estate page
- `donovan_businesslaw.html` — Business Law (404 page)
- `donovan_taxation.html` — Taxation page
- `donovan_clients.html` — Clients/Login page
- `donovan_contact.html` — Contact page
- `donovan_disclaimer.html` — Disclaimer page

### CSS
- `donovan_main_original.css` — Complete main stylesheet (23,889 bytes)
- `donovan_normalize.css` — Normalize stylesheet (6,138 bytes)

### Images
- `donovan_logo.png` — Site logo (14,764 bytes)
- `donovan_favicon.png` — Favicon (3,892 bytes)
- `donovan_firm_img.png` — Firm background image (348,425 bytes)

### Screenshots
- `donovan_experience_top.jpg` — Experience page top half
- `donovan_experience_bottom.jpg` — Experience page bottom half
- `donovan_law_screenshot.jpg` — Homepage
