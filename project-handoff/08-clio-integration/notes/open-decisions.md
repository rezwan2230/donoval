# Open Decisions & Working Notes

Living log of decisions still open for the Clio / ATHENA / DocuSign / GCP email-agent pre-build. Locked decisions are in [`../SOURCE-OF-TRUTH.md`](../SOURCE-OF-TRUTH.md) §2. Move an item here to that file once it is locked.

## Open decisions

| # | Decision | Current lean | Reference |
|---|---|---|---|
| D1 | Token storage backend on GCP | **GCP Secret Manager** | [`../oauth-setup/README.md`](../oauth-setup/README.md), [integration-research §11.2](../../03-research/clio-integration-research.md) |
| D2 | Webhook receiver service location | Standalone GCP Cloud Run service | [`../webhooks/README.md`](../webhooks/README.md) |
| D3 | Custom field schema sign-off (tier values, matter-type taxonomy) | Draft pending Paul | [`../schemas/README.md`](../schemas/README.md) |
| D4 | Email-agent MVP scope (which inbound/outbound flows ship first) | TBD | this file |
| D5 | DocuSign API trigger point (which event fires execution) | TBD | [`../SOURCE-OF-TRUTH.md`](../SOURCE-OF-TRUTH.md) §4 |
| D6 | Clio Payments vs LawPay re-evaluation trigger (ACH volume threshold) | Clio Payments default; revisit if ACH economics justify | [package-recommendation §4.4](../../03-research/clio-package-recommendation.md) |

## Items to confirm with Clio (api@clio.com) — from research

These are flagged UNCONFIRMED in [`../../03-research/clio-integration-research.md`](../../03-research/clio-integration-research.md) §12.1 and carry into the build:

- [ ] `query` param on `/contacts` searches phone-number fields (test empirically)
- [ ] Webhook event ID / replay-protection semantics
- [ ] Manage refresh-token non-rotation holds in practice

## Items to confirm with Paul

- [ ] Clio Manage Advanced purchased + OAuth handoff complete
- [ ] Custom field tier names and matter-type taxonomy (D3)
- [ ] Whether estate-planning work touches PHI (HIPAA add-on / BAA) — low probability for a tax practice ([integration-research §10.4](../../03-research/clio-integration-research.md))

## Notes

- Keep this file canonical. Do not start a competing decisions log elsewhere in the repo.
