// ── DR-INSANE-A34-FRAME-HEADERS — refusing foreign framing, but only after cutover
//
// Order DR-INSANE-A34-FRAME-HEADERS · ticket #59 · Phase A / Phase 3.
//
// The security claim is small and the compatibility claim is the hard one, so the
// file is organised around the second:
//
//   1. ROUTER ON  — `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` are
//      both present, and the per-request nonce CSP is otherwise untouched.
//   2. ROUTER OFF — the response headers are BYTE-IDENTICAL to the ones the
//      middleware emitted before this change. Not "equivalent", not "still has a
//      CSP": identical, because production runs router-off until David flips the
//      flag and the shell is still iframing the site there.
//
// Claim 2 is proved DIFFERENTIALLY, against the real pre-change middleware, loaded
// and driven through the same harness. Asserting a hand-written expected header block
// instead would prove only that the copy in this file matches the code in that file,
// which is the failure mode `buildCsp` is exported to avoid in the first place.
//
// ── WHY THE BASELINE IS A PINNED SHA AND NOT `origin/main` ───────────────────
// This file first shipped reading `origin/main:_middleware.js`. That was true while
// #59 was a branch and became false the instant #59 merged: `origin/main` then IS the
// #59 middleware, so "before" and "after" were the same code, the control's
// notDeepEqual and its `x-frame-options === undefined` both went false, and the suite
// reddened on main and on every branch cut from it — taking CI and every Preview
// deploy with it. A differential baseline may not be a moving ref. It is now pinned to
// BASELINE_COMMIT below, the F-10 state: main's tip immediately before #59 merged.
//
// ── WHY THE BASELINE IS A COMMITTED FIXTURE AND NOT A GIT READ (#152) ────────
// Pinning the SHA fixed the moving-baseline defect above but left a second one:
// the baseline was still READ through git at test time — `git rev-parse`, and on a
// miss `git fetch --depth=1 origin <sha>`. deploy-pages.yml checks out with a bare
// actions/checkout@v4 (depth 1, no fetch-depth), so f833826 is NOT in the CI clone
// and that fetch ran on EVERY run. `npm test` is the `test` job, and the
// `production` job declares `needs: [test, guard]` — so a network blip, a GitHub
// outage, or a GC'd unreferenced SHA reddened a production deploy for a reason
// that had nothing to do with the site. Correctly, the assertion below refuses to
// skip; that is exactly what made the fragility load-bearing.
//
// The baseline is now `test/fixtures/f10-middleware.baseline.js`, read from disk.
// Nothing is weakened, because the integrity check got STRONGER rather than
// looser: git blob ids are content addresses, so recomputing the fixture's blob
// SHA-1 and comparing it to BASELINE_BLOB proves the bytes ARE the F-10 bytes
// without trusting the filename, the path, or a network peer. The fixture is not a
// copy of that blob — `git rev-parse :test/fixtures/f10-middleware.baseline.js` is
// 146284f4, i.e. it IS the same object.
//
// ── REGENERATING THE FIXTURE (deliberately, when the baseline legitimately moves)
// Do NOT "refresh" this to make a red suite green — a differential baseline that
// follows the code under test measures nothing, which is the #59 defect above. A
// baseline change is a decision, taken by an order that says so in its report.
// When one legitimately rebases what "unchanged" means, from the repo root:
//
//   1. git cat-file blob <newSHA>:donovan-legal-site/functions/_middleware.js \
//        > test/fixtures/f10-middleware.baseline.js
//   2. git add test/fixtures/f10-middleware.baseline.js
//   3. git rev-parse :test/fixtures/f10-middleware.baseline.js   # the new blob id
//   4. Update BASELINE_COMMIT to <newSHA> and BASELINE_BLOB to step 3's output —
//      both together, never one alone.
//   5. npm test -- and confirm the CONTROL test still FAILS when the middleware is
//      mutated away from the fixture. A fixture that no test can break is a rubber
//      stamp, not a control.
//
// The fixture carries no header of its own on purpose: it must stay byte-identical
// to the blob it is pinned to, so a comment inside it would break the very check
// that makes it trustworthy. `test/fixtures/README.md` and
// `docs/F10-BASELINE-FIXTURE.md` hold the same procedure for anyone who
// arrives at the fixture instead of at this file. It is pinned `-text` in
// .gitattributes: the hash is over raw bytes, and core.autocrlf=true would
// otherwise rewrite its 220 LF on a Windows checkout.
//
// ── WHAT THE HARNESS DOES NOT PROVE ──────────────────────────────────────────
// This drives `onRequest` in Node with a stub rewriter. It proves what the Worker
// PUTS on the response. It cannot prove what a browser DOES with those headers —
// that a foreign frame is actually refused, and that zero CSP violations fire on a
// real page, is measured against a live Preview by test/preview/verify-a34.mjs.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { onRequest, buildCsp } from '../donovan-legal-site/functions/_middleware.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIDDLEWARE = 'donovan-legal-site/functions/_middleware.js';

/**
 * F-10 — the differential baseline. FIXED, never a ref.
 *
 * f8338262 is main's tip immediately before #59 (PR #85) merged, so its
 * _middleware.js is the last pre-frame-headers middleware that ever served
 * production. Pinning the COMMIT is what stops the baseline sliding forward onto the
 * change under test; pinning the BLOB too is what lets a reviewer prove it, because
 * the assertion below fails loudly if this SHA ever stops carrying the F-10 bytes.
 *
 * These are not to be "refreshed". A later change to _middleware.js is measured
 * against F-10 as well — that is the point of a fixed baseline. If a future order
 * genuinely rebases what "unchanged" means, it changes both constants together and
 * says so in its report (see REGENERATING THE FIXTURE at the top of this file).
 *
 * BASELINE_COMMIT is now provenance rather than a lookup key: #152 moved the read
 * off the network, so nothing here resolves it at test time. BASELINE_BLOB is the
 * live check — it is the content address the fixture must still hash to.
 */
const BASELINE_COMMIT = 'f833826217d6449b7a812476304029abed828b8c';
const BASELINE_BLOB = '146284f47271013fef2e12c52bbd614f36abe990';

/** The F-10 bytes, committed. See REGENERATING THE FIXTURE at the top of this file. */
const BASELINE_FIXTURE = join(ROOT, 'test', 'fixtures', 'f10-middleware.baseline.js');

// ── Test doubles ─────────────────────────────────────────────────────────────

/**
 * Enough HTMLRewriter to let `onRequest` finish. This file asserts on HEADERS, so
 * the body transform is deliberately a pass-through — csp.test.mjs already owns the
 * stamping contract and duplicating it here would only give it a second place to rot.
 */
class PassThroughRewriter {
  on() { return this; }
  transform(res) { return res; }
}

const HTML = '<html><head><script>window.x=1;</script></head><body><main>hi</main></body></html>';

/**
 * Drive a middleware module (this branch's, or main's) and return its headers.
 *
 * `env` and `url` are the only two inputs the frame gate reads, so they are the only
 * two knobs. Everything else is held constant across every call in this file — a
 * differential test whose two sides differ in a second variable measures nothing.
 */
async function headersFrom(mod, { env, url = 'https://www.donovan.law/estate-planning.html', ctype = 'text/html; charset=utf-8' } = {}) {
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = PassThroughRewriter;
  try {
    const res = await mod.onRequest({
      request: new Request(url),
      env,
      next: async () => new Response(HTML, { status: 200, headers: { 'content-type': ctype } }),
    });
    const out = {};
    for (const [k, v] of res.headers) out[k.toLowerCase()] = v;
    return out;
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

/**
 * The nonce is 16 bytes of CSPRNG per request, so two responses NEVER agree on the
 * CSP byte for byte and a raw comparison would fail for the one reason that is not
 * a defect. Blanking it is the only normalisation applied — anything else would be
 * this test quietly excusing a difference it was written to catch.
 */
function normalise(headers) {
  const copy = { ...headers };
  if (copy['content-security-policy']) {
    copy['content-security-policy'] = copy['content-security-policy'].replace(/'nonce-[a-f0-9]{32}'/g, "'nonce-NORMALISED'");
  }
  return copy;
}

/** `a; b; c` → { a: "…", b: "…" }, keyed by directive name. */
function directives(csp) {
  const out = {};
  for (const part of (csp || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    out[trimmed.split(/\s+/)[0]] = trimmed;
  }
  return out;
}

const ON = { PERCH_ROUTER: 'on' };
const OFF = { PERCH_ROUTER: 'off' };

// ── 1. Router ON — the site refuses foreign framing ──────────────────────────

describe('DR-INSANE-A34 — with the shell retired, foreign framing is refused', () => {
  test("frame-ancestors is exactly 'self'", async () => {
    const h = await headersFrom({ onRequest }, { env: ON });
    assert.equal(
      directives(h['content-security-policy'])['frame-ancestors'],
      "frame-ancestors 'self'",
      'the wildcard *.ticoai.net allowance must be gone once nothing off-origin frames the site'
    );
  });

  test('X-Frame-Options is SAMEORIGIN', async () => {
    const h = await headersFrom({ onRequest }, { env: ON });
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
  });

  test('both frame headers agree — no CSP-says-one-thing state', async () => {
    const h = await headersFrom({ onRequest }, { env: ON });
    assert.equal(directives(h['content-security-policy'])['frame-ancestors'], "frame-ancestors 'self'");
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
  });

  test('the headers are deployment-scoped, not page-scoped — the shell page gets them too', async () => {
    // /perch.html is the one page with a 'skip' plan, so a gate that consulted the
    // plan (as routerTags does) would leave the shell itself framable after cutover.
    const h = await headersFrom({ onRequest }, { env: ON, url: 'https://www.donovan.law/perch.html' });
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
    assert.equal(directives(h['content-security-policy'])['frame-ancestors'], "frame-ancestors 'self'");
  });

  test('non-HTML responses are covered too', async () => {
    // The CSP is set above the non-HTML early return; the frame headers must be as
    // well, or a framed subresource response would carry a policy the document does not.
    const h = await headersFrom({ onRequest }, { env: ON, ctype: 'text/css' });
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
    assert.equal(directives(h['content-security-policy'])['frame-ancestors'], "frame-ancestors 'self'");
  });

  test('a *.pages.dev host locks framing with no variable set at all', async () => {
    // The default arm of routerEnabled: Preview is router-on without PERCH_ROUTER,
    // which is what makes the Preview evidence in the report representative.
    const h = await headersFrom({ onRequest }, { env: undefined, url: 'https://drinsane-a34.donovan-site.pages.dev/estate-planning.html' });
    assert.equal(h['x-frame-options'], 'SAMEORIGIN');
    assert.equal(directives(h['content-security-policy'])['frame-ancestors'], "frame-ancestors 'self'");
  });
});

// ── 2. The nonce CSP is untouched — frame-ancestors is the ONLY change ───────

describe('DR-INSANE-A34 — frame-ancestors is the only directive that moves', () => {
  test('every other directive is byte-identical between ON and OFF', async () => {
    const on = directives(normalise(await headersFrom({ onRequest }, { env: ON }))['content-security-policy']);
    const off = directives(normalise(await headersFrom({ onRequest }, { env: OFF }))['content-security-policy']);

    assert.deepEqual(Object.keys(on), Object.keys(off), 'no directive may be added or dropped by the flag');
    const differing = Object.keys(on).filter((k) => on[k] !== off[k]);
    // Was ['frame-ancestors']: the flag chose between a wide string (so the Perch
    // shell could frame the site cross-origin) and 'self'. The shell is deleted and
    // Vantage severed, so nothing off-origin frames this site in either state and the
    // wide branch is gone. NO directive varies with the flag now, which is a stronger
    // statement than the one this test used to make.
    assert.deepEqual(differing, [], `the flag may no longer change any directive; got ${differing.join(', ')}`);
  });

  test('the flag does not touch script-src, and never introduces unsafe-inline or strict-dynamic', async () => {
    for (const env of [ON, OFF, undefined]) {
      const csp = (await headersFrom({ onRequest }, { env })) ['content-security-policy'];
      const scriptSrc = directives(csp)['script-src'];
      assert.match(scriptSrc, /'nonce-[a-f0-9]{32}'/, 'the per-request nonce must survive the flag');
      assert.doesNotMatch(scriptSrc, /unsafe-inline/);
      assert.doesNotMatch(scriptSrc, /unsafe-eval/);
      assert.doesNotMatch(csp, /strict-dynamic/);
    }
  });

  test('X-Frame-Options is the only header the flag adds', async () => {
    const on = normalise(await headersFrom({ onRequest }, { env: ON }));
    const off = normalise(await headersFrom({ onRequest }, { env: OFF }));
    const added = Object.keys(on).filter((k) => !(k in off));
    const removed = Object.keys(off).filter((k) => !(k in on));
    assert.deepEqual(added, ['x-frame-options']);
    assert.deepEqual(removed, [], 'the flag must never remove a header');

    // …and of the headers present on both, none may now read differently. This was
    // ['content-security-policy'], for the frame-ancestors reason above. X-Frame-Options
    // is still the flag's one effect — it is a header-level decision and keeps its gate.
    const changed = Object.keys(off).filter((k) => k in on && on[k] !== off[k]);
    assert.deepEqual(changed, []);
  });

  test('buildCsp has no frame-ancestors option left to get wrong', async () => {
    // This asserted the DEFAULT was the permissive policy, because the default was
    // load-bearing: production called buildCsp(nonce) with one argument, so a wrong
    // default would have silently widened or narrowed a live site.
    //
    // There is no default to be load-bearing any more. frame-ancestors is 'self'
    // unconditionally, so every spelling of the call agrees — including one that
    // still passes the removed option, which is asserted on purpose so that
    // re-introducing it fails here instead of quietly producing a second policy.
    assert.equal(directives(buildCsp('n'))['frame-ancestors'], "frame-ancestors 'self'");
    assert.equal(buildCsp('n'), buildCsp('n', {}));
    assert.equal(buildCsp('n'), buildCsp('n', { lockFrameAncestors: false }));
    assert.equal(buildCsp('n'), buildCsp('n', { lockFrameAncestors: true }));
  });
});

// ── 3. Router OFF — byte-identical to the middleware as it shipped ───────────

describe('DR-INSANE-A34 — with the router off the response is unchanged from F-10', () => {
  /**
   * The git blob id of a byte buffer: sha1("blob " + length + NUL + bytes).
   *
   * Reimplemented in four lines rather than shelled out to `git hash-object`
   * because the point of #152 is that no git process runs here — and because
   * hash-object would apply this repo's core.autocrlf=true to the file on the way
   * in, hashing bytes that are not the bytes on disk.
   */
  function gitBlobId(bytes) {
    return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  }

  /**
   * Read the F-10 middleware source out of the committed fixture.
   *
   * No git, no network, no skip. The three failure modes the old git path had —
   * a depth-1 CI clone that lacks the commit, a network blip on the SHA fetch, a
   * GC'd unreferenced object — cannot arise from a file that is IN the tree under
   * test. What replaces them is one check that is strictly harder to fool:
   *
   *   The fixture's bytes must hash to BASELINE_BLOB. A git blob id is a content
   *   address, so this proves the bytes ARE the F-10 bytes no matter how they got
   *   there. The old `git rev-parse <commit>:<path>` proved a weaker thing — that
   *   some commit still names that blob — and trusted git to hand back the content.
   *
   * Still a HARD FAILURE and never a skip: a green run in which the byte-identity
   * claim was not measured is the same class of defect as the moving baseline this
   * file's history is a record of.
   */
  let cachedSource;
  function baselineSource() {
    if (cachedSource) return cachedSource;

    let bytes;
    try {
      bytes = readFileSync(BASELINE_FIXTURE);
    } catch (e) {
      assert.fail(
        `NOT MEASURED — could not read the F-10 baseline fixture test/fixtures/f10-middleware.baseline.js ` +
        `(${String(e.message).split('\n')[0]}). This is a failure, not a skip: without the baseline the ` +
        `router-off byte-identity claim is unproven. The fixture is committed — restore it, do not regenerate it.`
      );
    }

    // The pin is only worth as much as this check. CRLF is called out by name
    // because it is the one corruption a checkout inflicts silently: the fixture is
    // `-text` in .gitattributes precisely to stop core.autocrlf rewriting its LF,
    // and an opaque hash mismatch would otherwise send a reader hunting the wrong bug.
    const actual = gitBlobId(bytes);
    if (actual !== BASELINE_BLOB && bytes.includes(0x0d)) {
      assert.fail(
        `the F-10 fixture has CRLF line endings and is no longer the F-10 bytes (blob ${actual}, ` +
        `expected ${BASELINE_BLOB}). Its .gitattributes \`-text\` pin is missing or was not applied on ` +
        `checkout — re-checkout the file, do not regenerate it.`
      );
    }
    assert.equal(
      actual,
      BASELINE_BLOB,
      `the F-10 fixture is not the pinned baseline: test/fixtures/f10-middleware.baseline.js is blob ` +
      `${actual}, expected ${BASELINE_COMMIT.slice(0, 8)}:${MIDDLEWARE} = ${BASELINE_BLOB}. The fixture is a ` +
      `historical artifact and must not be edited; see REGENERATING THE FIXTURE in this file.`
    );

    cachedSource = bytes.toString('utf8');
    return cachedSource;
  }

  /**
   * Materialise the F-10 middleware as an importable module.
   *
   * It goes to a temp dir OUTSIDE the repo on purpose: `donovan-legal-site` IS the
   * Pages deploy root and `wrangler pages deploy` has no --exclude, so a second copy
   * of the middleware dropped anywhere under it would be published and compiled. The
   * relative `./_lib/…` specifiers are rewritten to absolute file URLs so the baseline
   * binds to the SAME sibling modules this branch does — the only thing under test is
   * _middleware.js itself.
   */
  function loadBaseline() {
    const source = baselineSource();
    const libUrl = pathToFileURL(join(ROOT, 'donovan-legal-site', 'functions', '_lib')).href;
    const rewritten = source.replace(/(from\s+['"])\.\/_lib\//g, `$1${libUrl}/`);
    // A baseline that still carries a relative specifier would resolve against the
    // temp dir and throw an opaque ERR_MODULE_NOT_FOUND on import — name the real cause.
    assert.doesNotMatch(rewritten, /from\s+['"]\.\.?\//, 'every relative import in the baseline must have been rewritten');
    const dir = mkdtempSync(join(tmpdir(), 'a34-baseline-'));
    const file = join(dir, 'baseline-middleware.mjs');
    writeFileSync(file, rewritten, 'utf8');
    return { file, dir };
  }

  test('router OFF: every header except the CSP still matches F-10 byte for byte', async () => {
    // ── WHAT THIS ASSERTED, AND WHY IT HAD TO CHANGE ─────────────────────────
    //
    // It asserted byte-identity: with the router off, this middleware's response was
    // indistinguishable from the pre-Perch one, so production could carry the whole
    // Perch branch and change nothing until David flipped PERCH_ROUTER.
    //
    // The voice removal and the Vantage severance break that ON PURPOSE, and only in
    // the CSP. Both are unconditional — the point of removing an origin is that no
    // deployment keeps trusting it, so gating the tightening behind the router flag
    // would leave production trusting retellai, livekit, esm.sh and vantage.ticoai.net
    // after every line of code that used them was deleted.
    //
    // ── SO THE INVARIANT IS NARROWED, NOT DROPPED ────────────────────────────
    //
    //   1. every OTHER header is still byte-identical to F-10
    //   2. the CSP may differ ONLY BY SUBTRACTION — every token in every directive
    //      must already have been in the baseline's
    //
    // (2) is what keeps this a guard rather than a rubber stamp. A removed origin
    // passes; a NEW origin, a widened directive, an 'unsafe-inline', or a whole new
    // directive all fail — which is the class of change that endangers a live site.
    const baseline = loadBaseline();
    try {
      const mod = await import(pathToFileURL(baseline.file).href);

      for (const env of [OFF, undefined, { PERCH_ROUTER: '' }]) {
        for (const ctype of ['text/html; charset=utf-8', 'text/css']) {
          const before = normalise(await headersFrom(mod, { env, ctype }));
          const after = normalise(await headersFrom({ onRequest }, { env, ctype }));
          const where = `env=${JSON.stringify(env)}, ${ctype}`;

          const strip = (h) => { const c = { ...h }; delete c['content-security-policy']; return c; };
          assert.deepEqual(strip(after), strip(before),
            `a header other than the CSP drifted from F-10 ${BASELINE_COMMIT.slice(0, 8)} (${where})`);

          if (before['content-security-policy'] === undefined) continue;

          const toks = (csp) => new Map(csp.split('; ').map((d) => {
            const [name, ...rest] = d.split(' ');
            return [name, new Set(rest)];
          }));
          const b = toks(before['content-security-policy']);
          const a = toks(after['content-security-policy']);

          for (const [name, aSet] of a) {
            assert.ok(b.has(name), `the CSP GAINED a directive vs F-10: ${name} (${where})`);
            for (const t of aSet) {
              // The nonce is per-request and is the one token that legitimately
              // differs in spelling between two runs.
              if (/^.nonce-[a-f0-9]+.$/.test(t)) continue;
              assert.ok(b.get(name).has(t),
                `the CSP GAINED "${t}" in ${name} vs F-10 ${BASELINE_COMMIT.slice(0, 8)} — this guard `
                + `permits removals only (${where})`);
            }
          }
        }
      }
    } finally {
      rmSync(baseline.dir, { recursive: true, force: true });
    }
  });

  test('CONTROL: the subtraction-only guard would actually catch an addition', () => {
    // Without this, the loop above passes just as happily if `toks` silently returned
    // empty sets — a zero-difference assertion needs a positive arm.
    const toks = (csp) => new Map(csp.split('; ').map((d) => {
      const [n, ...r] = d.split(' ');
      return [n, new Set(r)];
    }));
    const base = toks("default-src 'self'; script-src 'self'");
    const widened = toks("default-src 'self'; script-src 'self' https://evil.example");
    const gained = [...widened.get('script-src')].filter((t) => !base.get('script-src').has(t));
    assert.deepEqual(gained, ['https://evil.example'], 'the comparison must see a widened directive');
  });

  test('CONTROL: the same comparison DOES see the router-on difference', async () => {
    // Without this the test above passes just as happily against a no-op change.
    const baseline = loadBaseline();
    try {
      const mod = await import(pathToFileURL(baseline.file).href);
      const before = normalise(await headersFrom(mod, { env: ON }));
      const after = normalise(await headersFrom({ onRequest }, { env: ON }));
      assert.notDeepEqual(after, before, `the F-10 baseline ${BASELINE_COMMIT.slice(0, 8)} cannot already be emitting the locked frame headers`);
      assert.equal(before['x-frame-options'], undefined, `the F-10 baseline ${BASELINE_COMMIT.slice(0, 8)} emits no X-Frame-Options — that is the state A34 replaces`);
    } finally {
      rmSync(baseline.dir, { recursive: true, force: true });
    }
  });
});
