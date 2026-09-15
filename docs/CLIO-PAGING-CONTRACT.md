# Clio v4 paging on `GET /calendar_entries` — what is contractual and what is merely observed

**Order:** SHELDON-CLIO-PAGING-PROBE-R1
**Probe:** `test/preview/verify-clio-paging.mjs` · controls `test/clio-paging-probe.test.mjs`
**Subject of the decision:** branch `sheldon/booking-safety` @ `84adc05`

Every claim below is labelled. **CONTRACT** means it is in
`integrations/clio/openapi.v4.json` and the path to the line is given so it can be
re-read rather than re-derived. **OBSERVED** means a live request was made and the
response is quoted; it is a reading taken on one day against one grant, it binds
Clio to nothing, and it can change without notice. Nothing here is both.

---

## 1. Why this file exists

`sheldon/booking-safety` changes `fetchBusyBlocks` to walk the calendar read and
then **refuse a final page that came back full**:

```js
const next = data?.meta?.paging?.next;
const hasNext = typeof next === "string" && next !== "";

if (!hasNext) {
  if (page.length >= CALENDAR_PAGE_LIMIT) {          // CALENDAR_PAGE_LIMIT = 200
    throw new Error("clio: GET /calendar_entries returned a truncated entry list");
  }
  break;
}
```

That is the correct shape **if** Clio emits `meta.paging.next`. If it does not,
the walk never reaches a second page, every full first page is refused, and the
throw surfaces at `/booking/availability` as a 503 — so the branch would not
narrow a booking bug, it would make every slot unbookable for every client as
soon as the firm's 60-day window holds 200 entries.

200 entries in 60 days is about **3.3 a day**. That is an ordinary working
attorney, not a pathological calendar. The question is therefore load-bearing on
the merge, and until this file was written the walk rested on a sandbox note and
on a *different* endpoint's behaviour.

---

## 2. CONTRACT — what the vendored spec actually says

Source: `integrations/clio/openapi.v4.json` (OpenAPI 3.0.0, Clio API v4,
retrieved 2026-07-30).

### 2.1 The request parameters ARE documented

`paths["/calendar_entries.json"].get.parameters[]` contains both:

| Parameter | Type | Description, verbatim |
|---|---|---|
| `limit` | `integer` (`int32`) | "A limit on the number of CalendarEntry records to be returned. Limit can range between 1 and 200. Default: `200`." |
| `page_token` | `string` | "A token specifying which page to return." |

So the *inputs* to paging are contractual. **200 is both the ceiling and the
default**, which is why an unlimited read (what `main` does today) is already
capped at 200 whether it asks to be or not.

### 2.2 The response cursor is NOT documented — at all

`components.schemas.CalendarEntry_List`, verbatim and complete:

```json
{
  "type": "object",
  "required": [
    "data"
  ],
  "properties": {
    "data": {
      "type": "array",
      "description": "CalendarEntry List Response",
      "items": {
        "$ref": "#/components/schemas/CalendarEntry"
      }
    }
  }
}
```

That is the whole schema. There is no `meta`, no `paging`, no `next`, no
`records`.

It is not an oversight local to this endpoint, and it is not something a wider
search rescues:

| Count over the vendored spec | Value |
|---|---|
| Schemas in `components.schemas` | 419 |
| …declaring a top-level `meta` property | **0** |
| `*_List` schemas | 79 |
| …whose `required` is exactly `["data"]` | **79 of 79** |

**The consequence, stated plainly.** `page_token` is documented as an input with
no documented output that produces one. A caller reading only the contract has no
specified way to obtain the second page, and no specified way to learn that a
second page exists. Everything the walk does past the first page is empirical.

### 2.3 What that does and does not license

- Reading `data` and requiring it to be an array is **CONTRACT**. `required: ["data"]`
  holds on all 79 list schemas, so a 200 without a `data` array is a malformed
  response and refusing it (as both `main` and the branch do) is spec-backed.
- Reading `meta.paging.next` is **OBSERVED at best**. Its *absence* therefore
  proves nothing about whether more pages exist — which is precisely the reasoning
  the branch's full-page backstop was built on, and that reasoning is sound. The
  open question is not whether the backstop is justified in principle; it is
  whether it fires against the firm's real calendar today.

---

## 3. OBSERVED — the live reading

> **STATUS: NOT YET TAKEN.**
>
> The probe is written, its controls pass 71/71 offline, and it refuses to run
> without credentials. The four values it needs —
> `CLIO_CLIENT_ID`, `CLIO_CLIENT_SECRET`, `CLIO_REFRESH_TOKEN`, `CLIO_CALENDAR_ID` —
> are held in the Cloudflare Pages environment and are not retrievable from it;
> Cloudflare returns secret *names*, never values. They must be supplied by the
> operator at run time.
>
> **This section is deliberately empty rather than inferred.** The whole point of
> the order is that the walk is unproven, and filling these tables from the
> 2026-07-03 sandbox note or from `clio-custom-fields.js` would reproduce exactly
> the mistake being investigated: a different endpoint, a different grant, a
> different day, quoted as if it were this one.
>
> To take the reading, see §5. Every table below is filled from the probe's own
> output, verbatim.

### 3.1 Does the response carry `meta.paging.next`? *(Task 2)*

| Reading | Answer |
|---|---|
| Taken at (UTC) | _not taken_ |
| Top-level keys on the 200 | _not taken_ |
| `meta` present | _not taken_ |
| `meta.paging` present | _not taken_ |
| `meta.paging.next` class | _not taken_ |
| Absolute URL or relative path | _not taken_ |
| Host it names | _not taken_ |

The observed `meta` object, verbatim:

```json
_not taken_
```

> When filled, the only alteration to the quoted object is the `page_token` query
> **value**, replaced with `<PAGE_TOKEN:len=N>`. The cursor is not a credential —
> it is inert without a bearer token — but it is opaque and live, and this file is
> committed. Nothing else is changed. The unaltered capture goes to
> `test/preview/clio-paging-evidence.json`, which is gitignored.

**Why the host matters and is recorded separately.** The branch assigns
`url = next` and fetches it whole. A cursor that is a perfectly well-formed
absolute URL pointing at a host that is not `app.clio.com` would be followed with
the firm's bearer token attached. A pathname-only check cannot see that
([[feedback_pathname_only_url_check_cannot_see_the_host]]), so the probe classifies
on origin **and** path and refuses to follow a cursor off `app.clio.com` rather
than reporting on it after the fact.

**Why a relative path would be its own bug.** If `next` came back as
`/api/v4/calendar_entries?page_token=…`, the branch's `url = next` hands a
non-URL to `fetch` and the walk dies on page two — a defect the branch cannot
currently see, because it has never had a page two. The probe reports
`ABSOLUTE_URL`, `RELATIVE_PATH` and `OPAQUE_TOKEN` as three distinct answers for
that reason.

### 3.2 What comes back when the result set is smaller than the limit *(Task 3)*

The no-more-pages shape, so it is known rather than assumed. Two readings, because
"short" and "empty" are not the same case:

| Reading | Rows | Top-level keys | `meta` present | `meta` verbatim |
|---|---|---|---|---|
| Terminal page of the 60-day walk | _not taken_ | _not taken_ | _not taken_ | _not taken_ |
| A window in 2001 (holds nothing) | _not taken_ | _not taken_ | _not taken_ | _not taken_ |

### 3.3 The firm's calendar, as a number

| Measure | Value |
|---|---|
| Window | 60 days, the maximum `/booking/availability` accepts |
| Entries in that window | _not taken_ |
| First page rows / limit | _not taken_ / 200 |
| Pages walked | _not taken_ |
| Headroom before the first page comes back full | _not taken_ |

---

## 4. Would the full-final-page backstop fire against the firm's real calendar today? *(Task 4)*

> **UNSETTLED — no live reading has been taken.**

This answer is produced by `replayBackstop()` in the probe, which is the branch's
own stopping logic copied rather than paraphrased, run over the pages actually
observed. There are exactly four outcomes:

| Observation | Verdict |
|---|---|
| First page comes back **full (≥200)** with **no** cursor | **FIRES.** `/booking/availability` answers 503. Every slot unbookable. Do not merge. |
| Cursor present, walk ends on a **short** page | **DOES NOT FIRE.** Merge is safe on this axis; record the headroom. |
| First page comes back **short** (<200) | **DOES NOT FIRE TODAY**, and the cursor question is still open — a short page never reaches the backstop, so it proves the branch harmless *now*, not correct. If no cursor was observed anywhere, the branch is one busy quarter from taking booking down and that must be said out loud in the PR. |
| Walk exhausts 10 pages with a cursor outstanding | **FIRES**, via the `did not finish paging` arm. |

The third row is the one most likely to be misread, so it is spelled out: a
passing reading on a quiet calendar is **not** evidence that the cursor exists.
The `limit=1` probe (§5, P1) exists precisely to separate those two — one entry
is a full page, so it tests the paging *mechanism* without depending on how busy
the firm is.

---

## 5. How to take the reading

```
CLIO_CLIENT_ID=… CLIO_CLIENT_SECRET=… CLIO_REFRESH_TOKEN=… CLIO_CALENDAR_ID=… \
  node test/preview/verify-clio-paging.mjs
```

Two optional flags:

| Flag | Default | Accepted |
|---|---|---|
| `--days=N` | `60` | `1`–`60`, the window `/booking/availability` accepts. Anything else prints a note and falls back to 60. |
| `--evidence=<path>` | `test/preview/clio-paging-evidence.json` | A file **directly** in `test/preview/` whose name matches `clio-paging-evidence*.json` — the gitignored set, and nothing else. See "No arbitrary write to disk" below. |

Four reads, all `GET`:

| | Request | What it answers |
|---|---|---|
| **P1** | `limit=1` over the 60-day window | Does this endpoint page **at all**? One entry is a full page, so the cursor's presence is decisive regardless of calendar volume. Vacuous only if the window is empty, and it says so. |
| **P2** | `limit=200` over the same window | Byte for byte the first request the branch issues. |
| **P3** | follows P2's cursor, bounded at 10 pages | The branch's own loop over real pages. Its terminal page is §3.2. |
| **P4** | `limit=200` over a window in 2001 | The zero-row envelope. |

### What the run will not do

- **No write, of any kind.** There is no `POST`, `PATCH` or `DELETE` to `/api/v4`
  anywhere in the probe. The run prints a request ledger — method, origin,
  pathname, status, in order — and asserts the read-only claim about its own
  traffic, so the transcript carries its own proof. The ledger prints on **every**
  exit path, including the ones that never reach the network, because an absent
  ledger and an empty one are indistinguishable in a transcript
  ([[feedback_zero_request_assertion_needs_a_positive_arm]]).
- **No redirect is followed, on any request.** Every `fetch` sets
  `redirect: 'error'`. This is not belt-and-braces on the GETs, where the fetch
  spec already strips `Authorization` cross-origin — it is load-bearing on the
  **mint**, which is a `POST` with a body. A `307` or `308` re-issues the request
  to the redirect target *with its body*, and that body is `client_id`,
  `client_secret` and `refresh_token` as form fields; header stripping does
  nothing for a body, and those three values re-provision the firm's grant.
  The ledger could not have caught it either: it records the URL the probe
  **constructed**, never the URL `fetch` finally contacted, so a followed
  redirect would print a clean `app.clio.com` line while the credentials were
  already elsewhere. Refusing the hop at the transport is what makes the ledger's
  claim true rather than merely well-intentioned.
- **No re-authorisation.** The one non-GET is
  `POST https://app.clio.com/oauth/token` with `grant_type=refresh_token` — the
  same call `getAccessToken` makes on every cold isolate. A *re-authorisation*
  mints a new refresh token and kills the live one, which takes production
  booking down; a *refresh* does not rotate. The run checks anyway and exits 3
  with a loud banner if the returned `refresh_token` differs from the one
  supplied, because the operator's stored credential would then be stale.
- **No secret in any output** — via **two** redactors, which do not hold the same
  thing, and the difference is worth stating because "a redactor" implies one
  instrument:

  | Redactor | Covers | Holds |
  |---|---|---|
  | the run's | every emitted line | the three credentials, **plus** the minted access token, added the moment the mint returns |
  | the CLI's | the evidence file | a **fresh** instance built from `process.env` — the same three credentials, and **not** the access token |

  The second is narrower because it is constructed in the CLI block, which never
  sees the token. That is adequate rather than an oversight, but only because of
  something proved separately: the object it serialises contains no access token
  to redact — the token lives in a local inside `runPagingProbe` and is never
  written into the returned `out`. A control asserts precisely that, so if it ever
  changes the suite reds instead of the evidence file quietly gaining a bearer
  token. The redactor firing is reported as a **defect**, not a save: the probe is
  built from placeholders and should never construct such a line.
- **No calendar content is ever recorded.** This is the guarantee, and it is the
  one the code makes: `readPage` reads `body.data.length` and nothing else — no
  row, no field of a row, on any page, from any request, whatever the response
  contains.

  The narrower claim about `fields` is **not** that guarantee and must not be read
  as one. `fields=start_at,end_at` — the same selection the adapter uses — is
  applied to the URLs the probe **constructs**: P1, P2 and P4. P3 does not
  construct a URL; it follows Clio's `meta.paging.next` verbatim, which is the
  whole point of the walk (it is the branch's own behaviour), and that cursor
  carries whatever query Clio chose to put in it. If Clio does not round-trip
  `fields`, page two onward come back as **full entries** — summary, description,
  attendees, client names. Whether it does cannot be stated here, because no live
  reading has been taken; that is what the probe is for, and §3 stays empty until
  it is. What holds regardless is that no row is read out of the body at all.
- **No arbitrary write to disk.** `--evidence=<path>` is bounded to the gitignored
  set: the path must resolve to a file sitting **directly** in `test/preview/` and
  its name must match `clio-paging-evidence*.json`. Anything else is refused by
  name, with the resolved path printed, **before** the network is touched — exit
  6, nothing sent and nothing written. Unbounded, the flag was a file-overwrite
  primitive running in the one shell session that has the live Clio credentials
  exported: `--evidence=.dev.vars` would have destroyed the local credential
  file, and a tab-completion into `donovan-legal-site/` would have overwritten a
  page of the live site.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | The instrument worked. **Both** "would fire" and "would not fire" exit 0 — a firing backstop is a result, not a crash. |
| 2 | Credentials missing or unusable; nothing was sent. |
| 3 | The refresh token rotated. Fix the stored credential before anything else. |
| 4 | The redaction backstop fired — treat all output as suspect. |
| 5 | The run issued a request outside the read-only contract. |
| 6 | `--evidence` named a path outside the gitignored set. Refused before the network; nothing sent, nothing written. |

---

## 6. Related

- `donovan-legal-site/functions/booking/_lib/provider-clio.js` — `fetchBusyBlocks`,
  `CALENDAR_PAGE_LIMIT`, `CALENDAR_MAX_PAGES`.
- `donovan-legal-site/functions/booking/_lib/clio-custom-fields.js` — walks the
  same `meta.paging.next` key on `/custom_fields`. **A different endpoint.** That
  it works there is the origin of the assumption under investigation, not evidence
  for it.
- `integrations/clio/README.md` — already separates spec-backed guarantees from
  field-tested ones. This file follows that split.
