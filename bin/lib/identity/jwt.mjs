/**
 * GitHub App JWT construction + RS256 signing (ADR-008). Vendored (VAN-60) from
 * TicoAI/Agent_OS src/identity/jwt.ts, byte-faithful. The private key PEM is
 * passed in by the caller (a provisioned secret) and never stored or logged here.
 */
import { createSign } from 'node:crypto'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

/**
 * Build App JWT claims: backdate iat by 60s (clock-skew tolerance) and set exp
 * to now + 600s — the 10-minute GitHub maximum for an App JWT.
 */
export function buildAppJwtClaims(appId, nowSec) {
  return { iat: nowSec - 60, exp: nowSec + 600, iss: appId }
}

/** Create an RS256 App-JWT signer bound to a private key PEM. */
export function makeRs256Signer(privateKeyPem) {
  return (claims) => {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = base64url(JSON.stringify(claims))
    const signingInput = `${header}.${payload}`
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(privateKeyPem)
      .toString('base64url')
    return `${signingInput}.${signature}`
  }
}
