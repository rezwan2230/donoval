/**
 * Verdict-emission guard + audit (EPIC-2A / Gap 0) — the pure, unit-tested core
 * behind the `agent-verdict` CI workflow. Vendored (VAN-60) from TicoAI/Agent_OS
 * src/identity/verdict.ts, byte-faithful (types stripped).
 *
 * A "verdict" only counts when it is a bot-authored PR review by a counterparty
 * GATE agent (Dr. Insane / Sarah). The workflow mints that agent's OWN token and
 * posts the review via `commit-as-agent` — but BEFORE any review is posted, this
 * guard enforces the integrity rules **fail-closed** (a violation throws; the emit
 * step never runs, so nothing is posted):
 *
 *   1. agent ∈ gate agents (scope: gate-verdict emission only);
 *   2. event ∈ {APPROVE, REQUEST_CHANGES, COMMENT};
 *   3. pr is a positive integer and the PR is OPEN;
 *   4. author≠approver — an APPROVE is refused when the verdict agent's bot is the
 *      PR head-commit author OR the PR opener.
 *
 * IDEMPOTENCY (AOS-153): before emitting, the guard READS the reviews already on
 * the PR and, if the target bot's LATEST review already has the requested event's
 * state AND was submitted against the current head SHA, marks the decision
 * `duplicate` — the caller then SKIPS emission. A reviews-read failure is
 * FAIL-CLOSED: it throws, exactly like the other integrity violations.
 *
 * All I/O is injected as an `http` port, so this is testable with no network.
 */
import { getAgentApp } from './registry.mjs'
import { canonicalize, sha256 } from './worm.mjs'

/** Decision C: verdict emission is restricted to the counterparty GATE agents. */
export const GATE_AGENTS = Object.freeze(['Dr. Insane', 'Sarah'])

/** The review verdicts a gate may emit. */
export const REVIEW_EVENTS = Object.freeze(['APPROVE', 'REQUEST_CHANGES', 'COMMENT'])

/** Raised on any guard violation. Fail-closed: the caller posts NOTHING. */
export class VerdictGuardError extends Error {
  constructor(message) {
    super(`verdict-guard: ${message}`)
    this.name = 'VerdictGuardError'
  }
}

export function isReviewEvent(x) {
  return REVIEW_EVENTS.includes(x)
}

/**
 * Resolve a gate agent's App identity, or throw. A non-gate or unknown call-sign
 * is refused here — the input allowlist lives at this seam, independent of the
 * workflow's `choice` dropdown.
 */
export function assertGateAgent(callSign) {
  if (!GATE_AGENTS.includes(callSign))
    throw new VerdictGuardError(`'${callSign}' is not a gate agent — only ${GATE_AGENTS.join(' | ')} may emit verdicts`)
  return getAgentApp(callSign)
}

/** `GET /repos/{repo}/pulls/{pr}` — PR state + head SHA + opener login. */
export function prLookupRequest(apiBase, repo, pr, token) {
  return {
    url: `${apiBase}/repos/${repo}/pulls/${pr}`,
    method: 'GET',
    headers: { authorization: `token ${token}`, accept: 'application/vnd.github+json' },
  }
}

/** `GET /repos/{repo}/commits/{sha}` — the head commit's linked author login. */
export function commitLookupRequest(apiBase, repo, sha, token) {
  return {
    url: `${apiBase}/repos/${repo}/commits/${sha}`,
    method: 'GET',
    headers: { authorization: `token ${token}`, accept: 'application/vnd.github+json' },
  }
}

/** `GET /repos/{repo}/pulls/{pr}/reviews` — the reviews already on the PR (idempotency readback). */
export function reviewsLookupRequest(apiBase, repo, pr, token) {
  return {
    url: `${apiBase}/repos/${repo}/pulls/${pr}/reviews`,
    method: 'GET',
    headers: { authorization: `token ${token}`, accept: 'application/vnd.github+json' },
  }
}

/**
 * A review `event` (what a client POSTs) maps to the `state` the reviews-read
 * surface reports for it. The idempotency check compares the requested event's
 * state against the target bot's latest review state.
 */
export const EVENT_TO_REVIEW_STATE = Object.freeze({
  APPROVE: 'APPROVED',
  REQUEST_CHANGES: 'CHANGES_REQUESTED',
  COMMENT: 'COMMENTED',
})

/**
 * Canonicalize a GitHub login for identity comparison — strip a trailing `[bot]`
 * and lowercase. Defensive against the `[bot]`-suffix drift that silently dropped
 * verdicts before.
 */
export function canonicalBotLogin(login) {
  return login.trim().toLowerCase().replace(/\[bot\]$/, '')
}

/**
 * The target bot's LATEST submitted review, or `null` if it has none. Logins are
 * canonicalized on both sides; the latest is chosen by `submitted_at`, with later
 * array position breaking ties.
 */
export function latestReviewFor(reviews, botLogin) {
  const canon = canonicalBotLogin(botLogin)
  let latest = null
  for (const r of reviews) {
    if (canonicalBotLogin(r.user?.login ?? '') !== canon) continue
    if (!latest || (r.submitted_at ?? '') >= (latest.submitted_at ?? '')) latest = r
  }
  return latest
}

/**
 * Validate one verdict-emission request and resolve the PR/author facts, throwing
 * (fail-closed) on any violation. Returns the decision the workflow audits.
 */
export async function guardVerdict(input, ports, ctx) {
  const app = assertGateAgent(input.agent)
  if (!isReviewEvent(input.event))
    throw new VerdictGuardError(`event '${input.event}' not in ${REVIEW_EVENTS.join('|')}`)
  if (!Number.isInteger(input.pr) || input.pr <= 0)
    throw new VerdictGuardError(`pr '${input.pr}' must be a positive integer`)

  const prRes = await ports.http(prLookupRequest(ctx.apiBase, ctx.repo, input.pr, ctx.token))
  if (prRes.status !== 200) throw new VerdictGuardError(`PR #${input.pr} lookup failed: HTTP ${prRes.status}`)
  const pr = prRes.json
  if (pr.state !== 'open') throw new VerdictGuardError(`PR #${input.pr} is '${pr.state ?? 'unknown'}', not open — refusing`)
  const headSha = pr.head?.sha
  if (!headSha) throw new VerdictGuardError(`PR #${input.pr} has no head SHA — refusing`)
  const prAuthorBot = pr.user?.login ?? null

  const cRes = await ports.http(commitLookupRequest(ctx.apiBase, ctx.repo, headSha, ctx.token))
  if (cRes.status !== 200) throw new VerdictGuardError(`head commit ${headSha} lookup failed: HTTP ${cRes.status}`)
  const headAuthorBot = cRes.json.author?.login ?? null

  if (input.event === 'APPROVE') {
    const approver = app.bot.toLowerCase()
    const offender = [headAuthorBot, prAuthorBot].find((l) => l !== null && l.toLowerCase() === approver)
    if (offender)
      throw new VerdictGuardError(
        `author≠approver: ${app.bot} authored PR #${input.pr} (as ${offender}) — it cannot APPROVE its own work`,
      )
  }

  // Idempotency readback (AOS-153): does this bot already have this exact verdict at
  // this head? A reviews-read failure is FAIL-CLOSED — we never emit on a blind read.
  const rRes = await ports.http(reviewsLookupRequest(ctx.apiBase, ctx.repo, input.pr, ctx.token))
  if (rRes.status !== 200)
    throw new VerdictGuardError(
      `reviews readback for PR #${input.pr} failed: HTTP ${rRes.status} — failing closed (no emission)`,
    )
  const latest = latestReviewFor(rRes.json ?? [], app.bot)
  const duplicate =
    !!latest && latest.state === EVENT_TO_REVIEW_STATE[input.event] && latest.commit_id === headSha

  return {
    agent: app.callSign,
    bot: app.bot,
    pr: input.pr,
    event: input.event,
    headSha,
    prAuthorBot,
    headAuthorBot,
    duplicate,
  }
}

/** Stamp the audit fields with a content hash. */
export function verdictAuditRecord(fields) {
  return { ...fields, hash: sha256(canonicalize(fields)) }
}

/** One canonical JSONL line for the WORM audit trail (the immutable Actions run log). */
export function verdictAuditLine(fields) {
  return canonicalize(verdictAuditRecord(fields))
}

/**
 * Stamp a `duplicate-suppressed` audit record — the WORM entry for a verdict that
 * was NOT emitted because an identical one already exists at this head. The hash
 * covers the `outcome` too, so a suppression cannot be forged into an emission.
 */
export function verdictSuppressedAuditRecord(fields) {
  const withOutcome = { ...fields, outcome: 'duplicate-suppressed' }
  return { ...withOutcome, hash: sha256(canonicalize(withOutcome)) }
}

/** One canonical JSONL line recording a `duplicate-suppressed` no-op for the WORM trail. */
export function verdictSuppressedAuditLine(fields) {
  return canonicalize(verdictSuppressedAuditRecord(fields))
}
