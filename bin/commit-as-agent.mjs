#!/usr/bin/env node
/**
 * AOS-ADR-027 Gap 0 — Commit-as-agent. Make one git/PR action happen as the named
 * agent's OWN bot, never the operator. Vendored (VAN-60) from TicoAI/Agent_OS
 * bin/commit-as-agent.mjs; the only change is the import path
 * (./lib/identity/index.mjs — Vantage has no TS build). In the verdict workflow it
 * is invoked only as:
 *
 *   node bin/commit-as-agent.mjs review --agent "Dr. Insane" --pr 12 \
 *        --event APPROVE|REQUEST_CHANGES|COMMENT --body "verdict"
 *
 * Token-bound by construction: the identity is DERIVED from the call-sign + the
 * minted token's verified bot user — there is NO `--author`/`--committer` flag
 * (both are refused), so a coordinator cannot impersonate a bot.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { actAsAgent, parseCommand, installationEnvVar } from './lib/identity/index.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com'

/** owner/repo from $GITHUB_REPOSITORY (CI) or the origin remote (local). */
function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  const m = url.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?$/)
  if (!m) throw new Error(`commit-as-agent: cannot derive owner/repo from origin '${url}'`)
  return m[1]
}

const ports = {
  // Mint the agent's 1h token via the single sanctioned path. The token is written
  // to a private GITHUB_OUTPUT temp file (never to argv/stdout); the child masks it
  // in logs and we propagate that mask line.
  async mintToken(callSign) {
    const dir = mkdtempSync(join(tmpdir(), 'caa-'))
    const outFile = join(dir, 'github_output')
    try {
      const installationId =
        process.env[installationEnvVar(callSign)] || process.env.AGENT_INSTALLATION_ID || ''
      const out = execFileSync('node', [join(here, 'get-agent-token.mjs')], {
        encoding: 'utf8',
        env: {
          ...process.env,
          AGENT_CALLSIGN: callSign,
          AGENT_INSTALLATION_ID: installationId,
          GITHUB_OUTPUT: outFile,
        },
      })
      if (out) process.stdout.write(out) // forwards `::add-mask::` so the token stays masked
      const line = readFileSync(outFile, 'utf8')
        .split('\n')
        .find((l) => l.startsWith('token='))
      if (!line) throw new Error('get-agent-token produced no token')
      return line.slice('token='.length)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  },

  async http(req) {
    const r = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
    return { status: r.status, json: await r.json().catch(() => ({})) }
  },

  git(args, env) {
    execFileSync('git', args, { stdio: 'inherit', env: { ...process.env, ...env } })
  },

  mask(secret) {
    console.log(`::add-mask::${secret}`)
  },
}

try {
  const cmd = parseCommand(process.argv.slice(2))
  const result = await actAsAgent(cmd, ports, { apiBase, repo: resolveRepo() })
  console.log(
    `[commit-as-agent] ${result.action} as ${result.bot} (author=${result.identity.name} <${result.identity.email}>)`,
  )
  process.exit(0)
} catch (err) {
  console.error(`[commit-as-agent] ${err.message}`)
  process.exit(1)
}
