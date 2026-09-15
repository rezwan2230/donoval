#!/usr/bin/env node
/**
 * ADR-008 Get-AgentToken — mint a 1-hour GitHub App installation token for one
 * agent. Vendored (VAN-60) from TicoAI/Agent_OS bin/get-agent-token.mjs; the only
 * change is the import path (./lib/identity/index.mjs — Vantage has no TS build).
 *
 * KEY SOURCE (keyless/WIF preferred): when GCP_ACCESS_TOKEN + GCP_PROJECT_ID are
 * present, the App private-key PEM is read from GCP Secret Manager via the
 * WIF-issued token — the key never leaves GCP except into this ephemeral runner.
 * Falls back to an AGENT_APP_PRIVATE_KEY env secret (local / non-GCP) if no GCP
 * token is supplied. Masks the minted token in CI logs and writes it to
 * GITHUB_OUTPUT.
 *
 * Required env:
 *   AGENT_CALLSIGN          e.g. "Dr. Insane"
 *   plus ONE key source:
 *     GCP_ACCESS_TOKEN + GCP_PROJECT_ID   (keyless/WIF — preferred)
 *     AGENT_APP_PRIVATE_KEY               (raw PEM secret — fallback)
 * Optional env:
 *   AGENT_INSTALLATION_ID   OVERRIDE only — verified against auto-discovery.
 *   GITHUB_REPOSITORY       owner/repo for discovery (CI sets this).
 *   GITHUB_API_URL          Actions API base (defaults to api.github.com)
 *   GCP_SECRETMANAGER_BASE_URL / GCP_SECRET_VERSION  (optional Secret Manager overrides)
 */
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { makeRs256Signer, makeGcpAppJwtSigner, getAgentToken } from './lib/identity/index.mjs'

const callSign = process.env.AGENT_CALLSIGN
const overrideRaw = process.env.AGENT_INSTALLATION_ID
const installationOverride = overrideRaw ? Number(overrideRaw) : undefined
const pem = process.env.AGENT_APP_PRIVATE_KEY
const gcpToken = process.env.GCP_ACCESS_TOKEN
const gcpProject = process.env.GCP_PROJECT_ID
const haveGcp = Boolean(gcpToken && gcpProject)

if (!callSign || (!haveGcp && !pem)) {
  console.error(
    'get-agent-token: AGENT_CALLSIGN and a key source ' +
      '(GCP_ACCESS_TOKEN+GCP_PROJECT_ID, or AGENT_APP_PRIVATE_KEY) required',
  )
  process.exit(1)
}
if (overrideRaw && !Number.isInteger(installationOverride)) {
  console.error('get-agent-token: AGENT_INSTALLATION_ID, when set, must be an integer')
  process.exit(1)
}

/** owner/repo for installation discovery — $GITHUB_REPOSITORY (CI) or the origin remote (local). */
function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
    const m = url.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?$/)
    return m ? m[1] : undefined
  } catch {
    return undefined
  }
}

const http = async ({ url, method, headers }) => {
  const r = await fetch(url, { method, headers })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

try {
  // Keyless/WIF first: fetch the PEM from GCP Secret Manager; never persist or log it.
  const signer = haveGcp
    ? await makeGcpAppJwtSigner(callSign, {
        projectId: gcpProject,
        accessToken: gcpToken,
        http,
        apiBaseUrl: process.env.GCP_SECRETMANAGER_BASE_URL,
        version: process.env.GCP_SECRET_VERSION,
      })
    : makeRs256Signer(pem)

  const { agent, token, expiresAt } = await getAgentToken({
    callSign,
    installationId: installationOverride,
    repo: resolveRepo(),
    signer,
    http,
    apiBaseUrl: process.env.GITHUB_API_URL,
  })

  console.log(`::add-mask::${token}`)
  console.log(`[get-agent-token] minted for ${agent}; expires ${expiresAt}`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `token=${token}\nexpires_at=${expiresAt}\n`)
  }
  process.exit(0)
} catch (err) {
  console.error(`[get-agent-token] ${err.message}`)
  process.exit(1)
}
