# CLAUDE.md — Donovan Legal PLLC website

You are working on the live website of a Florida law firm. It is deployed and
serving real clients at **https://www.donovan.law**. Act accordingly.

Read this file completely before you change anything.

> **Updated August 2026.** The repository, the Cloudflare account, and the domain
> are now owned and controlled by Donovan Legal PLLC. TICO AI no longer has
> access. Earlier versions of this file said David Pierce owned the repo and was
> the only person who could merge or deploy — that is no longer true. If you find
> other documents in this repo saying so, they are stale.

---

## 1. Who is asking, and what they can do

**Paul Donovan** (`Paul@Donovan.Law`) is the firm's owner and attorney, and the
owner of this repository. He is not a developer and should never be asked to read
code, resolve a merge conflict, or reason about HTML.

When Paul asks for a change:

- Talk to him in plain English. Never paste code at him. Never explain CSP,
  swup, HTMLRewriter, or CI to him.
- Do the work, open a PR, and reply with **the preview URL and one sentence**
  about what changed.
- He reviews the preview, merges, and runs the production deploy himself. Those
  are his decisions, not yours.

**You never merge and you never deploy.** Not because someone else owns the repo
— Paul does — but because a human reading the preview is the last check before a
law firm's live site changes. Open the PR, hand him the link, stop there.

---

## 2. The content lane — what you may change and just open a PR for

✅ **Routine:** the words inside `<p>`, `<h1>`–`<h6>`, `<li>`, `<td>`, `<span>`,
and `<a>` text; `<title>` and `<meta name="description">` content; an existing
`href` retargeted to a page that already exists in this repo.

⚠️ **Possible, but say so clearly in the PR and explain the risk in plain
English:**

- creating a new page (see §5 — there is a checklist and it is easy to get wrong)
- adding a content block that reuses classes already defined in `css/main.css`
- adding an inbound link from an existing page to a new one

⛔ **Do not do without a specific, informed instruction from Paul:**

- editing the nav (see §4 — it is copy-pasted across ~96 files and has already
  forked)
- anything under `functions/`, `css/`, `test/`, or `.github/`
- adding, removing, or reordering any `<script>` or `<link>` tag
- adding or changing a `class`, `id`, or `style` attribute on existing markup
- renaming or deleting any file

If a request needs something in the ⛔ list, **stop and explain the trade-off**.
Tell him what it touches, what could break, and what you would do instead. He can
authorise it — he owns the repo — but he should be told what he is authorising.

---

## 3. Hard rules — these fail CI and the PR will not merge

The test suite gates every deploy. CI runs `npm test` from the **repo root**, not
from `donovan-legal-site/`. These are the rules a content or page edit
realistically trips:

1. **No inline `<script>` anywhere inside `<body>`.** No exceptions — not even
   `application/ld+json`. Inline `<script>` in `<head>` is fine.
2. **No `on*=` attributes.** `onclick`, `onload`, `onerror` — all dead under the
   nonce CSP and all fail the build.
3. **No `data-dvn-on`** unless the page already loads `js/inline-actions.js`.
   Only 8 pages do. Check before using it.
4. **Every internal `href` must resolve.** A typo'd link fails the build.
5. **Every page in `sitemap.xml` needs ≥100 words of body text, a non-empty
   `<title>`, and at least one `<h1>` or `<h2>`.** Trimming copy can drop a page
   below the floor and red the build.
6. **Never add `noindex`** to a page listed in `sitemap.xml`.
7. **Every sitemap URL needs at least one inbound internal link.** Removing a
   link can orphan a page and fail the build.
8. **Never add a new `<script src>` or change a `?v=` cache-buster.** Both break
   the router's allow-list completeness check.

---

## 4. Silent traps — no test catches these, and they break the live site

Treat these as harder rules than §3, precisely because nothing will warn you.

- **Never add a `<main>` element.** The edge middleware
  (`donovan-legal-site/functions/_middleware.js`) injects `<main id="perch-main">`
  itself, using a two-pass **div-ordinal** plan. Adding a `<main>` flips it to a
  different branch. The concierge product was removed, but **this injector is
  still live** — the element is added per request and will not appear in page
  source.
- **Never add `<div id="concierge">`.** That makes the injector skip the page
  entirely — losing the swap container, the router, and the "Book a
  Consultation" bar in one shot.
- **Never move markup relative to `div.container`, `div.border-grey`, or
  `div.big-screen`.** The injector counts divs. Shifting them can pull the nav
  *inside* the swap container, which kills the menu after the first soft
  navigation, silently.
- **Never rename or remove `nav.menubar`**, or any class `js/main.js` binds:
  `.hamburger`, `.btn-close.menu`, `.nav-mobile-overlay`, `.dropdown`,
  `.dropdown-menu`.
- **Never edit the nav on one page.** The nav markup is copy-pasted across ~96
  files and has *already* forked. A one-page nav edit makes this worse
  permanently. If Paul wants a nav change, it is a scripted pass across every
  file that carries the current nav, in its own PR, reviewed on the preview.

---

## 5. New pages — the checklist

A new page needs **all** of the following or CI reds:

- an entry in `donovan-legal-site/sitemap.xml`
  (helper: `donovan-legal-site/scripts/generate-sitemap.mjs`)
- **at least one inbound internal link** from a page that already exists
- ≥100 words of body text
- a non-empty `<title>` and a `<meta name="description">`
- one `<h1>`
- a `<link rel="canonical">` pointing at the extensionless URL
- a `<script src>` set **byte-identical** to the page you cloned the chrome from

**The reliable way to build one:** copy an existing page in the same section,
replace only the head fields, the `<h1>`, and the content block between
`<div class="animate__animated animate__fadeIn animate__delay-2s" ...>` and its
closing tags. Leave the nav, the footer, and everything else untouched.

Put the copy in the PR body so a non-developer can review it by reading.

---

## 6. Workflow

1. Branch from `main`. Name it `paul/<short-description>` for Paul's requests,
   `content/<short-description>` otherwise.
2. **One coherent change per PR.** A section of related pages is fine. Unrelated
   edits are not.
3. Open a PR against `main`. Title it in plain English —
   *"Add the divorce special counsel section"* — not a commit convention.
4. In the PR body: what changed, which files, and **quote the before and after
   text** so it can be reviewed by reading.
5. Reply to Paul with the **Cloudflare preview URL** (auto-deploys once CI
   passes) and one sentence.
6. Stop there. Paul merges.

**How production actually deploys**, so nobody guesses: merging to `main` does
**not** publish. Publishing is a manual GitHub Actions run — *Deploy (Cloudflare
Pages)* → *Run workflow* → branch `main` → type `deploy-production` in the
confirmation box. The typed string is required by the workflow; anything else
fails closed. That is deliberate, and it is Paul's step.

---

## 7. Repo map — the short version

| Path | What it is |
|---|---|
| `donovan-legal-site/` | **The deployed site.** Everything that ships. Edit here. |
| `donovan-legal-site/*.html` | ~117 pages. Chrome is copy-pasted per file — there is no templating. |
| `donovan-legal-site/functions/` | Cloudflare Pages Functions + the edge middleware. **Off limits.** |
| `donovan-legal-site/css/main.css` | The shared stylesheet. **Off limits.** |
| `donovan-legal-site/nav-block.html` | ⚠️ Referenced by zero pages and **stale**. Never paste it into anything. |
| `test/` | The test suite, run from the repo root. Gates every deploy. **Off limits.** |
| `.github/workflows/` | CI and the deploy workflows. **Off limits.** |
| `src/`, `infra/`, `Dockerfile`, `cloudbuild.yaml` | **Abandoned.** Nothing deploys to GCP. Ignore. |

⚠️ Several markdown docs in this repo are **stale** and will mislead you:
`donovan-legal-site/README.md` says the folder is a read-only baseline (false —
it is the deployed site). `HANDOFF.md` and `HANDOFF-TO-DAVID.md` describe an
arrangement that has ended. `assessment-perch.md` and `assessment-vantage.md`
describe products that have been removed from the site. Trust the code over the
docs.

---

## 8. What was removed, and what that means

The Perch concierge, the Paula voice agent, and the ConnexŪS/Vantage analytics
layer were removed in August 2026. No page calls TICO, ConnexŪS, or their
infrastructure.

Two consequences worth knowing:

- **Clio is untouched and is the system of record.** Bookings and contact-form
  submissions still write into Clio Manage and Clio Grow. Do not break the
  booking or contact forms.
- **The edge middleware survived the removal.** The div-ordinal injector in
  `functions/_middleware.js` still runs on every request. Everything in §4 still
  applies.

---

## 9. Standing content conventions

These are the firm's, not the framework's. Follow them unless Paul says otherwise.

- **Phone number is `(561) 666-6022`** — `tel:+15616666022`. There is no other
  firm number. Do not "correct" it.
- **Address is 301 W. Atlantic Avenue, Suite 5, Delray Beach, FL 33444.** Some
  external directories still carry an old 55 SE 2nd Avenue address; the site is
  correct.
- **Florida Bar Rule 4-7.12** requires the firm name and city on the page. It is
  in the footer of every page. Do not remove it.
- **Rule 4-7.13(b)(8)(F)** requires any testimonial to carry the disclaimer that
  a prospective client may not obtain the same or similar results. If you add or
  move a testimonial, the disclaimer travels with it.
- **Never write** *best*, *top*, *#1*, *leading*, *expert*, *specialist*,
  *aggressive*, or any guarantee or prediction of outcome. These are Bar
  problems, not style preferences.
- **Do not add "Attorney Advertising."** That is a New York rule. Florida
  requires firm name and city, which the footer already carries.
- Copy is written in a senior-partner register: direct, declarative, no hedging,
  no exclamation marks, no marketing enthusiasm.

---

## 10. When in doubt

Stop and ask. A PR that says *"I wasn't sure whether you meant X or Y"* costs
Paul thirty seconds. A confidently wrong edit to a law firm's live site costs
considerably more.
