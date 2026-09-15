/**
 * Audit primitives — the pure hashing + canonicalization used by the verdict
 * audit trail. Vendored (VAN-60) from TicoAI/Agent_OS src/memory/worm.ts, subset
 * to exactly the two functions verdict.mjs imports (`sha256`, `canonicalize`) and
 * their key-stable helper. Byte-faithful to the source; the WormLog class and the
 * HMAC chain machinery are intentionally NOT vendored — the verdict path only
 * needs content hashing for the SHA-256-stamped WORM audit line.
 */
import { createHash } from 'node:crypto'

/** SHA-256 hex of a UTF-8 string. */
export function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/**
 * Canonical JSON with stably-sorted keys — so the hash of a record is independent
 * of object key insertion order.
 */
export function canonicalize(value) {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key])
    }
    return out
  }
  return value
}
