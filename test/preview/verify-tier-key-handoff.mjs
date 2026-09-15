// ── SHELDON-PERCH-TIER-KEY-HANDOFF — the Preview verifier ────────────────────
//
// Order SHELDON-PERCH-TIER-KEY-HANDOFF · ticket #95 W2 · ADAM key audit H2.
//
//   node test/preview/verify-tier-key-handoff.mjs https://<hash>.donovan-site.pages.dev
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// Named `verify-*.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs a
// live deployment and a browser, neither of which CI has.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT ───────────────────────────────────────
//
//   REAL, against the live Preview deployment
//     • the four tier roots, probed unauthenticated: the members' own Basic-auth
//       door must still answer 401 (or 503, the fail-closed answer when a tier's
//       credentials are unset for that environment). Task 3.
//     • the DEPLOYED js/perch/command-channel.js — imported from the Preview
//       origin inside a real browser and driven with a recording host. The tier
//       refusal and the ordinary-navigation control are measured on the bytes the
//       edge served, not on the bytes in this worktree
//       ([[feedback_prove_code_ships_by_scanning_the_binary]]).
//     • the DEPLOYED js/perch/swap-policy.js — its real excludeReason() must
//       still classify the tier paths as `tier-basic-auth`. That exclusion is
//       what makes a real member's click a document navigation, which is what
//       raises the credential prompt.
//     • the routing destinations: /engagement (where the handoff points) and the
//       ordinary nav targets still answer 200.
//     • /fn/do_page_action and /fn/get_page_actions answer 401 unauthenticated.
//
//   NOT REAL, and why
//     • the AUTHENTICATED tool responses. Reading either needs
//       PERCH_TOOL_SECRET, and this order forbids entering or reading a secret.
//       The handoff body and the shortened advertised list are held in CI
//       instead, against the real handlers — test/perch-tier-key-handoff.test.mjs
//       §1 and §2.
//     • a live Retell call. It needs a Turnstile solve, which refuses automation
//       by design ([[feedback_turnstile_not_agent_verifiable]]). The one thing a
//       call would add — that Paula's ENUM no longer holds the four keys — lives
//       in the Retell dashboard, not in this repo. It is David's task.
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// Every request below is a GET, or a POST that is expected to be REFUSED at the
// auth gate before it can reach a handler. No credential is sent. No booking
// endpoint is touched — an "error path" probe once booked a real Clio
// appointment ([[feedback_negative_path_probe_can_write]]).

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = ((process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : process.env.PREVIEW_URL || '')
  .replace(/\/$/, '');

if (!BASE) {
  console.error('usage: node test/preview/verify-tier-key-handoff.mjs https://<hash>.donovan-site.pages.dev');
  process.exit(0);
}

const TIERS = ['gold', 'platinum', 'diamond', 'reserve'];
const out = { base: BASE, checks: [], writes: [], verdict: 'PENDING' };

function ok(name, pass, detail) {
  out.checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return !!pass;
}

/**
 * A fresh Pages Preview 404s its own assets for up to a minute after the build
 * reports done, and "Not Found" is served as a 200 page — so readiness must look
 * at BYTES, not at a status code.
 * [[feedback_fresh_pages_preview_404s_assets]] · [[feedback_preview_not_found_is_a_200_page]]
 */
async function waitReady(tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/js/perch/command-channel.js`, { redirect: 'follow' });
      const t = r.ok ? await r.text() : '';
      if (r.ok && t.includes('createCommandChannel')) return { ready: true, attempt: i + 1 };
    } catch (e) { /* propagating */ }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { ready: false, attempt: tries };
}

const ready = await waitReady();
ok('0. the Preview is serving its own assets', ready.ready, `attempt ${ready.attempt}`);
if (!ready.ready) {
  out.verdict = 'NO-GO';
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// ── 1. Task 3: the members' door is still shut, and still a door ─────────────
// 401 = configured and challenging. 503 = configured to fail closed with the
// credentials unset for this environment (tier-auth.js). 200 would mean the tier
// went public, which is the one answer that is a NO-GO.
for (const tier of TIERS) {
  const r = await fetch(`${BASE}/${tier}/`, { redirect: 'manual' });
  const wa = r.headers.get('www-authenticate') || '';
  const guarded = r.status === 401 || r.status === 503;
  ok(`1.${tier} — /${tier}/ is still guarded, unauthenticated`, guarded,
    `HTTP ${r.status}${wa ? ` · WWW-Authenticate: ${wa}` : ''}`);
  if (r.status === 401) {
    ok(`1.${tier}.challenge — the 401 carries a Basic challenge (this is what prompts a real member)`,
      /basic/i.test(wa), wa || '(absent)');
  }
}

// ── 2. the deployed client refuses a tier navigate ───────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/engagement`, { waitUntil: 'domcontentloaded' });

/**
 * A fresh deployment can answer a plain `fetch` for an asset while the BROWSER's
 * module import of the same URL still 404s — the propagation window is per-edge,
 * so §0's readiness probe is necessary but not sufficient
 * ([[feedback_fresh_pages_preview_404s_assets]]). Retry, then report the failure
 * as a result rather than a crash.
 */
async function evaluateWithRetry(fn, arg, tries = 6) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    last = await page.evaluate(fn, arg);
    if (!last || !last.error) return last;
    await new Promise((r) => setTimeout(r, 5000));
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  return last;
}

// The module is imported from the Preview ORIGIN, so this drives the deployed
// bytes. Everything inside a module runs in strict mode, which is why the
// dispatch is done there and not in a sloppy-mode evaluate body
// ([[feedback_page_evaluate_runs_sloppy_mode]]).
// Wrapped, and the whole evaluate is wrapped again below: a module that fails to
// import is a RESULT (a Preview that is not serving what it was asked to serve),
// not a stack trace. This file promises exit 0 either way; a throw here would
// break that promise and lose every check after it.
const channel = await evaluateWithRetry(async (base) => {
  let mod;
  try {
    mod = await import(`${base}/js/perch/command-channel.js`);
  } catch (e) {
    return { error: 'import failed: ' + String((e && e.message) || e) };
  }
  if (typeof mod.createCommandChannel !== 'function') return { error: 'createCommandChannel absent' };

  function drive(target) {
    const gos = [];
    const host = { drive() {}, go(h) { gos.push(h); }, afterNavigate() {}, onContentReady() {} };
    const ch = mod.createCommandChannel(host, {}, window);
    const rec = ch.dispatch({ cmd: 'navigate', target });
    ch.stop();
    return { gos, rec };
  }

  return {
    hasIsTierPath: typeof mod.isTierPath === 'function',
    gold: drive('/gold/'),
    platinum: drive('/platinum/'),
    diamond: drive('/diamond/'),
    reserve: drive('/reserve/'),
    control: drive('/contact.html'),
    controlBook: drive('/book.html'),
  };
}, BASE);

if (channel.error) {
  ok('2. the deployed command channel is importable', false, channel.error);
} else {
  ok('2.0 the deployed module exports the tier predicate', channel.hasIsTierPath);
  for (const tier of TIERS) {
    const r = channel[tier];
    ok(`2.${tier} — the DEPLOYED channel refuses navigate /${tier}/`,
      r.gos.length === 0 && r.rec && r.rec.refused === 'tier_basic_auth',
      `host.go calls: ${JSON.stringify(r.gos)} · refused: ${r.rec && r.rec.refused}`);
  }
  // THE CONTROL. Without it this section would pass against a channel whose
  // navigate branch had simply been deleted — which would break every nav key.
  ok('2.control — an ordinary navigate STILL reaches host.go',
    channel.control.gos.length === 1 && channel.control.gos[0] === '/contact.html',
    JSON.stringify(channel.control.gos));
  ok('2.control-book — /book still navigates (the booking path is untouched)',
    channel.controlBook.gos.length === 1 && channel.controlBook.gos[0] === '/book.html',
    JSON.stringify(channel.controlBook.gos));
}

// ── 3. the deployed router policy still excludes the tiers ───────────────────
const policy = await evaluateWithRetry(async (base) => {
  let mod;
  try {
    mod = await import(`${base}/js/perch/swap-policy.js`);
  } catch (e) {
    return { error: 'import failed: ' + String((e && e.message) || e) };
  }
  const r = {};
  for (const p of ['/gold/', '/platinum/', '/diamond/', '/reserve/', '/engagement.html', '/contact.html']) {
    const ex = mod.excludeReason(p);
    r[p] = ex ? ex.id : null;
  }
  return r;
}, BASE);

if (policy.error) {
  ok('3. the deployed swap-policy is importable', false, policy.error);
} else {
  for (const tier of TIERS) {
    ok(`3.${tier} — the DEPLOYED swap-policy still excludes /${tier}/ as tier-basic-auth`,
      policy[`/${tier}/`] === 'tier-basic-auth', String(policy[`/${tier}/`]));
  }
  ok('3.control — ordinary content pages are still interceptable',
    policy['/engagement.html'] === null && policy['/contact.html'] === null,
    `engagement:${policy['/engagement.html']} contact:${policy['/contact.html']}`);
}

await browser.close();

// ── 4. the handoff destination and the rest of navigation still resolve ──────
for (const path of ['/engagement', '/contact', '/book', '/real-estate', '/home', '/tools']) {
  const r = await fetch(`${BASE}${path}`, { redirect: 'follow' });
  const body = r.ok ? await r.text() : '';
  // A Pages "Not Found" page is served as a 200 — check the bytes.
  const real = r.ok && body.length > 2000 && !/^\s*Not Found\s*$/i.test(body);
  ok(`4.${path} — still served`, real, `HTTP ${r.status} · ${body.length} bytes`);
}

// ── 5. the tool endpoints are alive and still refuse an unauthenticated call ─
// No secret is sent. A 401 is the expected — and only acceptable — answer.
for (const fn of ['do_page_action', 'get_page_actions']) {
  const r = await fetch(`${BASE}/fn/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ call: { call_id: 'verify-no-op' }, args: { action_key: 'goto_gold' } }),
  });
  ok(`5.${fn} — refuses an unauthenticated call (401), so nothing was queued`,
    r.status === 401, `HTTP ${r.status}`);
  out.writes.push({ endpoint: `/fn/${fn}`, status: r.status, queued: r.status === 401 ? false : 'UNKNOWN' });
}

const failed = out.checks.filter((c) => !c.pass);
out.verdict = failed.length === 0 ? 'GO' : 'NO-GO';
out.summary = `${out.checks.length - failed.length}/${out.checks.length} checks pass`;
out.note = 'The authenticated tool bodies and Paula’s Retell enum are NOT verifiable here — see docs/SHELDON-PERCH-TIER-KEY-HANDOFF.md §7.';

const evidence = fileURLToPath(new URL('./tier-key-handoff-evidence.json', import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log(`\n${out.verdict} — ${out.summary}`);
console.log(`evidence: ${evidence}`);
process.exit(0);
