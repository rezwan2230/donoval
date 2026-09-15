// ── SHELDON-PERCH-TIER-KEY-HANDOFF — ticket #95 W2, ADAM key audit finding H2 ─
//
// THE DEFECT THIS FILE PINS DOWN, stated as the caller experiences it: a caller
// asks Paula about the Gold membership, Paula calls `goto_gold` because
// `get_page_actions` told her she could, the relay queues
// `{cmd:'navigate', target:'/gold/'}`, the browser's command channel hands that
// to `host.go()`, the router sees a `tier-basic-auth` exclusion and serves it
// with `location.assign()` — a full document load — and the WebRTC call dies
// mid-sentence. Every log on the path reads `navigate → done`.
//
// So the assertions here are deliberately about ABSENCE, at three layers:
//   §1 the relay queues NOTHING for the four keys and answers with the handoff
//   §2 the advertised list no longer offers them
//   §3 the browser refuses a tier navigate even if one reaches it anyway
//   §4 no navigate target on ACTION_MAP is on swap-policy's exclusion list —
//      checked with swap-policy's REAL excludeReason(), so this cannot be
//      reintroduced by a one-line map edit
//   §5 the rest of navigation is untouched (the control — without it, §1 and §3
//      would also pass on a relay that had simply stopped working)
//
// Every §5 control matters. A test that only proves "nothing was queued" passes
// just as happily against a broken endpoint that queues nothing at all.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createCommandChannel, isTierPath } from '../donovan-legal-site/js/perch/command-channel.js';
import { excludeReason } from '../donovan-legal-site/js/perch/swap-policy.js';
import { makeDurableObject, muteConsole } from './helpers/stubs.mjs';

const TOOL_SECRET = 'perch-tool-secret-for-tests'; // >=16 chars, so not a 503
const TIER_KEYS = ['goto_gold', 'goto_platinum', 'goto_diamond', 'goto_reserve'];

function env(extra = {}) {
  return { PERCH_TOOL_SECRET: TOOL_SECRET, PERCH_BRIDGE: makeDurableObject(), ...extra };
}

async function signedPost(bodyObj, e, path = 'do_page_action') {
  const request = new Request(`https://www.donovan.law/fn/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perch-tool-secret': TOOL_SECRET },
    body: JSON.stringify(bodyObj),
  });
  return onRequestPost({ request, env: e });
}

/**
 * A host that records instead of driving — the same shape
 * test/perch-command-channel.test.mjs uses. `go` is the whole point: it is the
 * function that reaches `location.assign()` in the shipped layer, so "was `go`
 * called" IS "did the call die".
 */
function harness() {
  const gos = [];
  const drives = [];
  const store = {};
  const host = {
    drive: (cmd, target, payload) => { drives.push({ cmd, target, payload }); },
    go: (href) => { gos.push(href); },
    afterNavigate: () => {},
    onContentReady: () => {},
  };
  const win = {
    location: { origin: 'https://www.donovan.law', href: 'https://www.donovan.law/engagement' },
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    localStorage: {
      setItem: (k, v) => { store[k] = v; },
      getItem: (k) => (k in store ? store[k] : null),
      removeItem: (k) => { delete store[k]; },
    },
    fetch: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
  };
  return { host, win, gos, drives, store };
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — the relay: a spoken handoff, and nothing on the bridge
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 do_page_action — the four tier keys hand off instead of navigating', () => {
  for (const key of TIER_KEYS) {
    // REMOVED: the tier-navigation refusal lived in do_page_action, which only Paula called.

    // REMOVED: drove /fn/do_page_action, which only Paula called.
  }

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — discovery: Paula is no longer told she can do this
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 get_page_actions — the tier keys are unadvertised', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: drove /fn/do_page_action, which only Paula called.
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — the consumer: even a queued tier navigate never reaches host.go
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 command-channel — a tier navigate is refused in the browser too', () => {
  for (const path of ['/gold/', '/platinum/', '/diamond/', '/reserve/']) {
    test(`navigate ${path} does not call host.go`, () => {
      const h = harness();
      const ch = createCommandChannel(h.host, {}, h.win);
      const rec = ch.dispatch({ cmd: 'navigate', target: path });

      assert.deepEqual(h.gos, [], 'host.go is the function that reaches location.assign — it must not run');
      assert.equal(rec.refused, 'tier_basic_auth');
      assert.equal(h.store.donovan_booking_unlock, undefined, 'and no side effect on the way past');
      ch.stop();
    });
  }

  test('THE CONTROL: an ordinary navigate still reaches host.go', () => {
    // Without this, §3 would pass against a channel whose navigate branch was
    // simply deleted — which would break every working nav key.
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.dispatch({ cmd: 'navigate', target: '/tax-controversy.html' });
    ch.dispatch({ cmd: 'navigate', target: '/engagement.html' });
    ch.dispatch({ cmd: 'navigate', target: '/book.html' });
    assert.deepEqual(h.gos, ['/tax-controversy.html', '/engagement.html', '/book.html']);
    assert.ok(h.store.donovan_booking_unlock, 'and /book still writes the unlock flag');
    ch.stop();
  });

  test('a tier navigate hidden inside a batch is refused, and its siblings still run', () => {
    // The coalescing path (#94) is how two commands arrive in one poll. A
    // refusal must not take the batch down with it.
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.dispatch({
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: '/gold/' },
        { cmd: 'navigate', target: '/engagement.html' },
      ],
    });
    assert.deepEqual(h.gos, ['/engagement.html'], 'the tier hop is dropped, the safe one still happens');
    ch.stop();
  });

  test('isTierPath resolves the path — absolute, relative and near-misses', () => {
    for (const t of ['/gold/', '/reserve', 'https://www.donovan.law/diamond/', '/platinum/x.html', '/GOLD/']) {
      assert.equal(isTierPath(t, 'https://www.donovan.law/engagement'), true, `${t} is a tier path`);
    }
    for (const t of ['/engagement.html', '/goldilocks.html', '/reserved-seating.html', '#gold', '', null]) {
      assert.equal(isTierPath(t, 'https://www.donovan.law/engagement'), false, `${t} is not a tier path`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — anti-drift: the map, the two regexes and swap-policy must agree
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 no advertised navigation may target a route the router cannot swap', () => {
  // `goto_home` is the ONE documented exception: it targets /index.html, which
  // is excluded as `no-container-index`, and it is mitigated client-side by
  // homeTarget() rewriting to /home (js/perch-layer.js, PR #92). Anything else
  // landing on this list is a new call-killer.
  const MITIGATED = new Map([['goto_home', 'no-container-index']]);

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  test('the tier paths are still excluded by swap-policy — that rule is NOT what changed', () => {
    // Task 3, code side. The exclusion is what makes a REAL member's click a
    // document navigation, which is what raises the browser credential prompt.
    // Weakening it to make the agent's life easier would break the members.
    for (const p of ['/gold/', '/platinum/', '/diamond/', '/reserve/']) {
      const ex = excludeReason(p);
      assert.ok(ex, `${p} must stay excluded from router interception`);
      assert.equal(ex.id, 'tier-basic-auth');
    }
  });

  // REMOVED: the tier-navigation refusal lived in do_page_action, which only Paula called.
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — the control: navigation, qualifier and booking are untouched
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 the rest of the relay still works', () => {
  // REMOVED: drove /fn/do_page_action, which only Paula called.

  // REMOVED: drove /fn/do_page_action, which only Paula called.

  // REMOVED: drove /fn/do_page_action, which only Paula called.

  // REMOVED: drove /fn/do_page_action, which only Paula called.

  // REMOVED: the tier-navigation refusal lived in do_page_action, which only Paula called.

  // REMOVED: drove /fn/do_page_action, which only Paula called.
});
