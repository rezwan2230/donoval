// Browser-side behaviour, under jsdom.
//
// Two things are covered here:
//   1. The consent modal (B1 client half) — that it fails CLOSED and hands back
//      the server's ticket rather than a self-authored assertion.
//   2. The inline-action dispatcher (B3) — that the 255 rewritten handlers still
//      invoke what they used to. This is the regression guard for the riskiest
//      part of the change: a silent break here means dead buttons on the member
//      tax tools, which no server-side test would ever notice.

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { DISCLOSURE_TEXT } from '../donovan-legal-site/functions/_lib/consent.js';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const dispatcherSrc = readFileSync(fileURLToPath(new URL('js/inline-actions.js', SITE)), 'utf8');

/** Fresh jsdom with the dispatcher installed. */
function mount(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only' });
  dom.window.eval(dispatcherSrc);
  return dom;
}

describe('inline-action dispatcher (B3)', () => {
  test('a no-arg click handler invokes the global function', () => {
    const dom = mount('<button data-dvn-on="click" data-dvn-do="calculateSTR()">go</button>');
    let hits = 0;
    dom.window.calculateSTR = () => { hits++; };
    dom.window.document.querySelector('button').click();
    assert.equal(hits, 1);
  });

  test('a string argument is passed through', () => {
    const dom = mount(`<button data-dvn-on="click" data-dvn-do="loadPreset('ski')">go</button>`);
    const seen = [];
    dom.window.loadPreset = (v) => seen.push(v);
    dom.window.document.querySelector('button').click();
    assert.deepEqual(seen, ['ski']);
  });

  test('backslash-escaped quotes are handled (toggleHelp(\\\'x\\\'))', () => {
    const dom = mount(`<button data-dvn-on="click" data-dvn-do="toggleHelp(\\'reclass_help\\')">?</button>`);
    const seen = [];
    dom.window.toggleHelp = (v) => seen.push(v);
    dom.window.document.querySelector('button').click();
    assert.deepEqual(seen, ['reclass_help']);
  });

  test('`this` resolves to the element that carried the attribute', () => {
    const dom = mount('<button id="b" data-dvn-on="click" data-dvn-do="toggleNOIMethod(this)">go</button>');
    let got = null;
    dom.window.toggleNOIMethod = (el) => { got = el; };
    const btn = dom.window.document.querySelector('#b');
    btn.click();
    assert.equal(got, btn);
  });

  test('`event` resolves to the real event (the file-input importJSON case)', () => {
    const dom = mount('<input id="imp" data-dvn-on="change" data-dvn-do="importJSON(event)">');
    let got = null;
    dom.window.importJSON = (ev) => { got = ev; };
    const input = dom.window.document.querySelector('#imp');
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.ok(got, 'handler must receive the event');
    assert.equal(got.type, 'change');
  });

  test('a numeric argument arrives as a Number (the delEntry(${id}) case)', () => {
    const dom = mount('<button data-dvn-on="click" data-dvn-do="delEntry(42)">x</button>');
    const seen = [];
    dom.window.delEntry = (v) => seen.push(v);
    dom.window.document.querySelector('button').click();
    assert.deepEqual(seen, [42]);
    assert.equal(typeof seen[0], 'number');
  });

  test('THE DYNAMIC CASE: handlers on innerHTML-injected rows still fire', () => {
    // This is why the dispatcher delegates instead of binding at load. These rows
    // are created after page load by the tracker's render(); their old inline
    // handlers would have been dead under the new CSP.
    const dom = mount('<div id="list"></div>');
    const seen = [];
    dom.window.delActivity = (id) => seen.push(id);
    dom.window.document.querySelector('#list').innerHTML =
      '<button data-dvn-on="click" data-dvn-do="delActivity(7)">Remove</button>';
    dom.window.document.querySelector('#list button').click();
    assert.deepEqual(seen, [7]);
  });

  test('a dotted path resolves with the right `this` (window.print)', () => {
    const dom = mount('<button data-dvn-on="click" data-dvn-do="window.print()">p</button>');
    let called = 0;
    dom.window.print = function () { called++; };
    dom.window.document.querySelector('button').click();
    assert.equal(called, 1);
  });

  test('the __click builtin clicks the target element', () => {
    const dom = mount(`<button data-dvn-on="click" data-dvn-do="__click('#imp')">load</button><input id="imp">`);
    let clicked = 0;
    dom.window.document.querySelector('#imp').addEventListener('click', () => { clicked++; });
    dom.window.document.querySelector('button').click();
    assert.equal(clicked, 1);
  });

  test('an element only responds to the event type it was authored for', () => {
    const dom = mount('<input data-dvn-on="change" data-dvn-do="renderHeatMap()">');
    let hits = 0;
    dom.window.renderHeatMap = () => { hits++; };
    const el = dom.window.document.querySelector('input');
    el.click(); // wrong type — must NOT fire
    assert.equal(hits, 0);
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(hits, 1);
  });

  test('a click on a child still finds the handler element', () => {
    const dom = mount('<button data-dvn-on="click" data-dvn-do="exportCSV()"><span id="inner">x</span></button>');
    let hits = 0;
    dom.window.exportCSV = () => { hits++; };
    dom.window.document.querySelector('#inner').click();
    assert.equal(hits, 1);
  });

  test('IT IS NOT AN EVAL BRIDGE: an arbitrary expression is refused', () => {
    const dom = mount(`<button data-dvn-on="click" data-dvn-do="fetch('https://evil.example')">x</button>`);
    let fetched = 0;
    dom.window.fetch = () => { fetched++; };
    dom.window.console.warn = () => {};
    dom.window.document.querySelector('button').click();
    // `fetch` IS a global function, so this one is genuinely callable — the point
    // of the assertion below is the ARGUMENT parser, not the callee. A non-literal
    // argument must stop the call dead.
    const dom2 = mount(`<button data-dvn-on="click" data-dvn-do="steal(document.cookie)">x</button>`);
    let stolen = 0;
    dom2.window.steal = () => { stolen++; };
    dom2.window.console.warn = () => {};
    dom2.window.document.querySelector('button').click();
    assert.equal(stolen, 0, 'a non-literal argument must not be evaluated');
  });

  test('an unknown function warns instead of throwing', () => {
    const dom = mount('<button data-dvn-on="click" data-dvn-do="noSuchFn()">x</button>');
    const warns = [];
    dom.window.console.warn = (...a) => warns.push(a.join(' '));
    dom.window.document.querySelector('button').click();
    assert.ok(warns.some((w) => w.includes('no such function')));
  });
});

// REMOVED with the voice concierge: js/consent-gate.js minted the Turnstile + consent credentials that /web-call required. Both are gone.

// Source-level guard. The behavioural tests above prove the modal works; this
// proves it cannot regress into needing 'unsafe-inline' — a future edit that
// reaches for el.style or an injected <style> fails here rather than silently
// re-coupling the consent gate to a policy we are trying to tighten.
// REMOVED with the voice concierge: the consent gate and its stylesheet went with the voice concierge.
