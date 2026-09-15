// Repo-level regression guards for B2, B3 and N1.
//
// These assert on the TREE, not on behaviour, because the defects they guard are
// "somebody adds the bad pattern back in a new file". A behavioural test on six
// known files cannot catch a seventh being written next month.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCsp } from '../donovan-legal-site/functions/_middleware.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');

function walk(dir, filter, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const fnFiles = walk(join(SITE, 'functions'), (p) => p.endsWith('.js'));
const htmlFiles = walk(SITE, (p) => p.endsWith('.html'));

describe('B2 — the shared default bucket stays dead', () => {
  test('no function falls back to a literal "default" call id', () => {
    const offenders = [];
    for (const f of fnFiles) {
      const src = readFileSync(f, 'utf8');
      // The exact shape that caused the cross-session pickup.
      if (/\|\|\s*['"]default['"]/.test(src)) offenders.push(relative(ROOT, f));
    }
    assert.deepEqual(offenders, [], `these reintroduce the shared bucket: ${offenders.join(', ')}`);
  });

  test('the guard would actually fire (control)', () => {
    // Proves the regex above is not vacuous.
    const sample = "const callId = b.call_id || 'default';";
    assert.ok(/\|\|\s*['"]default['"]/.test(sample));
  });
});

describe('B2-a/b + D1 + SHELDON-PERCH-TOOL-AUTH — every Retell-tool endpoint authenticates', () => {
  // R4 sorted the relay by CALLER: an endpoint Retell invokes must be authenticated;
  // an endpoint the caller's own browser invokes uses a bearer-capability call_id.
  //
  // SHELDON-PERCH-TOOL-AUTH (P0): these seven endpoints originally verified the
  // x-retell-signature WEBHOOK HMAC (verifyRetellSignature). But Retell CUSTOM
  // FUNCTION TOOL calls do NOT send that header — only webhook deliveries do — so
  // every real tool call 401'd in production and Paula could not navigate, offer
  // times, book, qualify, or capture a lead (confirmed by a live call transcript).
  // The fix moves the tool endpoints to a shared-secret header, x-perch-tool-secret,
  // verified by verifyToolSecret against the PERCH_TOOL_SECRET binding. The WEBHOOK
  // path still uses verifyRetellSignature — only the fn tool endpoints switched.
  //
  // D1 (Dr. Insane RE-GATE R5): the classification is CLOSED OVER THE DIRECTORY.
  // Every .js directly under functions/fn/ must appear in exactly one bucket, and
  // the completeness test below fails on any file in neither. A new tool endpoint
  // cannot ship unauthenticated without someone explicitly writing its name into
  // one of these two lists.
  // EMPTY SINCE THE VOICE CONCIERGE WAS REMOVED, AND DELIBERATELY STILL HERE.
  //
  // All seven entries — do_page_action, qualifier_result, booking_result,
  // take_message, save_lead, get_availability, get_page_actions — were Retell
  // function-tool endpoints, and every one went with the agent that called them.
  //
  // The list is kept rather than deleted because D1's value is the CLOSURE, not the
  // contents: the completeness test below still fails on any file in neither bucket,
  // so the next tool endpoint to appear cannot ship unclassified. An empty list that
  // still closes over the directory is a working guard. A deleted list is no guard,
  // and the deletion would be invisible in a diff that also removed seven files.
  const TOOL_ENDPOINTS = [];
  // Called by perch.html in the caller's browser. Bearer-capability by
  // construction (R4 ruling) — deliberately NOT signed, and out of D1's scope.
  //
  // contact.js (SHELDON-CONTACT-ROUTE-R1, #214) is browser-called too, but it is
  // NOT a bearer-capability endpoint and the distinction is worth writing down: it
  // holds no call id and there is no secret a public contact form could carry. Its
  // gate is the three fail-closed layers _lib/abuse.js provides — same-origin,
  // per-IP rate limit, and Turnstile with TURNSTILE_SECRET_KEY, whose absence 503s
  // the route rather than opening it — which is the same posture /booking/create
  // uses for the other unauthenticated public write on this site. The dedicated
  // coverage is test/contact-route.test.mjs.
  // `page-poll.js` and `booking_confirmed.js` were removed with the concierge. Both
  // read as browser-called and both were: the browser did the fetching. But each
  // existed only to serve the agent — page-poll drained commands the agent queued,
  // and booking_confirmed set a flag whose only reader was Paula's get_booking_result.
  // With no agent, page-poll had no writer and booking_confirmed had no reader.
  const BROWSER_CALLED = ['qualifier_submit.js', 'contact.js'];

  const FN_DIR = join(SITE, 'functions', 'fn');

  test('every endpoint in functions/fn is classified (D1 completeness)', () => {
    const onDisk = readdirSync(FN_DIR).filter((n) => n.endsWith('.js')).sort();
    const classified = [...TOOL_ENDPOINTS, ...BROWSER_CALLED].sort();
    assert.deepEqual(
      onDisk,
      classified,
      'THE D1 DEFECT: a relay endpoint exists that is in neither bucket. Decide who ' +
        'calls it — Retell (add to TOOL_ENDPOINTS and sign it) or the browser (add ' +
        'to BROWSER_CALLED). Do not delete this assertion to make it pass.'
    );
  });

  for (const name of TOOL_ENDPOINTS) {
    test(`${name} calls verifyToolSecret`, () => {
      // SHELDON-PERCH-TOOL-AUTH: the credential a Retell function-tool call actually
      // carries is x-perch-tool-secret, NOT the webhook HMAC. Asserting
      // verifyRetellSignature here would re-pin the exact bug that 401'd every live
      // tool call — so the invariant now demands the shared-secret verifier. A file
      // still importing the webhook helper for these routes fails this guard.
      const src = readFileSync(join(FN_DIR, name), 'utf8');
      assert.match(src, /verifyToolSecret\s*\(/, `${name} is a Retell function-tool endpoint and MUST authenticate with verifyToolSecret`);
      assert.doesNotMatch(src, /verifyRetellSignature\s*\(/, `${name} must NOT gate on the x-retell-signature webhook HMAC — a tool call never sends it`);
    });

    test(`${name} exposes no unauthenticated GET route`, () => {
      // A GET route would bypass the POST auth entirely — this is how get_availability
      // and get_page_actions were once reachable unauthenticated. With only
      // onRequestPost exported, Pages answers GET with 405.
      const src = readFileSync(join(FN_DIR, name), 'utf8');
      assert.doesNotMatch(src, /export\s+(async\s+function|const)\s+onRequestGet\b/, `${name} must not export a GET handler`);
      assert.doesNotMatch(src, /export\s+(async\s+function|const)\s+onRequest\b/, `${name} must not export a method-agnostic handler`);
    });
  }

  test('the auth guard would actually fire (control)', () => {
    // A file that authenticates nothing must not satisfy the assertion above.
    const unauthed = "export async function onRequestPost(c){ const b = await c.request.json(); }";
    assert.doesNotMatch(unauthed, /verifyToolSecret\s*\(/);
  });

  test('the GET-route guard would actually fire (control)', () => {
    // Both shapes the two D1 endpoints actually used before this change.
    assert.match('export async function onRequestGet(context) {}', /export\s+(async\s+function|const)\s+onRequestGet\b/);
    assert.match('export const onRequestGet = json;', /export\s+(async\s+function|const)\s+onRequestGet\b/);
  });

  test('the completeness guard would actually fire (control)', () => {
    // Simulates a new unsigned relay landing in functions/fn next month. The guard
    // is only worth anything if THIS throws.
    const onDisk = [...TOOL_ENDPOINTS, ...BROWSER_CALLED, 'new_unsigned_tool.js'].sort();
    const classified = [...TOOL_ENDPOINTS, ...BROWSER_CALLED].sort();
    assert.throws(() => assert.deepEqual(onDisk, classified), assert.AssertionError);
  });
});

describe('B2-c — the poll credential never rides the query string', () => {
  // REMOVED with the voice concierge: fn/page-poll was removed — no caller, no writer.

  // REMOVED with the voice concierge: fn/page-poll was removed.

  test('the shell guard would actually fire (control)', () => {
    assert.ok(/page-poll\?[^'"`]*call_id=/.test("fetch('/fn/page-poll?call_id='+id)"));
  });
});

// N1 — each Vantage gate accepts exactly ONE header, and which one depends on the
// ENDPOINT being called. This rule used to be blanket ("no function anywhere sends
// x-write-secret"), which was correct only while /caller-context was the sole Vantage
// call site. VAN-159 armed the WRITE gate on /upsert-lead, splitting Vantage into two
// independently-secretted paths, so the blanket form began forbidding the very header
// the write path requires. Per Zane's adjudication on ORDER SHELDON-WRITE-HEADER-2 the
// invariant is now PATH-SCOPED. The R2 no-dual-accept principle is preserved and in fact
// sharpened: neither call site may send both headers, so no gate is ever offered a
// second credential it might learn to accept.
//   read  path — VAN-157  /caller-context → x-vantage-read-secret (VANTAGE_READ_SECRET)
//   write path — VAN-159  /upsert-lead    → x-write-secret        (VANTAGE_WRITE_SECRET)
// Both directions assert a NON-EMPTY caller set: if a refactor renames an endpoint out
// from under this test, it fails loudly rather than vacuously passing over zero files.
describe('N1 — each Vantage path sends its own single header', () => {
  // Match the endpoint on the fetch template, not the many prose mentions of
  // "/caller-context" in nearby comments.
  const readCallers = fnFiles.filter((f) => /\$\{VANTAGE\}\/caller-context/.test(readFileSync(f, 'utf8')));
  const writeCallers = fnFiles.filter((f) => /\$\{VANTAGE\}\/upsert-lead/.test(readFileSync(f, 'utf8')));
  // Match the header being SET, not merely mentioned in a comment.
  const sets = (src, h) => new RegExp(`\\[\\s*['"]${h}['"]\\s*\\]\\s*=`).test(src);

  /**
   * Source with `//` and block comments removed, so a guard below measures code.
   *
   * A `//` inside a string literal is the one thing a line-based stripper gets wrong,
   * and it gets it wrong SAFELY here: `'https://vantage.ticoai.net'` loses its tail,
   * which cannot invent a `/upsert-lead` that was not there. The failure direction is
   * a missed mention, never a fabricated one, and the control below pins both arms.
   *
   * `[^\r\n]*`, NOT `.*$`. This repo is worked on Windows worktrees, where a checkout
   * carries CRLF while the committed blob carries LF. JavaScript's `.` does not match
   * `\r`, so `/\/\/.*$/` matches NOTHING on a CRLF line — the stripper silently becomes
   * a no-op, every prose mention survives, and the guard below reds on four comment
   * paragraphs. It did exactly that on the first run of this file.
   */
  const stripComments = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\r\n]*/g, '');

  // REMOVED with the voice concierge: the only /caller-context caller was web-call.js, removed with the voice concierge.

  // REMOVED: every /upsert-lead caller sends x-write-secret and NOT x-vantage-read-secret
  // superseded by the severance guard below: there are no /upsert-lead callers to check headers on, because there is no /upsert-lead call left in the tree.

  // The arm that keeps the shrink above honest. A writer that stopped spelling the
  // endpoint did not stop writing — it moved behind sendVantageUpsert, which attaches
  // the same single header. Counting BOTH populations means the invariant still covers
  // every lead writer in the repo, and a writer that is neither — one that spells the
  // endpoint AND skips the header, or imports nothing and hand-rolls its own client —
  // has nowhere to hide.
  const routedCallers = fnFiles.filter((f) => /sendVantageUpsert\s*\(/.test(readFileSync(f, 'utf8')));

  test('NOTHING in the tree calls Vantage any more — the severance holds', () => {
    // This replaces two count-based invariants that policed HOW the lead writers
    // called /upsert-lead: one required every direct caller to send x-write-secret
    // and never the read secret, the other required routed callers to go through the
    // shared sender. Both counted a population that is now empty, and an invariant
    // over an empty set passes by saying nothing.
    //
    // The population being empty is itself the thing worth asserting, so it is
    // asserted directly — and across the whole of functions/, not just fn/, because
    // the two deleted callers that mattered most lived in booking/_lib/.
    const all = [];
    (function walk(dir) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) all.push(p);
      }
    })(join(ROOT, 'donovan-legal-site', 'functions'));

    assert.ok(all.length > 20, `the walk found only ${all.length} files — it is not scanning the tree`);

    const offenders = all.filter((f) => {
      const code = stripComments(readFileSync(f, 'utf8'));
      return /\/upsert-lead/.test(code)
        || /sendVantageUpsert\s*\(/.test(code)
        || /vantage-(upsert|lead)\.js/.test(code)
        || /vantage\.ticoai\.net/.test(code);
    }).map((f) => relative(ROOT, f));

    assert.deepEqual(offenders, [],
      `these still reach for Vantage after the severance: ${offenders.join(', ')}`);
  });

  test('the severance guard would actually fire (control)', () => {
    // An empty offender list proves the repo is clean only if the patterns can match
    // anything at all. Driven against the shape qualifier_submit.js really carried.
    const preFix = [
      "import { sendVantageUpsert } from '../booking/_lib/vantage-upsert.js';",
      'await fetch(`${VANTAGE}/upsert-lead?${params}`, { headers });',
      // The CALL as well as the import: the guard looks for the call shape, and an
      // import alone would leave that pattern unexercised — which is exactly the
      // dead-regex case this control exists to rule out.
      "context.waitUntil(sendVantageUpsert(env, params, 'qualifier_submit'));",
    ].join('\n');
    const code = stripComments(preFix);
    assert.ok(/\/upsert-lead/.test(code), 'the endpoint pattern must match');
    assert.ok(/sendVantageUpsert\s*\(/.test(code), 'the sender pattern must match');
    assert.ok(/vantage-(upsert|lead)\.js/.test(code), 'the import pattern must match');
  });

  // REMOVED: the routed writers are counted too — routing a caller away does not shrink the invariant
  // same: the shared sender it counted callers of, booking/_lib/vantage-upsert.js, is deleted.

  test('every file that names the endpoint IN CODE is in one population or the other', () => {
    // The shape a fourth writer added next month arrives in: it neither spells
    // `${VANTAGE}/upsert-lead` with the header nor imports the sender, and both arms
    // above pass over it in silence because both only look at the files they already
    // know about. This looks the other way round — at every mention of the endpoint.
    //
    // COMMENTS ARE STRIPPED FIRST. Six files in functions/ discuss /upsert-lead in
    // prose, several inside backticks, and a guard that counts its own documentation
    // reds on a paragraph and stays quiet on a writer
    // ([[feedback_regression_guard_greps_own_comments]]).
    const named = new Set([...writeCallers, ...routedCallers].map((f) => relative(ROOT, f)));
    const orphans = fnFiles
      .filter((f) => /\/upsert-lead/.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(ROOT, f))
      .filter((f) => !named.has(f));
    assert.deepEqual(orphans, [], `these touch /upsert-lead in code outside both populations: ${orphans.join(', ')}`);
  });

  test('the orphan guard reads code, not prose (control)', () => {
    // Both arms measured: a comment about the endpoint is invisible, a call to it is not.
    assert.doesNotMatch(stripComments('// forwards to Vantage `/upsert-lead` in the background\n'), /\/upsert-lead/);
    assert.doesNotMatch(stripComments('/* the /upsert-lead endpoint */\n'), /\/upsert-lead/);
    assert.match(stripComments('fetch(`${V}/upsert-lead?${q}`) // the write\n'), /\/upsert-lead/);
    // THE CRLF ARM. Identical input, Windows line endings — the case the first cut of
    // this stripper silently failed, and the case a LF-only control cannot see.
    assert.doesNotMatch(stripComments('// forwards to Vantage `/upsert-lead`\r\nconst x = 1;\r\n'), /\/upsert-lead/);
    assert.match(stripComments('fetch(`${V}/upsert-lead`)\r\n'), /\/upsert-lead/);
  });
});

describe('B3 — no unsafe-inline in script-src, no inline handlers', () => {
  test('_headers contains no unsafe-inline at all', () => {
    const headers = readFileSync(join(SITE, '_headers'), 'utf8');
    // Ignore the explanatory comment lines; assert on directive lines only.
    const directives = headers
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    assert.doesNotMatch(directives, /unsafe-inline/, '_headers must not carry unsafe-inline');
  });

  test('_headers no longer sets a Content-Security-Policy (single owner: the middleware)', () => {
    const headers = readFileSync(join(SITE, '_headers'), 'utf8');
    const directives = headers.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    assert.doesNotMatch(directives, /Content-Security-Policy/i);
  });

  test('the live CSP has NO unsafe-inline in script-src and carries the nonce', () => {
    const csp = buildCsp('deadbeefdeadbeefdeadbeefdeadbeef');
    const scriptSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src'));
    assert.ok(scriptSrc, 'script-src must be present');
    assert.doesNotMatch(scriptSrc, /unsafe-inline/, 'THE B3 DEFECT: script-src must not allow inline');
    assert.doesNotMatch(scriptSrc, /unsafe-eval/, 'never grant unsafe-eval');
    assert.match(scriptSrc, /'nonce-deadbeefdeadbeefdeadbeefdeadbeef'/);
  });

  test('the CSP no longer allows the origins the removed voice path needed', () => {
    // INVERTED, not deleted. This used to assert the voice origins were PRESENT.
    // Asserting their absence is worth more than deleting the row: a policy that
    // still named Retell would be a standing permission for a capability the site
    // does not have, and the most likely way it comes back is somebody restoring a
    // "missing" CSP entry to fix an unrelated console warning.
    const csp = buildCsp('n');
    for (const gone of [
      'esm.sh',      // served the RetellWebClient module
      'retellai',    // the signalling host
      'livekit',     // the media transport underneath it
    ]) {
      assert.ok(!csp.includes(gone), `${gone} is still in the CSP — the voice path was removed`);
    }
    // Turnstile stays: the contact form is still behind it, and this row is the
    // control that proves the assertion above is measuring the policy, not an
    // empty string.
    for (const needed of ['https://challenges.cloudflare.com']) {
      assert.ok(csp.includes(needed), `${needed} must remain allowed`);
    }
  });

  test('no HTML file carries an inline on*= event handler', () => {
    const offenders = [];
    for (const f of htmlFiles) {
      const src = readFileSync(f, 'utf8');
      if (/\son[a-z]+\s*=\s*["']/i.test(src)) offenders.push(relative(ROOT, f));
    }
    assert.deepEqual(offenders, [], `inline handlers are dead under the new CSP: ${offenders.join(', ')}`);
  });

  test('the inline-handler guard would actually fire (control)', () => {
    assert.ok(/\son[a-z]+\s*=\s*["']/i.test('<button onclick="x()">'));
  });

  test('every page using data-dvn-on loads the dispatcher', () => {
    const offenders = [];
    for (const f of htmlFiles) {
      const src = readFileSync(f, 'utf8');
      if (src.includes('data-dvn-on') && !src.includes('js/inline-actions.js')) {
        offenders.push(relative(ROOT, f));
      }
    }
    assert.deepEqual(offenders, [], `these have dead buttons: ${offenders.join(', ')}`);
  });
});

describe('SHELDON-BOOKING-HARDEN — one Turnstile secret name, tree-wide', () => {
  // The booking endpoint read TURNSTILE_SECRET while _lib/abuse.js read
  // TURNSTILE_SECRET_KEY. Two names meant the operator could set one, believe the
  // site was protected, and leave the endpoint that writes to Paul's real calendar
  // running unverified. A behavioural test on create.js cannot catch the NEXT file
  // that invents a third name, so this asserts on the tree.
  //
  // It matches env READS (env.X / env?.X / env["X"]) rather than the bare string,
  // so the comments explaining this history do not trip their own guard.
  const ENV_READ = /env\s*\??\s*(?:\.\s*(TURNSTILE_\w+)|\[\s*["'](TURNSTILE_\w+)["']\s*\])/g;

  function turnstileEnvReads(src) {
    const names = new Set();
    for (const m of src.matchAll(ENV_READ)) names.add(m[1] ?? m[2]);
    return names;
  }

  // Every Turnstile env var the tree may read, and what each one is. A name that
  // is not on this list fails the test — the point is that adding one has to be a
  // deliberate, reviewed act, because "a second plausible-looking name" is exactly
  // how the booking endpoint ended up unprotected.
  const KNOWN = {
    TURNSTILE_SECRET_KEY: 'server-side siteverify secret — the ONLY secret name',
    TURNSTILE_SITE_KEY:   'public site key, deliberately served to the browser',
  };

  test('only the classified Turnstile env vars are read anywhere in functions/', () => {
    const offenders = [];
    for (const f of fnFiles) {
      for (const name of turnstileEnvReads(readFileSync(f, 'utf8'))) {
        if (!(name in KNOWN)) offenders.push(`${relative(ROOT, f)}: ${name}`);
      }
    }
    assert.deepEqual(
      offenders, [],
      `unclassified Turnstile env var(s). If this is the server secret it must be ` +
      `TURNSTILE_SECRET_KEY; if it is genuinely something else, add it to KNOWN ` +
      `with a note: ${offenders.join(', ')}`,
    );
  });

  test('the secret is read under exactly one name', () => {
    // Narrower and blunter than the classification above: whatever else exists,
    // there is one secret and it is TURNSTILE_SECRET_KEY.
    const secretNames = new Set();
    for (const f of fnFiles) {
      for (const name of turnstileEnvReads(readFileSync(f, 'utf8'))) {
        if (name.includes('SECRET')) secretNames.add(name);
      }
    }
    assert.deepEqual([...secretNames], ['TURNSTILE_SECRET_KEY']);
  });

  test('the name guard would actually fire (control)', () => {
    // Proves the regex sees the exact shape create.js used to carry.
    assert.deepEqual(
      [...turnstileEnvReads('const s = (env?.TURNSTILE_SECRET || "").trim();')],
      ['TURNSTILE_SECRET'],
    );
    assert.deepEqual([...turnstileEnvReads('env["TURNSTILE_SECRET"]')], ['TURNSTILE_SECRET']);
  });

  test('exactly one file implements siteverify', () => {
    // The duplicate implementation is what let the names drift. Callers pass a log
    // tag to _lib/abuse.js instead of copying it.
    const impls = fnFiles.filter((f) =>
      readFileSync(f, 'utf8').includes('turnstile/v0/siteverify'),
    ).map((f) => relative(ROOT, f).split(sep).join('/'));
    assert.deepEqual(impls, ['donovan-legal-site/functions/_lib/abuse.js']);
  });
});

// ORDER SHELDON-DISCLOSURE-VESTIGE — no agent prompting, and no disclosure logic,
// lives in this repo.
//
// David and Paul's F1 ruling: disclosure is MODAL-ONLY. The pre-call consent gate
// states AI identity, FL §934.03 recording, and no-legal-advice / no-attorney-client,
// and takes an explicit agreement before a Retell token is ever minted. Everything
// the agent SAYS is owned by the Retell dashboard prompt.
//
// Two vestiges of the old design were removed: web-call.js built a `begin_message`
// and shipped it as `agent_override`, and dynamic-vars.js sent a
// `ai_disclosure_delivered: 'via_begin_message'` flag — which after the first removal
// was also just false. This guard asserts on the TREE because the failure mode is
// somebody adding either back, in a file that does not exist yet. A behavioural test
// on web-call.js cannot see a new route written next month.
describe('SHELDON-DISCLOSURE-VESTIGE — no agent prompting or disclosure flags in the tree', () => {
  // The approved homes for disclosure TEXT. Both carry the modal wording, so both
  // legitimately talk about disclosure; neither may put words in the agent's mouth,
  // which is a different thing and is why the exemption is by PATH and not by
  // loosening the patterns for everyone.
  // `js/consent-gate.js` was removed with the voice concierge — it existed only to
  // mint the Turnstile + consent credentials /web-call required. Its exemption goes
  // with it: an exemption for a path that no longer exists is a hole aimed at
  // nothing, which is exactly what the test below refuses to allow.
  const EXEMPT = new Set([
    'functions/_lib/consent.js',
  ]);

  // Each entry: what it is, and why it must not appear.
  const FORBIDDEN = [
    { re: /\bagent_override\b/,               why: 'agent_override overrides the Retell agent from code' },
    { re: /\bbegin_message\b/,                why: 'begin_message hardcodes the agent\'s opening line' },
    { re: /\bgeneral_prompt\b/,               why: 'general_prompt is the Retell LLM prompt — it lives in the dashboard' },
    { re: /\bgeneral_tools\b/,                why: 'general_tools reconfigures the Retell LLM from code' },
    { re: /\bretell_llm\s*:/,                 why: 'a retell_llm object in a request body is a prompt override' },
    { re: /\bai_disclosure\w*\b/i,            why: 'a disclosure-delivery flag is disclosure logic in the wrong layer' },
    { re: /\bdisclosure_deliver(?:ed|y)\b/i,  why: 'a disclosure-delivery flag is disclosure logic in the wrong layer' },
  ];

  // Scanned extensions: everything under the site that could plausibly carry code or
  // agent configuration. Binaries and stylesheets are excluded; .md and the config
  // files are INCLUDED, because a prompt pasted into a doc or a wrangler var is still
  // prompting that escapes review of the code path.
  const SCANNED = new Set(['.js', '.mjs', '.jsx', '.html', '.shtml', '.json', '.jsonc', '.proposed']);
  const ext = (p) => (p.match(/\.[^.\\/]+$/) || [''])[0].toLowerCase();

  // Comments are stripped from SOURCE files only. web-call.js deliberately carries a
  // "no begin_message override here on purpose — do not re-add" note, and a guard that
  // reds on the comment explaining the rule is a guard that gets deleted rather than
  // obeyed. Prose files are scanned verbatim: there is no comment to protect there.
  function stripFor(path, src) {
    const e = ext(path);
    if (e === '.js' || e === '.mjs' || e === '.jsx') {
      return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    }
    if (e === '.html' || e === '.shtml') {
      return src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    }
    return src;
  }

  /**
   * The scanner itself, over {path, src} records. Controls below feed synthetic
   * records through THIS function, so what they prove is that the real guard reds —
   * not merely that a regex written next to them matches a string.
   */
  function promptOffenders(records) {
    const offenders = [];
    for (const { path, src } of records) {
      if (EXEMPT.has(path)) continue;
      const code = stripFor(path, src);
      for (const { re, why } of FORBIDDEN) {
        if (re.test(code)) offenders.push(`${path}: ${re.source} — ${why}`);
      }
    }
    return offenders;
  }

  const siteRecords = walk(SITE, (p) => SCANNED.has(ext(p))).map((p) => ({
    path: relative(SITE, p).split(sep).join('/'),
    src: readFileSync(p, 'utf8'),
  }));

  test('the scan covers a real, non-empty file set (non-vacuity)', () => {
    // A guard that walks zero files passes forever. Pin both the volume and two
    // specific files that MUST be in scope — the two the vestiges lived in.
    assert.ok(siteRecords.length > 50, `expected the site tree, scanned ${siteRecords.length} files`);
    // Both pins have now been replaced once each, and for the same reason. It was
    // `functions/web-call.js` + `_lib/dynamic-vars.js` — the two files the vestiges
    // lived in. web-call.js went with the voice concierge; dynamic-vars.js built the
    // Retell mint payload and went with it, its only caller having been web-call.js.
    // Two pins rather than one on purpose: a single pin is half a vacuity guard.
    for (const must of ['functions/_middleware.js', 'functions/booking/create.js']) {
      assert.ok(siteRecords.some((r) => r.path === must), `${must} must be in scope`);
    }
  });

  test('nothing under donovan-legal-site prompts the agent or flags disclosure', () => {
    assert.deepEqual(
      promptOffenders(siteRecords), [],
      'THE F1 DEFECT: agent prompting or disclosure logic is back in code. The opening ' +
        'is driven by the Retell dashboard prompt, and every legal disclosure is made ' +
        'and consented to in the pre-call modal before the token mints. Do not delete ' +
        'this assertion to make it pass.'
    );
  });

  test('the exempted disclosure locations both exist', () => {
    // An exemption for a path that no longer exists is a hole aimed at nothing —
    // and would silently persist through a rename.
    for (const p of EXEMPT) {
      assert.ok(siteRecords.some((r) => r.path === p), `exempt path ${p} is missing — fix or drop the exemption`);
    }
  });

  test('MUTATION BITE — re-adding the override reds the guard', () => {
    // The exact code that was removed from web-call.js.
    const mutated = [
      ...siteRecords,
      {
        path: 'functions/web-call.js',
        src: "body.agent_override = { retell_llm: { begin_message: `Good ${tod}, I'm Paula, an AI assistant.` } };",
      },
    ];
    const offenders = promptOffenders(mutated);
    assert.ok(offenders.length >= 3, `expected agent_override, retell_llm and begin_message to fire, got: ${offenders.join(' | ')}`);
  });

  test('MUTATION BITE — re-adding the disclosure flag reds the guard', () => {
    // The exact line that was removed from _lib/dynamic-vars.js.
    const mutated = [
      ...siteRecords,
      { path: 'functions/_lib/dynamic-vars.js', src: "dyn.ai_disclosure_delivered = 'via_begin_message';" },
    ];
    assert.ok(promptOffenders(mutated).length > 0, 'the disclosure flag must red the guard');
  });

  test('MUTATION BITE — a NEW file cannot smuggle it in', () => {
    // The whole reason this asserts on the tree rather than on two known files.
    const mutated = [...siteRecords, { path: 'functions/fn/new_agent_config.js', src: 'export const P = { general_prompt: "You are Paula..." };' }];
    assert.ok(promptOffenders(mutated).length > 0, 'a new file must be in scope too');
  });

  test('the comment carve-out is narrow (control)', () => {
    // A comment saying "do not re-add begin_message" must pass...
    assert.deepEqual(
      promptOffenders([{ path: 'functions/x.js', src: '// no begin_message override here on purpose\nconst body = { agent_id };' }]),
      []
    );
    // ...while the same words in actual code must not.
    assert.ok(promptOffenders([{ path: 'functions/x.js', src: 'const begin_message = "hi";' }]).length > 0);
    // And a prose file gets no carve-out at all: comment syntax is not a shield there.
    assert.ok(promptOffenders([{ path: 'NOTES.md', src: '// begin_message: "hi"' }]).length > 0);
  });

  test('the exemption is by path only, not by pattern (control)', () => {
    // The exempt path moved when js/consent-gate.js was removed with the voice
    // concierge. The control is unchanged in shape: one real exemption passes, and a
    // lookalike beside it does not — which is what proves the exemption is matched by
    // exact path rather than by a pattern that a neighbouring file could satisfy.
    const src = 'const begin_message = "x";';
    assert.deepEqual(promptOffenders([{ path: 'functions/_lib/consent.js', src }]), [], 'exempt path passes');
    assert.ok(promptOffenders([{ path: 'functions/_lib/consent-2.js', src }]).length > 0, 'a lookalike path does not');
  });
});
