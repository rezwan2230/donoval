/**
 * Vendored agent-identity barrel (VAN-60) — re-exports the runtime symbols the
 * bin/ helpers and the guard unit test consume. Mirrors the TicoAI/Agent_OS
 * src/identity/index.ts surface, trimmed to the verdict-emission path.
 */
export { buildAppJwtClaims, makeRs256Signer } from './jwt.mjs'
export { AGENT_APPS, getAgentApp } from './registry.mjs'
export {
  getAgentToken,
  resolveInstallationId,
  verifyOverrideInstallation,
} from './token.mjs'
export {
  agentSecretId,
  agentSecretName,
  fetchAgentPem,
  makeGcpAppJwtSigner,
} from './gcp-secrets.mjs'
export {
  botNoReplyEmail,
  botCommitIdentity,
  assertBotIdentity,
  assertNotSelfApprove,
  BotIdentityError,
  BotAttributionError,
  SelfApprovalError,
  commitEnv,
  tokenRemoteUrl,
  userLookupRequest,
  reviewRequest,
  installationEnvVar,
  actAsAgent,
  parseCommand,
} from './commit.mjs'
export {
  GATE_AGENTS,
  REVIEW_EVENTS,
  EVENT_TO_REVIEW_STATE,
  VerdictGuardError,
  isReviewEvent,
  assertGateAgent,
  prLookupRequest,
  commitLookupRequest,
  reviewsLookupRequest,
  canonicalBotLogin,
  latestReviewFor,
  guardVerdict,
  verdictAuditRecord,
  verdictAuditLine,
  verdictSuppressedAuditRecord,
  verdictSuppressedAuditLine,
} from './verdict.mjs'
