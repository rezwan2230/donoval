/**
 * GCP Secret Manager adapter for the injectable App-key port (ADR-008 / AOS-11).
 * Vendored (VAN-60) from TicoAI/Agent_OS src/identity/gcp-secrets.ts, byte-faithful.
 *
 * The org is keyless (Workload Identity Federation): there are NO exported JSON
 * service-account keys and the App private keys never leave GCP except into the
 * ephemeral CI runner that is about to use them. This adapter reads an agent's App
 * private-key PEM from Secret Manager using a WIF-issued GCP access token and
 * returns an RS256 signer for that agent.
 */
import { makeRs256Signer } from './jwt.mjs'
import { getAgentApp } from './registry.mjs'

/**
 * SINGLE SOURCE OF TRUTH for the Secret Manager secret short-name. The org's
 * existing App-key secrets in `tico-ai-prod` are named `agent-<slug>-github-key`.
 */
export const SECRET_NAME = (slug) => `agent-${slug}-github-key`

/**
 * Canonical Secret Manager short-name for an agent's App-key secret, derived from
 * the call-sign: e.g. ADAM -> `agent-adam-github-key`, "Dr. Insane" ->
 * `agent-dr-insane-github-key`. Resolving through the registry first makes this an
 * identity gate.
 */
export function agentSecretId(callSign) {
  const app = getAgentApp(callSign)
  const slug = app.callSign
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return SECRET_NAME(slug)
}

/** Full Secret Manager resource name: projects/<id>/secrets/<secret>/versions/<version>. */
export function agentSecretName(callSign, projectId, opts) {
  const id = opts?.secretId ?? agentSecretId(callSign)
  const version = opts?.version ?? 'latest'
  return `projects/${projectId}/secrets/${id}/versions/${version}`
}

/**
 * Fetch an agent's App private-key PEM from GCP Secret Manager (WIF auth).
 * The Secret Manager API always base64-encodes `payload.data`; the STORED secret
 * value itself may be either a raw PEM or a base64-encoded PEM, so we decode once
 * and, if that is not yet a PEM, decode a second time. Sanity-checked before use.
 */
export async function fetchAgentPem(callSign, cfg) {
  const app = getAgentApp(callSign) // identity gate before any I/O
  const name = agentSecretName(callSign, cfg.projectId, {
    secretId: cfg.secretId,
    version: cfg.version,
  })
  const base = cfg.apiBaseUrl ?? 'https://secretmanager.googleapis.com'

  const res = await cfg.http({
    url: `${base}/v1/${name}:access`,
    method: 'GET',
    headers: {
      authorization: `Bearer ${cfg.accessToken}`,
      accept: 'application/json',
    },
  })

  if (res.status !== 200) {
    throw new Error(`secret access failed for ${app.callSign}: HTTP ${res.status}`)
  }
  const body = res.json
  const data = body.payload?.data
  if (typeof data !== 'string') {
    throw new Error(`secret payload malformed for ${app.callSign}`)
  }
  // Stored value may be raw PEM or base64(PEM) — handle both.
  const decoded = Buffer.from(data, 'base64').toString('utf8')
  const pem = decoded.includes('PRIVATE KEY')
    ? decoded
    : Buffer.from(decoded.trim(), 'base64').toString('utf8')
  if (!pem.includes('PRIVATE KEY')) {
    throw new Error(`secret for ${app.callSign} is not a PEM private key`)
  }
  return pem
}

/**
 * Build an RS256 App-JWT signer whose key is sourced from GCP Secret Manager.
 * The PEM is fetched on demand and closed over; it is never returned or logged.
 */
export async function makeGcpAppJwtSigner(callSign, cfg) {
  return makeRs256Signer(await fetchAgentPem(callSign, cfg))
}
