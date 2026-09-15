#!/usr/bin/env node
/**
 * agent-verdict — guard + audit glue for the verdict-emission-in-CI workflow.
 * Vendored (VAN-60) from TicoAI/Agent_OS bin/agent-verdict.mjs; the only change is
 * the import path (./lib/identity/index.mjs — Vantage has no TS build).
 *
 * Two subcommands:
 *
 *   guard --agent "<CallSign>" --pr <n> --event <APPROVE|REQUEST_CHANGES|COMMENT>
 *       Mints the named GATE agent's OWN 1h token (keyless/WIF), reads the PR +
 *       head commit WITH THAT TOKEN (never GITHUB_TOKEN), and enforces the
 *       integrity guards fail-closed: gate-agent allowlist, event enum, PR OPEN,
 *       and author≠approver on APPROVE. On any violation it exits non-zero and
 *       posts NOTHING. On success it writes bot/head_sha/author logins to
 *       $GITHUB_OUTPUT for the audit step.
 *
 *   audit --actor <a> --agent <A> --bot <b> --pr <n> --event <E> --head-sha <s> --ts <iso>
 *       Emits the canonical, SHA-256-stamped WORM audit line.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  guardVerdict,
  verdictAuditLine,
  verdictSuppressedAuditLine,
  installationEnvVar,
} from './lib/identity/index.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com'

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

/** owner/repo from $GITHUB_REPOSITORY (CI) or the origin remote (local). */
function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  const m = url.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?$/)
  if (!m) throw new Error(`agent-verdict: cannot derive owner/repo from origin '${url}'`)
  return m[1]
}

/** Mint the agent's 1h token via the single sanctioned path (same as commit-as-agent). */
function mintToken(callSign) {
  const dir = mkdtempSync(join(tmpdir(), 'av-'))
  const outFile = join(dir, 'github_output')
  try {
    const installationId =
      process.env[installationEnvVar(callSign)] || process.env.AGENT_INSTALLATION_ID || ''
    const out = execFileSync('node', [join(here, 'get-agent-token.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, AGENT_CALLSIGN: callSign, AGENT_INSTALLATION_ID: installationId, GITHUB_OUTPUT: outFile },
    })
    if (out) process.stdout.write(out) // forward `::add-mask::` so the token stays masked
    const line = readFileSync(outFile, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('token='))
    if (!line) throw new Error('get-agent-token produced no token')
    return line.slice('token='.length)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const http = async (req) => {
  const r = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

async function runGuard() {
  const agent = arg('agent')
  const pr = Number(arg('pr'))
  const event = arg('event')
  if (!agent || !event || !Number.isFinite(pr)) {
    throw new Error('guard: --agent <CallSign> --pr <number> --event <APPROVE|REQUEST_CHANGES|COMMENT> required')
  }
  const token = mintToken(agent)
  console.log(`::add-mask::${token}`)
  const decision = await guardVerdict({ agent, pr, event, body: '' }, { http }, { apiBase, repo: resolveRepo(), token })
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `bot=${decision.bot}\nhead_sha=${decision.headSha}\nhead_author_bot=${decision.headAuthorBot ?? ''}\n` +
        `pr_author_bot=${decision.prAuthorBot ?? ''}\nduplicate=${decision.duplicate}\n`,
    )
  }

  // Idempotency (AOS-153): the bot already has this exact verdict at this head.
  // Skip emission (a no-op) and audit the suppression. The workflow gates the
  // emit/audit steps on `duplicate != 'true'`.
  if (decision.duplicate) {
    const line = verdictSuppressedAuditLine({
      actor: process.env.ACTOR || process.env.GITHUB_ACTOR || 'unknown',
      agent: decision.agent,
      bot: decision.bot,
      pr: decision.pr,
      event: decision.event,
      headSha: decision.headSha,
      ts: new Date().toISOString(),
    })
    console.log(`[agent-verdict][audit] ${line}`)
    console.log(
      `[agent-verdict] duplicate-suppressed — ${decision.bot} already ${decision.event} PR #${decision.pr} ` +
        `at head ${decision.headSha.slice(0, 7)}; no second review created`,
    )
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### agent-verdict: duplicate-suppressed\n\n` +
          `\`${decision.bot}\` already has a **${decision.event}** review on PR #${decision.pr} at head ` +
          `\`${decision.headSha.slice(0, 7)}\` — no second review created.\n\n\`\`\`json\n${line}\n\`\`\`\n`,
      )
    }
    return
  }

  console.log(
    `[agent-verdict] guard PASS — ${decision.bot} may ${decision.event} PR #${decision.pr} ` +
      `(head ${decision.headSha.slice(0, 7)}; author ${decision.headAuthorBot ?? 'unknown'})`,
  )
}

function runAudit() {
  const fields = {
    actor: arg('actor') || 'unknown',
    agent: arg('agent'),
    bot: arg('bot'),
    pr: Number(arg('pr')),
    event: arg('event'),
    headSha: arg('head-sha'),
    ts: arg('ts'),
  }
  const line = verdictAuditLine(fields)
  console.log(`[agent-verdict][audit] ${line}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### agent-verdict emission\n\n\`\`\`json\n${line}\n\`\`\`\n`,
    )
  }
}

try {
  const sub = process.argv[2]
  if (sub === 'guard') await runGuard()
  else if (sub === 'audit') runAudit()
  else throw new Error(`agent-verdict: unknown subcommand '${sub}' (expected guard|audit)`)
  process.exit(0)
} catch (err) {
  console.error(`[agent-verdict] ${err.message}`)
  process.exit(1)
}
