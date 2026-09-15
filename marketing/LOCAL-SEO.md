# Local SEO — Google Business Profile and citations

Google's local ranking leans heavily on **NAP consistency**: Name, Address, Phone
matching everywhere the firm appears. Donovan's does not currently match, and that
has to be fixed alongside creating the Business Profile — a perfect profile
pointing at a web full of contradictions still underperforms.

---

## The canonical NAP — use these EXACTLY

From the live site's own schema.org markup, confirmed against the Florida
Division of Corporations.

```
Donovan Legal PLLC
301 W. Atlantic Avenue, Suite 5
Delray Beach, FL 33444
(561) 529-5873
https://www.donovan.law
info@donovan.law
```

**Sunbiz confirms it.** Entity `L20000082983`, filed 2020-03-16, **ACTIVE**,
principal address changed to 301 W Atlantic Ave Suite 5 on **2025-05-01**. The
current address is public record, so the older one is genuinely stale rather than
an alternative spelling.

**On the phone number:** `561-529-5873` is the Paula/Retell concierge line and it
is what the live site publishes. Keeping it on the Business Profile means calls
from Google Maps get answered, qualified and booked automatically. That is the
machine working — worth preferring over the main office number.

---

## ⚠️ Stale citations already live on the web

Found 2026-08-10. Each contradicts the site:

| Source | What it says | Wrong how |
|---|---|---|
| LawInfo | 55 SE 2nd Avenue · 561-666-6022 | **Old address AND old phone** |
| Avvo | 301 W Atlantic Ave **Ste R5** | Suite variant — "Ste R5" vs "Suite 5" |
| FindLaw | listing exists | verify against canonical |

The old **55 SE 2nd Avenue** address and **561-666-6022** phone are the same pair
the retired Cloud Run site was publishing. That site is 403 now, but the
directories it seeded are still out there.

---

## Before creating anything: check whether a profile already exists

Google auto-generates listings for businesses it detects, so this may be a
**claim** rather than a create. Creating a second makes a duplicate, which is
worse than having none — duplicates split ranking signals and are tedious to merge.

1. Search Google Maps for `Donovan Legal PLLC Delray Beach`
2. **If a listing appears** — look for *"Own this business?"* or *"Claim this business"*. It needs claiming, not creating. Check the address and phone it shows: if it carries the old 55 SE 2nd Avenue pair, that is a live problem worth fixing first
3. **If nothing appears** — create it

---

## Who should own it — not Tico

This is the firm's Google presence. It carries their reviews, it shows on Maps,
and for a local practice it is often the single most valuable digital asset there
is. **It should be created or claimed under a `@donovan.law` account** — Leidy or
Paul — not under `elroy@ticoai.net`.

Same argument already running on the Meta assets and the ad account. Far easier to
get right at creation than to transfer once it has history and reviews attached.

If Tico needs to manage it, the owner adds them as a **Manager**. That is the
correct shape: firm owns, agency manages.

---

## Setup values

| Field | Value |
|---|---|
| Name | `Donovan Legal PLLC` |
| Primary category | **Tax attorney** — the single biggest ranking lever, and less contested than the generic "Law firm" |
| Secondary categories | Law firm · Real estate attorney |
| Address | as canonical above; storefront, since there is a real office |
| Service area | Palm Beach County / South Florida. Keep it tight — a large declared area dilutes local ranking rather than widening reach |
| Phone | `(561) 529-5873` |
| Website | `https://www.donovan.law` |

**Verification is usually a postcard** to the office address. Somebody has to be
told to watch for it — it looks like junk mail, and binning it means starting over.

---

## Blocked: nobody knows who holds GoDaddy DNS

`donovan.law` nameservers are `ns51/ns52.domaincontrol.com` — **GoDaddy**, not
Cloudflare. Two pending tasks need a DNS TXT record there:

- **Meta domain verification** (handoff doc P2) — the plan assumed Cloudflare. That was wrong.
- **Google Search Console** — this one has a free way around it: once GA4 is live, Search Console verifies in a single click with no DNS at all. Wait for switch-on rather than chasing access.

Worth asking David who holds the GoDaddy account.
