# Donovan build — machine handoff

Written 2026-07-18 for the move to a new laptop. Goal: pick the Donovan build back
up in ~15 minutes, with nothing lost.

---

## ⚠️ 1. READ FIRST — what is NOT in git and will be lost if not copied

Everything in the repo is pushed and safe on GitHub. **These are not:**

| Path | Why it is irreplaceable |
|---|---|
| `clio-onboard\paula\` | 🔴 **The real risk.** Paul's three original intake scripts + the working voice prompts. These are **documents, not secrets — nothing in Cloudflare holds them**, and they cannot be regenerated. |
| `C:\Users\elroy\clio-onboard\` | **NOT a git repo.** Also holds the OAuth capture tooling and `.env` (see the note below on why CF is not a recovery source). |
| `C:\Users\elroy\.claude\` | `CLAUDE.md`, cross-project memory, agent profiles, skills |
| `C:\Users\elroy\Atrium\` | CHARTER, playbook, ADRs, project docs |
| `C:\Users\elroy\.env` | `GHL_PIT`, `GHL_LOCATION_ID`, `GEMINI_API_KEY` (the `RETELL_API_KEY` here is duplicated in Cloudflare) |

### On the secrets — the site does NOT depend on this laptop
All **runtime** secrets already live in the Cloudflare Pages dashboard: `CLIO_CLIENT_ID` /
`CLIO_CLIENT_SECRET` / `CLIO_REFRESH_TOKEN` (read indirectly via `resolveSecret`),
`CLIO_CALENDAR_ID`, `GROW_LEAD_TOKEN`, `RETELL_API_KEY`, `RETELL_AGENT_ID`,
`TURNSTILE_SECRET_KEY`, `VANTAGE_READ_SECRET`. **The site keeps working regardless of what
happens to the laptop.**

> ⚠️ `TURNSTILE_SECRET_KEY` is the ONE name the code reads (`_lib/abuse.js`, used by
> both `/web-call` and `/booking/create`). An earlier build of `/booking/create` read
> `TURNSTILE_SECRET` and fell OPEN when it was unset; that name is gone. If the
> dashboard still holds the value under the old name, **rename it** — both endpoints
> now return 503 rather than run unverified. Set it on Production AND Preview.

**But two caveats:**
1. **Cloudflare encrypted secrets are write-only** — the dashboard will not show a value
   back. CF keeps the *site* running; it is **not somewhere to recover a value from** if
   you need it locally (e.g. to run `list-calendars.mjs`).
2. So `clio-onboard\.env` is still worth copying — it is the only readable copy of the
   Clio credentials. Without it you can still deploy and the site still runs; you just
   cannot run the local Clio tooling until those values are re-issued.

Never put any of these values in chat, email or a repo.

---

## 2. Already safe in the cloud — nothing to copy

- **Code** — `TicoAI/DonovanLegal`, branch `feat/perch-voice-concierge` (fully pushed)
- **Cloudflare Pages** project `donovan-site` — including all env vars/secrets, which live in the CF dashboard and were never on the laptop
- **Retell** — agents, prompts, phone numbers, tools (the *live* prompts are in Retell; the local `paula/*.txt` are working copies)
- **Clio, Vantage, Google** — all server-side

---

## 3. Copy list

```
C:\Users\elroy\LegalPlatform\DonovanLegal\    <- repo (also on GitHub)
C:\Users\elroy\clio-onboard\                  <- ⚠️ local only
C:\Users\elroy\.env                           <- ⚠️ local only
C:\Users\elroy\.claude\                       <- ⚠️ local only
C:\Users\elroy\Atrium\                        <- ⚠️ local only
```
Other projects (`FinanceFaceless`, etc.) are separate — copy if wanted, not needed for Donovan.

---

## 4. New machine setup

**Install:** Node 22+ · Git · Claude Code · (optional) `cloudflared` — only needed to re-run the Clio OAuth tunnel.

**Re-authenticate (none of these transfer with files):**
1. **GitHub** — `gh auth login` (needs push access to the TicoAI org)
2. **Cloudflare** — `npx wrangler login` (required to deploy)
3. **Retell / Clio / Vantage** — no login; they use keys from the `.env` files you copied

**Restore paths:** if the new user folder isn't `C:\Users\elroy`, the repo works anywhere, but `.claude` and `.env` must sit in the new user home.

---

## 5. Verify you're back (5 min)

```bash
cd <repo>/donovan-legal-site
git status -sb                 # expect: in sync with origin, clean

# Clio credentials survived the move:
cd C:\Users\<you>\clio-onboard
node --env-file .env list-calendars.mjs
#   expect: "token refresh OK" + calendars 9084638 (Donovan Legal) and 9084653 (Firm)
#   if this fails, the refresh token did not come across.

# Deploy path works:
cd <repo>/donovan-legal-site
npx wrangler pages deploy . --project-name donovan-site --branch main
```
Then call **+1 561-529-5873** and load **donovan.law/perch** — if both behave, you're fully back.

---

## 6. Where the build stands (2026-07-18)

### Live and working
- **Phone line +1 561-529-5873** (Retell-Twilio, local number). Wendy: greeting → EN/ES language choice → name → reason → answer or transfer.
- **Transfer to Wendy (+52 55 4651 1119)** — warm transfer + human detection. **Solved a long bug:** toll-free numbers cannot dial internationally, which is why every earlier transfer failed instantly. A *local* number fixed it. Verified holding 10+ min.
- **`take_message`** — on a failed transfer (max 2 tries) Wendy takes a message which writes to **Vantage CRM + Clio Grow lead inbox** (`/fn/take_message`).
- **Widget** (`/perch`) — orb + persistent Retell call + bilingual qualifier card → booking into Clio, with the qualifier summary folded into the calendar entry and Grow lead.
- **Booking** — 30-min slots, Turnstile on the write.

### SEO Phase 1 — complete
Sitemap 71→94 URLs w/ `lastmod` · unique titles on 14 practice pages · 98 empty meta tags filled · topic promoted to `<h1>` (visually pinned) · `desclimer` typo + `the-cmm2` duplicates 301'd · `Person` schema on 4 bios · booking page un-orphaned.

### Specced, NOT started
**Option B** — remove the iframe, keep Perch as a persistent overlay. See `donovan-legal-site/OPTION-B-PORT-SPEC.md`. The live iframe shell is untouched and still serving.

---

## 7. Next actions

**Blocked on Elroy / the firm:**
1. **GA4 `G-` measurement ID** — the site has **zero analytics**; this gates all measurement and Google Ads. Create under a *firm* Google account, add Paul as Admin.
2. **Search Console** — verify (one click once GA4 exists), submit `sitemap.xml`
3. **Google Business Profile** — still shows the OLD 866 number; the site changed 2026-07-17
4. **Google Ads `AW-` ID** — only when Paul commits a budget
5. `sameAs` profile URLs + office geo coordinates

**Ready to build:** Option B (B.1 `perch-layer.js` → B.5 cutover, per the spec)

**Small/open:** delete the 2 `ZZTEST DeleteMe` smoke leads (Vantage + Clio Grow) · caller-ID decision (Wendy sees firm line vs caller's number) · Clio calendar decision (Firm calendar `9084653` vs Wendy's own) · widget "Paula" greeting still in `begin_message` · widget latency (47k-char prompt) · practice pages are thin (37–143 words — Paul's copy) · merge branch → `main` (PR + review per §22)

---

## 8. Key facts (non-secret)

| Thing | Value |
|---|---|
| Repo / branch | `TicoAI/DonovanLegal` · `feat/perch-voice-concierge` |
| Site dir | `donovan-legal-site/` |
| Deploy | `npx wrangler pages deploy . --project-name donovan-site --branch main` |
| CF project | `donovan-site` · prod alias `donovan-site.pages.dev` |
| ⚠️ Functions | `/fn/*` are served on **`donovan-site.pages.dev`**, *not* on `donovan.law` |
| Phone (live) | **+1 561-529-5873** |
| Spares (parked in Retell) | +1 866-829-4530 (Vonage) · +1 866-797-9120 (toll-free) |
| Transfer target | Wendy +52 55 4651 1119 |
| Phone agent | `agent_83952b13de75271faedee94ac5` · LLM `llm_85a73ddc105cf7896e6d43f2db15` (published v7; number pinned to `latest_published`) |
| Widget agent | `agent_7d044bab7d2d0e5d648de5f198` · LLM `llm_46c9246d2921b0a43513973b1283` |
| Clio calendars | `9084638` Donovan Legal (Paul) · `9084653` Firm (account calendar) |
| Vantage | `vantage.ticoai.net` · deployments `donovan-intake` (widget), `donovan-phone` (phone) |
| CF env vars (dashboard only) | `CLIO_CLIENT_ID/SECRET/REFRESH_TOKEN`, `CLIO_CALENDAR_ID`, `GROW_LEAD_TOKEN`, `TURNSTILE_SECRET_KEY`, `VANTAGE_READ_SECRET` |

---

## 9. Gotchas that will bite

- **Cloudflare propagation lag** — after a deploy the alias can serve the old build for a minute. Hard-reload / cache-bust before concluding a change didn't work. This wasted real time repeatedly.
- **Retell versioning** — publishing freezes a version. To edit afterwards: `createAgentVersion` (from a base) → edit the LLM draft → `publishAgentVersion`. The phone number is pinned to `latest_published`, so publishing is enough — no re-pointing.
- **`donovan.law/fn/*` returns 404** — functions only serve on the `pages.dev` domain. Retell tool URLs must use `donovan-site.pages.dev`.
- **`C:\Users\elroy` has `"type":"module"`** — standalone Node scripts there must be `.cjs`.
- **Never paste secrets** anywhere visible. Runtime secrets belong in the CF dashboard; local ones in `.env`.
