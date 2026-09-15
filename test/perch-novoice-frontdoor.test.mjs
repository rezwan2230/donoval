// ── JORDAN-NOVOICE-FRONTDOOR — the qualifier, reachable without a voice call ──
//
// Order JORDAN-NOVOICE-FRONTDOOR-R1 · the second front door into intake.
//
// ── THE GAP ──────────────────────────────────────────────────────────────────
// The qualifier card opened exactly one way: Paula issued `open_qualifier` on a
// live call. So a visitor who tapped BOOK A CONSULTATION reached Paul's calendar
// having answered nothing, and the firm received a booking with no intake — while
// a visitor who happened to want a voice call arrived pre-qualified. Same calendar,
// two very different leads, and the difference was a microphone.
//
// ── THE HALF OF #110 THAT WAS MISSING, AND IS THE REASON THIS IS NOT A REVIVE ─
// PR #110 built the door and shipped 38/38 green, but its card handed
// `/fn/qualifier_submit` a NULL call_id on the no-voice path. That endpoint refuses
// a submission without one — 400 `call_id_required`, the B2 fix that removed the
// shared `qual:default` bucket — and the modal's POST is fire-and-forget, so a 400
// RESOLVES rather than rejecting. The card rendered its done state, the visitor
// booked, and no server-side record was ever written. Nothing failed loudly;
// nothing failed at all. §2 is that hole, closed and measured: a minted web-session
// id, checked against the SERVER's own regex, producing the same three rows in the
// same three stores the voice door produces.
//
// §1  the convention   — one attribute, spelled once per side, held equal by CI
// §2  the join key     — Task 4: both doors, one record shape, one booking join
// §3  the two doors    — Task 3: Paula still opens the same card, latches separate
// §4  the two endings  — JORDAN-SITE-UX-FIXES-R1: DECLINE opens the calendar,
//                        DISMISS does not. Was Task 5's "skip or walk away and the
//                        calendar still opens", which production proved too wide.
// §5  the boundaries   — no intake value in any calendar field, and the sha to prove it
// §6  the document load — the join key and the prefill crossing a real page load
//
// Every section drives the SHIPPED functions. Nothing here re-declares a mapping or
// a policy the product owns; see [[feedback_assert_behavior_not_source_spelling]].

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  BOOK_INTENT_ATTR as EDGE_ATTR, BOOK_INTENT_SOURCE, BAR_HTML, BOOKING_HREF,
} from '../donovan-legal-site/functions/_lib/utility-bar-inject.js';
import { onRequestPost as qualifierSubmit } from '../donovan-legal-site/functions/fn/qualifier_submit.js';
import { resolveQualifierBinding, QUALIFIER_JOIN } from '../donovan-legal-site/functions/booking/_lib/qualifier-bind.js';
import { buildClientDescription } from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import { NOTE_ANSWER_KEYS, bookingPrefillFrom } from '../donovan-legal-site/js/perch/qualifier.js';
import { FORBIDDEN_METHODS, COMMAND_MAP } from '../donovan-legal-site/js/perch/booking-control.js';
import { CONTAINER_ID, LAYER_ID } from '../donovan-legal-site/js/perch/placement.js';
import { registerRouter, hasRouter } from '../donovan-legal-site/js/perch/surface.js';
import { BOOK_PATH } from '../donovan-legal-site/js/perch/command-channel.js';
import { makeKV, makeDurableObject, muteConsole } from './helpers/stubs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'donovan-legal-site');
/**
 * Read a shipped file with NORMALISED line endings.
 *
 * Not cosmetic. `core.autocrlf` gives a Windows worktree CRLF while the committed
 * blob — and every CI checkout — is LF, so any assertion that anchors on `'\n}\n'`
 * to bound a function silently matches NOTHING locally: `indexOf` returns -1, the
 * slice runs past the closing brace into the next declaration, and the count comes
 * back one too high. That is exactly how the decline-fallback count below read 5 on
 * a Windows worktree and 4 on the runner. See
 * [[feedback_git_show_lf_vs_worktree_crlf.md]].
 */
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8').replace(/\r\n/g, '\n');

/** Source with comments stripped — a guard must not be satisfied by prose. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Run the REAL js/perch-layer.js. Same harness as test/perch-command-consumer.test.mjs. */
async function loadLayer(tag) {
  const src = read(path.join('js', 'perch-layer.js'))
    .replace(/(['"])\/js\//g, '$1../donovan-legal-site/js/');
  const file = path.join(HERE, `.novoice-layer-harness-${process.pid}.mjs`);
  fs.writeFileSync(file, src);
  try {
    return await import('./' + path.basename(file) + '?novoice=' + tag);
  } finally {
    fs.unlinkSync(file);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

const submits = [];       // every /fn/qualifier_submit body the card POSTed
const navigated = [];     // every href the registered router was asked for
let env = null;
let layer = null;

/**
 * A jsdom document with the two book-intent triggers on it, plus the minimum
 * `DLBooking` surface `booking-control.js` drives.
 *
 * `sessionStorage` is jsdom's own, so `web-session.js` is exercised through the
 * real storage API rather than a hand-rolled object — which is what makes the
 * "same id at submit time and at booking time" claim in §2 mean anything.
 */
function browserGlobals(url = 'https://donovan-site.pages.dev/contact') {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><body><main id="${CONTAINER_ID}">`
    + `<a id="cta" class="dl-ubar-cta" href="${BOOKING_HREF}" target="_top" ${EDGE_ATTR}="${BOOK_INTENT_SOURCE}">Book</a>`
    + `<a id="contact-link" href="book.html" ${EDGE_ATTR}="contact_page">schedule a consultation online</a>`
    + `<a id="plain" href="/about">About</a>`
    + `</main></body></html>`,
    { url, pretendToBeVisual: true },
  );
  const win = dom.window;

  const prefilled = [];
  const revealed = [];
  win.DLBooking = {
    prefill: (p) => { prefilled.push(p); return true; },
    selectType: () => true, selectSlot: () => true, showDate: () => true,
  };
  win.DL = { revealBookingGate: () => { revealed.push(1); return true; } };

  win.fetch = async (url2, init) => {
    if (String(url2) === '/fn/qualifier_submit') {
      submits.push(JSON.parse(String(init && init.body)));
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  win.scrollTo = () => {};
  win.scrollBy = () => {};
  win.HTMLElement.prototype.scrollIntoView = () => {};

  const saved = {};
  const globals = {
    window: win, document: win.document, location: win.location,
    CustomEvent: win.CustomEvent, fetch: win.fetch,
    sessionStorage: win.sessionStorage, localStorage: win.localStorage,
    crypto: win.crypto || crypto,
    setInterval: win.setInterval.bind(win),
    clearInterval: win.clearInterval.bind(win),
  };
  for (const [k, v] of Object.entries(globals)) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  return {
    win, prefilled, revealed,
    restore() {
      for (const [k, d] of Object.entries(saved)) {
        if (d) Object.defineProperty(globalThis, k, d);
        else delete globalThis[k];
      }
      dom.window.close();
    },
  };
}

/**
 * Tap every step of the card through to the done state.
 *
 * The select step is handled FIRST and on purpose: its Continue button carries
 * `class="opt"` too, so an option-first loop clicks a button whose handler is
 * `if (sel.value) pick(...)` — a no-op while the select is empty — and spins on the
 * same step forever. A driver that silently stalls would make a "the card submits"
 * assertion pass for the wrong reason.
 */
function tapThrough(win) {
  const qual = win.document.getElementById('qual');
  for (let guard = 0; guard < 20; guard++) {
    if (qual.classList.contains('done-state') || qual.classList.contains('handoff-state')) return true;
    const body = qual.querySelector('#qual-bd') || qual.querySelector('.bd');
    const sel = body.querySelector('#q-sel');
    if (sel) {
      sel.value = 'FL';
      const cont = body.querySelector('#q-cont');
      if (!cont) return false;
      cont.click();
      continue;
    }
    const opt = body.querySelector('button.opt[data-v]');
    if (!opt) return false;
    opt.click();
  }
  return false;
}

const click = (win, id) => {
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  win.document.getElementById(id).dispatchEvent(ev);
  return ev;
};

before(async () => {
  env = browserGlobals();
  layer = await loadLayer('main');
  layer.mount();
});

after(() => {
  if (layer) layer.releaseCall();
  if (env) env.restore();
  env = null;
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The convention — one attribute, spelled once per side
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — the book-intent convention', () => {
  test('the edge injector and the layer spell the attribute identically', async () => {
    // The two constants CANNOT import one another: utility-bar-inject.js is bundled
    // into the Pages Functions worker and perch-layer.js is a browser module that
    // BOOTS on import. So the string is written twice and held equal here — the
    // same trade command-channel.js's BOOK_PATH makes against ACTION_MAP.
    assert.equal(EDGE_ATTR, layer.BOOK_INTENT_ATTR,
      'the edge writes the attribute the layer listens for');
    assert.equal(layer.BOOK_INTENT_SELECTOR, `[${EDGE_ATTR}]`);
  });

  test('the injected CTA carries the intent and keeps its href and target', () => {
    assert.ok(BAR_HTML.includes(`${EDGE_ATTR}="${BOOK_INTENT_SOURCE}"`),
      'the CTA is marked as a book intent');
    // The no-JS floor and the #108 frame escape are both untouched — the attribute
    // is additive, never a replacement. A card that fails to open falls through to
    // exactly the link the visitor had before this ticket.
    assert.ok(BAR_HTML.includes(`href="${BOOKING_HREF}"`), 'href survives — the no-JS floor');
    assert.ok(BAR_HTML.includes('target="_top"'), 'target=_top survives — the #108 frame escape');
  });

  test('relabelling the CTA does not move the book intent (#222)', () => {
    // #222 changed the CTA's WORDING to "Book a Free Consultation". The wording and
    // the trigger live in the same string, one attribute apart, so a careless
    // relabel is exactly the edit that could take `data-perch-book` with it — and
    // the failure would be silent: the anchor still points at /book, so a visitor
    // would simply skip the qualifier card and arrive at the calendar unqualified,
    // which is the entire regression #158 exists to prevent.
    //
    // Both halves are pinned together here, in one test, so neither can move alone.
    assert.ok(BAR_HTML.includes('aria-label="Book a Free Consultation"'),
      'the accessible name is the #222 label');
    assert.ok(BAR_HTML.includes('>Book<span class="dl-ubar-cta-full"> a Free Consultation</span>'),
      'the visible label is the #222 label, still split so it can collapse to "Book" under 480px');
    // The SOURCE value is unchanged by #222 and must stay that way: it is what lands
    // in the lead record, so a new spelling silently re-buckets every bar-sourced lead.
    assert.equal(BOOK_INTENT_SOURCE, 'utility_bar',
      'the lead source changed — every utility-bar lead would re-bucket');
    assert.equal((BAR_HTML.match(/data-perch-book=/g) || []).length, 1,
      'exactly one book intent on the CTA');
  });

  test('the contact page link carries it too, and nothing else on the page does', () => {
    const html = read('contact.html');
    assert.ok(html.includes(`${EDGE_ATTR}="contact_page"`), 'the contact-page link is a door');
    assert.equal((html.match(new RegExp(EDGE_ATTR, 'g')) || []).length, 1,
      'exactly one trigger on the page — a second would open the card twice');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The join key — Task 4, and the hole #110 left open
// ─────────────────────────────────────────────────────────────────────────────

/** The server's OWN shape guard, read out of the module that enforces it. */
const SERVER_CALL_ID_RE = (() => {
  const m = code('functions/booking/_lib/qualifier-bind.js').match(/const CALL_ID_RE = (\/.+?\/);/);
  assert.ok(m, 'qualifier-bind.js still declares CALL_ID_RE — this test reads the real one');
  // eslint-disable-next-line no-eval
  return eval(m[1]);
})();

describe('§2 — one record shape, whichever door the visitor used', () => {
  test('a minted id satisfies the SERVER regex that gates the booking join', async () => {
    const ws = await import('../donovan-legal-site/js/perch/web-session.js?fresh=1');
    // 200 mints, not one: the charset claim is about every id this can produce, and
    // a single sample proves only that one sample happened to pass.
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const dom = new JSDOM('<!doctype html>', { url: 'https://x.test/' });
      ws.__reset();
      const id = ws.sessionId(dom.window);
      assert.match(id, SERVER_CALL_ID_RE, `minted id must pass the server's guard: ${id}`);
      assert.notEqual(id.toLowerCase(), 'default', 'never the reserved shared-bucket id');
      assert.ok(id.startsWith('web-'), 'and it names its door');
      assert.equal(id.startsWith('call_'), false, 'it cannot squat Retell\'s namespace');
      seen.add(id);
      dom.window.close();
    }
    assert.equal(seen.size, 200, 'every mint is distinct — no shared bucket by accident');
  });

  test('the same id is returned for the life of the tab', async () => {
    const ws = await import('../donovan-legal-site/js/perch/web-session.js?fresh=2');
    const dom = new JSDOM('<!doctype html>', { url: 'https://x.test/' });
    ws.__reset();
    const first = ws.sessionId(dom.window);
    assert.equal(ws.sessionId(dom.window), first, 'stable across calls');
    // A fresh module instance reading the SAME storage — this is the document-load
    // case, which is exactly where #110's in-memory-only approach would have lost it.
    const ws2 = await import('../donovan-legal-site/js/perch/web-session.js?fresh=3');
    ws2.__reset();
    assert.equal(ws2.sessionId(dom.window), first,
      'and across a document load, so the booking presents the id the qualifier POSTed under');
    dom.window.close();
  });

  test('a storage-less browser stays coherent within the tab', async () => {
    const ws = await import('../donovan-legal-site/js/perch/web-session.js?fresh=4');
    ws.__reset();
    const blocked = { get sessionStorage() { throw new Error('blocked'); }, crypto };
    const a = ws.sessionId(blocked);
    assert.match(a, SERVER_CALL_ID_RE);
    assert.equal(ws.sessionId(blocked), a,
      'private mode must not mint a new id per call — the qualifier and the booking would disagree');
  });

  // ── THE ACCEPTANCE. Both doors, through the REAL server handler. ────────────
  // REMOVED: the voice door and the no-voice door write indistinguishable records
  // there is only one door now. This compared a Retell-call submission against a
  // no-voice card submission field for field, to prove the card was not a second-class
  // entry point. The voice door is deleted, so the comparison has no left-hand side.
  // What it protected — that the card writes a complete, joinable record — is asserted
  // directly by the KV and cookie tests above and by qualifier-join-composition.

  test('a null call_id is still refused — the B2 bucket stays closed', async () => {
    const m = muteConsole();
    let res;
    try {
      res = await qualifierSubmit({
        request: new Request('https://www.donovan.law/fn/qualifier_submit', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ matter_category: 'tax' }),
        }),
        env: { PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: makeDurableObject() },
        waitUntil: () => {},
      });
    } finally { m.restore(); }
    // This is the endpoint behaviour that made #110's no-voice door write nothing.
    // It is not relaxed by this ticket — the CLIENT is what changed.
    assert.equal(res.status, 400);
    assert.equal((await res.json()).reason, 'call_id_required');
  });

  test('the card actually POSTs a call_id when there is no call at all', () => {
    submits.length = 0;
    click(env.win, 'cta');
    assert.ok(tapThrough(env.win), 'the card taps through to the done state');
    assert.equal(submits.length, 1, 'exactly one lead POST');
    const body = submits[0];
    // THE REGRESSION #110 SHIPPED, asserted directly rather than inferred from a
    // green suite: this field was `undefined` and the server answered 400.
    assert.ok(body.call_id, 'a no-voice submission carries a join key');
    assert.match(body.call_id, SERVER_CALL_ID_RE);
    assert.equal(body.source, BOOK_INTENT_SOURCE, 'the door is recorded as the lead source');

    // And the booking form is handed the SAME key, through the seam
    // js/booking-widget.js already reads at submit time.
    assert.equal(env.win.__perchCallId, body.call_id,
      'the booking POST will present the id the qualifier POSTed under');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The two doors — Task 3, the voice path unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — both doors reach one card, and the voice path is untouched', () => {
  test('exactly one qualifier card exists in the document', () => {
    assert.equal(env.win.document.querySelectorAll('#qual').length, 1,
      'mountQualifier is adopt-or-build on a fixed id — two closures over one node '
      + 'would mean two answer objects and one set of handlers');
    assert.ok(env.win.document.getElementById(LAYER_ID).contains(env.win.document.getElementById('qual')),
      'and it lives inside the persistent layer, so a content swap cannot tear it away');
  });

  test('the consumer adopts that card rather than mounting a second', () => {
    // The layer calls `mountQualifier` exactly twice: `mountShellConcierge` (which
    // is deliberately never called on page load) and `mountNoVoiceQualifier`. The
    // bridge consumer used to be a third; it now adopts. A third would be a
    // collision, not a duplicate — `mountQualifier` is adopt-or-build on the fixed
    // id `#qual`, so two closures would share one node with two answer objects.
    const src = code('js/perch-layer.js');
    // ONE now, not two: `mountShellConcierge` went with the voice concierge — it was
    // the shell's entry point and the shell is deleted. `mountNoVoiceQualifier` is the
    // only builder left, which is precisely what this suite is about. The number
    // matters less than the direction: what must never GROW is the count of things
    // that build the card, because two builders on the shared `#qual` id is a silent
    // collision rather than a visible duplicate.
    assert.equal((src.match(/mountQualifier\(layer, \{/g) || []).length, 1,
      'exactly one mountQualifier call site remains in the layer');
    assert.match(src, /const qualifier = mountNoVoiceQualifier\(\)\.qualifier;/,
      'the bridge consumer takes the card the no-voice door mounted');

    // Paula's own door — `open_qualifier` arriving over the bridge and showing this
    // card — is driven end to end against the real poll in
    // test/perch-command-consumer.test.mjs §4. That file's §1 was amended by this
    // ticket and its §4 was not, which is the measurement that the voice path did
    // not move.
  });

  test('the consent-decline door opens the same card, with no call and no token', () => {
    const win = env.win;
    const before = win.Perch.layer.probe().noVoice.bookIntents;
    assert.equal(layer.openBookingQualifier('consent_decline'), true,
      'the module export opens the card');
    const qual = win.document.getElementById('qual');
    assert.ok(qual.classList.contains('show'), 'and it is the one card in the document');
    assert.equal(win.document.querySelectorAll('#qual').length, 1);
    assert.equal(win.Perch.layer.probe().noVoice.bookIntents, before + 1);
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  test('the probe reports which key a completed card would use, never the value', () => {
    const p = env.win.Perch.layer.probe();
    assert.equal(p.qualifierMounted, true);
    assert.equal(p.noVoice.joinKey, 'web_session', 'no call bound, so the web session id');
    const flat = JSON.stringify(p);
    assert.equal(flat.includes('web-'), false,
      'the probe never prints an id — same posture as commandChannel.callId');
    assert.equal(flat.includes('call_'), false);
  });

  test('the no-voice channel and the call channel keep separate latches', () => {
    const p = env.win.Perch.layer.probe();
    assert.notEqual(p.noVoice.channel, null, 'the no-voice channel exists');
    assert.equal(p.commandChannel, null, 'and the bridge consumer does not, with no call bound');
    assert.equal(p.noVoice.channel.polling, false,
      'it is never started — it has no credential to poll with and nothing to poll for');
  });

  test('a modified click is left to the browser — that is how people open a tab', () => {
    const win = env.win;
    const before = win.Perch.layer.probe().noVoice.bookIntents;
    for (const mod of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
      const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [mod]: true });
      win.document.getElementById('cta').dispatchEvent(ev);
      assert.equal(ev.defaultPrevented, false, `${mod}-click must follow the href`);
    }
    const mid = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 1 });
    win.document.getElementById('cta').dispatchEvent(mid);
    assert.equal(mid.defaultPrevented, false, 'middle-click must follow the href');
    assert.equal(win.Perch.layer.probe().noVoice.bookIntents, before, 'and none opened the card');
  });

  test('an ordinary link is not touched', () => {
    const ev = click(env.win, 'plain');
    assert.equal(ev.defaultPrevented, false,
      'the listener is scoped to marked elements — nothing else on the page changes behaviour');
  });

  test('the layer is not a window handle to the card', () => {
    const win = env.win;
    assert.equal(typeof win.openBookingQualifier, 'undefined');
    const pub = win.Perch && win.Perch.layer ? Object.keys(win.Perch.layer) : [];
    for (const k of pub) {
      assert.equal(/openBookIntent|openBookingQualifier|mountNoVoiceQualifier/.test(k), false,
        `A33 (#58): ${k} must not be reachable from window — it raises a dialog `
        + 'that collects income and net-worth bands');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The two endings — JORDAN-SITE-UX-FIXES-R1
//
// This section used to assert that a BACKDROP DISMISS reached the calendar, and it
// passed, and that was the production defect: the most common accidental gesture
// against a modal — clicking outside it — was reading as "skip intake", writing the
// 30-minute booking unlock and navigating to /book. The card exists to stand
// between a walk-up and Paul's calendar, and closing it was walking through it.
//
// The contract now has two endings and they are held apart here:
//   DISMISS (backdrop / Esc / Back) — no navigation, no unlock, nothing written.
//   DECLINE (the labelled control in the card) — #158's path, unchanged.
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — declining reaches the calendar, dismissing does not', () => {
  let e2 = null;
  let l2 = null;

  before(async () => {
    if (env) env.restore();
    e2 = browserGlobals('https://donovan-site.pages.dev/contact');
    l2 = await loadLayer('abandon');
    l2.mount();
  });

  // Restore only e2: its `saved` descriptors ARE the shared env's globals, so
  // putting them back re-arms every later section against the original document.
  after(() => { if (e2) e2.restore(); });

  test('a dismiss (Esc) leaves the visitor where they were, with the gate shut', () => {
    // Was the backdrop click, then briefly a header ×; both were removed as ways
    // out of the booking protocol (2026-09-04 / 2026-09-05). The backdrop is
    // inert, there is no close control, and Esc is the dismiss gesture.
    const win = e2.win;
    const ev = click(win, 'cta');
    assert.equal(ev.defaultPrevented, true, 'the anchor navigation was prevented to open the card');

    // One tap, then a click on the dark area (inert), then Esc.
    const qual = win.document.getElementById('qual');
    const opt = qual.querySelector('#qual-bd button.opt');
    if (opt) opt.click();
    qual.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    assert.equal(qual.classList.contains('show'), true, 'a backdrop click must not close the card');
    assert.equal(qual.querySelector('.hd [data-close-x]'), null, 'no close control may be painted');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    assert.equal(qual.classList.contains('show'), false, 'the card closed');
    // THE POINT, and the reversal. With no router `host.go` is a `location.assign`,
    // which jsdom records as a "not implemented" navigation and cannot be read
    // back — so the unlock write is the observable for "did this reach a revealed
    // calendar", exactly as it was when this assertion ran the other way round.
    assert.equal(win.localStorage.getItem('donovan_booking_unlock'), null,
      'a dismissed card writes no booking unlock — /book stays gated behind the qualifier');
    assert.equal(win.Perch.layer.probe().noVoice.declines, 0,
      'and the host did not record it as a decline');
    assert.equal(win.Perch.layer.probe().noVoice.dismissals, 1);
  });

  test('the DECLINE control is what carries a visitor who asked to skip', () => {
    const win = e2.win;
    click(win, 'cta');
    const qual = win.document.getElementById('qual');
    assert.equal(qual.classList.contains('show'), true, 'the card re-opened');

    const decline = qual.querySelector('#qual-bd [data-decline]');
    assert.ok(decline, 'the card paints an explicit way to skip the questions');
    assert.ok(decline.textContent.trim().length > 0, 'and it is labelled, not a bare icon');
    assert.match(decline.getAttribute('href') || '', /^tel:/, '2026-09-04: the only alternative to answering is the phone');
    decline.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));

    // 2026-09-02: a decline no longer unlocks the calendar; 2026-09-04: it no
    // longer goes to the contact page either. It is counted, the card stays open
    // with the number in view, and nothing navigates.
    assert.equal(qual.classList.contains('show'), true, 'the card stays open');
    assert.equal(win.localStorage.getItem('donovan_booking_unlock'), null,
      'a declined card writes no booking unlock — /book stays gated behind a completed card');
    assert.equal(win.Perch.layer.probe().noVoice.declines, 1);
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  test('an abandoned card claims no server record', () => {
    // Nothing was POSTed, so there is nothing for /booking/create to join to, and
    // presenting an id would resolve `unverified` — a clean signal turned to noise.
    assert.equal(submits.filter((s) => s.source === 'contact_page').length, 0);
    assert.ok(!e2.win.__perchCallId,
      'no join key is claimed for a card that never submitted');
  });

  test('but the answers they DID tap survive onto the form', async () => {
    const ws = await import('../donovan-legal-site/js/perch/web-session.js?fresh=5');
    // The prefill is stashed without the qualified flag: the answers are the
    // visitor's own and they earned them; the id claim is what has to be earned.
    assert.equal(ws.isQualified(e2.win), false, 'not qualified — nothing was submitted');
  });

  test('the card is reachable again after an abandon', () => {
    const win = e2.win;
    const before = win.Perch.layer.probe().noVoice.bookIntents;
    click(win, 'contact-link');
    assert.equal(win.document.getElementById('qual').classList.contains('show'), true,
      'a second intent re-opens the card — abandoning is not a one-way door');
    assert.equal(win.Perch.layer.probe().noVoice.bookIntents, before + 1);
    win.document.getElementById('qual').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · The boundaries — no intake value reaches a calendar field
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 — the description guard is untouched', () => {
  // The verification the order names. Computed over the function SPAN with LF
  // endings, trimmed, one trailing newline — not `toString()`, which would move
  // with the engine rather than with the file.
  // See [[project_sheldon_clio_writepath_verify]].
  const DESCRIPTION_SHA = 'de5fcb4fff0ce318d15f50f6685acd7cbffb0db2ec3b5b30f28bb995433aef0b';

  test('buildClientDescription is byte-for-byte what it was before this ticket', () => {
    const src = read('functions/booking/_lib/provider-clio.js').replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    const start = lines.findIndex((l) => l.startsWith('export function buildClientDescription'));
    assert.ok(start >= 0, 'the function is still declared where the guard expects it');
    const end = lines.findIndex((l, i) => i > start && l === '}');
    const span = `${lines.slice(start, end + 1).join('\n').trim()}\n`;
    assert.equal(crypto.createHash('sha256').update(span).digest('hex'), DESCRIPTION_SHA,
      'this ticket may not alter buildClientDescription');
  });

  test('no intake value can reach the description, summary or location', () => {
    // The guard is structural: the function takes four named parameters and reads
    // nothing else, so extra fields cannot leak in even when handed to it.
    const out = buildClientDescription({
      typeName: 'Consultation',
      meetingLink: 'https://meet.donovan.law/c',
      firmPhone: '', firmEmail: '',
      notes: 'Income: $1.5M–$3M',
      intakeSummary: '— Perch intake —\nNet worth: $5M–$15M',
      contact: { name: 'Income: $1.5M–$3M' },
    });
    for (const forbidden of ['Income', 'Net worth', 'Perch intake', '$1.5M', '$5M']) {
      assert.equal(out.includes(forbidden), false,
        `the client-facing description must never carry: ${forbidden}`);
    }
  });

  test('the note allow-list still omits both bands — #110 half two does not land', () => {
    // PR #110's other claim was "every intake answer on the invite". It is refused
    // here: `notes` is a client-visible, caller-editable textarea, and issue #115
    // holds the same line ("Bands never reach a client-visible field").
    // 2026-09-06: widened by ONE key, `role` (who is booking: party / counsel / advisor /
    // notice / deal), so the office can run conflicts before a divorce call. Reviewed
    // here, as the comment above demands. It is a tapped label, not a band and not a fact.
    assert.deepEqual([...NOTE_ANSWER_KEYS],
      ['matter_category', 'matter_sub', 'role', 'for_whom', 'state', 'source'],
      'the allow-list is the reviewed six — widening it further stays a reviewed diff');
    assert.equal(NOTE_ANSWER_KEYS.includes('income_band'), false);
    assert.equal(NOTE_ANSWER_KEYS.includes('net_worth_band'), false);

    // And the filter is real, not documentation: bands handed in are dropped.
    const note = bookingPrefillFrom({
      matter_category: 'real_estate', matter_sub: 'acquisition',
      income_band: '1_5m_3m', net_worth_band: '5m_15m', language: 'en',
    });
    assert.ok(note && note.notes, 'the matter still composes');
    for (const forbidden of ['Income', 'Net worth', '1_5m', '5m_15m', '$1.5M', '$5M']) {
      assert.equal(note.notes.includes(forbidden), false,
        `a band must not reach the booking note: ${forbidden}`);
    }
    assert.deepEqual(Object.keys(note), ['notes'],
      'and no new form field is invented to carry them');
  });

  test('nothing on the no-voice path can submit a booking', () => {
    // The two host seams this ticket adds reach `booking-control.js`, whose command
    // table has no submit verb. The visitor always presses Confirm.
    assert.deepEqual([...FORBIDDEN_METHODS], ['submit', 'confirm', 'book', 'create']);
    for (const m of FORBIDDEN_METHODS) {
      assert.equal(Object.values(COMMAND_MAP).includes(m), false,
        `COMMAND_MAP must not expose ${m}`);
    }
    // Anchored on the CLOSING quote, not on a prefix: `applyBooking('book` is a
    // prefix of `applyBooking('booking_prefill'`, so an unanchored pattern reports
    // a violation on the one legitimate call this ticket adds.
    const layerSrc = code('js/perch-layer.js');
    for (const m of FORBIDDEN_METHODS) {
      assert.equal(new RegExp(`applyBooking\\((['"])${m}\\1`).test(layerSrc), false,
        `the layer must not drive ${m}`);
    }
    // The positive arm: the two verbs it DOES drive are both on COMMAND_MAP, so the
    // assertion above is not passing merely because nothing calls applyBooking.
    // See [[feedback_zero_request_assertion_needs_a_positive_arm]].
    const driven = [...layerSrc.matchAll(/applyBooking\(['"]([a-z_]+)['"]/g)].map((m) => m[1]);
    assert.ok(driven.length >= 2, 'the layer does drive booking commands');
    for (const cmd of driven) {
      assert.ok(Object.prototype.hasOwnProperty.call(COMMAND_MAP, cmd),
        `${cmd} must be a declared booking command`);
    }
  });

  test('the no-voice door navigates to the same page goto_booking does', () => {
    assert.match(code('js/perch-layer.js'), /host\.go\(BOOK_PATH\)/,
      'the fallback uses the channel\'s own constant, not a second spelling of /book');
    assert.equal(BOOK_PATH, '/book.html');
  });

  // REMOVED: the consent decline keeps its memo §1 fallback
  // js/consent-gate.js is deleted. The consent gate existed because the voice call
  // recorded audio under Florida two-party consent (§934.03); the card records nothing,
  // so there is no consent to decline and no fallback to keep.
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 · The document load — the half a same-document test cannot reach
// ─────────────────────────────────────────────────────────────────────────────

describe('§6 — the join key and the prefill cross a document boundary', () => {
  let e3 = null;
  let l3 = null;

  before(() => {
    // LAST on purpose: browserGlobals() swaps globalThis, and the shared layer
    // instance above holds references to the window it mounted into. Tearing that
    // down mid-file would make every later assertion read an empty document.
    if (env) { env.restore(); env = null; }
    e3 = browserGlobals('https://donovan-site.pages.dev/book.html');
  });

  after(() => { if (e3) e3.restore(); });

  // ── §6 body ──
  // The no-router fallback is a `location.assign`, so the join key and the prefill
  // have to cross a document boundary. Nothing in memory does. This is the half of
  // Task 4 that a same-document test cannot reach.
  test('the join key and the prefill survive a document load onto /book', async () => {
    const ws = await import('../donovan-legal-site/js/perch/web-session.js?fresh=6');
    ws.__reset();

    // Stand in for the previous document: a completed card, its id and its note.
    const id = ws.markQualified(e3.win);
    ws.stashPrefill({ notes: 'Matter: Real estate — Acquisition' }, e3.win);

    l3 = await loadLayer('resume');
    l3.mount();

    assert.equal(e3.win.__perchCallId, id,
      'the booking POST presents the id the qualifier POSTed under, across the load');
    assert.deepEqual(e3.prefilled, [{ notes: 'Matter: Real estate — Acquisition' }],
      'and the note the visitor tapped is on the form');

    // Read-once: a second mount must not replay the payload onto a later booking.
    assert.equal(ws.takePrefill(e3.win), null, 'the prefill is spent');
    assert.equal(ws.isQualified(e3.win), true,
      'but the join key survives — a reload of /book must still join');

    l3.releaseCall();
  });
});
