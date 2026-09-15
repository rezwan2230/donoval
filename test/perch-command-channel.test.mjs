// ── SHELDON-PERCH-COMMAND-CHANNEL — the bridge consumer, exercised ───────────
//
// Order SHELDON-PERCH-COMMAND-CHANNEL · priority regression from the A51 cutover.
//
// ── WHAT REGRESSED ───────────────────────────────────────────────────────────
// A live manual call after the A51 cutover (#62) found that on a CONTENT page
// Paula can no longer drive the page: `do_page_action` answers `{status:"done"}`
// and nothing moves. The queue was never the problem — the Durable Object had the
// command. Nothing on the page was reading it, because the poll loop, the
// qualifier card and the navigation drive were all built inside
// `mountShellConcierge()`, which js/perch-layer.js deliberately never calls.
//
// ── WHAT THIS FILE PROVES, AND HOW ───────────────────────────────────────────
// Behaviour, not spelling. Every assertion drives the SHIPPED function and reads
// what it did — see [[feedback_assert_behavior_not_source_spelling]], and the
// A22 lesson that a presence check is not a liveness check. The one thing a unit
// test cannot reach is a real Retell session, so the boundary is drawn where the
// call id enters and the manual-call checklist picks it up from there
// (docs/PERCH-COMMAND-CHANNEL-CALL-TEST.md).
//
// §1  the dispatch table — every command Paula can queue, and what it drives
// §2  the poll — the interval, the header credential, and stop()
// §3  the page-control executor (scroll / scrollby / highlight)
// §4  the qualifier, mounted and driven, with the live call id on the submit
// §5  the server round trip: qualifier_submit → get_qualifier_result
// §6  the shell is not what changed — /perch keeps the same wiring
//
// The layer-side half — router gating, `bindCall`, and the fact that a
// production deployment with `PERCH_ROUTER` unset builds none of it — is in
// test/perch-command-consumer.test.mjs, which needs its own process because
// `registerRouter` is first-caller-wins for the life of a module instance.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { createCommandChannel, POLL_MS, PREFILL_TRIES } from '../donovan-legal-site/js/perch/command-channel.js';
import { createPageControl, PAGE_COMMANDS, HIGHLIGHT_MS } from '../donovan-legal-site/js/perch/page-control.js';
import { mountQualifier } from '../donovan-legal-site/js/perch/qualifier.js';
import { onRequestPost as qualifierSubmit } from '../donovan-legal-site/functions/fn/qualifier_submit.js';
import { makeDurableObject, stubFetch, muteConsole } from './helpers/stubs.mjs';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');

/**
 * A host that records instead of driving, plus the window bits the channel reads.
 *
 * `win` is injected rather than taken from a global so the channel's message bus
 * and `localStorage` writes are observable without a browser. That injection
 * point is the third parameter of the shipped function, not a test-only fork.
 */
function harness({ fetchImpl } = {}) {
  const drives = [];
  const gos = [];
  const afterNavigateCbs = [];
  const contentReadyCbs = [];
  const store = {};
  const listeners = [];

  const host = {
    drive: (cmd, target, payload) => drives.push({ cmd, target, payload }),
    go: (href) => gos.push(href),
    afterNavigate: (cb) => afterNavigateCbs.push(cb),
    onContentReady: (cb) => contentReadyCbs.push(cb),
  };

  const win = {
    location: { origin: 'https://www.donovan.law' },
    localStorage: {
      setItem: (k, v) => { store[k] = String(v); },
      getItem: (k) => (k in store ? store[k] : null),
    },
    addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); },
    fetch: fetchImpl || (async () => ({ ok: true, json: async () => ({}) })),
  };

  return {
    host, win, drives, gos, store, afterNavigateCbs, contentReadyCbs,
    /** Deliver a same-origin postMessage the way the widget's ack does. */
    message(data) {
      for (const fn of listeners) fn({ origin: win.location.origin, data });
    },
    /** Deliver a CROSS-origin one — the channel must ignore it. */
    foreignMessage(data) {
      for (const fn of listeners) fn({ origin: 'https://evil.test', data });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The dispatch table
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — every command Paula can queue reaches the right verb', () => {
  test('navigate drives the host, and only /book writes the unlock flag', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.dispatch({ cmd: 'navigate', target: '/tax-controversy.html' });
    assert.deepEqual(h.gos, ['/tax-controversy.html'],
      'THE REGRESSION: a goto command has to actually navigate');
    assert.equal(h.store.donovan_booking_unlock, undefined,
      'a tour hop must not silently unlock the calendar');

    ch.dispatch({ cmd: 'navigate', target: '/book.html' });
    assert.deepEqual(h.gos, ['/tax-controversy.html', '/book.html']);
    assert.ok(h.store.donovan_booking_unlock, 'agent-driven booking nav IS the unlock');
    ch.stop();
  });

  test('a /book navigate re-delivers a prefill Paula sent before the page arrived', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    // The real order Paula fires them in: prefill first, while /book is loading.
    ch.dispatch({ cmd: 'booking_prefill', payload: { name: 'Ada' } });
    assert.deepEqual(h.drives.at(-1), { cmd: 'booking_prefill', target: null, payload: { name: 'Ada' } });

    h.drives.length = 0;
    ch.dispatch({ cmd: 'navigate', target: '/book.html' });
    assert.equal(h.afterNavigateCbs.length, 1, 'the navigate must register an afterNavigate');
    h.afterNavigateCbs[0]();
    assert.deepEqual(h.drives.at(-1), { cmd: 'booking_prefill', target: null, payload: { name: 'Ada' } },
      'the prefill is re-delivered once the swap lands');
    ch.stop();
  });

  test('the widget ack stops re-delivery, and a foreign origin cannot', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.dispatch({ cmd: 'booking_prefill', payload: { email: 'a@b.test' } });

    h.foreignMessage({ __perchBookingAck: true, action: 'prefill' });
    assert.equal(ch.probe().prefillPending, true, 'a cross-origin ack must be ignored');

    h.message({ __perchBookingAck: true, action: 'prefill' });
    assert.equal(ch.probe().prefillPending, false, 'the same-origin ack stops the loop');
    ch.stop();
  });

  test('open_qualifier opens the card and is NOT forwarded to the content surface', () => {
    const opened = [];
    const h = harness();
    const ch = createCommandChannel(h.host, { openQualifier: (lang, src) => opened.push([lang, src]) }, h.win);

    ch.dispatch({ cmd: 'open_qualifier', payload: { matter: 'tax', lang: 'es', source: 'referral' } });
    assert.deepEqual(opened, [['es', 'referral']], 'lang + source ride through from the payload');
    assert.deepEqual(h.drives, [], 'the modal is layer-level — it must not be driven at the page');

    // The pre-payload wire shape Paula's older tool config may still send.
    ch.dispatch({ cmd: 'open_qualifier', lang: 'en', source: 'google' });
    assert.deepEqual(opened.at(-1), ['en', 'google']);
    ch.stop();
  });

  test('an unrecognised command still falls through to host.drive', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.dispatch({ cmd: 'scrollby', target: 'down' });
    assert.deepEqual(h.drives, [{ cmd: 'scrollby', target: 'down', payload: undefined }]);
    ch.stop();
  });

  test('a content load re-hands the live call id to the booking widget', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    assert.equal(h.contentReadyCbs.length, 1);

    h.contentReadyCbs[0]();
    assert.deepEqual(h.drives, [], 'with no call there is nothing to hand down');

    ch.start('call_live_1');
    assert.deepEqual(h.drives.at(-1), { cmd: 'set_call_id', target: null, payload: { call_id: 'call_live_1' } });
    h.drives.length = 0;
    h.contentReadyCbs[0]();
    assert.deepEqual(h.drives, [{ cmd: 'set_call_id', target: null, payload: { call_id: 'call_live_1' } }],
      'A32: the id has to survive the navigation or /booking/create cannot join it');
    ch.stop();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The poll
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — the poll loop, its credential, and its off switch', () => {
  test('start() polls /fn/page-poll with the call id in a HEADER, never the URL', async () => {
    const seen = [];
    const h = harness({
      fetchImpl: async (url, init) => {
        seen.push({ url, init });
        return { ok: true, json: async () => ({}) };
      },
    });
    const ch = createCommandChannel(h.host, {}, h.win);
    assert.equal(ch.probe().polling, false, 'nothing polls until a call is bound');

    ch.start('call_secret_9');
    assert.equal(ch.probe().polling, true);
    assert.equal(ch.probe().callId, 'set');

    await new Promise((r) => setTimeout(r, POLL_MS + 250));
    ch.stop();

    assert.ok(seen.length >= 1, 'the loop must actually fire — a bound channel that never polls IS the bug');
    const [first] = seen;
    assert.equal(first.url, '/fn/page-poll');
    assert.equal(first.init.headers['x-perch-call-id'], 'call_secret_9');
    assert.doesNotMatch(first.url, /call_id=/, 'B2-c: the credential must not reach the access log');

    // The probe is a diagnostic, not a leak: it must never print the credential.
    assert.equal(JSON.stringify(ch.probe()).includes('call_secret_9'), false);
  });

  test('a queued command from the real response shape drives the page', async () => {
    let served = false;
    const h = harness({
      fetchImpl: async () => ({
        ok: true,
        json: async () => (served ? {} : (served = true, { cmd: 'navigate', target: '/experience.html' })),
      }),
    });
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.start('call_x');
    await new Promise((r) => setTimeout(r, POLL_MS + 250));
    ch.stop();
    assert.deepEqual(h.gos, ['/experience.html']);
  });

  test('stop() ends the loop, and a failing poll never kills it', async () => {
    let calls = 0;
    const h = harness({
      fetchImpl: async () => { calls++; throw new Error('network down'); },
    });
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.start('call_x');
    await new Promise((r) => setTimeout(r, POLL_MS * 2 + 250));
    const during = calls;
    assert.ok(during >= 2, 'a dropped poll must not take the loop down with it');

    ch.stop();
    assert.equal(ch.probe().polling, false);
    await new Promise((r) => setTimeout(r, POLL_MS + 250));
    assert.equal(calls, during, 'stop() must actually stop it — a leaked interval outlives the call');
  });

  test('start() is idempotent — a re-bind does not leave two loops running', async () => {
    let calls = 0;
    const h = harness({ fetchImpl: async () => { calls++; return { ok: true, json: async () => ({}) }; } });
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.start('call_a');
    ch.start('call_b');
    await new Promise((r) => setTimeout(r, POLL_MS + 250));
    ch.stop();
    assert.ok(calls <= 2, `two loops would double the rate; saw ${calls} polls in one interval`);
  });

  test('the prefill re-delivery cap is still six', () => {
    assert.equal(PREFILL_TRIES, 6, 'the widget contract in js/perch/booking-control.js is written against this');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The page-control executor
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — scroll / scrollby / highlight run against the LIVE document', () => {
  function page() {
    const dom = new JSDOM(
      '<!doctype html><body><div style="height:4000px"></div><section id="fees">f</section></body>',
      { url: 'https://www.donovan.law/tax.html' },
    );
    const win = dom.window;
    const scrolls = [];
    win.scrollTo = (o) => scrolls.push({ fn: 'scrollTo', ...o });
    win.scrollBy = (o) => scrolls.push({ fn: 'scrollBy', ...o });
    win.HTMLElement.prototype.scrollIntoView = function scrollIntoView(o) {
      scrolls.push({ fn: 'scrollIntoView', id: this.id, ...o });
    };
    Object.defineProperty(win, 'innerHeight', { value: 800, configurable: true });
    return { win, scrolls, close: () => dom.window.close() };
  }

  test('scroll_down / _up / _to_top / _to_bottom all move the page', () => {
    const p = page();
    try {
      const pc = createPageControl(p.win, p.win.document);
      pc.apply('scrollby', 'down');
      pc.apply('scrollby', 'up');
      pc.apply('scrollby', 'top');
      pc.apply('scrollby', 'bottom');
      assert.deepEqual(p.scrolls.map((s) => s.fn), ['scrollBy', 'scrollBy', 'scrollTo', 'scrollTo']);
      assert.equal(p.scrolls[0].top, 680, '0.85 of an 800px viewport, down');
      assert.equal(p.scrolls[1].top, -680, 'and the same distance up');
      assert.equal(p.scrolls[2].top, 0);
      assert.ok(p.scrolls.every((s) => s.behavior === 'smooth'), 'perch-inject.js scrolled smoothly; so does this');
    } finally { p.close(); }
  });

  test('scroll targets an #id, and a missing one is reported rather than thrown', () => {
    const p = page();
    try {
      const pc = createPageControl(p.win, p.win.document);
      assert.equal(pc.apply('scroll', '#fees').via, 'scrollIntoView');
      assert.equal(p.scrolls.at(-1).id, 'fees');
      assert.equal(pc.apply('scroll', '#nope').reason, 'target_absent');
      // A malformed selector makes querySelector THROW; inside a 1.2s poll that
      // would take every later command down with it.
      assert.equal(pc.apply('scroll', '>>>broken').reason, 'target_absent');
    } finally { p.close(); }
  });

  test('highlight paints a ring and clears it', () => {
    const p = page();
    try {
      const pc = createPageControl(p.win, p.win.document);
      pc.apply('highlight', '#fees');
      const el = p.win.document.getElementById('fees');
      assert.match(el.style.boxShadow, /#c1a221|193, 162, 33/);
      return new Promise((resolve) => {
        p.win.setTimeout(() => {
          assert.equal(el.style.boxShadow, '', 'the ring must not be permanent');
          resolve();
        }, HIGHLIGHT_MS + 60);
      });
    } finally { /* closed by the caller's timer resolution */ }
  });

  test('it owns exactly the three non-booking commands, and never navigates', () => {
    assert.deepEqual(PAGE_COMMANDS.slice().sort(), ['highlight', 'scroll', 'scrollby']);
    const p = page();
    try {
      const pc = createPageControl(p.win, p.win.document);
      assert.equal(pc.handles('navigate'), false, 'navigation is the router\'s, not this module\'s');
      assert.equal(pc.handles('booking_prefill'), false, 'one owner per command family');
      assert.equal(pc.apply('navigate', '/x').handled, false);
    } finally { p.close(); }
    const src = read('js/perch/page-control.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /location\s*\.\s*(assign|replace|href)/,
      'a hard navigation here would kill the call the layer exists to protect');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The qualifier, mounted and driven
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — the qualifier card renders, submits, and carries the live call id', () => {
  function qualPage(callId) {
    const dom = new JSDOM('<!doctype html><body><div id="host"></div></body>', {
      url: 'https://www.donovan.law/contact.html',
    });
    const win = dom.window;
    const posts = [];
    win.fetch = async (url, init) => { posts.push({ url, init }); return { ok: true, json: async () => ({ ok: true }) }; };
    // The module fetches through the bare global, as the browser does.
    const savedFetch = globalThis.fetch;
    globalThis.fetch = win.fetch;
    const savedLoc = globalThis.location;
    Object.defineProperty(globalThis, 'location', { value: win.location, configurable: true });
    const q = mountQualifier(win.document.getElementById('host'), { callId: () => callId });
    return {
      win, q, posts,
      close() {
        globalThis.fetch = savedFetch;
        if (savedLoc) Object.defineProperty(globalThis, 'location', { value: savedLoc, configurable: true });
        else delete globalThis.location;
        dom.window.close();
      },
    };
  }

  test('the card mounts, locks its probe onto window.__perch, and opens closed', () => {
    const p = qualPage('call_q1');
    try {
      const qual = p.win.document.getElementById('qual');
      assert.ok(qual, 'THE REGRESSION Zane measured: no qualifier element existed in the DOM');
      assert.ok(p.win.__perch, 'and window.__perch was null');
      assert.deepEqual(p.win.__perch.probe(), {
        mounted: true, open: false, lang: 'en', step: 0, answered: 0, callId: 'set',
      });
      // A33: read-only, and it never prints the credential.
      assert.equal(Object.getOwnPropertyDescriptor(p.win, '__perch').writable, false);
      assert.equal(JSON.stringify(p.win.__perch.probe()).includes('call_q1'), false);
    } finally { p.close(); }
  });

  test('open_qualifier renders the first step, in the language Paula asked for', () => {
    const p = qualPage('call_q2');
    try {
      p.q.openQualifier('es', 'referral');
      const qual = p.win.document.getElementById('qual');
      assert.ok(qual.classList.contains('show'), 'the modal has to be VISIBLE, not merely present');
      assert.equal(p.win.__perch.probe().lang, 'es');
      assert.match(qual.textContent, /Qué tipo de asunto/);
      assert.ok(qual.querySelectorAll('.opt').length >= 4, 'the caller needs something to tap');
    } finally { p.close(); }
  });

  test('a completed tap-through POSTs to /fn/qualifier_submit with the live call id', async () => {
    const p = qualPage('call_q3');
    try {
      p.q.openQualifier('en', 'google');
      const doc = p.win.document;
      const tap = (v) => {
        const b = [...doc.querySelectorAll('#qual-bd .opt')].find((x) => x.dataset && x.dataset.v === v);
        assert.ok(b, `no option "${v}" on step "${doc.querySelector('#qual-bd h2').textContent}"`);
        b.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
      };
      tap('real_estate');
      tap('acquisition');
      tap('party');            // 2026-09-06: the role step ("Who are you in this matter?")
      // the state step is a <select> + Continue
      doc.querySelector('#q-sel').value = 'FL';
      doc.querySelector('#q-cont').dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
      tap('yourself');
      tap('1_5m_3m');
      tap('5m_15m');

      assert.equal(p.posts.length, 1, 'exactly one submit, on completion');
      const [post] = p.posts;
      assert.equal(post.url, '/fn/qualifier_submit');
      const body = JSON.parse(post.init.body);
      assert.equal(body.call_id, 'call_q3',
        'without this the record lands under a key get_qualifier_result can never read');
      assert.equal(body.matter_category, 'real_estate');
      assert.equal(body.matter_sub, 'acquisition');
      assert.equal(body.state, 'FL');
      assert.equal(body.income_band, '1_5m_3m');
      assert.equal(body.net_worth_band, '5m_15m');
      assert.equal(body.language, 'en');
      assert.equal(body.source, 'google');
      assert.match(doc.getElementById('qual-bd').textContent, /Got it\./,
        'and the caller sees the done card');
    } finally { p.close(); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · The server round trip
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 — a completed submit is what get_qualifier_result reads back', () => {
  const SECRET = 'x'.repeat(32);

  /**
   * The half of Task 5 a browser cannot prove on Preview.
   *
   * Reading `/fn/get_qualifier_result` on a live deployment needs
   * `PERCH_TOOL_SECRET`, and this order forbids entering or reading a secret. So
   * the round trip is held HERE, against the real handlers and a Durable Object
   * double with the real read-once semantics, and the live read stays on the
   * manual-call checklist where Paula's own tool call performs it.
   */
  async function roundTrip(callId, fields) {
    const bridge = makeDurableObject();
    const env = { PERCH_BRIDGE: bridge, PERCH_TOOL_SECRET: SECRET };
    const f = stubFetch(async () => new Response('{}')); // Vantage forward, swallowed
    const mute = muteConsole();
    const waits = [];
    try {
      await qualifierSubmit({
        request: new Request('https://www.donovan.law/fn/qualifier_submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ call_id: callId, ...fields }),
        }),
        env,
        waitUntil: (p) => waits.push(p),
      });
      const res = await qualifierResult({
        request: new Request('https://www.donovan.law/fn/get_qualifier_result', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-perch-tool-secret': SECRET },
          body: JSON.stringify({ call_id: callId }),
        }),
        env,
      });
      return { bridge, body: await res.json() };
    } finally {
      await Promise.allSettled(waits);
      f.restore();
      mute.restore();
    }
  }

  // REMOVED: the answers the card sends come back to Paula as status:complete
  // Paula is gone. The card's answers still reach the server — fn/qualifier_submit's KV write and cookie — which qualifier-join-composition.test.mjs asserts end to end.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 · The rollback target
// ─────────────────────────────────────────────────────────────────────────────

describe('§6 — /perch is untouched and stays the rollback target', () => {
  // REMOVED: the shell still composes chrome + call + qualifier through its iframe host
  // js/page/perch-shell.js and perch.html are deleted; there is no iframe host left to compose.

  // REMOVED: perch.html still authors the orb and the qualifier the shell adopts
  // the shell is deleted, and with it the orb it authored.

  // REMOVED: perch-inject.js — the iframe executor — is unchanged in shape
  // the injector lived inside the shell's iframe and is deleted; booking-control.js reaches the widget from the same page now.

  // REMOVED: the call engine still starts and stops the poll on the two Retell events
  // js/perch/call.js and /fn/page-poll went with the voice concierge, so there are no Retell events to bracket.
});
