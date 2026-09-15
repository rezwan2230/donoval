# Schemas — Custom Fields & Mappings

Clio Manage custom field definitions and the ATHENA / GHL / email-agent ↔ Clio field mappings. Custom field API mechanics are in [`../../03-research/clio-integration-research.md`](../../03-research/clio-integration-research.md) §6.9 — this file holds the Donovan-specific schema, pending Paul's sign-off.

## Custom fields (Donovan Legal) — DRAFT, awaiting sign-off

These are the custom fields ATHENA and the email agent need on Clio Manage Contact/Matter records ([package-recommendation §1](../../03-research/clio-package-recommendation.md), [integration-research §6.9](../../03-research/clio-integration-research.md)):

| Field | Applies to | Type | Values (draft) | Notes |
|---|---|---|---|---|
| Client tier | Contact | Picklist | Gold / Platinum / Reserve | Final tier names pending Paul |
| Matter type | Matter | Picklist | Controversy / Planning | Tax controversy vs tax planning |
| Reserve client number | Contact | Number | 001–100 | Reserve program identifier |

Field **IDs** are discovered at onboarding via `GET /custom_fields?fields=id,name,field_type` and recorded here once Paul's fields exist. Do not hardcode IDs before discovery.

## Mapping tables — to be finalized

| Source field (ATHENA / GHL / email agent) | Clio Manage target | Notes |
|---|---|---|
| Caller/sender name | Contact `first_name` / `last_name` | |
| Phone | Contact `phone_numbers` | |
| Email | Contact `email_addresses` | |
| Matter description | Matter `description` | |
| Tier assignment | custom field (above) | by field ID after discovery |

## Constraints (from research)

- Contacts limited to 20 email addresses / 20 phone numbers / 20 physical addresses ([integration-research §4.1](../../03-research/clio-integration-research.md)).
- Custom field values are nested in the Contact/Matter response when requested via `fields=custom_field_values{...}`.
- No native API trigger for lead→matter conversion; use dual-write and map all custom fields at write time ([integration-research §8.3](../../03-research/clio-integration-research.md)).

## Open items

- [ ] Paul signs off on tier names and matter-type taxonomy
- [ ] Record discovered custom field IDs here after the fields are created in Paul's account

Tracked in [`../notes/open-decisions.md`](../notes/open-decisions.md).
