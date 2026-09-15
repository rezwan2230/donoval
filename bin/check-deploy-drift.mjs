#!/usr/bin/env node
/**
 * check-deploy-drift — answer "is what visitors see the same as what main says?"
 * without anybody opening the Actions tab by hand.
 *
 * WHY THIS EXISTS (ADAM-DEPLOY-DRIFT-R3)
 *   Production deploys for `donovan-site` happen ONLY on a manual
 *   workflow_dispatch of deploy-pages.yml on main with confirm=deploy-production.
 *   Every other run of that workflow — including a plain `push` to main — still
 *   finishes GREEN, because the `production` job's `if:` simply does not match and
 *   GitHub records the job as *skipped*. So "the newest successful deploy-pages run
 *   on main" is NOT the same question as "the newest production deploy", and a
 *   handoff document that guesses wrong (it asserted run 258 when 276 was live)
 *   sends a whole session chasing a fix that already shipped.
 *
 *   The discriminator is the production JOB's own conclusion, which the Actions
 *   API does expose:
 *     GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs
 *       -> jobs[] { name, status, conclusion }
 *   A real deploy is conclusion === 'success'; a run that skipped the deploy is
 *   conclusion === 'skipped'. Live proof at authoring time: run 273 (push to main)
 *   is overall `success` with production `skipped`, while run 276 (dispatch,
 *   confirm=deploy-production) is production `success`.
 *
 * WHAT COUNTS AS DRIFT
 *   Only commits that touch `donovan-legal-site/` change what a visitor loads.
 *   Commits to docs, tests, infra or bin can sit unshipped forever and nobody
 *   sees a difference. So the exit code keys on site-affecting commits alone;
 *   non-site commits are reported but do not fail the check.
 *
 * SCOPE LIMIT — read this before trusting a green result
 *   This compares GIT REFS via the GitHub API. It proves "the commit production
 *   was built from" vs "main HEAD". It does NOT fetch the site, so it cannot see
 *   edge-level divergence: the apex host donovan.law is known to serve different
 *   content from www.donovan.law. A green result here means main and the last
 *   production build agree, NOT that both hostnames serve that build.
 *
 * THE PER-COMMIT FILE CAP (ADAM-DEPLOY-DRIFT-R4)
 *   GET /repos/{owner}/{repo}/commits/{sha} returns at most 300 entries in
 *   `files[]`. There is NO field in the JSON body that says so — measured
 *   2026-08-04 against the Linux initial-import commit (1da177e, ~17k files):
 *   `files.length` is exactly 300, `stats.total` counts LINES not files, and no
 *   `total_files` / `truncated` / `incomplete` key exists anywhere in the body.
 *
 *   That silence is the danger. A single commit touching more than 300 files
 *   whose donovan-legal-site/ entries sort past the cutoff reads as non-site,
 *   the report says "none that visitors can see", and the tool exits 0 — the
 *   exact false all-clear this check exists to prevent.
 *
 *   The API does expose the signal, just not in the body: the same measurement
 *   returned `Link: <...page=2>; rel="next", <...page=10>; rel="last"`. So we
 *   guard twice, and either one alone is enough to fail closed:
 *     1. files.length >= 300 — the boundary itself, works on any transport.
 *     2. Link rel="next"    — explicit, and survives GitHub moving the cap.
 *   Guard 1 is deliberately `>=`, not `>`: a commit of EXACTLY 300 files is
 *   indistinguishable from a truncated one by count alone, and "cannot tell"
 *   must resolve to exit 2, never to exit 0.
 *
 * EXIT CODES
 *   0  main and production match, or the only unshipped commits are non-site.
 *   1  site-affecting drift: visitors are seeing an older donovan-legal-site.
 *   2  the check could not be completed (no token, no deploy found, truncated
 *      comparison, truncated per-commit file list). Fails closed — an
 *      unanswerable check is never "no drift".
 *
 * USAGE
 *   GITHUB_TOKEN=... node bin/check-deploy-drift.mjs [--json]
 */

import { pathToFileURL } from 'node:url';

const API = process.env.GITHUB_API_URL || 'https://api.github.com';

export const DEFAULT_REPO = 'TicoAI/DonovanLegal';
export const DEFAULT_WORKFLOW = 'deploy-pages.yml';
export const DEFAULT_BRANCH = 'main';
export const SITE_PREFIX = 'donovan-legal-site/';

/**
 * The production job is matched by name prefix rather than exact string so a
 * cosmetic rename ("Deploy PRODUCTION (manual, main only)") does not silently
 * turn this check into a no-op. If NO job matches, we refuse to call the run a
 * deploy — see productionJobOutcome.
 */
export const PRODUCTION_JOB_PATTERN = /^deploy\s+production/i;

/** How many per-commit file listings we are willing to fetch before bailing. */
export const MAX_COMMITS_INSPECTED = 100;

/**
 * GitHub's hard cap on `files[]` in a single-commit response. Reaching it means
 * "there may be more", never "there were exactly this many" — see the header
 * comment. Treated as a truncation signal in its own right.
 */
export const MAX_COMMIT_FILES = 300;

/** Workflow-run listing pagination (see listDispatchRuns). */
export const RUN_PAGE_SIZE = 100;
export const MAX_RUN_PAGES = 5;

/**
 * The one caveat every single report must carry, on every path — including the
 * top-level failure path, which is exactly where an operator is most likely to
 * go looking for a second opinion and least likely to be told the check never
 * looked at a hostname at all.
 */
export const SCOPE_LIMIT_LINES = [
  'Scope limit: this compares git refs only. It does not fetch the site, so it cannot',
  'see edge divergence — donovan.law and www.donovan.law are known to serve different',
  'content, and neither hostname was checked here.',
];

export const SCOPE_LIMIT_NOTE = SCOPE_LIMIT_LINES.join(' ');

/**
 * Classify a run's job list with respect to "did the production deploy run?".
 *
 * Returns one of:
 *   { deployed: true,  reason }                       - the deploy actually ran and succeeded
 *   { deployed: false, reason, conclusion, found }     - it skipped / failed / is absent
 *
 * Fail-closed on `found: false`: a run whose job list contains no production job
 * at all is not evidence of a deploy, it is evidence the workflow changed shape.
 */
export function productionJobOutcome(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const job = list.find((j) => PRODUCTION_JOB_PATTERN.test(String(j?.name ?? '').trim()));
  if (!job) {
    return {
      deployed: false,
      found: false,
      conclusion: null,
      reason: 'no job matching /^deploy production/i in this run',
    };
  }
  const status = String(job.status ?? '');
  const conclusion = job.conclusion === null || job.conclusion === undefined ? null : String(job.conclusion);
  if (status !== 'completed') {
    return { deployed: false, found: true, conclusion, reason: `production job is ${status}, not completed` };
  }
  if (conclusion !== 'success') {
    // 'skipped' is the important one: the confirm input was wrong, or the event
    // was a push, so the `if:` gate never matched and NOTHING was deployed.
    return { deployed: false, found: true, conclusion, reason: `production job concluded ${conclusion}` };
  }
  return { deployed: true, found: true, conclusion, reason: 'production job completed successfully' };
}

/** Is this run even a candidate: a completed manual dispatch on the target branch? */
export function isProductionDispatchCandidate(run, branch = DEFAULT_BRANCH) {
  return (
    run?.event === 'workflow_dispatch' &&
    run?.head_branch === branch &&
    String(run?.status ?? '') === 'completed'
  );
}

/**
 * Walk runs newest-first and return the first one whose production job really ran.
 *
 * @param {object[]} runs      workflow runs (any order; sorted here defensively)
 * @param {(runId:number)=>Promise<object[]>} listJobs  job fetcher for one run
 * @returns {Promise<{run, examined}|{run:null, examined}>}
 */
export async function findLastProductionDeploy({ runs, listJobs, branch = DEFAULT_BRANCH }) {
  const candidates = (Array.isArray(runs) ? runs : [])
    .filter((r) => isProductionDispatchCandidate(r, branch))
    .sort((a, b) => (b.run_number ?? 0) - (a.run_number ?? 0));

  const examined = [];
  for (const run of candidates) {
    const outcome = productionJobOutcome(await listJobs(run.id));
    examined.push({ run_number: run.run_number, id: run.id, head_sha: run.head_sha, ...outcome });
    if (outcome.deployed) return { run, examined };
  }
  return { run: null, examined };
}

/** Does this commit's file list touch the shipped site? */
export function isSiteCommit(files, prefix = SITE_PREFIX) {
  return (Array.isArray(files) ? files : []).some((f) => {
    const p = String(f?.filename ?? '');
    // A rename moves a file out of / into the site; both change what ships.
    const prev = String(f?.previous_filename ?? '');
    return p.startsWith(prefix) || prev.startsWith(prefix);
  });
}

/**
 * Turn the raw comparison into a verdict plus plain-English text.
 *
 * @param {object} input
 * @param {string} input.deployedSha    commit production was built from
 * @param {string} input.headSha        current branch HEAD
 * @param {object} input.deployRun      {run_number, id, html_url, created_at}
 * @param {object[]} input.commits      [{sha, message, files}] oldest-first, exclusive of deployedSha
 * @param {string[]} [input.warnings]   completeness problems; any warning fails closed
 */
export function buildReport({
  deployedSha,
  headSha,
  deployRun = {},
  commits = [],
  warnings = [],
  branch = DEFAULT_BRANCH,
  prefix = SITE_PREFIX,
}) {
  const short = (s) => String(s ?? '').slice(0, 7);
  const subject = (m) => String(m ?? '').split('\n')[0].trim();

  const classified = commits.map((c) => ({
    sha: c.sha,
    subject: subject(c.message),
    site: isSiteCommit(c.files, prefix),
  }));
  const siteCommits = classified.filter((c) => c.site);
  const otherCommits = classified.filter((c) => !c.site);

  const matched = String(deployedSha) === String(headSha);
  const runLabel = deployRun.run_number ? `run ${deployRun.run_number}` : 'the last production deploy';

  const L = [];
  let exitCode;
  let verdict;

  if (warnings.length) {
    // An incomplete comparison must not be reported as "no drift".
    exitCode = 2;
    verdict = 'UNKNOWN';
    L.push('DEPLOY DRIFT: UNKNOWN — the comparison could not be completed.');
    L.push('');
    for (const w of warnings) L.push(`  ! ${w}`);
    L.push('');
    L.push('Treat this as "not verified", not as "no drift".');
  } else if (matched) {
    exitCode = 0;
    verdict = 'NONE';
    L.push('DEPLOY DRIFT: none.');
    L.push('');
    L.push(`Production was built from ${short(deployedSha)} by ${runLabel}, and ${branch} HEAD is the`);
    L.push(`same commit. Nothing is waiting to be deployed.`);
  } else if (siteCommits.length === 0) {
    exitCode = 0;
    verdict = 'NON-SITE-ONLY';
    L.push(`DEPLOY DRIFT: none that visitors can see (${otherCommits.length} unshipped commit(s), all outside ${prefix}).`);
    L.push('');
    L.push(`Production was built from ${short(deployedSha)} by ${runLabel}; ${branch} HEAD is ${short(headSha)}.`);
    L.push(`The commits in between do not touch ${prefix}, so the live site is byte-for-byte`);
    L.push('what the newest code would produce. No deploy is needed to fix what people see.');
    L.push('');
    L.push('Unshipped, non-visitor-facing:');
    for (const c of otherCommits) L.push(`  ${short(c.sha)}  ${c.subject}`);
  } else {
    exitCode = 1;
    verdict = 'SITE-AFFECTING';
    const n = siteCommits.length;
    L.push(
      `DEPLOY DRIFT: visitors are seeing an OLD site. ${n} unshipped commit(s) change ${prefix}.`
    );
    L.push('');
    L.push(`Production was built from ${short(deployedSha)} by ${runLabel}.`);
    L.push(`${branch} HEAD is ${short(headSha)}, ${commits.length} commit(s) ahead.`);
    L.push('');
    L.push(`Site-affecting — these are the ones people actually load:`);
    for (const c of siteCommits) L.push(`  ${short(c.sha)}  ${c.subject}`);
    if (otherCommits.length) {
      L.push('');
      L.push('Also unshipped, but not visitor-facing:');
      for (const c of otherCommits) L.push(`  ${short(c.sha)}  ${c.subject}`);
    }
    L.push('');
    L.push('To ship: run deploy-pages.yml via workflow_dispatch on main with');
    L.push('confirm = deploy-production. Nothing else deploys production.');
  }

  L.push('');
  L.push(...SCOPE_LIMIT_LINES);

  return {
    verdict,
    exitCode,
    drift: !matched,
    siteAffecting: siteCommits.length > 0,
    deployedSha,
    headSha,
    deployRun,
    siteCommits,
    otherCommits,
    warnings,
    scopeLimit: SCOPE_LIMIT_NOTE,
    summary: L.join('\n'),
  };
}

/**
 * The report for "the check itself blew up before it could compare anything".
 *
 * Shaped like buildReport's output on purpose: same verdict/exitCode/scopeLimit/
 * summary fields, so a consumer reading either output mode finds the caveat in
 * the same place it always is. Previously this path printed neither.
 */
export function buildFailureReport(message) {
  const summary = [
    'DEPLOY DRIFT: UNKNOWN — the check could not run.',
    `  ! ${message}`,
    'Treat this as "not verified", not as "no drift".',
    '',
    ...SCOPE_LIMIT_LINES,
  ].join('\n');

  return {
    verdict: 'UNKNOWN',
    exitCode: 2,
    error: String(message),
    scopeLimit: SCOPE_LIMIT_NOTE,
    summary,
  };
}

/* ------------------------------------------------------------------ *
 * Live GitHub plumbing. Everything above is pure and unit-tested.
 * ------------------------------------------------------------------ */

/** Does a Link header advertise another page? `rel="next"` is the only tell. */
export function hasNextPage(linkHeader) {
  return /<[^>]*>\s*;\s*rel="next"/i.test(String(linkHeader ?? ''));
}

export function makeGitHub({ token, repo = DEFAULT_REPO, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error('GITHUB_TOKEN is not set — refusing to guess (fail-closed).');
  const raw = async (path) => {
    const res = await fetchImpl(`${API}/${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'check-deploy-drift',
      },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} on /${path}`);
    // Headers carry the pagination truth the JSON body omits entirely.
    return { body: await res.json(), link: res.headers?.get?.('link') ?? null };
  };
  const get = (path) => raw(path).then((r) => r.body);
  return {
    /**
     * Walk the dispatch-run listing instead of taking the first 50. The old cap
     * silently bounded how far back "the last production deploy" could be found:
     * 50 dispatches with no successful production job read the same as no deploy
     * ever happening. Bounded by MAX_RUN_PAGES so a pathological repo cannot
     * spin here; checkDeployDrift reports how far it actually looked.
     */
    listDispatchRuns: async (workflow = DEFAULT_WORKFLOW, branch = DEFAULT_BRANCH) => {
      const all = [];
      for (let page = 1; page <= MAX_RUN_PAGES; page += 1) {
        const d = await get(
          `repos/${repo}/actions/workflows/${workflow}/runs` +
            `?event=workflow_dispatch&branch=${branch}&per_page=${RUN_PAGE_SIZE}&page=${page}`
        );
        const batch = d.workflow_runs ?? [];
        all.push(...batch);
        if (batch.length < RUN_PAGE_SIZE) break;
      }
      return all;
    },
    listJobs: (runId) =>
      get(`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`).then((d) => d.jobs ?? []),
    headSha: (branch = DEFAULT_BRANCH) =>
      get(`repos/${repo}/commits/${branch}`).then((d) => d.sha),
    compare: (base, head) => get(`repos/${repo}/compare/${base}...${head}?per_page=100`),
    /**
     * `filesTruncated` is the header-derived signal. It is additive: callers
     * that never see it still fail closed on the 300-entry boundary.
     */
    commit: (sha) =>
      raw(`repos/${repo}/commits/${sha}`).then((r) => ({
        ...r.body,
        filesTruncated: hasNextPage(r.link),
      })),
  };
}

export async function checkDeployDrift({ gh, branch = DEFAULT_BRANCH, prefix = SITE_PREFIX }) {
  const runs = await gh.listDispatchRuns(DEFAULT_WORKFLOW, branch);
  const { run, examined } = await findLastProductionDeploy({ runs, listJobs: gh.listJobs, branch });

  if (!run) {
    return buildReport({
      deployedSha: null,
      headSha: await gh.headSha(branch).catch(() => null),
      commits: [],
      branch,
      prefix,
      warnings: [
        `No production deploy found. Examined ${examined.length} manual dispatch run(s) on ` +
          `${branch} (out of ${runs.length} listed, up to ${MAX_RUN_PAGES * RUN_PAGE_SIZE}); ` +
          `none had a production job that completed successfully. A deploy older than the ` +
          `run-retention horizon cannot be seen from the Actions API at all.`,
      ],
    });
  }

  const deployedSha = run.head_sha;
  const headSha = await gh.headSha(branch);
  const deployRun = {
    run_number: run.run_number,
    id: run.id,
    html_url: run.html_url,
    created_at: run.created_at,
  };

  if (deployedSha === headSha) {
    return buildReport({ deployedSha, headSha, deployRun, commits: [], branch, prefix });
  }

  const cmp = await gh.compare(deployedSha, headSha);
  const warnings = [];
  const listed = cmp.commits ?? [];
  const total = cmp.total_commits ?? listed.length;

  if (listed.length < total) {
    // The compare endpoint caps at 250 commits. Say so instead of reporting a
    // partial list as if it were the whole range.
    warnings.push(
      `Comparison truncated: GitHub returned ${listed.length} of ${total} commits between ` +
        `${String(deployedSha).slice(0, 7)} and ${String(headSha).slice(0, 7)}.`
    );
  }
  if (listed.length > MAX_COMMITS_INSPECTED) {
    warnings.push(
      `Range is ${listed.length} commits, above the ${MAX_COMMITS_INSPECTED}-commit inspection ` +
        `limit; per-commit file lists were not fetched.`
    );
  }

  if (warnings.length) {
    return buildReport({ deployedSha, headSha, deployRun, commits: [], branch, prefix, warnings });
  }

  // Per-commit file lists: the compare payload's aggregate `files` cannot tell us
  // WHICH commit touched the site, and Task 2 needs the flag per commit.
  //
  // This is the second truncation frontier, and it is quieter than the compare
  // one: `files[]` stops at 300 with nothing in the body admitting it. A commit
  // past that cap whose donovan-legal-site/ paths fall after the cutoff would be
  // classified non-site and exit 0. Same fail-closed rule as the compare guard.
  const commits = [];
  const fileWarnings = [];
  for (const c of listed) {
    const full = await gh.commit(c.sha);
    const files = full.files ?? [];
    const atCap = files.length >= MAX_COMMIT_FILES;
    const headerSaysMore = full.filesTruncated === true;
    if (atCap || headerSaysMore) {
      // The two guards fire independently, so the SENTENCE has to be assembled
      // the same way. The Link-header guard can fire well below the boundary —
      // GitHub is free to move the cap, and the header is the signal that
      // survives that — and the old string then read "returned 5 file(s), at or
      // above the 300-file per-commit API cap", contradicting its own count in
      // the same breath. An operator who spots the contradiction stops trusting
      // the warning, which is the one thing standing between them and a false
      // all-clear. So the cap clause now sits behind the condition that makes it
      // true, and the count is stated once, unconditionally, as a fact.
      const reasons = [];
      if (atCap) reasons.push(`that is at or above the ${MAX_COMMIT_FILES}-file per-commit API cap`);
      if (headerSaysMore) reasons.push('the Link header advertises another page');
      fileWarnings.push(
        `Commit ${String(c.sha).slice(0, 7)} returned ${files.length} file(s); ` +
          `${reasons.join(', and ')}. The file list is truncated, so a ${prefix} path could sit ` +
          `past the cutoff and be read as non-site. Not classified.`
      );
    }
    commits.push({ sha: c.sha, message: c.commit?.message ?? '', files });
  }

  if (fileWarnings.length) {
    return buildReport({
      deployedSha,
      headSha,
      deployRun,
      commits: [],
      branch,
      prefix,
      warnings: fileWarnings,
    });
  }

  return buildReport({ deployedSha, headSha, deployRun, commits, branch, prefix });
}

async function main() {
  const json = process.argv.includes('--json');
  let report;
  try {
    const gh = makeGitHub({ token: process.env.GITHUB_TOKEN });
    report = await checkDeployDrift({ gh });
  } catch (err) {
    // The failure path carries the scope-limit caveat too. It used to print in
    // neither mode, while the docs claimed every report carried it — so the one
    // report an operator reads while already unsure was the one that never said
    // no hostname had been checked.
    const failure = buildFailureReport(err.message);
    if (json) console.log(JSON.stringify(failure, null, 2));
    else console.error(failure.summary);
    process.exit(failure.exitCode);
  }
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(report.summary);
  process.exit(report.exitCode);
}

// Only run when invoked directly, so the test file can import the pure helpers.
// pathToFileURL (not string concat) — argv[1] is a backslash path on Windows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
