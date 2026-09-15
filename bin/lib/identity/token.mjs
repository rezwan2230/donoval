/**
 * Get-AgentToken (ADR-008) — mint a 1-hour GitHub App INSTALLATION token for one
 * agent, scoped to that agent's App. Vendored (VAN-60) from TicoAI/Agent_OS
 * src/identity/token.ts, byte-faithful (types stripped). The JWT `iss` is the
 * agent's appId and the token is requested for the agent's installation, so the
 * resulting token can act only as that bot.
 *
 * INSTALLATION ID (AOS-36 / #74): auto-DISCOVERED at runtime from the App JWT's
 * OWN identity — `GET /repos/{owner}/{repo}/installation` — never read from
 * caller-supplied input. `installationId` survives only as an OPTIONAL override
 * that is *verified* against the discovered value; a mismatch is REJECTED. With
 * no repo, a supplied override is verified against `GET /app/installations` before
 * it can authorize a mint. Every path tightens caller-input -> mint and fails closed.
 */
import { buildAppJwtClaims } from './jwt.mjs'
import { getAgentApp } from './registry.mjs'

/**
 * Pull a validated installation id out of an installation object, binding it to
 * the App we authenticated as: a positive integer `id`, and (when present) an
 * `app_id` that equals our App. A foreign `app_id` means the response is not this
 * App's installation — refuse rather than mint a token for the wrong App.
 */
function installationIdFrom(json, app) {
  const inst = json
  if (typeof inst?.id !== 'number' || !Number.isInteger(inst.id) || inst.id <= 0) {
    throw new Error(`installation discovery for ${app.callSign}: malformed installation id`)
  }
  if (typeof inst.app_id === 'number' && inst.app_id !== app.appId) {
    throw new Error(
      `installation discovery for ${app.callSign}: installation belongs to App ${inst.app_id}, not ${app.appId}`,
    )
  }
  return inst.id
}

/** True when a listed installation is this App's installation on `owner`. */
function installationMatchesOwner(json, app, owner) {
  const inst = json
  const login = inst?.account?.login
  const ownerOk = typeof login === 'string' && login.toLowerCase() === owner.toLowerCase()
  const appOk = typeof inst?.app_id !== 'number' || inst.app_id === app.appId
  return ownerOk && appOk
}

/**
 * Resolve the App installation id at runtime, DERIVED PURELY from the App JWT's
 * own identity — never from caller-supplied input. Primary lookup is the App's
 * installation on this repo; on a 404 we fall back to enumerating the App's own
 * installations and matching the repo owner. Every resolved installation is bound
 * back to `app` (see `installationIdFrom`).
 */
export async function resolveInstallationId(opts) {
  const { app, jwt, http, base, repo } = opts
  const headers = {
    authorization: `Bearer ${jwt}`,
    accept: 'application/vnd.github+json',
  }

  // Primary: the App's installation ON THIS REPO (authenticated as the App via JWT).
  const res = await http({ url: `${base}/repos/${repo}/installation`, method: 'GET', headers })
  if (res.status === 200) {
    return installationIdFrom(res.json, app)
  }
  if (res.status !== 404) {
    throw new Error(`installation discovery for ${app.callSign} failed: HTTP ${res.status}`)
  }

  // Fallback (repo endpoint 404): list the App's OWN installations, match the owner.
  const owner = repo.split('/')[0]
  const list = await http({ url: `${base}/app/installations`, method: 'GET', headers })
  if (list.status !== 200) {
    throw new Error(`installation list for ${app.callSign} failed: HTTP ${list.status}`)
  }
  const installs = Array.isArray(list.json) ? list.json : []
  const matches = installs.filter((i) => installationMatchesOwner(i, app, owner))
  if (matches.length !== 1) {
    throw new Error(
      `installation discovery for ${app.callSign}: expected exactly 1 installation on '${owner}', found ${matches.length}`,
    )
  }
  return installationIdFrom(matches[0], app)
}

/**
 * NO-REPO RESIDUAL (#73, Dr. Insane #97 note): with no repo there is nothing to
 * discover the installation id against, so a caller-supplied override is the only
 * input. Instead of trusting it, VERIFY it: it must appear in the App's OWN
 * installations (`GET /app/installations`, authed by the App JWT) AND belong to
 * this App. An override that is not one of this App's installations is REJECTED.
 */
export async function verifyOverrideInstallation(opts) {
  const { app, jwt, http, base, override } = opts
  const list = await http({
    url: `${base}/app/installations`,
    method: 'GET',
    headers: { authorization: `Bearer ${jwt}`, accept: 'application/vnd.github+json' },
  })
  if (list.status !== 200) {
    throw new Error(`installation list for ${app.callSign} failed: HTTP ${list.status}`)
  }
  const installs = Array.isArray(list.json) ? list.json : []
  const match = installs.find((i) => {
    const inst = i
    const idOk = inst?.id === override
    const appOk = typeof inst?.app_id !== 'number' || inst.app_id === app.appId
    return idOk && appOk
  })
  if (match === undefined) {
    throw new Error(
      `installation override ${override} for ${app.callSign} is not a verified installation of this App — refusing unverified override`,
    )
  }
  return installationIdFrom(match, app)
}

export async function getAgentToken(opts) {
  const app = getAgentApp(opts.callSign)
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000)
  const jwt = opts.signer(buildAppJwtClaims(app.appId, nowSec))
  const base = opts.apiBaseUrl ?? 'https://api.github.com'

  const installationId = await resolveTokenInstallationId(opts, app, jwt, base)

  const res = await opts.http({
    url: `${base}/app/installations/${installationId}/access_tokens`,
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
  })

  if (res.status !== 201) {
    throw new Error(`token mint failed for ${app.callSign}: HTTP ${res.status}`)
  }
  const body = res.json
  if (typeof body.token !== 'string' || typeof body.expires_at !== 'string') {
    throw new Error(`token mint response malformed for ${app.callSign}`)
  }
  // Identity is bound BEFORE the mint, on the JWT side: `resolveTokenInstallationId`
  // asserts `app_id === app.appId` against real JWT-authed endpoints. There is no
  // post-mint introspection — GitHub exposes no installation-token-authed endpoint
  // that returns the minted token's App identity (see #73 bounce).
  return { agent: app.callSign, appId: app.appId, token: body.token, expiresAt: body.expires_at }
}

/**
 * Decide the installation id for the mint. Discovery from the App JWT is the
 * source of truth whenever a `repo` is available; the optional `installationId`
 * override is only ever accepted as a verified pin (equal to the discovered id).
 */
async function resolveTokenInstallationId(opts, app, jwt, base) {
  const override = opts.installationId
  if (opts.repo) {
    const discovered = await resolveInstallationId({ app, jwt, http: opts.http, base, repo: opts.repo })
    if (override !== undefined && override !== discovered) {
      throw new Error(
        `installation id override mismatch for ${app.callSign}: ${override} (override) != ` +
          `${discovered} (discovered) — refusing misprovisioned override`,
      )
    }
    return discovered
  }
  if (override === undefined) {
    throw new Error(
      `installation id for ${app.callSign}: provide a repo to auto-discover, or an explicit override`,
    )
  }
  return verifyOverrideInstallation({ app, jwt, http: opts.http, base, override })
}
