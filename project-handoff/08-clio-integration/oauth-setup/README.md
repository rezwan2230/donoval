# OAuth Setup — Clio Manage

Pre-build notes for registering and authorizing the **private** Clio Manage Advanced OAuth app for Donovan Legal PLLC. Authoritative auth details are in [`../../03-research/clio-integration-research.md`](../../03-research/clio-integration-research.md) §2.1 — this file does not restate them, it captures the build-specific plan.

## Scope of this integration

- **Clio Manage only.** No Clio Grow app (Grow is out of scope — see [`../SOURCE-OF-TRUTH.md`](../SOURCE-OF-TRUTH.md) §3).
- **Private app**, single firm. No App Directory security review required for private use ([integration-research §9.4](../../03-research/clio-integration-research.md)).
- **US region** (`app.clio.com`). Donovan Legal is Florida-based.

## Registration checklist

Register at the Manage Developer Portal ([developers.clio.com](https://developers.clio.com)). Required fields per [integration-research §2.1](../../03-research/clio-integration-research.md):

- [ ] App `Name`, `Website URL`
- [ ] `Redirect URI(s)` — to be set to the GCP Cloud Run callback (TBD once service is stood up)
- [ ] `App Permissions` (scopes) — minimum needed for the build (see below)
- [ ] `Deauthorization Callback URL` — must be handled to invalidate stored tokens
- [ ] Accept Developer Terms of Service

## Scopes to request (minimum for Milestone 0 + write path)

Clio Manage scopes are resource-based. Request only what the flows below need:

| Scope | Why |
|---|---|
| Contacts | Caller/sender lookup, contact creation on engagement |
| Matters | Matter read + creation (dual-write) |
| Communications | Log calls/emails ([integration-research §6.4](../../03-research/clio-integration-research.md)) |
| Calendars | Consultation booking (if in MVP) |
| Clio Payments | Payment/trust flows |

Confirm exact scope strings against the [Manage permissions docs](https://docs.developers.clio.com/api-docs/clio-manage/permissions/) at registration time.

## Token storage (GCP)

- Store access + refresh tokens in **GCP Secret Manager**, encrypted at rest. Do not store in plaintext in an app database. ([integration-research §11.2](../../03-research/clio-integration-research.md))
- Manage access token lifetime is 7 days; **refresh tokens do not rotate** — proactive background refresh ~1 hour before expiry, no distributed lock required for Manage. ([integration-research §2.1, §11.2](../../03-research/clio-integration-research.md))
- Handle the Manage deauthorization callback: mark token revoked, trigger re-auth.

## Handoff steps (Paul)

1. Paul purchases Clio Manage Advanced (annual billing recommended; [package-recommendation §7](../../03-research/clio-package-recommendation.md)).
2. Paul authorizes the private app once via the OAuth consent flow.
3. Resulting token pair is written to Secret Manager.

## Open items

- [ ] Final redirect URI (depends on Cloud Run service name)
- [ ] Confirm exact scope strings before registration
- [ ] Developer trial vs production account for pre-Paul testing ([integration-research §2.1](../../03-research/clio-integration-research.md))

Tracked in [`../notes/open-decisions.md`](../notes/open-decisions.md).
