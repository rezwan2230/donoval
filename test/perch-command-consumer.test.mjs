// ── SHELDON-PERCH-COMMAND-CHANNEL — the consumer INSIDE the persistent layer ──
//
// Order SHELDON-PERCH-COMMAND-CHANNEL · priority regression from the A51 cutover.
//
// ── WHY THIS IS ITS OWN FILE ─────────────────────────────────────────────────
// `registerRouter` in js/perch/surface.js is first-caller-wins for the life of a
// module instance, and the whole point of these assertions is what the layer does
// BEFORE a router exists and AFTER one registers. Those are two states of one
// module, so they need one process and one ordering — and `node --test` gives each
// file its own process. Putting them in test/perch-command-channel.test.mjs would
// have made the off-state assertion depend on which describe() ran first.
//
// ── WHAT IT PROVES ───────────────────────────────────────────────────────────
// The REAL js/perch-layer.js, running in a real document, against the same
// js/perch/surface.js module instance this file imports — so the router handshake
// below is the handshake, not a stand-in. The harness that makes that possible is
// the one test/perch-surface.test.mjs §4 already uses; it rewrites the browser's
// absolute `/js/…` specifiers to relative ones and imports the result. Nothing
// inside donovan-legal-site/ is modified.
//
// §1  router OFF — production today. Nothing is built, and that is the acceptance.
// §2  router ON  — the consumer mounts on the registration, with no second orb.
// §3  bindCall   — the launcher's call id starts the poll; release stops it.
// §4  the drive  — goto navigates through the router; open_qualifier shows the card.
// §5  goto_home  — the one target the exclusion list would have hard-navigated.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { CONTAINER_ID, LAYER_ID } from '../donovan-legal-site/js/perch/placement.js';
import { registerRouter, hasRouter } from '../donovan-legal-site/js/perch/surface.js';
import { excludeReason } from '../donovan-legal-site/js/perch/swap-policy.js';
import { POLL_MS } from '../donovan-legal-site/js/perch/command-channel.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'donovan-legal-site');

/** Run the REAL js/perch-layer.js. Same harness as test/perch-surface.test.mjs §4. */
async function loadLayer() {
  const src = fs.readFileSync(path.join(SITE, 'js', 'perch-layer.js'), 'utf8')
    .replace(/(['"])\/js\//g, '$1../donovan-legal-site/js/');
  const file = path.join(HERE, `.cmdchan-layer-harness-${process.pid}.mjs`);
  fs.writeFileSync(file, src);
  try {
    return await import('./' + path.basename(file) + '?cmdchan=1');
  } finally {
    fs.unlinkSync(file);
  }
}

let env = null;
let layer = null;
let surface = null;
/** Every href the registered router was asked to navigate to. */
const navigated = [];
/** Every fetch the page made: { url, headers }. */
const fetches = [];
/** What the next /fn/page-poll should serve. Consumed once, like the real DO. */
let queued = null;

function browserGlobals() {
  const dom = new JSDOM(
    `<!doctype html><body><main id="${CONTAINER_ID}"><p>content</p></main></body>`,
    { url: 'https://donovan-site.pages.dev/contact' },
  );
  const win = dom.window;

  win.fetch = async (url, init) => {
    fetches.push({ url: String(url), headers: (init && init.headers) || {} });
    if (String(url) === '/fn/page-poll') {
      const d = queued; queued = null;
      return { ok: true, json: async () => (d || {}) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  win.scrollTo = () => {};
  win.scrollBy = () => {};
  win.HTMLElement.prototype.scrollIntoView = () => {};

  const saved = {};
  const globals = {
    window: win,
    document: win.document,
    location: win.location,
    CustomEvent: win.CustomEvent,
    fetch: win.fetch,
    // jsdom's interval, so window.close() clears it — Node's global setInterval
    // would keep the layer's tick counter and the 1.2 s poll alive past the test.
    //
    // setTimeout is DELIBERATELY not swapped: jsdom's implementation calls the
    // ambient global internally, so binding it here recurses until the stack
    // blows (RangeError inside mount(), which the layer's own try/catch then
    // swallows into "mount failed" — a silent, very confusing red).
    //
    // clearInterval MUST come with it: jsdom's setInterval returns a jsdom timer
    // handle, and Node's clearInterval cannot cancel one. Swapping only half the
    // pair leaves `stop()` a no-op and the poll running after the caller hangs up.
    setInterval: win.setInterval.bind(win),
    clearInterval: win.clearInterval.bind(win),
  };
  for (const [k, v] of Object.entries(globals)) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  return {
    win,
    restore() {
      for (const [k, d] of Object.entries(saved)) {
        if (d) Object.defineProperty(globalThis, k, d);
        else delete globalThis[k];
      }
      dom.window.close();
    },
  };
}

before(async () => {
  env = browserGlobals();
  layer = await loadLayer();
  surface = { registerRouter, hasRouter };
  layer.mount();
});

after(() => {
  if (layer) layer.releaseCall();
  if (env) env.restore();
});

const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// §1 · Router OFF — what production serves today
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — with no router, the consumer does not exist', () => {
  // ── AMENDED BY JORDAN-NOVOICE-FRONTDOOR, and this is the deliberate part ────
  //
  // Two of the three measurements below USED to read `#qual === null` and
  // `win.__perch === undefined`. Both flipped, on purpose: the qualifier card is
  // now mounted in the call-independent path so the BOOK A CONSULTATION door works
  // on a deployment with `PERCH_ROUTER` unset — which is precisely the deployment
  // the no-router fallback was written to survive, so gating the card on a router
  // would have put the fallback behind the condition it exists for.
  //
  // What this section was really protecting is NOT the absence of a DOM node; it is
  // that nothing talks to the bridge without a router. That claim is unchanged and
  // is now asserted directly — no poll, no `/fn/page-poll` request, and a null
  // `commandChannel` — rather than inferred from the card's absence.
  // See [[feedback_assert_behavior_not_source_spelling]].
  test('the card mounts, but nothing reaches the bridge', () => {
    const { win } = env;
    assert.equal(surface.hasRouter(), false, 'precondition: no router yet');
    assert.ok(win.document.getElementById(LAYER_ID), 'the layer itself still mounts');

    assert.ok(win.document.getElementById('qual'),
      'the qualifier card IS built — the no-voice door does not need a router');
    assert.equal(win.Perch.layer.probe().qualifierMounted, true,
      'and the probe says so');

    // The invariant that actually matters, stated as measurements.
    assert.equal(win.Perch.layer.probe().commandChannel, null,
      'no consumer, so no poll loop — the bridge is untouched without a router');
    assert.equal(fetches.filter((f) => f.url === '/fn/page-poll').length, 0,
      'and nothing has polled');
    assert.equal(win.Perch.layer.probe().noVoice.channel.polling, false,
      'the no-voice channel exists but is never started — it has no call to poll for');
  });

  test('bindCall refuses, and refuses without throwing at the caller', () => {
    // js/donovan-widget.js calls this from `call_started`. A throw there would
    // break a call the caller has already connected.
    const r = layer.bindCall({ callId: 'call_off' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /no router/);
    assert.equal(fetches.filter((f) => f.url === '/fn/page-poll').length, 0,
      'and absolutely nothing polls');
  });

  test('a missing call id is refused before the router is even consulted', () => {
    assert.equal(layer.bindCall({}).ok, false);
    assert.equal(layer.bindCall(undefined).ok, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · Router ON — the consumer mounts on the registration
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — registering a router boots the consumer stack', () => {
  before(() => {
    // Exactly what js/perch-swup-router.js does at boot, minus Swup. The layer's
    // `onRouterRegistered` waiter fires from inside this call.
    const r = surface.registerRouter((href) => navigated.push(href));
    assert.equal(r.ok, true, 'precondition: this file must be the first registrant');
  });

  test('the qualifier is built INSIDE the layer and locks its probe on', () => {
    const { win } = env;
    const qual = win.document.getElementById('qual');
    assert.ok(qual, 'THE FIX for what Zane measured: no qualifier element existed in the DOM');
    const root = win.document.getElementById(LAYER_ID);
    assert.ok(root.contains(qual),
      'and it must be in the LAYER — a card inside #perch-main is torn away mid-answer');
    assert.ok(win.__perch && win.__perch.probe().mounted, 'window.__perch was null on a live content page');
  });

  test('the channel exists, and is correctly NOT polling until a call binds', () => {
    const p = env.win.Perch.layer.probe();
    assert.ok(p.commandChannel, 'the A51 regression is exactly this being null');
    assert.equal(p.commandChannel.polling, false);
    assert.equal(p.commandChannel.callId, null);
    assert.equal(p.qualifierMounted, true);
  });

  test('no second concierge was created — the launcher is still the only one', () => {
    const { win } = env;
    assert.equal(win.document.getElementById('concierge'), null,
      'mountShellConcierge() must not have run; two orbs is the defect the layer header records');
    assert.equal(win.document.getElementById('caption'), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · bindCall — the launcher hands over the live call
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — the launcher\'s call id is what starts the poll', () => {
  test('bindCall starts the loop and hands the id to the booking widget', async () => {
    fetches.length = 0;
    const said = [];
    const r = layer.bindCall({ callId: 'call_layer_1', say: (t, hold) => said.push([t, hold]) });
    assert.equal(r.ok, true);

    const p = env.win.Perch.layer.probe();
    assert.equal(p.commandChannel.polling, true);
    assert.equal(p.commandChannel.callId, 'set');
    assert.equal(JSON.stringify(p).includes('call_layer_1'), false,
      'the probe must never print the bridge credential');

    // A32: set_call_id rides the same drive() seam and lands on window.__perchCallId.
    assert.equal(env.win.__perchCallId, 'call_layer_1',
      'without this /booking/create cannot join the booking to the call');

    await settle(POLL_MS + 250);
    const polls = fetches.filter((f) => f.url === '/fn/page-poll');
    assert.ok(polls.length >= 1, 'a bound channel that never polls IS the regression');
    assert.equal(polls[0].headers['x-perch-call-id'], 'call_layer_1');
  });

  test('releaseCall stops it, and re-binding does not double the rate', async () => {
    layer.releaseCall();
    assert.equal(env.win.Perch.layer.probe().commandChannel.polling, false);

    fetches.length = 0;
    await settle(POLL_MS + 250);
    assert.equal(fetches.filter((f) => f.url === '/fn/page-poll').length, 0,
      'a leaked interval outlives the call it was polling for');

    layer.bindCall({ callId: 'call_layer_2' });
    layer.bindCall({ callId: 'call_layer_2' });
    fetches.length = 0;
    await settle(POLL_MS + 250);
    assert.ok(fetches.filter((f) => f.url === '/fn/page-poll').length <= 2,
      'two loops would double the poll rate against the bridge');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The drive — a queued command actually moves the page
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — a command on the bridge drives the live document', () => {
  test('a goto navigates THROUGH THE ROUTER, not through location.assign', async () => {
    navigated.length = 0;
    queued = { cmd: 'navigate', target: '/tax-controversy.html' };
    await settle(POLL_MS + 300);
    assert.deepEqual(navigated, ['/tax-controversy.html'],
      'a hard navigation here would destroy the call the layer exists to protect');
  });

  test('open_qualifier raises the card over the page', async () => {
    const { win } = env;
    assert.equal(win.document.getElementById('qual').classList.contains('show'), false);
    queued = { cmd: 'open_qualifier', payload: { matter: 'real_estate', lang: 'es', source: 'referral' } };
    await settle(POLL_MS + 300);
    assert.ok(win.document.getElementById('qual').classList.contains('show'),
      'THE REGRESSION: open_qualifier returned done and no modal appeared');
    assert.equal(win.__perch.probe().open, true);
    assert.equal(win.__perch.probe().lang, 'es');
    assert.equal(win.__perch.probe().callId, 'set',
      'and the card knows the call id, so the submit lands where get_qualifier_result reads');
  });

  test('a scroll command moves the page instead of vanishing into postMessage', async () => {
    const scrolled = [];
    env.win.scrollBy = (o) => scrolled.push(o);
    queued = { cmd: 'scrollby', target: 'down' };
    await settle(POLL_MS + 300);
    assert.equal(scrolled.length, 1, 'scroll_down is on Paula\'s published tool list and moved nothing');
    assert.equal(scrolled[0].behavior, 'smooth');
    assert.equal(env.win.Perch.layer.probe().pageControl.log.at(-1).cmd, 'scrollby');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · goto_home — the target the exclusion list would have hard-navigated
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 — goto_home reaches the homepage without ending the call', () => {
  test('the premise: /index.html IS excluded from soft navigation', () => {
    // THIS PREMISE HAS INVERTED, AND THE COMMENT ABOVE IS WHY THAT IS SAFE: it said
    // "if this ever stops being true the rewrite below becomes dead weight, and this
    // assertion is what says so rather than leaving it to rot". It stopped being true.
    //
    // `/index.html` and `/` were excluded because both reached the concierge shell,
    // which A0.1 skipped, so there was no #perch-main and Swup would have thrown. The
    // shell is deleted, `/` resolves to index.html — an ordinary page with an ordinary
    // container — and both swap-policy exclusions are removed. So all three URLs are
    // interceptable, and the goto_home rewrite below is indeed dead weight; see the
    // test after this one.
    assert.equal(excludeReason('/index.html'), null, 'the homepage is a normal page now');
    assert.equal(excludeReason('/'), null, 'and so is the root it is served at');
    assert.equal(excludeReason('/home'), null, '/home 301s to / and is not excluded either');
  });

  test('do_page_action\'s goto_home target is rewritten to the swappable spelling', () => {
    // /index.html is what functions/fn/do_page_action.js maps goto_home to. Left
    // alone, the router's own callback would location.assign() it and hang the
    // caller up mid-sentence.
    assert.equal(layer.homeTarget('/index.html', '/contact'), '/home');
    assert.equal(layer.homeTarget('/index', '/contact'), '/home');
    assert.equal(layer.homeTarget('/', '/contact'), '/home');
    assert.equal(layer.homeTarget('/home.html', '/contact'), '/home');
  });

  test('a caller already on the homepage is a same-page visit, not a re-navigation', () => {
    for (const here of ['/', '/home', '/index.html']) {
      assert.equal(layer.homeTarget('/index.html', here), here,
        'returning the current path is what go() reads as "nothing to swap"');
    }
  });

  test('nothing else is touched', () => {
    for (const href of ['/tax.html', '/book.html', '/gold/', '/blog.html', '/re-acquisition.html']) {
      assert.equal(layer.homeTarget(href, '/contact'), href);
    }
    assert.equal(layer.homeTarget('::not a url::', '/contact'), '::not a url::',
      'an unparseable target is handed on untouched for the router to refuse');
  });

  test('and the rewrite reaches the router end to end', async () => {
    navigated.length = 0;
    queued = { cmd: 'navigate', target: '/index.html' };
    await settle(POLL_MS + 300);
    assert.deepEqual(navigated, ['/home'],
      'goto_home has to arrive at a page the router can swap to');
  });
});
