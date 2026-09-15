# Webhooks — Clio Manage

Receiver design for Clio Manage webhooks. Authoritative webhook semantics (models, events, HMAC handshake, expiry, CRUD endpoints) are in [`../../03-research/clio-integration-research.md`](../../03-research/clio-integration-research.md) §5.1 and §11.3 — this file captures the build-specific plan only.

## Scope

- **Clio Manage webhooks only.** Clio Grow has **no webhooks** — Grow is out of scope anyway ([SOURCE-OF-TRUTH §3](../SOURCE-OF-TRUTH.md)).
- Receiver runs as a **standalone GCP Cloud Run** service (HTTPS required; HTTP is rejected by Clio).

## Receiver flow (per integration-research §11.3)

1. **Verify signature** — compute `HMAC-SHA256(shared_secret, raw_body_bytes)` and compare to `X-Hook-Signature`; reject with 403 on mismatch.
2. **Idempotency** — dedupe on event identity (Clio event IDs are [UNCONFIRMED — verify with api@clio.com]; until confirmed, dedupe on payload hash).
3. **Enqueue** to Cloud Tasks / Pub/Sub for async processing.
4. **Return 200 OK immediately.**

## Handshake (per integration-research §5.1)

On webhook creation Clio POSTs `X-Hook-Secret`. Respond by echoing the secret (immediate) or via `PUT /api/v4/webhooks/:id/activate` (delayed). Store the shared secret for signature verification.

## Events to subscribe (MVP)

| Model | Event | Use |
|---|---|---|
| `contact` | `updated` | Invalidate cached contact lookups |
| `matter` | `created`, `updated`, `matter_closed` | Keep ATHENA/email-agent matter state current |
| `communication` | `created` | Reconcile call/email logs |
| `clio_payments_payment` | `created` | Payment confirmation |

## Renewal (critical)

Manage webhooks expire after 3 days by default, **31 days max**. A missed renewal is a silent failure (no events). Run a background job that lists webhooks, checks `expires_at`, and PATCHes any expiring within ~7 days to extend to max. ([integration-research §5.1, §11.3](../../03-research/clio-integration-research.md))

## Reconciliation

Webhook delivery is best-effort (no documented SLA). Poll for missed events on a schedule (e.g. `GET /api/v4/communications` since last reconcile timestamp). ([integration-research §11.5](../../03-research/clio-integration-research.md))

## Open items

- [ ] Confirm Clio event ID / replay-protection semantics with api@clio.com
- [ ] Cloud Run service name + public HTTPS URL for the receiver

Tracked in [`../notes/open-decisions.md`](../notes/open-decisions.md).
