/**
 * Canonical agent App registry (ADR-008). Vendored (VAN-60) from
 * TicoAI/Agent_OS src/identity/registry.ts, byte-faithful. App IDs are the public
 * identifiers from agents/IDENTITY-GATES.md. Installation IDs and private keys are
 * NOT here — they are provisioned separately and supplied at call time.
 *
 * Identity is a gate: a token may only be minted for a registered agent.
 */

export const AGENT_APPS = Object.freeze({
  Zane: { callSign: 'Zane', appId: 4152890, bot: 'zane-ticoai-chief-of-staff[bot]' },
  ADAM: { callSign: 'ADAM', appId: 4152938, bot: 'adam-ticoai-devops[bot]' },
  Sheldon: { callSign: 'Sheldon', appId: 4153518, bot: 'sheldon-ticoai-backend[bot]' },
  Jordan: { callSign: 'Jordan', appId: 4153542, bot: 'jordan-ticoai-frontend[bot]' },
  Sarah: { callSign: 'Sarah', appId: 4153646, bot: 'sarah-ticoai-qa[bot]' },
  'Dr. Insane': {
    callSign: 'Dr. Insane',
    appId: 4153699,
    bot: 'dr-insane-ticoai-compliance[bot]',
  },
})

/** Resolve an agent's App identity by call-sign, or throw if unregistered. */
export function getAgentApp(callSign) {
  const app = AGENT_APPS[callSign]
  if (!app) {
    throw new Error(`unknown agent identity: ${callSign}`)
  }
  return app
}
