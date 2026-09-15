# Clio Manage API — vendored contract (v4)

Canonical source of truth for every Clio integration across the stack:
**Donovan** (booking confirmation email), **Vantage** (CRM writes), and
**Perch** (contact post). Build against this file — do not guess at the API.

- **Source:** Clio "Download OpenAPI specification" — https://docs.developers.clio.com/clio-manage/api-reference/
- **Spec:** OpenAPI 3.0.0 · title "Clio API Documentation" · version **v4**
- **Retrieved:** 2026-07-30
- **166 paths.** Path keys omit the `/api/v4` prefix (e.g. `/calendar_entries.json`) — prepend the base URL when calling.
- **Location note:** this lives at repo root under `integrations/clio/`, deliberately **not** under `donovan-legal-site/`, so the 3.2 MB reference is never shipped into the deployed Cloudflare Pages bundle.

---

## Field-tested notes — OBSERVED, not in the spec

These were established by live probing against Clio, not from the published
reference. Flagged so the next person knows which guarantees have a paper
trail and which rest on observed behavior — re-verify if Clio changes.

- **`contact_id` is NOT a create-body field.** It does not appear in the
  `POST /calendar_entries` schema, and Clio *silently discards* unrecognized
  top-level keys — no error, no attendee, no email. This was the root cause of
  booking confirmations never sending. Use `attendees`, never `contact_id`.
- **The `.ics` rides along with the notification, and no human step is needed.**
  The spec documents what `send_email_notification` is *for*; that a create alone
  delivers the invitation **and** the calendar attachment to the attendee, with
  nobody touching the Clio UI, is what the live probe established.
- **Meeting links go in `location`.** The conferencing-specific field names
  (`conference_url`, `zoom_meeting`, `join_url`, and ~13 others) do not exist on
  the resource and are rejected. Only `location` (string) and `conference_meeting`
  (object) exist; `location` is the confirmed target for the Zoom link.
- **The email renders `description` verbatim to the attendee.** Therefore the
  entry `description` must be client-safe: any intake data (income / net-worth
  bands) belongs on a **contact Note** (`POST /notes.json`, `type: "Contact"`),
  never in the calendar-entry description.
- **OAuth refresh token does not rotate** (observed; token mechanics are behind
  the external Authorization docs, not this reference — treat as implementation
  detail, not contract).
- **The generated `.ics` carries no `METHOD`**, and smooth Zoom delivery needs
  two Zoom account settings. Operational, outside the API surface.

---

## Specified, and previously mis-filed as observed

These were in the "observed, not in the spec" list above and should not have been.
They are fully documented; the entries were moved here so nobody re-derives from a
live probe what the contract already states.

- **Attendee shape is `attendees: [{ id, type: "Contact" }]`** — and `_destroy`.
  `POST /calendar_entries.json` → `data.attendees.items.properties` documents all
  three keys: `id` ("Not required for creating new Attendee, but required for
  updating or deleting existing ones"), `type` ("The type of attendee (Calendar,
  Contact)"), and `_destroy` ("Flag to delete a specific attendee").
- **`send_email_notification` is a documented boolean** on the same body:
  "Whether the calendar Entry should send email notifications to attendees."
- **Contacts search parameter is `query`.** `GET /contacts.json` documents `query`
  and does **not** list `q`. Treat `q` as unsupported, not as an alias: an
  unrecognized query parameter is *ignored* rather than rejected, so the wrong
  spelling does not error — the search silently stops filtering and every returning
  client looks new.
- **Nested-attribute semantics** for `addresses`, `phone_numbers`,
  `email_addresses` and `custom_field_values` on `PATCH /contacts/{id}.json`: a
  member with **no `id` is created**, a member **with `id` is updated in place**,
  and a member is deleted **only** on an explicit `{ id, _destroy: true }`. Sending
  one phone number therefore appends; it does not replace the client's others.
- **A Person needs at least a first name or a last name** — one of the two. The
  Contacts tag documentation recommends the individual `first_name`/`last_name`
  fields over the composed `name` parameter, which it calls "discouraged" because
  Clio must infer the components and 422s when it cannot. No placeholder surname is
  required or wanted.
- **`custom_field_values[].id` is an opaque composite string** (e.g.
  `"text_line-1"`), not an integer, and **may be `NULL`** when a CustomField is
  displayed by default but has never been given a value. When it is null, send
  `custom_field: { id }` to create the value instead.

---

## The three endpoints the current integration uses

| Purpose | Endpoint | Key fields |
|---|---|---|
| Create the consult + send email | `POST /calendar_entries.json` | `calendar_owner{id}`, `start_at`, `end_at`, `summary`, `description` (client-safe), `location` (meeting link), `attendees: [{id, type:"Contact"}]`, `send_email_notification: true` |
| Resolve / create the client | `GET /contacts?query=<email>` · `POST /contacts.json` · `PATCH /contacts/{id}.json` | search: `query`, `type: "Person"` · create (identity only): `type`, `first_name`, `last_name`, `email_addresses`, `phone_numbers` · enrich: `addresses`, `custom_field_values` |
| Attorney-side intake record | `POST /notes.json` | `contact` association, `type: "Contact"`, the intake summary incl. bands |

---

## Intake custom fields

The qualifier answers that ride on the Clio **contact** as `custom_field_values`
(`SHELDON-CLIO-CONTACT-MAPPING`). Clio addresses a `CustomFieldValue` by **id**
only — there is no by-name form — and the ids are per-firm, so
`donovan-legal-site/functions/booking/_lib/clio-custom-fields.js` turns the stable
field *names* below into whatever ids this account uses.

**This code never creates a CustomField.** David builds the set by hand in Clio
settings; resolution is read-only. There is no flag that turns creation back on and
no `POST /custom_fields` anywhere in the shipped bundle. Two reasons: a CustomField
is *schema*, appearing on every contact form in the account; and `field_type` is
immutable — `PATCH /custom_fields/{id}.json` accepts only `display_order`,
`displayed`, `name`, `picklist_options` and `required`, so a definition minted with
the wrong type is permanent. Nothing in the API distinguishes "created the field"
from "created a second field with the same name" either.

### The field set

Create these in Clio settings with **`parent_type: Contact`** and exactly these
names and types. A name found on the account with a different `field_type` is
**refused rather than bound** — binding it would write values Clio rejects on every
booking from then on, visible only as a warn line.

| Qualifier key | Clio CustomField name | Expected `field_type` |
|---|---|---|
| `matter_category` | Intake Matter Category | `text_line` |
| `matter_sub` | Intake Matter Sub-Type | `text_line` |
| `for_whom` | Intake For Whom | `text_line` |
| `income_band` | Intake Income Band | `text_line` |
| `net_worth_band` | Intake Net Worth Band | `text_line` |
| `language` | Intake Language | `text_line` |
| `source` | Intake Source | `text_line` |

`text_line` throughout on purpose: a picklist would have to enumerate every band and
matter option, and a qualifier that later gains an option would then write a value
Clio rejects. A text line accepts whatever the qualifier's `LABELS` table renders.

A name that resolves to no id is **skipped** — absent from the request body, never
sent with a null id. The same answers stay readable on the intake Note either way.

### Where these go on the wire

`POST /contacts.json` carries **identity only** (`type`, `first_name`, `last_name`,
`email_addresses`, `phone_numbers`). `addresses` and `custom_field_values` are
applied afterwards on `PATCH /contacts/{id}.json`, which is best-effort. Both are
legal on the create body and are deliberately not sent there: a rejected optional
field on the create would cost the contact id, and with it the calendar entry's
`attendees`, `send_email_notification` and the intake note — i.e. the client's
confirmation email.

The PATCH is safe to use this way because of the documented nested-attribute
semantics (see above): a member with no `id` is created, so the enrichment appends
and never replaces a returning client's existing numbers or addresses.

### Environment variables

| Variable | Shape | Default | What it does |
|---|---|---|---|
| `CLIO_INTAKE_FIELD_IDS` | JSON object, qualifier key → integer CustomField id: `{"income_band":0,"source":0}` | unset | Ids handed over by the firm. Seeded names are used as-is and skip the name lookup. Partial objects are fine — unlisted keys fall through to the lookup. Also overrides the `field_type` check, since a seeded id is a human naming the field explicitly. Malformed JSON is ignored, never thrown. |

The ids above are `0` placeholders illustrating the **shape**. Real values belong in
the Pages environment, never in this repo. This is configuration, not a secret: a
custom-field id is meaningless without the OAuth credentials.

Related: `CLIO_CREATE_CONTACT` gates the contact path as a whole. With it off there
is no contact, therefore no attendee, no confirmation email and no intake note —
and none of the above runs at all.
