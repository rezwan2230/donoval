// Gates every request under /diamond/* against the member's engagement level in Clio.
//
// Replaces the HTTP Basic gate that stood here (TIER_DIAMOND_USER / _PASS), which was
// David's stop-gap while the member area was unfinished. The level now comes from
// "Membership Tier" on the member's own Clio contact, read at sign-in and carried in
// a signed, level-only session cookie — so admitting or revoking a member is a
// paralegal changing a dropdown, not an engineer changing a secret.
//
// Levels are independent, not ranked: a diamond session opens /diamond/ and nothing else.
// Fail-closed — an unconfigured environment serves 503, never public.
//
// See ../_lib/member-auth.js for the model and the configuration block, and
// docs/MEMBERS-CLIO-GATED-ACCESS-R1.md for the order.
import { memberGuard } from "../_lib/member-auth.js";

export const onRequest = memberGuard("diamond");
