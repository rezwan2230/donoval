# DR. INSANE — Apex Origin Findings (`donovan.law`)

**Order:** DRINSANE-APEX-ORIGIN-R1
**Agent:** Dr. Insane (security)
**Repo:** TicoAI/DonovanLegal — branch `drinsane/apex-origin-r1` off `main` @ `73852d0`
**Probes run:** 2026-08-04, 15:46–15:53 UTC; re-probe for §4.2.1 and §5.1–§5.2 at 16:25 UTC (DRINSANE-APEX-PUBLISH-R1)
**Scope:** read-only. No DNS record changed, no service deleted or redeployed, no Cloudflare or GCP configuration touched, no write of any kind to Clio. Every HTTP probe was `GET`, `HEAD`, or a redirect follow. No `POST` was issued to any booking path.

---

## How to read this document (DRINSANE-APEX-DOC-CORRECT-R1)

This file accumulates three orders in publication sequence: **§1–§8** (apex origin), **§9–§17** (Cloud Run enumeration), **§18** (the impersonated credential). **Later sections correct earlier ones.** A reader working top-to-bottom will otherwise reach superseded guidance before reaching its correction — which is exactly what happened with §7 Option 3.

**Corrections applied 2026-08-04 under DRINSANE-APEX-DOC-CORRECT-R1, before this became the remediation record:**

| # | What was wrong | Where | What refutes it |
|---|---|---|---|
| 1 | §7 Option 3 step 1 told the reader to run `gcloud auth login`, **labelled read-only**. It is neither the repair nor a read — it mints a credential and writes local config. | §7 | §18.3, §18.5 |
| 2 | §6 and §7 were written before the Cloud Run and impersonation work and carried no supersession marker — including the "reachable and billing" claim and the false "reauthentication failed" diagnosis. | §6, §7 | §11.1, §15, §18.3 |
| 3 | The deploy definition was cited at `donovan-law-site/cloudbuild.yaml`. **No such file or directory exists**; it is `cloudbuild.yaml` at the repo root. | §6 G1, §7 | §11.1, which cites `cloudbuild.yaml:30` correctly |
| 4 | A 24-service inventory of unrelated tenants — names, regions, public/private status, page titles — was published in a **client** repo. | §10.2, §11.2, §13.1 | Reduced to counts + the `donovan-law-site` row; full tables moved to [issue 145](https://github.com/TicoAI/DonovanLegal/issues/145#issuecomment-5182687147) |
| 5 | Three negatives were stated wider than their evidence: an unqualified "no second consumer of the Clio credential"; "no service **anywhere in the estate**" when **8 of 29** were fingerprinted; `SERVICE_DISABLED` read as "no service **has ever** run there". | §14, §13.1, §17, §10.3 | Each now states its sample |
| 6 | The six-versus-seven project count was left unexplained, and a committed handoff doc names a build trigger §16 could not find. | §18.5, §16 | Both now recorded, with what each does and does not settle |

**Every correction above is to wording, scope, or placement. No confirmed finding was weakened, withdrawn, or restated.** The originals are marked in place rather than deleted, so each correction is auditable against what it corrects.

---

## Bottom line

**A client cannot book against the apex today.** The apex `donovan.law` serves no Donovan Legal application content at all — no HTML pages, no Pages Functions, no booking path. It is a **GoDaddy domain-forwarding endpoint** that 301s the bare root `/` to `https://www.donovan.law` and returns a generic 404 for every other path.

The "stale copy of the firm site on the apex" scenario in the order **did not reproduce**. There is no second origin serving firm content, and therefore no pre-PR-129 booking code exposed on the apex. The orphaned–Cloud-Run hypothesis is ruled out for the apex by TLS and server evidence (§1.4).

There is still a real but **lower-severity** problem: the apex is present in search-engine indexes, and every indexed apex URL now returns an empty 404. Clients arriving from search on an apex result get a blank dead page (§4).

**One premise in the order could not be reproduced.** The order's claim that `donovan.law/engagement.html` serves a page titled *Engagement Levels* did not reproduce under any probe: 6 named resolvers, 4 named user agents, ports 80 and 443, and both apex IPs pinned individually — all returned an empty 404. It is recorded as **NOT REPRODUCED** in §5, with the full probe matrix in §5.1, rather than omitted from the record.

---

## 1. Task 1 — What serves the apex

### 1.1 DNS records (CONFIRMED)

Zone authority is **GoDaddy**, not Cloudflare:

```
$ nslookup -type=NS donovan.law 8.8.8.8
donovan.law   nameserver = ns51.domaincontrol.com
donovan.law   nameserver = ns52.domaincontrol.com
```

`domaincontrol.com` is GoDaddy's nameserver estate. The apex and `www` resolve to **different** infrastructure:

| Host | Record | Value | Platform |
|---|---|---|---|
| `donovan.law` | A | `3.33.251.168`, `15.197.225.128` | AWS Global Accelerator anycast |
| `donovan.law` | AAAA | *(none returned)* | — |
| `www.donovan.law` | CNAME | `donovan-site.pages.dev` → `172.66.44.184`, `172.66.47.72` | Cloudflare |

The apex A records are identical from Google (`8.8.8.8`), Cloudflare (`1.1.1.1`), Quad9 (`9.9.9.9`), OpenDNS (`208.67.222.222`), the Comcast system resolver, and the authoritative `ns51.domaincontrol.com`. This is not a resolver-local or cached artifact.

### 1.2 TLS certificate (CONFIRMED — the decisive identifier)

```
apex donovan.law:
  issuer  = C=US, O=GoDaddy.com, CN=GoDaddy TLS Intermediate CA DV - R1v1
  subject = CN=donovan.law
  SAN     = DNS:donovan.law
  validity= Jul 21 22:46:03 2026 GMT -> Feb  4 22:46:03 2027 GMT

www.donovan.law:
  issuer  = C=US, O=Google Trust Services, CN=WE1
  subject = CN=www.donovan.law
  SAN     = DNS:www.donovan.law
  validity= Jul 21 21:47:23 2026 GMT -> Oct 19 22:47:21 2026 GMT
```

The apex certificate is issued by **GoDaddy's own DV CA** and covers the apex alone. GoDaddy provisions exactly this certificate shape for its Domain Forwarding product. The `www` certificate is Google Trust Services `WE1`, which is Cloudflare Universal SSL. Two different issuers means two independently terminated TLS endpoints.

### 1.3 HTTP response headers (CONFIRMED)

The apex root:

```
$ curl -sSI https://donovan.law/
HTTP/1.1 301 Moved Permanently
Content-Length: 58
Content-Type: text/html; charset=utf-8
Location: https://www.donovan.law
Server: ip-10-123-124-216.ec2.internal
Vary: Accept-Encoding
X-Request-Id: e5730ff4-d1cc-498c-87bc-ec9d8cc1ac58
```

Body (58 bytes): `<a href="https://www.donovan.law">Moved Permanently</a>.`

Two platform identifiers leak here:

- `Server: ip-10-123-124-216.ec2.internal` — an **AWS EC2 internal hostname** emitted as the `Server` header. The value rotates per request across a fleet (`ip-10-123-125-121`, `ip-10-123-124-237`, `ip-10-123-125-239`, `ip-10-123-125-9` all observed), confirming a load-balanced pool.
- `Server: awselb/2.0` with a `Wafrule: 5` header on other paths — an **AWS Application Load Balancer** with a WAF rule in front.

The `Location` is `https://www.donovan.law` with **no path component**, on every request. GoDaddy forwarding is configured here **without path forwarding**.

For contrast, `www` is unambiguously Cloudflare and unambiguously the firm's app:

```
$ curl -sSI https://www.donovan.law/
HTTP/1.1 200 OK
Server: cloudflare
CF-RAY: a25eb2a67b71708a-MIA
Cache-Control: no-store
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...' ...
```

### 1.4 The apex has three responders, all generic (CONFIRMED)

The apex response is a function of **URL shape only**, not of any route that exists in this repo:

| Path shape | Example | Status | Body | `Server` |
|---|---|---|---|---|
| bare root | `/` | 301 → `https://www.donovan.law` | 58 B | `ip-10-123-x-x.ec2.internal` |
| one segment, no extension | `/about`, `/engagement`, `/book` | 404 | 143 B GoDaddy parking page | `ip-10-123-x-x.ec2.internal` |
| one segment, with extension | `/engagement.html`, `/robots.txt` | 404 | **0 B** | `awselb/2.0` + `Wafrule: 5` |
| two or more segments | `/booking/availability`, `/x/y/z` | 404 | 10 B `Not Found\n` | *(no `Server` header)* |

The 143-byte page is GoDaddy's generic parking 404, titled `Not Found`:

```html
<!DOCTYPE HTML>
<html lang='en-us'>
  <head>
    <title>Not Found</title>
  </head>
  <body>
    HTTP Status: 404 (not found)
  </body>
</html>
```

**Cloud Run is ruled out.** A Cloud Run service would present a Google-managed certificate and `Server: Google Frontend`. The apex presents a GoDaddy DV certificate and AWS ELB/EC2 identifiers. No response from the apex carried a Google or Cloudflare header on any probe.

### 1.5 Origin statement

> The apex `donovan.law` is served by **GoDaddy Domain Forwarding**, running on AWS (Global Accelerator anycast → Application Load Balancer with WAF), terminating TLS with a GoDaddy-issued DV certificate for `donovan.law`. It forwards only the bare root to `https://www.donovan.law` with a 301 and no path preservation, and 404s everything else. It is not Cloudflare Pages, and it is not Cloud Run.

---

## 2. Task 2 — What build or commit the apex origin serves

**The apex serves no build.** There is no application, no static bundle, and no commit to fingerprint. Every non-root path returns one of the three generic 404s in §1.4, whose bodies (0 B, 10 B, and the 143 B GoDaddy parking page) contain no firm content, no asset reference, and no version marker.

To make that a positive finding rather than an absence-of-evidence claim, `www` was fingerprinted against this repo. **`www` is current at `73852d0`** (`main` HEAD, the commit Pages deployed):

| Page | Live `www` `<title>` | `73852d0` `<title>` | Match |
|---|---|---|---|
| `/engagement` | `About Membership \| Donovan Legal PLLC` | `About Membership \| Donovan Legal PLLC` | ✅ |
| `/membership-gold` | `Gold Membership \| Donovan Legal PLLC` | `Gold Membership \| Donovan Legal PLLC` | ✅ |
| `/membership-diamond` | `Diamond Membership \| Donovan Legal PLLC` | `Diamond Membership \| Donovan Legal PLLC` | ✅ |
| `/membership-platinum` | `Platinum Membership \| Donovan Legal PLLC` | `Platinum Membership \| Donovan Legal PLLC` | ✅ |
| `/membership-reserve` | `Reserve Membership \| Donovan Legal PLLC` | `Reserve Membership \| Donovan Legal PLLC` | ✅ |

Secondary fingerprint — the `<h2>The Other Engagement Levels</h2>` block introduced by PR #135 (`45d9981`) is present exactly once on each of the four live tier pages and absent from `/engagement`, matching the repo at `73852d0` occurrence-for-occurrence.

The Cloudflare Pages default hostname `donovan-site.pages.dev` also serves the same current content (`/engagement.html` → 200 `About Membership`, `/membership-gold.html` → 200 `Gold Membership`). The branch alias `main.donovan-site.pages.dev` returns `Deployment Not Found`. **No stale Pages alias was found serving divergent content.**

> Note on live URL spellings: `www` 308-redirects legacy `.html` paths to clean URLs (`/engagement.html` → `/engagement`). A probe that does not follow redirects reads a 308 with an empty body and can be misread as "no content". All fingerprints above follow redirects and record the effective final URL.

---

## 3. Task 3 — Booking path and Functions endpoints on the apex

### 3.1 Result: no booking path, no Functions endpoint (CONFIRMED)

Every booking and Functions route defined in `donovan-legal-site/functions/` was probed on the apex with `GET` only:

| Apex path | Status | Body | Responder |
|---|---|---|---|
| `/booking/availability` | 404 | 10 B `Not Found\n` | no `Server` header |
| `/booking/types` | 404 | 10 B | no `Server` header |
| `/booking/create` | 404 | 10 B | no `Server` header |
| `/fn/get_availability` | 404 | 10 B | no `Server` header |
| `/fn/save_lead` | 404 | 10 B | no `Server` header |
| `/consent-notice` | 404 | 143 B parking page | `ip-10-123-x-x.ec2.internal` |
| `/book`, `/book.html` | 404 | 143 B / 0 B | parking / `awselb/2.0` |

### 3.2 Proof this is a blanket 404, not a route that merely failed

A 404 on a booking path is weak evidence on its own — it cannot distinguish "no such backend" from "backend present, method or route mismatch". The discriminating test: compare the booking path against a path that **cannot exist on any origin**.

```
$ curl -D h1 -o b1 https://donovan.law/booking/availability
$ curl -D h2 -o b2 https://donovan.law/zz9/qq8/nope
$ diff <(xxd b1) <(xxd b2)                       -> IDENTICAL bodies
$ diff <(grep -vi '^date:' h1) <(grep -vi '^date:' h2) -> IDENTICAL headers
```

`/booking/availability` and a nonsense path return **byte-identical bodies and byte-identical headers** (Date excluded). The apex does not distinguish the booking route from noise. There is no booking backend behind it.

### 3.3 Positive control — the probe method can detect a live endpoint

A negative result needs a positive arm, or it only proves the probe was inert. The same probe against `www` finds live Functions immediately:

```
GET https://www.donovan.law/booking/availability
  200 cloudflare
  {"ok":true,"deployment":"donovan-main","type":"","from":"2026-08-04T15:49:58.344Z","to":"2...

GET https://www.donovan.law/booking/types
  200 cloudflare
  {"ok":true,"deployment":"donovan-main","types":[{"id":"consult","name":"Initial Consultati...

GET https://www.donovan.law/consent-notice
  200 cloudflare
  {"version":"v1-2026-07-20-draft","text":"Before we connect you:\n\nYou will be speaking wi...
```

The method detects live booking Functions on `www` and finds nothing on the apex. The apex negative is real.

### 3.4 Pre-PR-129 behaviour question

The question is moot for the apex: with no endpoint present, there is no behaviour to compare against the pre-`2c6f338` code that read a wrong-shaped Clio 200 as an empty calendar. PR #129 changed `functions/booking/_lib/provider-clio.js` (+132 lines) and added `test/clio-busy-blocks.test.mjs` (547 lines); none of that code is reachable from `donovan.law`.

> **Double-booking risk from the apex: none.** There is no path on `donovan.law` through which a client can reach a calendar, read availability, or create a booking.

### 3.5 One limitation, stated plainly

`POST` was deliberately not issued anywhere. On `www`, `GET /booking/create` returns the Cloudflare Pages static 404 (`<title>File Not Found</title>`), which is indistinguishable from a `POST`-only Function responding to a wrong method. So this report does **not** characterise `www`'s `booking/create` behaviour — doing so would require a `POST` that could write to the firm Clio calendar, which the order forbids and which I did not do. This limitation does not affect the apex conclusion, which rests on the byte-identical-to-nonsense test in §3.2, not on `create` alone.

---

## 4. Task 4 — Indexing, URL competition, fees, and member content

### 4.1 The apex is in the search index (CONFIRMED)

A `site:donovan.law` search returns a result on the **apex** host:

- `https://donovan.law/formation.html` — titled *Donovan Legal PLLC*

Other returned results are on `www` and use the legacy `.html` spellings: `www.donovan.law/profile.html`, `/family-law.html`, `/ourfirm.html`, `/contact.html`.

### 4.2 Every indexed apex URL is now a dead link (CONFIRMED)

| Indexed URL | Apex today | Same path on `www` today |
|---|---|---|
| `/formation.html` | **404, 0-byte body** | 200 → `/entity-formation` — *Entity Formation & Ownership Structures* |
| `/family-law.html` | **404, 0-byte body** | 200 → `/experience` — *Representative Engagements* |
| `/profile.html` | **404, 0-byte body** | 200 → `/profile` — *Paul K. Donovan \| Tax Attorney & CPA* |
| `/ourfirm.html` | **404, 0-byte body** | 200 → `/ourfirm` — *The Firm* |

A client who clicks the indexed `donovan.law/formation.html` result gets an HTTP 404 with a **completely empty body** — a blank white page with no branding, no explanation, and no route back to the firm. This is the live client-facing harm.

### 4.2.1 Task 4, answered in one line

> **No — no indexed apex URL returns anything other than an empty 404.** Re-verified 2026-08-04 16:25 UTC: a fresh `site:donovan.law` query returns exactly one apex-host result, `https://donovan.law/formation.html`, and a `GET` of it returns HTTP 404 with `Content-Length: 0` and a zero-byte body; every other result in that query is on `www`. The dead-link defect in §4.2 is therefore the only remaining defect, and it is unchanged.

Two boundary conditions on that one-liner, so it is not read wider than it was tested:

- It is scoped to **`GET`**. A `HEAD` of the same URL returns 405, not 404 — see §5.2. That is a front-end method rejection, not content.
- It is scoped to **indexed** URLs, which are all `.html`-suffixed legacy spellings and therefore hit the zero-byte responder. Extensionless apex paths (`/formation`, `/ourfirm`) return a **143-byte GoDaddy parking page** titled `Not Found` — a non-empty 404 — but no extensionless apex URL appeared in the index, so none of them is a client-reachable search result today. If the index later picks one up, the §4.2 characterisation would need re-checking.
- Per gap **G3**, `site:` is a sample and not an exhaustive index dump. The claim is "every indexed apex URL found returns an empty 404", not "the index provably contains no other apex URL".

### 4.3 The apex does not compete with `www` for content (CONFIRMED)

Duplicate-content competition requires the apex to serve the same pages. It serves none. Additional confirmation from the `www` side:

- **Sitemap:** `https://www.donovan.law/sitemap.xml` contains 84 `<loc>` entries. **84 are `https://www.donovan.law`; 0 are the bare apex.** No apex URL is advertised for crawling.
- **`robots.txt`:** `User-agent: * / Allow: /`, with `Sitemap: https://www.donovan.law/sitemap.xml`. The apex has **no** `robots.txt` — `https://donovan.law/robots.txt` returns 404 (0 bytes, `awselb/2.0`).
- **Canonicals:** every `www` page sampled declares a `www` canonical — `/` → `https://www.donovan.law/`, `/engagement` → `https://www.donovan.law/engagement`, `/membership-gold` → `https://www.donovan.law/membership-gold`, `/contact` → `https://www.donovan.law/contact`. No page canonicalises to the bare apex.
- Served `www` HTML contains **no** bare-apex (`https://donovan.law/…`) links.

So the apex URLs in the index are **residue from the pre-Cloudflare GoDaddy cPanel era**, not an actively competing copy. The repo records that origin directly: commit `ca79bd4` — *"feat: import live production source from GoDaddy cPanel (Jun 12 2026)"*.

### 4.4 Fees and private member content on the apex (CONFIRMED)

**Neither is exposed.** The apex serves zero HTML pages. Specifically probed and 404'd: `/membership-gold`, `/membership-gold.html`, `/membership-diamond`, `/membership-diamond.html`, `/engagement`, `/engagement.html`, `/members`, `/members/x`, `/diamond`, `/diamond/index.html`, `/gold`. No fee figure and no member-gated content is retrievable from `donovan.law` because no document body is retrievable from `donovan.law` at all.

---

## 5. PREMISE NOT REPRODUCED — the `engagement.html` title claim

> **Status: NOT REPRODUCED.** This section records a premise stated in the order that I probed for and **could not reproduce**. It is retained here as an unreproduced premise rather than dropped from the record, so that the correction travels with the conclusion. I am not asserting the premise was never true; I am asserting that under every probe listed in §5.1 it is not true now, and that I found no mechanism by which it could have been true of the apex.

The order states that `donovan.law/engagement.html` returns a page titled **Engagement Levels** while `www.donovan.law/engagement.html` returns **About Membership**. Three of the order's four sub-claims reproduce; this one does not.

| Order's claim | Verified now | Result |
|---|---|---|
| `www…/membership-gold.html` 200 and current | 200, `Gold Membership`, matches `73852d0` | ✅ reproduces |
| `donovan.law/membership-gold.html` 404 | 404, 0 bytes, `awselb/2.0` | ✅ reproduces |
| `www…/engagement.html` titled *About Membership* | `About Membership \| Donovan Legal PLLC` | ✅ reproduces |
| `donovan.law/engagement.html` titled *Engagement Levels* | **404, 0-byte body, `awselb/2.0`** | ❌ does not reproduce |

### 5.1 What was tested before calling the premise unreproduced

A "could not reproduce" is only worth as much as the list of things that were tried. Re-probe run 2026-08-04 16:25 UTC. Every cell below returned **HTTP 404, `Content-Length: 0`, zero-byte body, no `<title>` element of any kind**. No probe in any cell retrieved a document titled *Engagement Levels*, or any document at all.

**Resolvers (6) — all returned the identical apex A set `3.33.251.168` + `15.197.225.128`:**

| Resolver | Operator | Result |
|---|---|---|
| `8.8.8.8` | Google Public DNS | `15.197.225.128`, `3.33.251.168` |
| `1.1.1.1` | Cloudflare | `3.33.251.168`, `15.197.225.128` |
| `9.9.9.9` | Quad9 | `15.197.225.128`, `3.33.251.168` |
| `208.67.222.222` | OpenDNS / Cisco | `3.33.251.168`, `15.197.225.128` |
| `ns51.domaincontrol.com` | GoDaddy, **authoritative** | `3.33.251.168`, `15.197.225.128` |
| system default (`2001:558:feed::1`) | Comcast, ISP-assigned | `15.197.225.128`, `3.33.251.168` |

No resolver returned a third address, and no resolver disagreed. The premise cannot be explained by a split-horizon or resolver-local answer.

**User agents (4), sent as the literal `User-Agent` request header:**

| Label | Exact string sent | Result on `https://donovan.law/engagement.html` |
|---|---|---|
| curl | `curl/8.4.0` | 404, 0 bytes, no title |
| Chrome desktop | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36` | 404, 0 bytes, no title |
| Safari iOS | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1` | 404, 0 bytes, no title |
| Googlebot | `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)` | 404, 0 bytes, no title |

The apex does not content-negotiate on User-Agent. A crawler-only or browser-only variant of the page is ruled out.

**Ports and schemes (2):**

| Port | Scheme | Result |
|---|---|---|
| 443 | `https://` | 404, 0 bytes, `Server: awselb/2.0`, `Wafrule: 5` |
| 80 | `http://` plaintext, redirects **not** followed | 404, 0 bytes |

Port 80 was probed without following redirects specifically so that a 301 to `www` could not be mistaken for apex content — the host under test never changes in these rows.

**Both apex IPs pinned individually** with `curl --resolve donovan.law:443:<ip>`, so that anycast or ALB pool member selection could not hide a divergent origin:

| Pinned IP | Result |
|---|---|
| `3.33.251.168` | 404, 0 bytes, no title |
| `15.197.225.128` | 404, 0 bytes, no title |

**Total: 6 resolvers × 4 user agents × 2 ports × 2 pinned IPs, all negative.**

### 5.2 One method-dependent wrinkle, recorded so it is not mistaken for content

`GET` and `HEAD` do **not** return the same status on the apex:

```
$ curl -sS -X GET  -o /dev/null -w '%{http_code} %{size_download}\n' https://donovan.law/formation.html
404 0
$ curl -sS -X HEAD -o /dev/null -w '%{http_code} %{size_download}\n' https://donovan.law/formation.html
405 0        # 405 Method Not Allowed, Content-Length: 19, text/plain, no Server header
```

`HEAD` is rejected by the fronting layer with **405 Method Not Allowed** and a 19-byte `text/plain` body; `GET` reaches the ELB and yields the empty 404. This is a property of the GoDaddy forwarding front end, not firm content — the 405 body is the literal string `Method Not Allowed`. It is recorded because a `HEAD`-only probe of the apex reads as "405, not 404" and could be misreported as a live endpoint refusing a method. It is not one. Every `GET` in §5.1 returned the empty 404.

**INFERRED — two candidate mechanisms, neither confirmed:**

1. The string *"Engagement Levels"* does exist in this repo, but as an `<h2>` — `The Other Engagement Levels` — inside the four tier pages `membership-{gold,diamond,platinum,reserve}.html`, added by PR #135 (`45d9981`). It has **never** been the `<title>` of `engagement.html`; across all history, that file's title has only ever been `About Membership | Donovan Legal PLLC`. A tool reporting a page heading rather than the `<title>` element, read from a tier page, would produce exactly this string.
2. A browser probing the apex is 301'd from `/` to `www` and then browses on `www`, so the host under test silently changes. A check that records only the pathname cannot see that the host moved.

I could not distinguish these two from the available evidence, and I am not asserting either. What is confirmed is the current-state finding: **the apex serves no such page today, and serves no firm content of any kind.**

---

## 6. Confirmed vs inferred — summary

> **⚠️ PARTIALLY SUPERSEDED — read §10–§15 and §18 before acting on anything in this section.**
> §1–§5 and the confirmed table C1–C17 below stand unchanged: they rest on DNS, TLS, and HTTP evidence and were never dependent on GCP access.
> What is superseded is the **GCP portion**, written before the Cloud Run enumeration and before the impersonation finding:
> - **Gap G1 ("GCP not enumerated")** is **closed** by §10–§15. The service was found. Its diagnosis of *why* enumeration failed — a reauthentication problem — is **refuted** by §18.3 and by the last row of §18.5: the credential was valid throughout, and the cause was service-account impersonation.
> - **Inference I4** is superseded by the direct evidence in §13.1.
> - The **"exists and costs money"** framing in G1 is refuted by §15: billing is disabled on the project and the exposure is **zero dollars**.
>
> Nothing below has been deleted; it is left in place so the correction is auditable against what it corrects.

### Confirmed (each backed by a DNS record, a response header, a certificate, or a content fingerprint)

| # | Claim | Evidence |
|---|---|---|
| C1 | `donovan.law` NS is GoDaddy | `ns51/ns52.domaincontrol.com` |
| C2 | Apex and `www` are different origins | Apex A `3.33.251.168`/`15.197.225.128`; `www` CNAME `donovan-site.pages.dev` |
| C3 | Apex TLS is GoDaddy-issued | `issuer=O=GoDaddy.com, CN=GoDaddy TLS Intermediate CA DV - R1v1` |
| C4 | `www` TLS is Cloudflare | `issuer=O=Google Trust Services, CN=WE1`; `Server: cloudflare`; `CF-RAY` |
| C5 | Apex runs on AWS ELB + WAF | `Server: awselb/2.0`, `Wafrule: 5`, `Server: ip-10-123-x-x.ec2.internal` |
| C6 | Apex forwards root only, no path | `Location: https://www.donovan.law` on every request |
| C7 | Apex serves no HTML pages | 404 on all 20+ paths probed, in both `.html` and clean-URL spellings |
| C8 | Apex has no booking or Functions endpoint | `/booking/availability` byte-identical to `/zz9/qq8/nope` |
| C9 | Probe method is not inert | `www` `/booking/availability`, `/booking/types`, `/consent-notice` all 200 JSON |
| C10 | `www` is current at `73852d0` | 5/5 title matches + PR #135 `h2` fingerprint |
| C11 | Apex appears in the search index | `site:donovan.law` returns `https://donovan.law/formation.html` |
| C12 | Indexed apex URLs are dead | `/formation.html`, `/family-law.html`, `/profile.html`, `/ourfirm.html` all 404, 0 bytes |
| C13 | Sitemap and canonicals are 100% `www` | 84/84 `<loc>` on `www`, 0 apex; 4/4 canonicals `www` |
| C14 | No fee or member content on apex | No document body retrievable from apex on any path |
| C15 | No stale Pages alias | `donovan-site.pages.dev` current; `main.donovan-site.pages.dev` = `Deployment Not Found` |
| C16 | The order's *Engagement Levels* apex premise **does not reproduce** | 6 resolvers × 4 UAs × 2 ports × 2 pinned IPs, all 404/0-byte/no-title — §5.1 |
| C17 | Apex rejects `HEAD` with 405, distinct from the `GET` 404 | `HEAD /formation.html` → 405, `Content-Length: 19`, `text/plain` — §5.2 |

### Inferred (reasoned, not directly proven)

| # | Inference | Basis | Confidence |
|---|---|---|---|
| I1 | The apex is specifically **GoDaddy Domain Forwarding** (as opposed to some other GoDaddy product) | GoDaddy DV cert for the apex alone + AWS ELB + root-only 301 with no path preservation + GoDaddy parking 404 page | High |
| I2 | Indexed apex URLs are residue from the pre-Cloudflare cPanel site | Commit `ca79bd4` imports live production source from GoDaddy cPanel, Jun 12 2026; indexed paths are legacy `.html` spellings | High |
| I3 | The *Engagement Levels* observation came from a heading read or a host change under redirect | §5 | Low — not asserted |
| I4 | No orphaned Cloud Run service is serving any Donovan hostname | Apex ruled out by cert + headers; `www` is Cloudflare | Medium — see gap G1. **SUPERSEDED by §13.1**, which tests this directly instead of inferring it: the service exists, and neither it nor any fingerprinted service in the estate serves Donovan content. Read §13.1 for the sample the direct test covers. |

### Gaps — what I could not verify

- **G1 — GCP not enumerated. ⚠️ CLOSED AND PARTLY REFUTED — see §10–§15, §18.3, §18.5.** As written: `gcloud run services list` failed: `Reauthentication failed. cannot prompt during non-interactive execution` (impersonating `agent-cli@tico-ai-prod.iam.gserviceaccount.com`). I hold no interactive GCP credential. This does **not** weaken the apex finding, which rests on DNS, TLS, and HTTP evidence and never required GCP access. It means only that I cannot state whether an orphaned Cloud Run service still *exists and costs money* — only that no such service serves `donovan.law`. `cloudbuild.yaml` **at the repo root** does define a Cloud Run deploy (`--allow-unauthenticated` at `cloudbuild.yaml:30`, port 8080, region default `us-east1`), so a dormant service plausibly exists and is worth an authenticated check.
  - **Correction 1 — the diagnosis was wrong.** "Reauthentication failed" read as an expired login. It was not. §18.3 corollary 1 shows `gcloud auth login` had **already succeeded** at 12:25 on 2026-08-04 and the next enumeration was still scoped to one project; §18.5's last row records this exact invocation as having "yielded a wrong *explanation*, not a wrong *inventory*." The cause was **service-account impersonation**, and the repair is the §18.3 env prefix, not a re-login.
  - **Correction 2 — the gap is closed.** §10–§15 enumerate the estate under the human identity. The service does exist (`donovan-law-site`, §10.1) and is publicly invocable (§11.1).
  - **Correction 3 — "costs money" is refuted.** §15: `billingEnabled: false`. The exposure is **zero dollars**, and the same billing state is why the service returns 503 rather than serving.
  - **Correction 4 — the path was wrong.** This gap originally cited `donovan-law-site/cloudbuild.yaml`. There is no such file and no such directory in this repo; the file is **`cloudbuild.yaml` at the repo root**. §11.1 already cites it correctly as `cloudbuild.yaml:30`.
- **G2 — `booking/create` on `www` uncharacterised**, by design. See §3.5. Establishing its behaviour requires a `POST` that could write to the firm calendar.
- **G3 — Index coverage is a sample.** One search engine, one query. `site:` results are not an exhaustive index dump; other indexed apex URLs may exist beyond the sampled result set. The confirmed claim is "at least one apex URL is indexed and dead", not a complete count.

---

## 7. Task 6 — Remediation options, ordered by risk

> **⚠️ PARTIALLY SUPERSEDED — Option 3 is rewritten below; read §18.3 before running any `gcloud` command from this workstation.**
> Options 1, 2 and 4 concern GoDaddy forwarding, Cloudflare Pages, and search-index removal. They are unaffected and stand as written.
> **Option 3 was written before §10–§15 and §18 existed** and, as originally published, gave the wrong repair:
> - it opened with `gcloud auth login` labelled **read-only**, which §18.3 refutes twice over — re-authenticating **fixes nothing** here, and `gcloud auth login` is **not a read**: it mints a credential and writes it to the local gcloud config;
> - it asserted the dormant service "may still be reachable by its `run.app` URL **and billing**", which §11.1 (503 on both URL spellings, request never reaches a container) and §15 (`billingEnabled: false`, exposure **zero dollars**) both refute;
> - it cited the deploy definition at a path that does not exist (see G1, correction 4).
>
> The superseding text is inline in Option 3 below. Nothing was deleted.

**None of these were executed. All require David; Zane gates.** Each is a configuration change outside this repo.

### Option 1 — Enable path-preserving forwarding on the apex *(lowest risk, recommended first)*

Change the GoDaddy forwarding rule so `donovan.law/<path>` 301s to `https://www.donovan.law/<path>` instead of dropping the path.

- **Fixes:** every dead indexed apex URL becomes a working redirect to the live page; search engines consolidate apex signals onto the `www` canonical.
- **Risk:** low. One setting in GoDaddy forwarding. No DNS record changes, no certificate change, no effect on `www` or Cloudflare.
- **Caveat:** GoDaddy forwarding is not path-aware of `www`'s clean-URL rules, so the redirect lands on `www…/formation.html`, which `www` then 308s to `/entity-formation`. Two hops, but both resolve. Acceptable.
- **Verify after:** `curl -sSIL https://donovan.law/formation.html` ends at `https://www.donovan.law/entity-formation` with 200.

### Option 2 — Point the apex at Cloudflare and add it to the Pages project *(medium risk, best end state)*

Add `donovan.law` as a custom domain on the `donovan-site` Pages project and repoint the apex records at Cloudflare, retiring GoDaddy forwarding.

- **Fixes:** one origin, one platform, one certificate authority, one set of security headers. The apex inherits the CSP, HSTS, `X-Frame-Options`, and `Cache-Control: no-store` that `www` already sends and the apex currently sends **none** of.
- **Risk:** medium. Touches apex DNS at GoDaddy and adds a custom domain in Cloudflare. Certificate issuance for the apex must complete before cutover or the apex briefly fails TLS. Needs a maintenance window and a rollback record of the current A values (`3.33.251.168`, `15.197.225.128`).
- **Decide first:** whether the apex should redirect to `www` or serve as a co-equal canonical host. If it serves content, canonical tags and the sitemap (currently 84/84 `www`) must be settled deliberately, or the duplicate-content problem this order was opened to investigate gets created for real.

### Option 3 — Authenticated GCP audit and decommission of any orphaned Cloud Run service *(REWRITTEN — the audit is done; only the decommission decision remains)*

**Gap G1 is closed.** The audit this option proposed has since been performed and is recorded in §10–§15. Not a fix for the apex — no Cloud Run service serves it — and `cloudbuild.yaml` **at the repo root** deploys `--allow-unauthenticated` (`cloudbuild.yaml:30`), which did produce a public `allUsers` binding on `donovan-law-site` (§11.1).

**Corrected on the evidence:** the service is public but **not reachable in any useful sense and bills nothing**. Every path on both URL spellings returns a Google-Frontend `503` and the request never reaches a container (§11.1); `billingEnabled: false` on the project, so the exposure is **zero dollars**, not "small" (§15). The residual is the `allUsers` binding itself, which survives the billing outage — see §16's latent-risk bullet for what would come back if billing were re-enabled, and what would not.

- **Step 1 — superseded, already executed.** As originally published this step read *"read-only: `gcloud auth login`, then `gcloud run services list` …"*. **That instruction was wrong on both counts.** `gcloud auth login` was not the repair — §18.3 corollary 1 shows a successful login left the enumeration scoped to one project — and it is **not read-only**: it mints a credential and writes it to the local gcloud configuration. The read that actually works carries the §18.3 prefix:

  ```
  CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= gcloud run services list \
      --project=donovan-law-site --platform=managed --account=david@ticoai.net
  CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= gcloud run services describe donovan-law-site \
      --project=donovan-law-site --region=us-east1 --account=david@ticoai.net
  ```

  Both are reads and change no state, local or remote. The env var must be set to the **empty string** on the command line, not unset and not omitted (§18.3).
- **Step 2 — done, and it came back negative.** The content was fingerprinted against this repo (§12): the image is a static `nginx:1.25-alpine` container built from a 58-file tree with **zero** booking, Functions, Clio or Retell files. The re-tiering trigger written into this step — *"a service serving pre-PR-129 booking code on a public `run.app` URL"* — **did not fire**: the build predates PR 129 by four months but has no booking path to be stale, and the service serves nothing.
- **Step 3 — the only step still open, and it is David's:** whether to remove the `allUsers` binding, delete the service, or leave the project as-is. **Risk: medium, and it is a write.** Out of scope here; no binding was changed (§17, hard do-nots).

### Option 4 — Request search-index removal for apex URLs *(low risk, do only after Option 1 or 2)*

- **Risk:** low, but **wrong if done first.** Removing apex URLs from the index while they are dead discards link equity that Option 1 would otherwise recover by redirecting it to `www`. Sequence matters: redirect first, then let the index re-crawl. Only request removal for apex URLs that have no `www` equivalent.

### Explicitly not recommended

- **Do not delete the apex A records.** That converts a recoverable dead link into an `NXDOMAIN` for anyone typing `donovan.law`, which is strictly worse than today.
- **Do not add a `robots.txt` to the apex to block crawling.** Blocked URLs cannot be re-crawled, so the redirect in Option 1 would never be seen and the dead results would persist in the index longer.

---

## 8. Verification statement

Every claim in §1–§4 cites a DNS record, an HTTP response header, a TLS certificate field, or a content fingerprint tied to a specific commit. Inferences are segregated into §6 and labelled with their basis and confidence.

**One premise from the order is recorded in §5 as NOT REPRODUCED, not as omitted.** §5.1 names every resolver, user agent, port, and pinned IP the premise was tested against, so a reader can judge the negative on the coverage rather than on my word for it. The two candidate mechanisms in §5 remain **inferred and unasserted** — I could not distinguish them, and I am not claiming the premise was never true of anything, only that it is not true of the apex under any probe I could construct.

**Plainly stated, as required:** **a client cannot book against the apex today.** `donovan.law` exposes no booking path, no Functions endpoint, and no page of any kind. The pre-PR-129 double-booking defect is not reachable from the apex. The residual issue is dead indexed apex links (§4.2), which is a client-experience and SEO problem, not a calendar-integrity one.

**Neither STOP condition was triggered.** Reaching and fully characterising the apex required no credentials. No probe would have written to the firm Clio calendar, and no `POST` was issued to any booking path on any host.

---

*Agents do not merge. Zane gates, David merges.*

---

# DR. INSANE — Cloud Run Enumeration (DRINSANE-CLOUDRUN-ENUM-R1)

**Order:** DRINSANE-CLOUDRUN-ENUM-R1
**Agent:** Dr. Insane (security)
**Repo:** TicoAI/DonovanLegal — branch `drinsane/cloudrun-enum-r1` off `drinsane/apex-origin-r1` @ `b5e78fb`
**Probes run:** 2026-08-04, 16:38–16:58 UTC
**Scope:** read-only. No service, revision, or traffic split deleted, stopped, redeployed, or modified. No IAM binding changed. No DNS record changed. No `POST` to any booking endpoint on any host. No secret value read or printed — Task 5 reports names only. Every HTTP probe was `GET`.

---

## 9. Bottom line

**The dormant-service hypothesis is CONFIRMED as to existence and REFUTED as to risk.**

A dormant Cloud Run service `donovan-law-site` does exist, is deployed, and is bound `allUsers` -> `roles/run.invoker` — publicly invocable, exactly as `cloudbuild.yaml`'s `--allow-unauthenticated` would produce. That much of the order's premise is real.

But it **does not serve, cannot bill, and never contained booking code**:

1. **It does not serve.** Billing is disabled on the project, so the container cannot start. Every path returns a Google-Frontend `503`.
2. **It cannot bill.** `billingEnabled: false`. Billing exposure is **zero dollars**, not "small".
3. **It never contained booking code.** The image is `nginx:1.25-alpine` serving a static `src/` directory. The tree that built it holds **58 files and zero booking, functions, Clio, or Retell files**. nginx cannot execute Pages Functions in any case.
4. **It holds no credentials.** The service spec has **no `env` block and no secret reference at all** — no Clio, Retell, Grow, or Vantage key by any name. There is **no second consumer of the firm Clio credential here.**

**The STOP condition was NOT triggered.** It requires a service *serving* a booking path that predates PR 129. This service predates PR 129 by four months but **serves nothing**, and the build it would serve has no booking path. There is no live client risk in the Cloud Run estate.

**The gap that made the earlier attempt blind was not the expired login.** It was **service-account impersonation** (§9.1) — the credential was authenticated the whole time, just scoped to the wrong project.

---

### 9.1 Why the earlier enumeration was blind (CONFIRMED)

The active gcloud config silently impersonates a service account:

```
$ gcloud config list
[auth]
impersonate_service_account = agent-cli@tico-ai-prod.iam.gserviceaccount.com
[core]
account = david@ticoai.net
```

Under that impersonation the credential sees **one** project:

```
$ gcloud projects list
WARNING: This command is using service account impersonation. All API calls will be executed as [agent-cli@tico-ai-prod.iam.gserviceaccount.com].
PROJECT_ID    PROJECT_NUMBER  NAME     LIFECYCLE_STATE
tico-ai-prod  418029748257    Tico AI  ACTIVE
```

With impersonation disabled, the human credential sees **seven**, including the one that matters:

```
$ CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= gcloud projects list --account=david@ticoai.net
PROJECT_ID              PROJECT_NUMBER  NAME                LIFECYCLE_STATE
convodojo               488190987753    ConvoDOJO           ACTIVE
donovan-law-site        290683654730    Donovan Legal PLLC  ACTIVE
mediamagic-prod         787245271387    MediaMagic          ACTIVE
platinum-bivouac-tgh3w  431919082599                        ACTIVE
ragbox-sovereign-prod   100739220279    RAGbox Sovereign    ACTIVE
tico-ai-ops             444835923080    tico-ai-ops         ACTIVE
tico-ai-prod            418029748257    Tico AI             ACTIVE
```

`donovan-law-site` is **not visible to the impersonated SA at all**. A re-auth alone would not have fixed this; every subsequent command in this order sets `CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT=` to defeat it. **Any prior GCP negative recorded from this workstation under the `agent` config is scoped to `tico-ai-prod` only and should be re-checked.**

---

## 10. Task 1 — Every Cloud Run service, every region, every visible project (CONFIRMED)

Enumeration command, run once per project (no `--region`, which queries **all** locations):

```
$ CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= gcloud run services list \
    --project=<P> --platform=managed --account=david@ticoai.net
```

That this spans regions is shown empirically, not asserted: the single `tico-ai-prod` invocation returned services in **both** `us-east4` and `us-central1`. The full region set is 43 (`gcloud run regions list` — `africa-south1 … us-west4`).

### 10.1 The service that matters

| Service | Project | Region | Created | Live revision Ready | Public URL |
|---|---|---|---|---|---|
| `donovan-law-site` | `donovan-law-site` | `us-east1` | 2026-03-29T05:11:43Z | **2026-03-30T12:52:23Z** | `https://donovan-law-site-nmlmkjgria-ue.a.run.app` |

Second URL spelling, from `run.googleapis.com/urls` — both were probed:
`https://donovan-law-site-290683654730.us-east1.run.app`

It is the **only** service in that project, at generation 8, revision `donovan-law-site-00008-5hp`, 100% traffic.

### 10.2 Estate totals — 29 services across 7 visible projects

**Counts only. The per-service inventory is deliberately not published here.** 24 of the 29 services belong to tenants with no relationship to Donovan Legal; listing their names, regions and public/private status in a client repo is a reconnaissance list that earns the Donovan finding nothing. The full tables — §10.2, §11.2 and §13.1 in their original form — live on **[issue 145, comment `5182687147`](https://github.com/TicoAI/DonovanLegal/issues/145#issuecomment-5182687147)**. **No finding changed; the data moved.** The counts below are what bounds the negative, and they are all the negative needs.

| Project | Services | Region(s) | Donovan-related? |
|---|---|---|---|
| `donovan-law-site` | **1 — `donovan-law-site`** | us-east1 | **Yes — the subject of this order** |
| 3 other visible projects | 28 combined | us-east1, us-east4, us-central1 | No — unrelated tenants; see issue 145 |
| 3 further visible projects | 0 — Cloud Run Admin API disabled | n/a | No — see §10.3 |

**7 projects visible, 29 services found, exactly 1 of them in the Donovan project.**

### 10.3 Bounding the negative — where I could NOT look

The absence is bounded, not assumed. Three projects returned `SERVICE_DISABLED` for the Cloud Run Admin API, and I did not enable the API (that would be a write):

- `mediamagic-prod` — `reason: SERVICE_DISABLED`
- `platinum-bivouac-tgh3w` — `reason: SERVICE_DISABLED`
- `tico-ai-ops` — `reason: SERVICE_DISABLED`

**What `SERVICE_DISABLED` supports, stated exactly.** With the Cloud Run Admin API disabled, **no Cloud Run service can be serving in those projects now**, and none can be deployed there without first enabling the API. That is a statement about the **present**, and it is the only one the evidence carries.

**What it does not support:** that no service *ever* ran there. An API can be enabled, used, and later disabled; the disabled state today says nothing about that history, and I did not read the API's enablement history or the projects' audit logs. This is a **correction of wording** — an earlier draft of this section read "no Cloud Run service has ever run there", which overstated a present-tense observation into a historical one. **The finding is unchanged:** these three projects host nothing reachable now, so nothing in them can serve Donovan content or a booking path today, which is what this order asks.

A disabled Admin API is still stronger present-tense evidence than an empty list: a currently-serving service could not hide behind it. **Not searched at all:** any project outside these seven, i.e. any project `david@ticoai.net` cannot see. That is the one residual blind spot, and it is a permissions boundary, not an oversight.

---

## 11. Task 2 — Unauthenticated invocation and liveness (CONFIRMED)

`PUBLIC` = `allUsers` present in `gcloud run services get-iam-policy`. `HTTP` = unauthenticated `GET /`.

### 11.1 `donovan-law-site` — public, and it does not serve

```
$ gcloud run services get-iam-policy donovan-law-site --project=donovan-law-site --region=us-east1
bindings:
- members:
  - allUsers
  role: roles/run.invoker
```

Public — matching `cloudbuild.yaml:30 '--allow-unauthenticated'`. But it answers nothing. Three attempts against **both** URL spellings:

```
attempt1 https://donovan-law-site-nmlmkjgria-ue.a.run.app        HTTP=503 bytes=302
attempt1 https://donovan-law-site-290683654730.us-east1.run.app  HTTP=503 bytes=302
attempt2 ...-ue.a.run.app  HTTP=503   attempt2 ...us-east1.run.app  HTTP=503
attempt3 ...-ue.a.run.app  HTTP=503   attempt3 ...us-east1.run.app  HTTP=503
```

(The very first request returned `500`; every subsequent one `503`. Both are Google-Frontend errors — `server: Google Frontend`, 302–323 bytes, no application headers. The request never reaches a container.)

### 11.2 The rest of the estate — counts only

Every one of the 29 services was checked for an `allUsers` binding and GET-probed unauthenticated. **The per-service results are on [issue 145, comment `5182687147`](https://github.com/TicoAI/DonovanLegal/issues/145#issuecomment-5182687147), not here** — see §10.2 for why. Totals:

| | Count |
|---|---|
| Services checked | **29** |
| `allUsers`-public | **18** |
| Private (no `allUsers`) | **11** |
| Answering `200`/`302` on `GET /` | **8** |
| Answering `404`/`403`/`500`/`503` | **21** |
| **In the Donovan project** | **1** — `donovan-law-site`, **PUBLIC**, **503** (§11.1) |

The only row this order turns on is the last one, and it is stated in full at §11.1. The other 28 matter here solely as the denominator that bounds the negative in §13.1.

---

## 12. Task 3 — Build fingerprint vs. PR 129 (CONFIRMED)

**PR 129 merged 2026-08-03 18:00:32 -0400** (`2c6f338`, *SHELDON-CLIO-BUSYBLOCKS*), touching `donovan-legal-site/functions/booking/_lib/provider-clio.js` and `test/clio-busy-blocks.test.mjs`.

The live revision `donovan-law-site-00008-5hp` went Ready **2026-03-30T12:52:23Z**. **The deployed build predates PR 129 by roughly four months.** That is confirmed on timestamps alone.

**But the fingerprint shows the question is moot — the build has no booking code to be stale.** The image is a static-file container:

```
$ cat Dockerfile
FROM nginx:1.25-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY src/ /usr/share/nginx/html/
```

The repo's first commit is `ff59a93 2026-03-29 01:14:09 +0000 Initial commit — Donovan Legal PLLC site rebuild`; the last commit at or before the revision timestamp is `6e5ccc3 2026-03-29 03:59:59`. That tree:

```
$ git ls-tree -r --name-only 6e5ccc3 | grep -iE 'booking|functions|clio|retell'
(no output)
$ git ls-tree -r --name-only 6e5ccc3 | wc -l
58
```

**58 files, zero booking/functions/Clio/Retell.** Top level is `.dockerignore .github .gitignore Dockerfile README.md cloudbuild.yaml infra reference src`. The container is nginx serving static HTML — it has no JavaScript runtime and could not execute a Pages Function even if one were present.

**Direct image verification was not possible** and I am not claiming it: pulling the manifest requires Artifact Registry, which is billing-blocked (`reason: BILLING_DISABLED`). The fingerprint above is from the git tree at the build timestamp, not from the image bytes. That is the honest limit of this claim, and it is corroborated by §13.

---

## 13. Task 4 — Booking path / Functions exposure by GET (CONFIRMED)

**Plainly: a client could not reach a booking path on this service.** Thirteen `GET`-only probes (no `POST`), including a deliberate control:

```
/                            HTTP=503      /api/booking              HTTP=503
/index.html                  HTTP=503      /functions/booking        HTTP=503
/booking                     HTTP=503      /booking/availability     HTTP=503
/book                        HTTP=503      /api/booking/availability HTTP=503
/schedule                    HTTP=503      /api/booking/create       HTTP=503
/_functions/booking          HTTP=503      /nonexistent-control-path-zzz  HTTP=503
```

**The control is the point.** `/nonexistent-control-path-zzz` returns the *same* 503 as `/booking`. A uniform 503 across real and nonsense paths means **this probe cannot discriminate routing at all** — it proves only that nothing is served. I therefore do **not** claim "the booking path returned 503, so it is absent." The absence of booking code is established by the build fingerprint in §12, not by these response codes.

### 13.1 The rest of the estate — no firm content, no booking route, on the sample stated

**The sample, stated first, because the negative is only as wide as the sample.** Content fingerprinting requires a body to fingerprint. **8 of the 29 services answered `200`/`302` on `GET /` and were fingerprinted for firm content and GET-probed for booking, each with a control path.** The remaining **21 returned `404`/`403`/`500`/`503` and served no body**, so they were bounded by response code alone — never by content. The per-service table is on **[issue 145, comment `5182687147`](https://github.com/TicoAI/DonovanLegal/issues/145#issuecomment-5182687147)** (see §10.2 for why it is not printed here).

| | Result |
|---|---|
| Services fingerprinted for firm content | **8 of 29** (every service that returned a body) |
| Firm-content hits (`donovan\|attorney\|law firm\|legal pllc`) | **0 of 8** |
| Booking routes found | **0 of 8** — every apparent hit ruled out by its control path, below |
| Services bounded by response code only, not content | **21 of 29** |

**Stated to its sample, not beyond it:** **no fingerprinted service serves Donovan Legal content, and none exposes a booking route.** The earlier phrasing — "No Cloud Run service *anywhere in the estate* serves Donovan Legal content" — asserted 29 where 8 were measured; this is a **correction of wording, not of the finding.** The 21 unfingerprinted services are not a live path either, but for a different and weaker reason: none returned a body to a client, and the one in the Donovan project among them is `donovan-law-site`, whose emptiness is established by the build fingerprint in §12 rather than by its 503.

**Three of the eight returned `200` on `/booking`, and all three were ruled out by their controls** — the control path returns `200` as well, so a `200` there carries no routing information at all. They are SPA catch-alls, not booking routes. One of the three also returned `401` on `/api/booking/availability` against that `200` control, which is the only result in the set that looked like a real endpoint. It was discriminated further:

```
/api/booking/availability   401      /api/                 401
/api/zzz-control-not-real   401      /booking/zzz-control  200
```

**All** of `/api/*` returns `401`, including nonsense. It is a blanket auth gate on the API prefix, not a booking endpoint. Ruled out. (The three are named, with their per-path results, on [issue 145](https://github.com/TicoAI/DonovanLegal/issues/145#issuecomment-5182687147); they are unrelated-tenant services and none serves firm content.)

---

## 14. Task 5 — Clio / Retell / Grow / Vantage environment variables (CONFIRMED — none)

**Reported by name only; no value was read or printed. There were no names to report.**

```
$ gcloud run services describe donovan-law-site ... --format="value[](spec.template.spec.containers[0].env[].name)"
(empty)

$ gcloud run services describe donovan-law-site ... --format=yaml | grep -iE 'env:|secretKeyRef|valueFrom|secrets|CLIO|RETELL|GROW|VANTAGE'
(no match)
```

The container spec has **no `env` block, no `secretKeyRef`, and no `valueFrom`**. The full spec is a bare nginx container: image, port 8080, 256Mi, 1 CPU, default compute service account.

**There is no second, untracked consumer of the firm Clio credential *here*** — "here" meaning **this service, `donovan-law-site`, read off its own container spec**. That is the scope of the read and therefore the scope of the claim. The concern that motivated this task does not materialise **in the Cloud Run estate**; it says nothing about consumers elsewhere — other platforms, other machines, or any project outside the seven visible to `david@ticoai.net` (§10.3). Consistent with §12: a static nginx container has nothing to authenticate *with* and nothing to call.

Secret Manager itself could not be listed (`gcloud secrets list` -> `BILLING_DISABLED`), so I cannot enumerate what secrets exist *in the project*. That is not needed for the finding: what matters is that **the service references none**, and that is read directly off the service spec.

---

## 15. Billing exposure (CONFIRMED — zero)

The order asks for billing exposure if a service is idle but deployed. This one is idle and deployed, and the exposure is **zero dollars**:

```
$ gcloud billing projects describe donovan-law-site
billingAccountName: ''
billingEnabled: false
name: projects/donovan-law-site/billingInfo
projectId: donovan-law-site
```

**Billing is disabled on the entire project.** This is also the *mechanism* behind the 503: with billing off, Cloud Run cannot pull the image or start the container, so the service reports `Ready: True` at the control plane while failing every request at the data plane. `min-instances=0` means there is no idle compute to bill in any case.

**Cloud Run's own posture is misleading here.** `status.conditions[0].type: Ready, status: "True"` — a console reader would see a healthy public service. It is not healthy; it is unable to start.

---

## 16. Inferred — NOT confirmed

Segregated from §9–§15 above. Each is labelled with its basis.

- **The service is an abandoned pre-Cloudflare deployment lane.** *Basis:* the project is named `Donovan Legal PLLC`; the repo's `project-handoff/HANDOFF.md:38` and `MIGRATION-CHECKLIST.md:57` both record this URL as the **"Live URL"**, while production now serves from Cloudflare Pages. *Confidence: high.* *Not confirmed:* I did not find a decision record retiring it.
- **Latent risk if billing is ever re-enabled.** The `allUsers` binding is **still in place** and survives the billing outage. Re-enabling billing would restore a publicly-invocable March-30 build with no further action. *Basis:* IAM policy read in §11.1. *Confidence: high.* **Mitigating and material:** what would come back is the static nginx site, **not** booking. At current `HEAD`, `Dockerfile` still copies only `src/` (34 files, `grep -ciE 'booking|functions'` -> **0**), while the live booking code lives under `donovan-legal-site/functions/booking/` — a directory the Dockerfile **never copies**. Even a rebuild today would not ship a booking path.
- **No automated rebuild is wired.** `gcloud builds triggers list --project=donovan-law-site` returned empty, so nothing appears to redeploy this service on push. *Confidence: medium* — the Cloud Build API may be degraded by the billing state, so an empty list is weaker evidence than it looks. Treat as unconfirmed. **Contradicted by a committed document:** `project-handoff/HANDOFF.md:42` and `MIGRATION-CHECKLIST.md:58` both name a `donovan-law-deploy` trigger on push to `main`. **Neither source settles it** — see §18.5 for both sides and for what a conclusive read would require.
- **Stale handoff documentation is the realistic harm.** Two committed docs point a reader at a URL that returns 503. *Confidence: high* as to the docs; *inferred* as to whether anyone follows them.

---

## 17. Verification statement

Every service claim in §10–§15 cites the `gcloud` command and its output verbatim, or an HTTP response code from a named URL and path.

**The negative is bounded, not assumed.** §10.2 states the totals — **7 visible projects, 29 services, 1 in the Donovan project** — and cites [issue 145, comment `5182687147`](https://github.com/TicoAI/DonovanLegal/issues/145#issuecomment-5182687147) for the per-service inventory, which is deliberately not published in this client repo. §10.3 names the 3 projects where Cloud Run was searched and found API-disabled, and states plainly that projects outside `david@ticoai.net`'s visibility were not searched. The region search covers all 43 Cloud Run regions, demonstrated empirically by a single un-regioned query returning services from two different regions.

**Four claims are deliberately weaker than they could have been made to sound.** The §12 fingerprint is from the git tree at the build timestamp, **not** from image bytes — Artifact Registry was billing-blocked and I did not enable it. The §13 path probe **cannot discriminate routing**, because the control path returns the same 503 as every real path; it is reported as proving only that nothing is served. §13.1's content negative is stated **to its sample — 8 of 29 services fingerprinted**, the 8 that returned a body; the other 21 are bounded by response code only. §10.3's `SERVICE_DISABLED` result is read as **present-tense only** — no service can be serving in those projects now — and **not** as proof that none ever ran there, which the evidence does not reach.

**Two of those four are corrections to the published wording, not to the findings.** The earlier text read "No Cloud Run service anywhere in the estate serves Donovan Legal content" (asserting 29 where 8 were measured) and "no Cloud Run service has ever run there" (asserting history from a present-tense API state). Both are narrowed above. **No confirmed finding changed**: no service in this estate serves Donovan content or a booking path, the Donovan service is public and dead, billing is zero, and the STOP condition remains untriggered on the same evidence as before.

**The STOP condition was NOT triggered, and the reason is substantive, not procedural.** It requires a service *serving* a booking path that predates PR 129. `donovan-law-site` predates PR 129 by four months and is publicly invocable, but it serves nothing, holds no credential, and was built from a 58-file tree with no booking code in it. **No client can reach a booking path on any Cloud Run service in this estate that was probed for one** — the Donovan service (§13) and the 8 of 29 that returned a body (§13.1). The other 21 served no body at all; they are bounded by response code, and none of them is in the Donovan project.

**Hard do-nots observed.** No service, revision, or traffic split was deleted, stopped, redeployed, or modified. No IAM binding was changed. No DNS record was changed. No `POST` was issued to any booking endpoint on any host. No secret value was read or printed — Task 5 reports the absence of names, having read none. No API was enabled. Every probe was `GET`.

---

# DR. INSANE — Standalone Finding: gcloud Service-Account Impersonation (DRINSANE-CLOUDRUN-PUBLISH-R1)

**Order:** DRINSANE-CLOUDRUN-PUBLISH-R1
**Agent:** Dr. Insane (security)
**Recorded:** 2026-08-04. Re-confirmed live at publish time, not carried over from the enumeration run.
**Tracking:** GitHub issue **145** (this finding) · GitHub issue **146** (the apex and Cloud Run findings it enabled)
**Scope:** read-only. No config was created, modified, activated, or deleted. No credential was re-authenticated. No IAM binding was changed. Every command in this section is a read.

**Why this is filed as its own section and not as a footnote to §9.1.** §9.1 records impersonation as the *reason the Cloud Run enumeration was blind*. That undersells it. The impersonation is a **standing property of this workstation**, it is **still in effect**, and it silently narrows the visible estate from 7 projects to 1 for *every* GCP command run here — not just for Cloud Run, and not just during this order. It is worth more than `donovan-law-site`, the service it found: that service serves nothing and bills nothing (§15), whereas this defect **manufactures confident false negatives across the entire GCP surface** and does so without failing. A finding that invalidates the method outranks a finding produced by it.

---

## 18. The active gcloud credential silently impersonates a service account (CONFIRMED)

### 18.1 The finding

The active gcloud configuration is named `agent` and carries `[auth] impersonate_service_account`. The human account `david@ticoai.net` remains the *base* credential, so `gcloud auth list` and `gcloud config list` both show a valid, current, human login — and every API call is nevertheless executed as a service account that can see one seventh of the estate.

**The failure mode is not an error.** It is a clean `exit 0` and a short, well-formed, wrong answer. There is a one-line `WARNING:` on **stderr**, which is discarded by every `2>/dev/null`, every `| grep`, and every JSON parse pipeline in normal use.

### 18.2 The two identities, and the project count each can see (CONFIRMED)

```
$ gcloud config list
[auth]
impersonate_service_account = agent-cli@tico-ai-prod.iam.gserviceaccount.com
[core]
account = david@ticoai.net

Your active configuration is: [agent]
```

| | Effective identity (who the API call runs as) | Projects visible | Sees `donovan-law-site`? |
|---|---|---|---|
| **As configured today (`agent` config)** | `agent-cli@tico-ai-prod.iam.gserviceaccount.com` | **1** | **No** |
| **Impersonation defeated** | `david@ticoai.net` | **7** | **Yes** |

The two lists, verbatim, stdout only:

```
$ gcloud projects list --format='value(projectId)'            # effective: agent-cli@tico-ai-prod
tico-ai-prod

$ CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= \
    gcloud projects list --account=david@ticoai.net --format='value(projectId)'
tico-ai-ops
platinum-bivouac-tgh3w
tico-ai-prod
mediamagic-prod
donovan-law-site          <-- Donovan Legal PLLC — the project this engagement is about
convodojo
ragbox-sovereign-prod
```

**`donovan-law-site` is invisible to the impersonated service account.** Every Cloud Run finding in §10–§15 of this document — the public `allUsers` binding, the 503, the disabled billing, the absent secrets — sits in a project that the default credential on this machine cannot enumerate, cannot describe, and cannot report the absence of.

**A measurement note, because it bit this very count.** `gcloud projects list 2>&1 | grep -c .` returns **2**, not 1: the impersonation `WARNING` is a stderr line and merging the streams counts it as a project. The counts above are stdout-only. The warning that tells you the answer is wrong will also corrupt the answer if you fold it in.

### 18.3 The exact command prefix required to defeat it (CONFIRMED)

```
CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT= gcloud <command> --account=david@ticoai.net
```

The environment variable is set to the **empty string** — it is not unset, and it is not omitted. An empty value overrides the config property for that one invocation; omitting the assignment leaves the property in force. `--account=david@ticoai.net` is carried alongside it to pin the base credential, but **`--account` alone does not defeat impersonation** — that is tested, not assumed:

```
$ gcloud projects list --account=david@ticoai.net --format='value(projectId)' | wc -l
1
WARNING: This command is using service account impersonation. All API calls will be
executed as [agent-cli@tico-ai-prod.iam.gserviceaccount.com].
```

Still one project, still impersonated. `--account` selects *which human credential mints the impersonation token*; it does not stop the impersonation. **The env prefix is the only thing in that command line doing the work.**

Three corollaries, each of which cost time on this engagement or would have:

1. **Re-authenticating fixes nothing.** The credential was never expired or invalid. `gcloud auth login` at 12:25 on 2026-08-04 succeeded and the next enumeration was still scoped to one project. A blind enumeration here looks exactly like an auth problem and invites exactly the wrong repair.
2. **`gcloud config set account` fixes nothing** for the same reason — it changes the base credential, not the impersonation.
3. **Print the principal in the evidence.** Any report claiming a GCP absence should carry `gcloud config list` output so the reader can see which principal bounded the negative. This document does, at §9.1 and here.

### 18.4 When impersonation took effect (CONFIRMED, from the gcloud command log)

The onset is not inferred from file timestamps alone. `%APPDATA%\gcloud\logs\` retains one log per invocation, and the impersonation `WARNING` is written into each affected log, so the boundary can be read directly:

| Evidence | Timestamp (local) | Source |
|---|---|---|
| `gcloud config configurations create` (creates `agent`) | 2026-07-29 18:50:34 | `logs/2026.07.29/18.50.34.829721.log` |
| First command whose log contains the impersonation WARNING | **2026-07-29 18:57:00** | `logs/2026.07.29/18.57.00.998729.log` |
| `gcloud config configurations activate` (makes `agent` the default) | 2026-07-29 19:00:49 | `logs/2026.07.29/19.00.49.335544.log` |
| Impersonation still in effect | 2026-08-04, publish time | `gcloud config list`, §18.2 |

**No log dated 2026-07-28 or earlier contains the warning.** The search covered all 15 retained log days (2026-07-11 through 2026-08-04, 2,258 logs); the warning appears on exactly three days — 07-29, 07-30, and 08-04.

**The impersonated window is therefore 2026-07-29 18:57 local (22:57 UTC) to the present, and it has not been closed.**

### 18.5 Which prior GCP conclusions were made under the impersonated identity (CONFIRMED, and bounded)

Every gcloud invocation inside the window is enumerable from the same logs. **Excluding this order's own commands, there are five**, and only five:

| When (local) | Command | Scope actually requested | Status of any conclusion drawn from it |
|---|---|---|---|
| 2026-07-29 19:00:58 | `run services list` | `--project=tico-ai-prod` | **Positives stand. Any estate-wide reading does not.** The SA *can* see `tico-ai-prod`, and the call returned no `PERMISSION_DENIED`. What it cannot support is "these are all the services", because six projects were never in view. |
| 2026-07-30 01:08:08 | `run services describe connexus-mcp` | `tico-ai-prod` / `us-east4` | Positives stand — the SA can read this project. |
| 2026-07-30 01:09:32 | `run services get-iam-policy connexus-mcp` | `tico-ai-prod` / `us-east4` | Positives stand. **An *absence* of a binding is weaker**: it is bounded by what the SA is permitted to read, not by what exists. Re-check before relying on a negative here. |
| 2026-07-30 01:09:50 | `run revisions describe connexus-mcp-00093-k57` | `tico-ai-prod` / `us-east4` | Positives stand. |
| 2026-08-04 11:53:11 | `run services list` | no `--project` | **Produced no data at all** — it failed and printed a re-authentication suggestion. This is the invocation that generated the false "the login expired" diagnosis. It yielded a wrong *explanation*, not a wrong *inventory*. |

Two conclusions follow, and they point in opposite directions. Both are stated.

**Narrowing.** The pre-existing GCP audits on this workstation — the infrastructure audit, the billing consolidation audit, the stale-tag purge, and the backend deploy work, all dated **2026-07-25** — ran **four days before the `agent` config existed**. They are **not** affected by this finding. Corroborating evidence beyond the timestamps: the billing audit enumerated all six `ticoai.net` org projects *including* `donovan-law-site`, which the impersonated SA cannot see at all. Those audits carry a *different* and separately recorded limitation — `gcloud billing accounts list` is role-scoped — which this finding neither creates nor worsens.

**The six-versus-seven discrepancy, resolved.** The paragraph above says **six** `ticoai.net` org projects; §9.1 and §18.2 both list **seven** projects visible to `david@ticoai.net`. Both numbers are right, and they count different things:

| | Count | What it counts |
|---|---|---|
| **Org projects** | **6** | Projects in the `ticoai.net` organization: `convodojo`, `donovan-law-site`, `mediamagic-prod`, `ragbox-sovereign-prod`, `tico-ai-ops`, `tico-ai-prod`. This is the set the 2026-07-25 billing audit consolidated. |
| **Visible projects** | **7** | The six above **plus `platinum-bivouac-tgh3w`**, which `david@ticoai.net` can *see* but which is **not a `ticoai.net` org project** — it is a Google AI-tenant project under a foreign organization, recorded as such in the 2026-07-25 billing audit, whose billing account (`0194ED-C51035-F9189D`) returns `PERMISSION_DENIED` from both credentialed identities. |

**Visibility is not membership.** `gcloud projects list` returns what the principal may see, not what the org contains, so the seven-project figure is the correct bound on *this document's* enumeration and the six-project figure is the correct bound on the *billing* consolidation. Neither weakens the other, and the discrepancy is not an error in either.

Two corroborations inside this document, so the reader need not take the org attribution on the billing audit's word alone: `platinum-bivouac-tgh3w` is the **only row in §9.1's project list with an empty `NAME` field**, consistent with a project provisioned by a tenant rather than by this org, and it is one of the three projects in §10.3 whose Cloud Run Admin API is disabled. **The foreign-org attribution itself is carried over from the separately recorded 2026-07-25 billing audit — I did not re-run an org query in this order, and it is cited, not re-confirmed.** Nothing in this document's findings turns on it: `platinum-bivouac-tgh3w` hosts no Cloud Run service either way (§10.3).

**A committed document names a build trigger that this order could not find.** `project-handoff/HANDOFF.md:42` records `| Cloud Build trigger | `donovan-law-deploy` (push to main → cloudbuild.yaml) |`, and `project-handoff/MIGRATION-CHECKLIST.md:58` repeats it; `README.md:112` carries the `gcloud builds triggers create --name="donovan-law-deploy"` command that would have made it. **§16 records the opposite observation:** `gcloud builds triggers list --project=donovan-law-site` returned **empty**.

These are recorded together because **neither one settles it**, and the honest reading is that the question is open:

- The empty list is **not** proof the trigger was deleted. §16 already labels this *confidence: medium* precisely because the Cloud Build API may be degraded by the project's disabled billing (§15), which makes an empty list weaker evidence than it looks.
- The handoff doc is **not** proof the trigger exists. It is a planning and handoff record, and this repo's `CLAUDE.md` §7 warns explicitly that `HANDOFF.md` is stale on other points.

**What follows for the reader:** do not treat "no automated rebuild is wired" as settled, and do not treat the handoff doc as current. If the `allUsers` binding decision in §7 Option 3 step 3 ever depends on whether a push to `main` can redeploy this service, that question needs a **fresh** `builds triggers list` under the §18.3 prefix with billing in a known state — a read, and one this order did not have the conditions to make conclusive.

**Widening.** The rule in §9.1 still holds for everything from 2026-07-29 18:57 onward, and the window is **still open**. Any GCP command run from this workstation from now until the config is changed is scoped to `tico-ai-prod` unless it carries the §18.3 prefix.

**The bound on this negative, stated plainly.** The five rows above are complete *for gcloud invocations on this workstation*, because `%APPDATA%\gcloud\logs\` logs every one. They are **not** a complete list of *recorded conclusions*. What I checked and found clean: no note in the operator memory corpus written inside the window records a Cloud Run, `run.app`, or gcloud read. What I did **not** check, and therefore do not claim: Linear comments, GitHub issue and PR comments, reports in other repositories, and any GCP command run from a different machine or a CI runner. Those would have their own credential, not this one.

### 18.6 Inferred — NOT confirmed

- **The `agent` config was created deliberately, for a narrowly-scoped automation credential, and left active by accident.** *Basis:* the 2026-07-29 log sequence shows `iam service-accounts create` -> four `projects add-iam-policy-binding` -> `keys create` -> `configurations create` in a single eleven-minute run, which reads as a deliberate provisioning session rather than a stray setting. *Confidence: high.* *Not confirmed:* no decision record was found, and I did not ask.
- **The blast radius is wider than GCP enumeration.** Any tooling on this workstation that shells out to `gcloud` — deploy scripts, drift checks, CI helpers run locally — inherits the same narrowing. *Basis:* the property is on the active config, not on a command. *Confidence: high.* *Not confirmed:* I did not inventory which local scripts call `gcloud`.
- **The service account holds only the four roles bound on 2026-07-29.** *Basis:* four `add-iam-policy-binding` calls in the provisioning sequence. *Confidence: low* — I did not read the SA's IAM policy, and bindings may have been added elsewhere. Treat the SA's permissions as unenumerated.

### 18.7 Remediation, ordered by risk

This section proposes; it does not act. **No configuration change was made** — the impersonation is exactly as it was found.

| # | Action | Risk | Note |
|---|---|---|---|
| 1 | Prefix `CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT=` on any command whose answer is meant to be exhaustive | **None** — per-invocation, changes no state | Works today. Already the practice in §10–§15. |
| 2 | `gcloud config configurations activate default` when doing human-scoped audit work | Low, reversible — **but this is a WRITE**, not a read | It mutates local gcloud config state (no cloud-side change, no credential minted). `default` is present and already points at `david@ticoai.net`. Re-activate `agent` for automation. Prefer #1 if you want to change nothing at all. |
| 3 | Record on issue 145 which automation actually requires the `agent` config, then decide whether it should be the *active* one | Low | The defect is not that the SA exists; it is that it is the default for interactive work. |
| 4 | Re-run the two `connexus-mcp` *negative* reads from §18.5 under the human identity, **carrying the §18.3 prefix** | Low, genuinely read-only | `get-iam-policy` and `revisions describe` are reads and change no state. Only needed if a decision rests on an absent IAM binding. **Do not substitute `gcloud auth login`** — it is not the repair (§18.3 corollary 1) and it is not a read. |

**Explicitly not recommended:** deleting the service account or its bindings. Something provisioned it four days before this engagement and may depend on it; that is issue 145's question to settle, not a security remediation to perform unilaterally.

### 18.8 Verification statement for §18

**Confirmed — each backed by a command and its verbatim output, all re-run at publish time:** the impersonation property and the config name (§18.2); the effective identity `agent-cli@tico-ai-prod.iam.gserviceaccount.com` against the base account `david@ticoai.net` (§18.2); the project counts **1 and 7** and the invisibility of `donovan-law-site` to the impersonated principal (§18.2); that the env prefix defeats it and that **`--account` alone does not** (§18.3, tested in both arms); the onset timestamp and the five in-window invocations (§18.4, §18.5, from per-invocation logs).

**Inferred and labelled as such:** everything in §18.6.

**The negative is bounded, not assumed.** §18.5 states exactly what the log evidence can and cannot cover, and names the four record surfaces I did not search.

**One arm of this section is a control, not a claim.** §18.3's `--account`-only test is included precisely because it *fails* — a remediation that looks correct and does nothing is the more dangerous of the two outcomes, and the only way to show the env prefix is load-bearing is to show that removing it restores the wrong answer.

---

*Agents do not merge. Zane gates, David merges.*
