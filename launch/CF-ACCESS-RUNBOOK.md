# CF Access — Member-Tier Auth Runbook (Donovan)

Replaces the dead cPanel `.htaccess` Basic Auth. Gates `/gold /platinum /diamond /reserve`
behind Cloudflare Access with **email one-time-PIN** (no IdP, no passwords for us to store).

**Who runs this:** Elroy (Cloudflare Zero Trust dashboard). **Needs from Paul:** the member
email list per tier.

> ⚠️ This MUST be live and verified on all four paths BEFORE the public DNS flip. The
> diamond/reserve dirs contain securities-sensitive SAMPLE deal packages (Reg D / NY
> publication) — they cannot be world-readable.

---

## Tier hierarchy model (use Access Groups, not raw email lists)

Higher tiers inherit lower-tier content. Model it once with Groups so a member is added
to exactly one group and gets everything at/below their tier.

Create 4 **Access Groups** (Zero Trust → Access → Access groups):
- `Donovan-Gold` → include emails: <gold members>
- `Donovan-Platinum` → include emails: <platinum members>
- `Donovan-Diamond` → include emails: <diamond members>
- `Donovan-Reserve` → include emails: <reserve members, 001–100>

Then each tier's app allows its group **plus all higher groups**:

| Path | Allowed groups |
|------|----------------|
| `/gold/*` | Gold, Platinum, Diamond, Reserve |
| `/platinum/*` | Platinum, Diamond, Reserve |
| `/diamond/*` | Diamond, Reserve |
| `/reserve/*` | Reserve |

(If Paul wants strictly siloed tiers instead of inherit-down, allow only the matching group per path — say the word and I'll flip the table.)

---

## Per-application setup (do this 4×, once per tier)

Zero Trust → Access → Applications → **Add an application → Self-hosted**.

1. **Application name:** `Donovan <Tier>`
2. **Session duration:** 30 days (members; adjust to taste)
3. **Application domain(s):** add BOTH so it works pre- and post-flip:
   - `donovan-site.pages.dev` — path `/<tier>/` (pre-flip testing)
   - `donovan.law` — path `/<tier>/` (and `www.donovan.law` if used) — add now, harmless until DNS flips
4. **Identity providers:** enable **One-time PIN** (Settings → Authentication → One-time PIN must be on at the account level).
5. **Policies → Add a policy:**
   - Action: **Allow**
   - Name: `<Tier> members`
   - Include: **Access Groups** → select per the hierarchy table above
6. Save.

Repeat for gold, platinum, diamond, reserve.

---

## Verify (before flip)

For each tier path on `https://donovan-site.pages.dev/<tier>/`:
- [ ] Unauthenticated visit → redirected to CF Access email-PIN screen (NOT the content)
- [ ] Non-member email → PIN works but access **denied**
- [ ] Member email → PIN → content loads
- [ ] A Gold member is **denied** `/reserve/` but **allowed** `/gold/`
- [ ] A Reserve member is **allowed** all four

## At DNS flip
- Application domains already include `donovan.law` (step 3) → no change needed.
- Confirm `donovan.law` is proxied (orange-cloud) through Cloudflare or Access won't intercept.

## Cleanup (already staged in code)
- The four `<tier>/.htaccess` Basic-Auth files are deleted from the deploy — they did nothing
  on Pages and implied protection that didn't exist. CF Access is the real gate now.
