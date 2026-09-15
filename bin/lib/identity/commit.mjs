/**
 * Commit-as-agent (AOS-ADR-027 Gap 0) — wire per-agent identity into the
 * commit / push / verdict path so each agent acts as its OWN bot, never the
 * operator. Vendored (VAN-60) from TicoAI/Agent_OS src/identity/commit.ts,
 * byte-faithful (types stripped).
 *
 * The integrity property this module enforces is **token-binding**: an agent can
 * only stamp `<agent>-…[bot]` onto a commit/push/review if it can mint that App's
 * installation token AND the token resolves to the registry's bot login (a `Bot`
 * user). The author identity is DERIVED here from the call-sign -> AGENT_APPS
 * entry -> GitHub-verified bot id; it is NEVER read from a caller-supplied field.
 */
import { getAgentApp } from './registry.mjs'
// Reuse the SAME pure request builders the workflow-level guard uses, so the
// primitive's author≠approver reads are byte-identical to the proven guard
// (verdict.mjs guardVerdict). No cycle: verdict.mjs never imports commit.mjs.
import { prLookupRequest, commitLookupRequest } from './verdict.mjs'

/**
 * The GitHub no-reply email for a bot. GitHub embeds the FULL login (including
 * the `[bot]` suffix) and the bot user's NUMERIC id.
 */
export function botNoReplyEmail(botLogin, botUserId) {
  return `${botUserId}+${botLogin}@users.noreply.github.com`
}

/** The bot's git identity: name = bot login, email = its no-reply address. */
export function botCommitIdentity(app, botUserId) {
  return { name: app.bot, email: botNoReplyEmail(app.bot, botUserId) }
}

/** Raised when the minted token does not resolve to the expected agent bot. */
export class BotIdentityError extends Error {
  constructor(message) {
    super(`token-binding: ${message}`)
    this.name = 'BotIdentityError'
  }
}

/**
 * Raised when a CODE commit is asked to be authored by a bot without explicit
 * intent (AOS-95). Code commits go out as the OPERATOR unless opted in with
 * `--as-bot`; push and review are agent-attributed by nature and unaffected.
 */
export class BotAttributionError extends Error {
  constructor(message) {
    super(`bot-attribution: ${message}`)
    this.name = 'BotAttributionError'
  }
}

/**
 * Raised when the review primitive is asked to post an APPROVE onto a PR the
 * acting bot itself authored (VAN-60 / Doc finding 5004247501). This is the
 * author≠approver check enforced AT THE POINT OF TOKEN USE — the last line of
 * defense, load-bearing on its own even if the workflow-level guard is bypassed.
 */
export class SelfApprovalError extends Error {
  constructor(message) {
    super(`author≠approver: ${message}`)
    this.name = 'SelfApprovalError'
  }
}

/**
 * Token-binding guard. The GitHub-resolved user for the registry's bot login MUST
 * be that exact login AND a `Bot` account with a numeric id — otherwise we refuse
 * to act. This is what makes a coordinator-supplied identity unable to impersonate
 * a bot: the identity used is the one the token authenticates as, verified against
 * the canonical registry entry, not anything passed in.
 */
export function assertBotIdentity(app, user) {
  if (!user) throw new BotIdentityError(`no GitHub user resolved for ${app.bot}`)
  if (typeof user.id !== 'number' || !Number.isInteger(user.id) || user.id <= 0)
    throw new BotIdentityError(`resolved user for ${app.bot} has no valid numeric id`)
  if (user.type !== 'Bot')
    throw new BotIdentityError(`resolved '${user.login}' is a ${user.type}, not a Bot — refusing to act as ${app.bot}`)
  if (user.login.toLowerCase() !== app.bot.toLowerCase())
    throw new BotIdentityError(`resolved '${user.login}' is not the expected bot ${app.bot}`)
}

/**
 * Git environment that pins BOTH author and committer to the bot. Returned as an
 * explicit map so the adapter OVERRIDES any inherited operator git config.
 */
export function commitEnv(identity) {
  return {
    GIT_AUTHOR_NAME: identity.name,
    GIT_AUTHOR_EMAIL: identity.email,
    GIT_COMMITTER_NAME: identity.name,
    GIT_COMMITTER_EMAIL: identity.email,
  }
}

/**
 * A one-shot, token-authenticated push URL. A push authenticated as the agent's
 * App (not the default `GITHUB_TOKEN`) is what TRIGGERS downstream CI. Used as an
 * argument to a single `git push`, never persisted into `.git/config`.
 */
export function tokenRemoteUrl(repo, token) {
  return `https://x-access-token:${token}@github.com/${repo}.git`
}

/**
 * The global git config key `actions/checkout` persists the workflow's default
 * `GITHUB_TOKEN` under: an `Authorization: basic …` header injected on every
 * request to github.com.
 */
export const GITHUB_EXTRAHEADER_KEY = 'http.https://github.com/.extraheader'

/**
 * Args for the one-shot, agent-token-authenticated push (Gap 0 fix, #80).
 * Prepending an EMPTY `-c http.https://github.com/.extraheader=` neutralizes the
 * inherited GITHUB_TOKEN header for THIS invocation only, leaving the URL-embedded
 * agent token as the sole credential.
 */
export function pushArgs(repo, token, ref) {
  return ['-c', `${GITHUB_EXTRAHEADER_KEY}=`, 'push', tokenRemoteUrl(repo, token), `HEAD:${ref}`]
}

/** `GET /users/{login}` to resolve the bot's numeric id + confirm it is a Bot. */
export function userLookupRequest(apiBase, login, token) {
  return {
    url: `${apiBase}/users/${encodeURIComponent(login)}`,
    method: 'GET',
    headers: { authorization: `token ${token}`, accept: 'application/vnd.github+json' },
  }
}

/**
 * A PR review submitted AS the agent's bot. This is the "verdict" leg: when
 * Dr. Insane reviews as `dr-insane-…[bot]` and the PR was pushed by
 * `adam-…[bot]`, author≠approver becomes real and the GA-5 sweeper can merge.
 */
export function reviewRequest(apiBase, repo, pr, event, body, token) {
  return {
    url: `${apiBase}/repos/${repo}/pulls/${pr}/reviews`,
    method: 'POST',
    headers: {
      authorization: `token ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ event, body }),
  }
}

/** Actions var name carrying an agent's App installation id, e.g. `ADAM` => `ADAM_APP_INSTALLATION_ID`. */
export function installationEnvVar(callSign) {
  const slug = callSign
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${slug}_APP_INSTALLATION_ID`
}

/**
 * Enforce author≠approver INSIDE the review primitive, at the point of token use
 * (VAN-60 / Doc finding 5004247501). The workflow-level guard (verdict.mjs
 * guardVerdict) remains as defense in depth; THIS is the primitive's own guard so
 * a caller reaching `actAsAgent` directly — bypassing the workflow's seven guards —
 * still cannot post an unguarded APPROVE as a gate bot.
 *
 * Semantics are byte-faithful to the proven guard: BOTH signals are checked — the
 * PR head-commit author AND the PR opener — case-insensitively. The acting bot
 * identity is already resolved fail-closed by `assertBotIdentity` upstream, so
 * `app.bot` is trusted here.
 *
 * FAIL-CLOSED on unknown: any read failure, a missing head SHA, or a PR that
 * exposes NO resolvable author (neither opener nor head-commit) REFUSES the
 * approve. The primitive never proceeds on an unresolved author and never assumes
 * the approver is distinct.
 */
export async function assertNotSelfApprove(app, pr, ports, ctx, token) {
  const prRes = await ports.http(prLookupRequest(ctx.apiBase, ctx.repo, pr, token))
  if (prRes.status !== 200)
    throw new SelfApprovalError(`PR #${pr} lookup failed: HTTP ${prRes.status} — refusing to APPROVE on an unresolved author`)
  const prJson = prRes.json ?? {}
  const prAuthorBot = prJson.user?.login ?? null
  const headSha = prJson.head?.sha
  if (!headSha)
    throw new SelfApprovalError(`PR #${pr} has no head SHA — refusing to APPROVE on an unresolved author`)

  const cRes = await ports.http(commitLookupRequest(ctx.apiBase, ctx.repo, headSha, token))
  if (cRes.status !== 200)
    throw new SelfApprovalError(`head commit ${headSha} lookup failed: HTTP ${cRes.status} — refusing to APPROVE on an unresolved author`)
  const headAuthorBot = cRes.json?.author?.login ?? null

  // Neither signal resolved → we cannot prove the approver is distinct from the
  // author. Refuse rather than assume distinct.
  if (prAuthorBot === null && headAuthorBot === null)
    throw new SelfApprovalError(`PR #${pr} exposes no resolvable author (neither opener nor head-commit) — refusing to APPROVE`)

  const approver = app.bot.toLowerCase()
  const offender = [headAuthorBot, prAuthorBot].find((l) => l !== null && l.toLowerCase() === approver)
  if (offender)
    throw new SelfApprovalError(`${app.bot} authored PR #${pr} (as ${offender}) — it cannot APPROVE its own work`)
}

/**
 * Run one command AS the named agent's bot. Sequence:
 *   1. resolve the registry App (identity gate — unknown call-sign throws);
 *   2. mint the agent's own 1h token (proves it controls the bot);
 *   3. resolve + verify the bot user (token-binding — `assertBotIdentity`);
 *   4. derive the bot git identity and perform the side effect.
 */
export async function actAsAgent(cmd, ports, ctx) {
  // AOS-95: a code commit is the OPERATOR's by default — refuse to bot-stamp it
  // without explicit `--as-bot` intent, BEFORE any token mint or side effect.
  if (cmd.kind === 'commit' && !cmd.asBot)
    throw new BotAttributionError(
      'code commits go out as the operator — refusing to author as a bot without explicit --as-bot intent',
    )

  const app = getAgentApp(cmd.callSign)
  const token = await ports.mintToken(app.callSign)
  ports.mask(token)

  const res = await ports.http(userLookupRequest(ctx.apiBase, app.bot, token))
  if (res.status !== 200) throw new BotIdentityError(`identity lookup for ${app.bot} failed: HTTP ${res.status}`)
  const user = res.json
  assertBotIdentity(app, user)
  const identity = botCommitIdentity(app, user.id)

  switch (cmd.kind) {
    case 'commit': {
      ports.git(['add', ...(cmd.paths.length > 0 ? cmd.paths : ['-A'])], {})
      ports.git(['commit', '-m', cmd.message], commitEnv(identity))
      break
    }
    case 'push': {
      ports.git(pushArgs(ctx.repo, token, cmd.ref), {})
      break
    }
    case 'review': {
      // author≠approver enforced HERE, before the token posts anything (VAN-60 /
      // Doc finding). Only APPROVE is gated — a bot may COMMENT/REQUEST_CHANGES on
      // its own PR. Fail-closed: throws (posts nothing) on self-approval or an
      // unresolved author.
      if (cmd.event === 'APPROVE') await assertNotSelfApprove(app, cmd.pr, ports, ctx, token)
      const r = await ports.http(reviewRequest(ctx.apiBase, ctx.repo, cmd.pr, cmd.event, cmd.body, token))
      if (r.status >= 300) throw new Error(`review submit for ${app.bot} failed: HTTP ${r.status}`)
      break
    }
  }
  return { agent: app.callSign, bot: app.bot, identity, action: cmd.kind }
}

/**
 * Parse `bin/commit-as-agent.mjs` argv into a typed command. Rejects any attempt
 * to supply an author/committer (`--author`/`--committer`) — identity is
 * token-derived, never caller-supplied (the token-binding contract).
 */
export function parseCommand(argv) {
  if (argv.includes('--author') || argv.includes('--committer'))
    throw new Error('commit-as-agent: author/committer are token-derived, not caller-supplied — refused')

  const sub = argv[0]
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i !== -1 ? argv[i + 1] : undefined
  }
  const agent = flag('agent')
  if (!agent) throw new Error('commit-as-agent: --agent <CallSign> is required')

  switch (sub) {
    case 'commit': {
      const mShort = argv.indexOf('-m')
      const message = flag('message') ?? (mShort !== -1 ? argv[mShort + 1] : undefined)
      if (!message) throw new Error('commit-as-agent commit: --message <msg> is required')
      const sep = argv.indexOf('--')
      const paths = sep !== -1 ? argv.slice(sep + 1) : []
      const asBot = argv.includes('--as-bot')
      return { kind: 'commit', callSign: agent, message, paths, asBot }
    }
    case 'push': {
      const ref = flag('ref')
      if (!ref) throw new Error('commit-as-agent push: --ref <branch> is required')
      return { kind: 'push', callSign: agent, ref }
    }
    case 'review': {
      const prRaw = flag('pr')
      const event = flag('event')
      const body = flag('body') ?? ''
      const pr = Number(prRaw)
      if (!prRaw || !Number.isInteger(pr) || pr <= 0)
        throw new Error('commit-as-agent review: --pr <number> is required')
      if (event !== 'APPROVE' && event !== 'REQUEST_CHANGES' && event !== 'COMMENT')
        throw new Error('commit-as-agent review: --event APPROVE|REQUEST_CHANGES|COMMENT is required')
      return { kind: 'review', callSign: agent, pr, event, body }
    }
    default:
      throw new Error(`commit-as-agent: unknown subcommand '${sub}' (expected commit|push|review)`)
  }
}
