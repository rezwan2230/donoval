# `donovan-legal-site/` — Live Production Source (As-Is from GoDaddy cPanel)

This folder contains the **exact source files of the live `www.donovan.law` website** as pulled from Paul Donovan's GoDaddy cPanel hosting on **June 12, 2026**.

> ⚠️ **This is the AS-IS production source.** It is the canonical reference for what is currently serving traffic at https://www.donovan.law. Do NOT modify these files in place during the rebuild — use this folder as a read-only baseline. Active rebuild work happens in `../src/` (Cloud Run) or in a new branch.

## Provenance

- **Source:** GoDaddy cPanel `public_html/` directory
- **Method:** Paul exported the site files himself and provided a zip (`public_html.zip`, ~24 MB)
- **Date acquired:** June 12, 2026
- **Operator:** Walter White (TICO AI), on behalf of David Pierce
- **Purpose:** Baseline for the GCP/Cloud Run rebuild and the ATHENA integration build

## What's here

- **142 HTML pages** — site pages, blog posts, member-portal tools, marketing pages
- **5 PHP files** — membership gate pages (`index.php` in `gold/`, `platinum/`, `diamond/`, `reserve/`); see "Security notes" below
- **5 `.htaccess` files** — Apache rewrite rules and cPanel Directory-Privacy auth declarations
- **`img/`** — site imagery, headshots, brand assets
- **`css/`** — stylesheets (16 files)
- **`js/`** — client-side scripts (20 files)
- **`webfonts/`** — embedded fonts (Trajan Pro, Gotham, etc.)
- **`htaccess.proposed`** — a more comprehensive redirect map staged by Paul but not yet active on the live host. Renamed from `htaccess` (no leading dot) to prevent accidental activation if this folder is ever deployed to a Linux/Apache host without inspection.

## What's NOT here (intentionally excluded from the commit)

| Excluded | Reason |
|---|---|
| `.well-known/` and `.well-known.zip` | Let's Encrypt / SSL challenge artifacts. Server-managed, not site source. |
| `.ftpquota` | cPanel internal metadata. |
| `.DS_Store` | macOS Finder metadata. |
| `error_log` | Stale 2021 server error log. Not source. |
| `*.php.backup` (in `gold/`, `platinum/`, `reserve/`) | Stale dev backups of the live `index.php`. |
| `donovan-law-batch-2026-05-11.zip` | Stale export bundle from May. Redundant with the current source. |
| Empty `donovan.law/admin/` folder | Leftover from a 2020-era restructure. Nothing in it. |

## Security notes

✅ **No credentials, API keys, or secrets are committed.** A pre-commit scan was performed for: passwords, API keys, Stripe/AWS/SMTP credentials, private keys, bearer tokens, and database connection strings. None were found.

✅ **The `.htaccess` files in `gold/`, `platinum/`, `diamond/`, and `reserve/` reference cPanel Directory-Privacy auth files at `/home/f75o0zcarxhb/.htpasswds/...`** — those `.htpasswd` files live OUTSIDE `public_html/` and are NOT in this archive. No hashed passwords or member usernames are exposed.

✅ **The `index.php` files in member directories contain no secrets.** They read `$_SERVER['PHP_AUTH_USER']` from Apache Basic Auth and look up a display name from an in-file array (currently empty). No DB connections, no third-party API calls, no embedded credentials.

⚠️ **Member directories (`gold/`, `platinum/`, `diamond/`, `reserve/`) contain client-facing tools and sample documents that are intentionally gated behind HTTP Basic Auth on production.** Committing them to a PRIVATE GitHub repo is acceptable. **Do not make this repo public** without first removing those directories.

## File tree (top-level)

```
donovan-legal-site/
├── .htaccess                        # production rewrite rules (HTTPS redirect, no-cache for HTML/JS)
├── htaccess.proposed                # staged but unactivated redirect map (rename to .htaccess to deploy)
├── 404.shtml
├── index.html                       # home page
├── about-membership.html
├── blog.html
├── blog-*.html                      # 38 blog posts
├── contact.html
├── disclaimer.html
├── engagement.html
├── experience.html
├── ourfirm.html
├── practice.html
├── real-estate.html / tax-controversy.html / tax-planning.html / etc.
├── tool-*.html                      # public-facing tool previews
├── testimonials.html
├── leidy.html / wendy.html / tefera.html / profile.html   # bio pages
│
├── gold/                            # 🔒 member portal (Apache Basic Auth)
├── platinum/                        # 🔒
├── diamond/                         # 🔒
├── reserve/                         # 🔒
│
├── img/                             # imagery, headshots, brand assets
├── css/                             # stylesheets
├── js/                              # client scripts
└── webfonts/                        # Trajan Pro, Gotham, etc.
```

## How to use this folder

- **For the GCP rebuild:** treat this as the visual + content baseline. Engineers can fork pages into the new Cloud Run app under `../src/` but should not modify files here.
- **For content reference:** Paul's writing voice, tax-practice messaging, blog architecture, and brand application all live here. The 38 blog posts are particularly valuable as the firm's controversy/planning expertise positioning.
- **For ATHENA intake widget integration:** the existing `contact.html`, `engagement.html`, and member tool pages show how Paul currently presents intake and tooling. Compare against what GHL/ATHENA will replace.

## Related folders in this repo

- [`../src/`](../src/) — Cloud Run rebuild source (Dockerfile, current build target)
- [`../infra/`](../infra/) — GCP infrastructure as code
- [`../project-handoff/`](../project-handoff/) — strategy, research, meeting records
- [`../project-handoff/08-clio-integration/`](../project-handoff/08-clio-integration/) — ATHENA ↔ Clio Manage build workspace

---

*Folder created 2026-06-12 by Walter White, Liaison to David Pierce.*
