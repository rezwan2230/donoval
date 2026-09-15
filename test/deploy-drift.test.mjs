// Tests for bin/check-deploy-drift.mjs (ADAM-DEPLOY-DRIFT-R3).
//
// The defect these guard is NOT "the script crashes". It is "the script gives a
// confidently wrong answer" — which is exactly what happened by hand: a handoff
// asserted the last production deploy was run 258 when it was 276, and a session
// was spent re-fixing something already live.
//
// So each fixture below is built so that the RIGHT logic and the WRONG logic
// return DIFFERENT verdicts. Inverting a fixture flips the verdict rather than
// merely changing a message, which is what makes these tests load-bearing.
//
// The load-bearing case is the last one: a manual dispatch whose `production`
// job was SKIPPED (wrong confirm input) is still a GREEN run on main. If the
// check trusts run-level success it will read that run's SHA as "what is live"
// and report no drift while visitors sit on an older site.
//
// ── SCOPE OF THIS FILE (ADAM-TEST-SCOPE-R1) ──────────────────────────────────
// Behavioural only. Every test here DRIVES bin/check-deploy-drift.mjs and reads
// what it returned; none of them read a file to compare it against another file.
//
// That matters because `npm test` is the test job of deploy-pages.yml and the
// `production` job declares `needs: [test, guard]`, so anything reachable from
// here is a precondition for deploying the live site. The docs-record assertion
// that used to close this file — the four-backtick YAML block in
// docs/deploy-drift-workflow.md matched byte for byte against the workflow —
// is not a statement about the site, and it made editing the cron without
// mirroring it into docs/ a production-deploy blocker. It moved, intact and with
// two mutation bites added, to hygiene/deploy-drift-record.test.mjs, which runs
// under `npm run test:hygiene` in ci.yml and gates pull requests only.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  checkDeployDrift,
  findLastProductionDeploy,
  productionJobOutcome,
  isSiteCommit,
  buildReport,
  buildFailureReport,
  hasNextPage,
  makeGitHub,
  MAX_COMMIT_FILES,
  RUN_PAGE_SIZE,
  MAX_RUN_PAGES,
  SITE_PREFIX,
} from '../bin/check-deploy-drift.mjs';

const SITE_FILE = 'donovan-legal-site/members.html';
// Used only as a path STRING — a representative non-site path for classification
// fixtures. Nothing in this file reads the file, by design: see the header note.
const DOC_FILE = 'docs/deploy-drift-workflow.md';

/** A completed manual dispatch on main. */
const dispatch = (run_number, head_sha) => ({
  id: run_number * 1000,
  run_number,
  head_sha,
  event: 'workflow_dispatch',
  head_branch: 'main',
  status: 'completed',
  conclusion: 'success',
  html_url: `https://github.com/TicoAI/DonovanLegal/actions/runs/${run_number * 1000}`,
  created_at: '2026-08-04T00:00:00Z',
});

/** A push to main: the workflow runs and goes green, but production is skipped. */
const push = (run_number, head_sha) => ({
  ...dispatch(run_number, head_sha),
  event: 'push',
});

const jobs = (productionConclusion) => [
  { name: 'Test (root suite, Node 22)', status: 'completed', conclusion: 'success' },
  { name: 'Tree-integrity', status: 'completed', conclusion: 'success' },
  { name: 'Deploy Preview', status: 'completed', conclusion: 'skipped' },
  { name: 'Deploy PRODUCTION (manual)', status: 'completed', conclusion: productionConclusion },
];

/**
 * Minimal GitHub stub. `jobsByRunId` maps run id -> job array, `filesBySha` maps
 * commit sha -> the file list the API would return for that commit.
 */
function stubGh({
  runs,
  jobsByRunId,
  headSha,
  rangeCommits = [],
  filesBySha = {},
  totalCommits,
  truncatedShas = [],
}) {
  return {
    listDispatchRuns: async () => runs,
    listJobs: async (id) => jobsByRunId[id] ?? [],
    headSha: async () => headSha,
    compare: async () => ({
      commits: rangeCommits.map((c) => ({ sha: c.sha, commit: { message: c.message } })),
      total_commits: totalCommits ?? rangeCommits.length,
    }),
    commit: async (sha) => ({
      files: (filesBySha[sha] ?? []).map((filename) => ({ filename })),
      // Mirrors the real client: header-derived, absent unless the Link header said so.
      filesTruncated: truncatedShas.includes(sha),
    }),
  };
}

/** `n` distinct non-site paths — the decoys that fill a truncated file list. */
const nonSiteFiles = (n) => Array.from({ length: n }, (_, i) => `docs/note-${i}.md`);

describe('deploy drift — production job discrimination', () => {
  test('a production job that concluded success is a real deploy', () => {
    const o = productionJobOutcome(jobs('success'));
    assert.equal(o.deployed, true);
    assert.equal(o.conclusion, 'success');
  });

  test('a production job that was SKIPPED is not a deploy', () => {
    const o = productionJobOutcome(jobs('skipped'));
    assert.equal(o.deployed, false);
    assert.equal(o.conclusion, 'skipped');
  });

  test('a run with no production job at all fails closed, it is not a deploy', () => {
    // Guards a workflow rename silently turning this check into a no-op.
    const o = productionJobOutcome([{ name: 'Test', status: 'completed', conclusion: 'success' }]);
    assert.equal(o.deployed, false);
    assert.equal(o.found, false);
  });

  test('a production job still in progress is not yet a deploy', () => {
    const o = productionJobOutcome([
      { name: 'Deploy PRODUCTION (manual)', status: 'in_progress', conclusion: null },
    ]);
    assert.equal(o.deployed, false);
  });
});

describe('deploy drift — commit classification', () => {
  test('a commit touching donovan-legal-site/ is site-affecting', () => {
    assert.equal(isSiteCommit([{ filename: SITE_FILE }]), true);
  });

  test('a commit touching only docs/ and test/ is not site-affecting', () => {
    assert.equal(isSiteCommit([{ filename: DOC_FILE }, { filename: 'test/x.test.mjs' }]), false);
  });

  test('a rename OUT of donovan-legal-site/ is site-affecting', () => {
    // The new path is outside the site, so filename alone would miss that a file
    // the visitor used to load has disappeared.
    assert.equal(
      isSiteCommit([{ filename: 'archive/old.html', previous_filename: `${SITE_PREFIX}old.html` }]),
      true
    );
  });
});

describe('deploy drift — end to end verdicts', () => {
  test('CASE 1: no drift — production and main sit at the same commit', async () => {
    // Mirrors the live state at authoring time: run 276 deployed 73852d0 and
    // main HEAD is 73852d0.
    const gh = stubGh({
      runs: [dispatch(276, 'aaaaaaa1')],
      jobsByRunId: { 276000: jobs('success') },
      headSha: 'aaaaaaa1',
    });

    const r = await checkDeployDrift({ gh });

    assert.equal(r.exitCode, 0);
    assert.equal(r.verdict, 'NONE');
    assert.equal(r.drift, false);
    assert.equal(r.deployedSha, 'aaaaaaa1');
    // Invert the fixture (headSha: 'bbbbbbb2') and exitCode is no longer 0.
    assert.match(r.summary, /DEPLOY DRIFT: none\./);
  });

  test('CASE 2: drift on non-site paths only — exits zero, still reports it', async () => {
    const gh = stubGh({
      runs: [dispatch(276, 'aaaaaaa1')],
      jobsByRunId: { 276000: jobs('success') },
      headSha: 'ccccccc3',
      rangeCommits: [
        { sha: 'bbbbbbb2', message: 'docs: record the deploy-drift workflow' },
        { sha: 'ccccccc3', message: 'test: add drift coverage' },
      ],
      filesBySha: {
        bbbbbbb2: [DOC_FILE],
        ccccccc3: ['test/deploy-drift.test.mjs'],
      },
    });

    const r = await checkDeployDrift({ gh });

    // main IS ahead, so there is drift — but nothing a visitor can see.
    assert.equal(r.drift, true);
    assert.equal(r.siteAffecting, false);
    assert.equal(r.exitCode, 0);
    assert.equal(r.verdict, 'NON-SITE-ONLY');
    assert.equal(r.siteCommits.length, 0);
    assert.equal(r.otherCommits.length, 2);
    // Invert by moving either file under donovan-legal-site/ and exitCode becomes 1.
    assert.match(r.summary, /none that visitors can see/);
  });

  test('CASE 3: drift including donovan-legal-site — exits non-zero and names the commits', async () => {
    const gh = stubGh({
      runs: [dispatch(276, 'aaaaaaa1')],
      jobsByRunId: { 276000: jobs('success') },
      headSha: 'ddddddd4',
      rangeCommits: [
        { sha: 'bbbbbbb2', message: 'docs: unrelated note' },
        { sha: 'ccccccc3', message: 'feat(marketing): publish tier pages' },
        { sha: 'ddddddd4', message: 'fix(booking): empty calendar is not unreadable' },
      ],
      filesBySha: {
        bbbbbbb2: [DOC_FILE],
        ccccccc3: [SITE_FILE],
        ddddddd4: ['donovan-legal-site/functions/booking.js'],
      },
    });

    const r = await checkDeployDrift({ gh });

    assert.equal(r.exitCode, 1);
    assert.equal(r.verdict, 'SITE-AFFECTING');
    assert.equal(r.siteAffecting, true);
    assert.deepEqual(
      r.siteCommits.map((c) => c.sha),
      ['ccccccc3', 'ddddddd4']
    );
    assert.deepEqual(
      r.otherCommits.map((c) => c.sha),
      ['bbbbbbb2']
    );
    // Plain English, and it names the only thing that actually deploys production.
    assert.match(r.summary, /visitors are seeing an OLD site/);
    assert.match(r.summary, /confirm = deploy-production/);
    // Invert by pointing every sha at DOC_FILE and exitCode drops to 0.
  });

  test('CASE 4: a manual run whose production job SKIPPED is NOT counted as a deploy', async () => {
    // Run 277 is a manual dispatch on main that went GREEN overall, but the
    // operator typed the wrong confirm value so the `production` job was skipped
    // and nothing shipped. Run 276 is the real last deploy.
    //
    // The fixture is built so the two readings disagree:
    //   correct  -> live SHA is 276's aaaaaaa1, and eeeeeee5 (a site commit) is
    //               unshipped        => exit 1, SITE-AFFECTING
    //   wrong    -> live SHA is 277's eeeeeee5, which equals main HEAD
    //               => exit 0, "no drift"  (the false all-clear)
    const gh = stubGh({
      runs: [dispatch(277, 'eeeeeee5'), dispatch(276, 'aaaaaaa1')],
      jobsByRunId: {
        277000: jobs('skipped'), // confirm input was wrong -> no deploy
        276000: jobs('success'), // the real deploy
      },
      headSha: 'eeeeeee5',
      rangeCommits: [{ sha: 'eeeeeee5', message: 'feat(site): new landing hero' }],
      filesBySha: { eeeeeee5: [SITE_FILE] },
    });

    const r = await checkDeployDrift({ gh });

    // The skipped run must not be mistaken for the deploy.
    assert.equal(r.deployRun.run_number, 276);
    assert.notEqual(r.deployedSha, 'eeeeeee5');
    assert.equal(r.deployedSha, 'aaaaaaa1');
    // And the consequence: real drift is surfaced instead of a false all-clear.
    assert.equal(r.exitCode, 1);
    assert.equal(r.verdict, 'SITE-AFFECTING');
    assert.deepEqual(
      r.siteCommits.map((c) => c.sha),
      ['eeeeeee5']
    );
    // Invert by setting 277000 to jobs('success') and this test reports NONE/exit 0.
  });

  test('a push to main is green but never a deploy, so it cannot set the live SHA', async () => {
    // Observed live: run 273 was a push to main, overall conclusion `success`,
    // production job `skipped`. Branch+event filtering must drop it.
    const gh = stubGh({
      runs: [push(273, 'fffffff6'), dispatch(276, 'aaaaaaa1')],
      jobsByRunId: { 273000: jobs('skipped'), 276000: jobs('success') },
      headSha: 'aaaaaaa1',
    });

    const r = await checkDeployDrift({ gh });

    assert.equal(r.deployRun.run_number, 276);
    assert.equal(r.exitCode, 0);
  });

  test('no production deploy anywhere in history fails closed with exit 2', async () => {
    const gh = stubGh({
      runs: [dispatch(277, 'eeeeeee5')],
      jobsByRunId: { 277000: jobs('skipped') },
      headSha: 'eeeeeee5',
    });

    const r = await checkDeployDrift({ gh });

    assert.equal(r.exitCode, 2);
    assert.equal(r.verdict, 'UNKNOWN');
    assert.match(r.summary, /No production deploy found/);
    // "Cannot tell" must never render as "no drift".
    assert.doesNotMatch(r.summary, /DEPLOY DRIFT: none/);
  });

  test('the examination trail records why each rejected run was rejected', async () => {
    const { run, examined } = await findLastProductionDeploy({
      runs: [dispatch(277, 'eeeeeee5'), dispatch(276, 'aaaaaaa1')],
      listJobs: async (id) => (id === 277000 ? jobs('skipped') : jobs('success')),
    });

    assert.equal(run.run_number, 276);
    assert.equal(examined.length, 2);
    assert.equal(examined[0].run_number, 277);
    assert.match(examined[0].reason, /skipped/);
  });
});

describe('deploy drift — reporting honesty', () => {
  test('a truncated comparison is UNKNOWN, not "no drift"', () => {
    const r = buildReport({
      deployedSha: 'aaaaaaa1',
      headSha: 'zzzzzzz9',
      commits: [],
      warnings: ['Comparison truncated: GitHub returned 250 of 400 commits.'],
    });

    assert.equal(r.exitCode, 2);
    assert.equal(r.verdict, 'UNKNOWN');
    assert.doesNotMatch(r.summary, /DEPLOY DRIFT: none/);
  });

  test('every verdict carries the edge-divergence scope limit — all four branches', () => {
    // A green git-ref comparison is not a statement about what either hostname
    // serves; donovan.law and www.donovan.law are known to differ. buildReport
    // has FOUR terminal branches and this used to exercise only two of them, so
    // the caveat could have been dropped from NON-SITE-ONLY or UNKNOWN — the two
    // branches most likely to be read as an all-clear — without reddening.
    const branches = {
      NONE: buildReport({ deployedSha: 'a', headSha: 'a', commits: [] }),
      'NON-SITE-ONLY': buildReport({
        deployedSha: 'a',
        headSha: 'b',
        commits: [{ sha: 'b', message: 'm', files: [{ filename: DOC_FILE }] }],
      }),
      'SITE-AFFECTING': buildReport({
        deployedSha: 'a',
        headSha: 'b',
        commits: [{ sha: 'b', message: 'm', files: [{ filename: SITE_FILE }] }],
      }),
      UNKNOWN: buildReport({
        deployedSha: 'a',
        headSha: 'b',
        commits: [],
        warnings: ['Comparison truncated.'],
      }),
    };

    // Assert the set of branches covered, so adding a fifth verdict without
    // covering it here is a visible failure rather than a silent gap.
    // Sorted: '-' (0x2D) sorts before 'E' (0x45), so NON-SITE-ONLY precedes NONE.
    assert.deepEqual(Object.keys(branches).sort(), [
      'NON-SITE-ONLY',
      'NONE',
      'SITE-AFFECTING',
      'UNKNOWN',
    ]);

    for (const [expected, r] of Object.entries(branches)) {
      assert.equal(r.verdict, expected, `fixture for ${expected} produced ${r.verdict}`);
      assert.match(r.summary, /donovan\.law and www\.donovan\.law/, `${expected} lost the caveat`);
      assert.match(r.summary, /compares git refs only/, `${expected} lost the caveat`);
      assert.match(r.scopeLimit, /donovan\.law and www\.donovan\.law/);
    }
  });
});

describe('deploy drift — the per-commit file list is capped at 300, silently', () => {
  // GET /repos/{owner}/{repo}/commits/{sha} returns at most 300 files[] entries
  // and NOTHING in the body admits it (measured against linux 1da177e, ~17k
  // files: files.length === 300, no total_files/truncated key). A commit past
  // that cap whose donovan-legal-site/ paths sort after the cutoff reads as
  // non-site — "none that visitors can see", exit 0. That is the false
  // all-clear this whole tool exists to prevent.

  const truncatedRun = (fileCount, extra = {}) =>
    stubGh({
      runs: [dispatch(276, 'aaaaaaa1')],
      jobsByRunId: { 276000: jobs('success') },
      headSha: 'bbbbbbb2',
      rangeCommits: [{ sha: 'bbbbbbb2', message: 'chore: enormous tree-wide rename' }],
      // Every visible entry is non-site. Under the old logic this classifies
      // clean; the site paths are exactly what got cut off.
      filesBySha: { bbbbbbb2: nonSiteFiles(fileCount) },
      ...extra,
    });

  test('a 300-entry file list is a truncation warning and exits 2, not 0', async () => {
    const r = await checkDeployDrift({ gh: truncatedRun(MAX_COMMIT_FILES) });

    assert.equal(r.exitCode, 2);
    assert.equal(r.verdict, 'UNKNOWN');
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /bbbbbbb/);
    assert.match(r.warnings[0], /300-file per-commit API cap/);
    // The whole point: it must not render as an all-clear.
    assert.doesNotMatch(r.summary, /DEPLOY DRIFT: none/);
    assert.doesNotMatch(r.summary, /none that visitors can see/);
  });

  test('INVERSION: the same fixture one file smaller classifies and exits 0', async () => {
    // Proves the 300 boundary is what discriminates, not some unrelated part of
    // the fixture. 299 non-site files is a complete list and a real answer.
    const r = await checkDeployDrift({ gh: truncatedRun(MAX_COMMIT_FILES - 1) });

    assert.equal(r.exitCode, 0);
    assert.equal(r.verdict, 'NON-SITE-ONLY');
    assert.equal(r.warnings.length, 0);
    assert.match(r.summary, /none that visitors can see/);
  });

  test('a Link rel="next" header fails closed even below the 300 boundary', async () => {
    // The second guard, independent of the count: if GitHub ever moves the cap,
    // the header still says "there is more" and the check still refuses to guess.
    const r = await checkDeployDrift({
      gh: truncatedRun(5, { truncatedShas: ['bbbbbbb2'] }),
    });

    assert.equal(r.exitCode, 2);
    assert.equal(r.verdict, 'UNKNOWN');
    assert.match(r.warnings[0], /Link header advertises another page/);

    // ADAM-TEST-SCOPE-R1 · Task 4 — and the sentence must not contradict itself.
    // This fixture has FIVE files. The warning used to state that count and then
    // say it was "at or above the 300-file per-commit API cap" in the same
    // sentence, because the cap clause sat outside the conditional that made it
    // true. A warning that is visibly wrong about the number it just printed is
    // a warning an operator learns to skip.
    assert.match(r.warnings[0], /returned 5 file\(s\)/, 'the count is stated as a fact');
    assert.doesNotMatch(
      r.warnings[0],
      /at or above/,
      'below the boundary the cap clause must not appear at all'
    );
    assert.doesNotMatch(r.warnings[0], /300-file per-commit API cap/);
  });

  test('at the boundary the warning does claim the cap, and both guards read as one sentence', async () => {
    // The inverse of the test above: the cap clause has to survive the split, and
    // when BOTH guards fire the two reasons must join rather than one silently
    // winning. Inverting either flag drops exactly one clause.
    const r = await checkDeployDrift({
      gh: truncatedRun(MAX_COMMIT_FILES, { truncatedShas: ['bbbbbbb2'] }),
    });

    assert.equal(r.exitCode, 2);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0], /returned 300 file\(s\)/);
    assert.match(r.warnings[0], /at or above the 300-file per-commit API cap/);
    assert.match(r.warnings[0], /and the Link header advertises another page/);
  });

  test('hasNextPage reads rel="next" and is not fooled by rel="last" alone', () => {
    const real =
      '<https://api.github.com/repositories/2325298/commits/1da177e?page=2>; rel="next", ' +
      '<https://api.github.com/repositories/2325298/commits/1da177e?page=10>; rel="last"';
    assert.equal(hasNextPage(real), true);
    // Final page: prev/first only. Not truncated.
    assert.equal(hasNextPage('<https://api.github.com/x?page=9>; rel="prev"'), false);
    assert.equal(hasNextPage(null), false);
  });
});

describe('deploy drift — the failure path is a report too', () => {
  const BIN = fileURLToPath(new URL('../bin/check-deploy-drift.mjs', import.meta.url));

  /** Run the real script with no token so makeGitHub throws before any network. */
  const runBin = (args) =>
    spawnSync(process.execPath, [BIN, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_TOKEN: '' },
    });

  test('text mode: the caveat prints on the top-level catch, and it exits 2', () => {
    const p = runBin([]);
    const out = `${p.stdout}${p.stderr}`;

    assert.equal(p.status, 2);
    assert.match(out, /the check could not run/);
    assert.match(out, /GITHUB_TOKEN is not set/);
    // Inverting the fix (dropping SCOPE_LIMIT_LINES from buildFailureReport)
    // fails exactly here.
    assert.match(out, /donovan\.law and www\.donovan\.law/);
    assert.match(out, /compares git refs only/);
    assert.doesNotMatch(out, /DEPLOY DRIFT: none/);
  });

  test('json mode: the caveat is a field, and it exits 2', () => {
    const p = runBin(['--json']);

    assert.equal(p.status, 2);
    const j = JSON.parse(p.stdout);
    assert.equal(j.verdict, 'UNKNOWN');
    assert.equal(j.exitCode, 2);
    assert.match(j.error, /GITHUB_TOKEN is not set/);
    assert.match(j.scopeLimit, /donovan\.law and www\.donovan\.law/);
    assert.match(j.summary, /compares git refs only/);
  });

  test('buildFailureReport keeps the exit-code contract at 2', () => {
    const r = buildFailureReport('GitHub 503 on /repos/x/y/commits/main');
    assert.equal(r.exitCode, 2);
    assert.equal(r.verdict, 'UNKNOWN');
    assert.match(r.summary, /Treat this as "not verified"/);
    assert.match(r.summary, /donovan\.law and www\.donovan\.law/);
  });
});

describe('deploy drift — the run listing is paginated, not capped at one page', () => {
  /**
   * A fetch stub that serves `total` dispatch runs across pages of RUN_PAGE_SIZE.
   * Records every URL so we can prove pagination actually happened.
   */
  function pagingFetch(total, urls) {
    return async (url) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get('page') ?? 1);
      const start = (page - 1) * RUN_PAGE_SIZE;
      const workflow_runs = Array.from(
        { length: Math.max(0, Math.min(RUN_PAGE_SIZE, total - start)) },
        (_, i) => dispatch(total - start - i, `sha${start + i}`)
      );
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ workflow_runs, total_count: total }),
      };
    };
  }

  test('a deploy on run 120 is still reachable — one page of 50 would miss it', async () => {
    const urls = [];
    const gh = makeGitHub({ token: 't', fetchImpl: pagingFetch(150, urls) });

    const runs = await gh.listDispatchRuns();

    assert.equal(runs.length, 150);
    assert.equal(urls.length, 2, 'should have fetched page 1 and page 2');
    assert.match(urls[0], /per_page=100&page=1/);
    assert.match(urls[1], /per_page=100&page=2/);
    // The old cap: runs[0..49]. Anything older was invisible.
    assert.ok(runs.length > 50, 'the 50-run cap is gone');
  });

  test('it stops on a short page instead of walking to the page limit', async () => {
    const urls = [];
    const gh = makeGitHub({ token: 't', fetchImpl: pagingFetch(30, urls) });

    const runs = await gh.listDispatchRuns();

    assert.equal(runs.length, 30);
    assert.equal(urls.length, 1, 'a short first page ends the walk');
  });

  test('pagination is bounded — it cannot spin past MAX_RUN_PAGES', async () => {
    const urls = [];
    const gh = makeGitHub({ token: 't', fetchImpl: pagingFetch(10_000, urls) });

    const runs = await gh.listDispatchRuns();

    assert.equal(urls.length, MAX_RUN_PAGES);
    assert.equal(runs.length, MAX_RUN_PAGES * RUN_PAGE_SIZE);
  });

  test('when no deploy is found the report states how far back it looked', async () => {
    // "No deploy found" is only honest if it says what horizon was searched.
    const gh = stubGh({
      runs: [dispatch(277, 'eeeeeee5')],
      jobsByRunId: { 277000: jobs('skipped') },
      headSha: 'eeeeeee5',
    });

    const r = await checkDeployDrift({ gh });

    assert.equal(r.exitCode, 2);
    assert.match(r.summary, /out of 1 listed, up to 500/);
    assert.match(r.summary, /run-retention horizon/);
  });
});

describe('deploy drift — KNOWN LIMITATION: main behind production', () => {
  // If main is rewound BELOW the deployed SHA (a force-push, a revert of the
  // merge that shipped), then compare(deployed...head) has head as an ancestor
  // of base: GitHub answers status "behind" with an EMPTY commits[] and
  // total_commits 0. Nothing is truncated, so no warning fires; the shas differ,
  // so `matched` is false; and there are no site commits, so the report lands in
  // the NON-SITE-ONLY branch and exits 0 — "none that visitors can see", over a
  // state where production is AHEAD of main and the next deploy would REMOVE
  // shipped code.
  //
  // This test asserts the CURRENT behaviour, not the desired one. It is here so
  // the limitation recorded in docs/deploy-drift-workflow.md is measured rather
  // than claimed, and so that whoever guards this direction gets a red test
  // telling them the doc needs updating in the same change.

  test('a rewound main reads as NON-SITE-ONLY and exits 0 — the limitation, measured', async () => {
    const gh = stubGh({
      runs: [dispatch(276, 'aaaaaaa1')],
      jobsByRunId: { 276000: jobs('success') },
      // Production shipped aaaaaaa1; main HEAD is now an OLDER commit.
      headSha: '0000000a',
      rangeCommits: [], // compare says "behind": no commits from deployed -> head
      totalCommits: 0,
    });

    const r = await checkDeployDrift({ gh });

    assert.equal(r.deployedSha, 'aaaaaaa1');
    assert.equal(r.headSha, '0000000a');
    assert.equal(r.drift, true, 'the shas differ, so drift is true');
    assert.equal(r.exitCode, 0, 'CURRENT behaviour: this direction does not fail');
    assert.equal(r.verdict, 'NON-SITE-ONLY');
    assert.equal(r.siteCommits.length, 0);
    assert.equal(r.otherCommits.length, 0);
    // The tell an operator can actually see: zero unshipped commits alongside a
    // "there is drift" verdict is only possible in the behind direction.
    assert.match(r.summary, /0 unshipped commit\(s\)/);
  });
});
