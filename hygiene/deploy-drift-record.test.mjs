// ADAM-TEST-SCOPE-R1 — repo hygiene lane: the drift workflow and its docs record.
//
// ── WHY THIS FILE IS NOT IN test/ ────────────────────────────────────────────
// `npm test` is the test job of .github/workflows/deploy-pages.yml, and the
// `production` job declares `needs: [test, guard]`. So every assertion reachable
// from `npm test` is a precondition for deploying the live site.
//
// That is correct for a behavioural test: if the middleware stops emitting the
// CSP, visitors should not get the new build. It is wrong for the assertion
// below, which compares a markdown code fence against a YAML file. Editing the
// cron in deploy-drift.yml without mirroring it into docs/ would have made
// production undeployable over a documentation mismatch — a doc that cannot be
// fixed without a deploy window is a worse doc, not a safer one.
//
// So the assertion did not get weaker and it did not get deleted. It moved to a
// lane that gates PULL REQUESTS (.github/workflows/ci.yml) and never gates a
// deploy. `npm run test:hygiene` runs this file; `npm test` cannot reach it,
// because the two globs are rooted at different directories — proved below.
//
// The rule for what belongs here: an assertion about the REPOSITORY (docs match
// code, a workflow has the shape we think it has, a script is wired where we
// think it is wired) rather than about what the deployed site DOES.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const DOC_FILE = 'docs/deploy-drift-workflow.md';
const WF = '.github/workflows/deploy-drift.yml';
const CI = '.github/workflows/ci.yml';
const DEPLOY = '.github/workflows/deploy-pages.yml';

/**
 * The comparison itself, extracted so the mutation bite below can drive the SAME
 * code path against a mutated doc instead of asserting something adjacent to it.
 * Returns null when the doc matches, or the reason it does not.
 */
/**
 * The lines of the top-level `on:` block, or null if there is no such block.
 *
 * Line-walked rather than matched, deliberately. The assertion this replaces was
 * `/^on:\n(\s+.*\n)*?\s+schedule:/m`, and CodeQL js/redos rated it HIGH: `\s`
 * matches `\n`, so `(\s+.*\n)*?` can partition the same run of whitespace and
 * newlines many ways and a non-matching input backtracks exponentially. It fired
 * on this file's first CI run (PR #149) — the regex predates this order and came
 * across with the move.
 *
 * A cap on input length would not have fixed it; a YAML file is already short and
 * the blow-up is in the partitioning, not the size. Splitting on newlines removes
 * the ambiguity outright, and scopes the push check to the block as a bonus.
 */
function onBlock(yamlText) {
  const lines = yamlText.split('\n');
  const start = lines.indexOf('on:');
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  // The block ends at the next line that starts in column 0 with content.
  const end = rest.findIndex((l) => l.trim() !== '' && !/^[ \t]/.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

function recordDrift(docText, yamlText) {
  const block = docText.match(/^````yaml\n([\s\S]*?)\n````$/m);
  if (!block) return 'no four-backtick yaml block';
  return `${block[1]}\n` === yamlText ? null : 'yaml block has drifted';
}

describe('deploy drift — the scheduled workflow and its docs record', () => {
  test('the YAML recorded in docs matches the workflow file byte for byte', () => {
    // A doc that merely *resembles* the workflow is worse than no doc: it becomes
    // the thing people trust after the workflow changes underneath it.
    // A four-backtick fence, because the recorded YAML itself contains a
    // three-backtick block (the step writes a fenced report to the job summary).
    // A three-backtick fence here would close early and the record would be a
    // silently truncated copy of the workflow.
    const yaml = read(WF).replace(/\n+$/, '\n');
    const doc = read(DOC_FILE);
    const block = doc.match(/^````yaml\n([\s\S]*?)\n````$/m);
    assert.ok(block, `${DOC_FILE} has no four-backtick yaml block`);
    assert.equal(`${block[1]}\n`, yaml, `${DOC_FILE} yaml block has drifted from ${WF}`);
    assert.equal(recordDrift(doc, yaml), null);
  });

  test('MUTATION BITE — one changed character in the cron reds the record', () => {
    // The move is only honest if the assertion still bites after it. Bump the
    // cron minute by one — literally the edit that motivated splitting the lanes
    // — and prove the same comparison rejects it.
    //
    // The mutation is applied to the WORKFLOW side, not the doc side, and the
    // value is derived rather than written as a literal. Mutating the doc would
    // couple this test to the one above: on a real drift, "doc says 17, workflow
    // says 18" plus a doc mutation of 17->18 would REPAIR the doc and red this
    // test for the opposite reason, turning one clear failure into two confusing
    // ones. Mutating the workflow keeps a real drift pointing at exactly one test.
    const yaml = read(WF).replace(/\n+$/, '\n');
    const doc = read(DOC_FILE);
    const mutated = yaml.replace(/(^\s+- cron: ")(\d+)/m, (_, lead, min) => `${lead}${Number(min) + 1}`);
    assert.notEqual(mutated, yaml, 'the mutation must actually change the workflow copy');
    assert.equal(recordDrift(doc, mutated), 'yaml block has drifted');
  });

  test('MUTATION BITE — a truncated fence is caught, not read as a match', () => {
    // The three-backtick failure mode the fence comment warns about: if the block
    // closes early the recorded copy is a silent prefix of the workflow.
    const yaml = read(WF).replace(/\n+$/, '\n');
    const doc = read(DOC_FILE);
    const truncated = doc.replace(/^````yaml\n[\s\S]*?\n````$/m, (m) =>
      `${m.split('\n').slice(0, 20).join('\n')}\n\`\`\`\``
    );
    assert.equal(recordDrift(truncated, yaml), 'yaml block has drifted');
  });

  test('the drift workflow is read-only — it never deploys and takes no write scopes', () => {
    const yaml = read(WF);
    assert.doesNotMatch(yaml, /wrangler/, 'the drift check must never deploy');
    assert.doesNotMatch(yaml, /pages deploy/);
    assert.doesNotMatch(yaml, /contents:\s*write/);
    assert.match(yaml, /actions:\s*read/, 'reading per-job conclusions needs actions: read');
  });

  test('the drift workflow does not trigger on push, so it cannot spam every branch', () => {
    const yaml = read(WF);
    const block = onBlock(yaml);

    assert.ok(block, `${WF} has no top-level \`on:\` block`);
    assert.ok(
      block.some((l) => /^\s+schedule:$/.test(l)),
      'the `on:` block must declare schedule:'
    );
    // Scoped to the block, not the whole file: a `push:` anywhere else in the
    // YAML is not a trigger. The file-wide check stays as well, because at the
    // moment there is no other two-space key that could legitimately be `push:`.
    assert.ok(
      !block.some((l) => /^\s+push:/.test(l)),
      'the `on:` block must not declare push:'
    );
    assert.doesNotMatch(yaml, /^\s{2}push:/m);
  });

  test('onBlock discriminates — it stops at the next top-level key (control)', () => {
    // Without this, `onBlock` returning the whole rest of the file would make the
    // push assertion above look scoped while actually being file-wide, and a
    // `push:` under `jobs:` would red the suite for the wrong reason.
    const sample = 'on:\n  schedule:\n    - cron: "0 0 * * *"\n\npermissions:\n  push: no\n';
    assert.deepEqual(onBlock(sample), ['  schedule:', '    - cron: "0 0 * * *"', '']);
    assert.equal(onBlock('jobs:\n  a: b\n'), null);
  });
});

describe('ADAM-TEST-SCOPE-R1 — the hygiene lane gates PRs and never gates a deploy', () => {
  const pkg = JSON.parse(read('package.json'));

  test('both scripts exist and their globs are rooted at disjoint directories', () => {
    const behavioural = pkg.scripts.test;
    const hygiene = pkg.scripts['test:hygiene'];
    assert.ok(behavioural, 'package.json has no `test` script');
    assert.ok(hygiene, 'package.json has no `test:hygiene` script');

    // The separation is a PREFIX, not a filename suffix, on purpose. A suffix
    // convention (`*.hygiene.mjs` under test/) is one typo away from a hygiene
    // file landing back in the deploy gate; two rooted directories cannot be
    // crossed by naming a file wrongly.
    const globOf = (s) => (s.match(/"([^"]+)"/) ?? [])[1] ?? '';
    assert.match(globOf(behavioural), /^test\//, '`npm test` must be rooted at test/');
    assert.match(globOf(hygiene), /^hygiene\//, '`npm run test:hygiene` must be rooted at hygiene/');
    assert.ok(
      !globOf(hygiene).startsWith('test/') && !globOf(behavioural).startsWith('hygiene/'),
      'the two lanes must not overlap'
    );
  });

  test('ci.yml runs the hygiene lane — this is what gates pull requests', () => {
    const ci = read(CI);
    assert.match(ci, /npm run test:hygiene/, 'ci.yml must run the hygiene lane');
    assert.match(ci, /pull_request:/, 'ci.yml must still trigger on pull requests');
  });

  test('deploy-pages.yml does NOT run the hygiene lane — a doc mismatch cannot block a deploy', () => {
    // The load-bearing assertion of this whole order. If someone later adds
    // `npm run test:hygiene` to the deploy workflow, the documentation-consistency
    // gate is back in front of production and this reds.
    const deploy = read(DEPLOY);
    assert.doesNotMatch(deploy, /test:hygiene/, 'the deploy workflow must never run the hygiene lane');
  });

  test('the deploy workflow still runs the behavioural suite (control)', () => {
    // Proving the absence above is only meaningful if the presence below holds:
    // otherwise "deploy-pages.yml does not mention test:hygiene" would also pass
    // on a workflow that runs no tests at all.
    const deploy = read(DEPLOY);
    assert.match(deploy, /^\s+- run: npm test$/m, 'deploy-pages.yml must still run `npm test`');
    assert.match(deploy, /needs: \[test, guard\]/, 'production must still need the test job');
  });
});
