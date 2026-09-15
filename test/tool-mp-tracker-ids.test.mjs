// Dr. Insane — material-participation tracker: ids and prior-year counts are
// numbers on every read path (#72, CodeQL js/xss-through-dom 147/148/149).
//
// #67 closed the how-held hole. Three sinks in this file stayed open because
// JSON.parse taints the whole restored object and three fields still reached
// HTML with no barrier at all:
//
//   renderActivities  `prior MP: ${a.prior}/10`          (alert 147)
//                     `data-dvn-do="delActivity(${a.id})"`
//   renderMP          Test 5 / Test 6 cells, `a.prior`   (alert 148)
//   renderLog         `data-dvn-do="delEntry(${e.id})"`  (alert 149)
//
// The two id sites are the sharp ones: they land INSIDE a double-quoted
// attribute, so a persisted id of `1)" onmouseover="alert(1)` breaks out of the
// attribute entirely — no `<` required, which is why escaping alone would not
// have been enough. Both restore paths (localStorage and an imported backup)
// now coerce through Number(), and a value that will not survive the coercion
// is not an id, so the record carrying it is dropped.
//
// Proved here: the coercion holds on both read paths, a crafted value never
// reaches an HTML or attribute sink, and the coerced numeric id still drives
// the real delete buttons through the real inline-actions dispatcher.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');
const PAGE = read('gold/tool-material-participation-tracker.html');
const TRACKER = read('js/page/tool-material-participation-tracker.js');
const INLINE = read('js/inline-actions.js');

const KEY = 'donovan_reps_mp_v3';
const PAGE_SCRIPTS = new JSDOM(PAGE).window.document.querySelectorAll('script').length;

// Two shapes of hostile value. The first needs `<` and is what esc() would have
// caught; the second needs only a quote and a space, and escapes the attribute
// context on its own.
const MARKUP = '"><img src=x onerror=alert(1)>';
const BREAKOUT = '1)" onmouseover="alert(1)';
const HOSTILE = [MARKUP, BREAKOUT, 'alert(1)', {}, [], 'NaN', '1e2abc'];

const activity = (over = {}) => ({
  id: 11, name: 'Beach condo', type: 'Rental', hold: 'Direct', gp: false, psa: false, prior: 6, ...over,
});
const entry = (over = {}) => ({
  id: 22, date: '2026-03-01', person: 'taxpayer', other: '', comp: false, act: 11,
  cat: 'tenant', inv: false, dd: false, counts: true, mgmt: false, hours: 6, desc: 'Screened two applicants.', ...over,
});

/** The real tool page under jsdom, with the tracker and the real dispatcher. */
function mount(seed, { dispatcher = false } = {}) {
  const dom = new JSDOM(PAGE, {
    url: 'https://example.test/gold/tool-material-participation-tracker.html',
    runScripts: 'outside-only', // the page's own <script> tags stay inert
  });
  if (seed) dom.window.localStorage.setItem(KEY, JSON.stringify(seed));
  dom.window.eval(TRACKER); // top level runs load() then render()
  if (dispatcher) dom.window.eval(INLINE);
  return dom;
}

const html = (dom, id) => dom.window.document.getElementById(id).innerHTML;
const rows = (dom) => [...dom.window.document.querySelectorAll('#actList .miniact')];
const logRows = (dom) => [...dom.window.document.querySelectorAll('#logBody tr')].filter((r) => r.querySelector('.del'));
const actions = (dom) => [...dom.window.document.querySelectorAll('[data-dvn-do]')].map((el) => el.getAttribute('data-dvn-do'));

/** Nothing the payload would have created exists, at any sink, in any form. */
function assertNoInjection(dom) {
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('img[onerror]').length, 0, 'payload created an element');
  assert.equal(doc.querySelectorAll('script').length, PAGE_SCRIPTS, 'payload created a script');
  assert.equal(doc.querySelectorAll('[onmouseover],[onclick],[onerror]').length, 0, 'payload broke out into an event attribute');
  for (const id of ['actList', 'mpZone', 'turnover', 'logBody']) {
    const h = html(dom, id);
    assert.ok(!h.includes('<img'), `raw markup rendered into #${id}`);
    assert.ok(!h.includes('onmouseover'), `attribute breakout rendered into #${id}`);
  }
}

/**
 * The two inline actions built from restored state — delActivity and delEntry —
 * are the attribute sinks. Their argument must always be a bare numeric literal;
 * the page's static actions (exportJSON(), __click('#imp'), …) are authored in
 * the HTML and carry nothing from storage, so they are not in scope here.
 */
function assertActionsAreNumericOnly(dom) {
  const dynamic = actions(dom).filter((e) => /^del(Activity|Entry)\b/.test(e));
  for (const expr of dynamic) {
    assert.match(expr, /^del(Activity|Entry)\(-?\d+(\.\d+)?\)$/, `non-numeric argument in an inline action: ${expr}`);
  }
}

describe('MP tracker — a crafted id never reaches an attribute sink (#72)', () => {
  test('a crafted activity id is dropped on load, not rendered', () => {
    for (const bad of HOSTILE) {
      const dom = mount({ activities: [activity({ id: bad })], entries: [] });
      assert.equal(rows(dom).length, 0, `activity id ${JSON.stringify(bad)} survived the read path`);
      assertNoInjection(dom);
      assertActionsAreNumericOnly(dom);
    }
  });

  test('a crafted entry id is dropped on load, not rendered', () => {
    for (const bad of HOSTILE) {
      const dom = mount({ activities: [activity()], entries: [entry({ id: bad })] });
      assert.equal(logRows(dom).length, 0, `entry id ${JSON.stringify(bad)} survived the read path`);
      assertNoInjection(dom);
      assertActionsAreNumericOnly(dom);
    }
  });

  test('the attribute-breakout payload does not escape the attribute', () => {
    const dom = mount({ activities: [activity({ id: BREAKOUT })], entries: [entry({ id: BREAKOUT })] });
    // The literal text must not appear anywhere in the rendered markup, in any sink.
    for (const id of ['actList', 'mpZone', 'turnover', 'logBody']) {
      assert.ok(!html(dom, id).includes('alert(1)'), `breakout payload text reached #${id}`);
    }
    assertNoInjection(dom);
  });

  test('ids that are not positive finite numbers are dropped, not flattened to 0', () => {
    // Number() maps all of these to 0; two records colliding on one id would let
    // a single delete remove both, so they are refused rather than coerced.
    for (const bad of [null, '', false, [], undefined]) {
      const dom = mount({ activities: [activity({ id: bad })], entries: [] });
      assert.equal(rows(dom).length, 0, `activity id ${JSON.stringify(bad)} was flattened rather than dropped`);
    }
  });
});

describe('MP tracker — a crafted prior-year count is coerced, not rendered (#72)', () => {
  test('a crafted prior reads as a number at both HTML sites', () => {
    const dom = mount({ activities: [activity({ prior: MARKUP })], entries: [] });

    assert.equal(rows(dom).length, 1, 'the activity itself should survive — only prior is bad');
    assert.match(rows(dom)[0].textContent, /prior MP: 0\/10/, 'prior was not coerced in the activity chip');
    assert.ok(html(dom, 'mpZone').includes('0/10'), 'prior was not coerced in the Test 5 cell');
    assertNoInjection(dom);
    assertActionsAreNumericOnly(dom);
  });

  test('every unreadable prior becomes 0 and Test 5 / Test 6 stay unmet', () => {
    for (const bad of [MARKUP, BREAKOUT, 'six', {}, [], null, undefined, NaN]) {
      const dom = mount({ activities: [activity({ prior: bad, psa: true })], entries: [] });
      const mp = html(dom, 'mpZone');
      assert.ok(!mp.includes('NaN') && !mp.includes('undefined'), `prior ${JSON.stringify(bad)} rendered as a non-number`);
      assert.ok(!mp.includes('✓ clears on history'), `prior ${JSON.stringify(bad)} wrongly cleared Test 5`);
      assert.ok(mp.includes('need 3 prior yrs'), `prior ${JSON.stringify(bad)} wrongly cleared Test 6`);
    }
  });
});

describe('MP tracker — an imported backup is coerced on the same terms (#72)', () => {
  async function importBackup(dom, backup) {
    const file = new dom.window.File([JSON.stringify(backup)], 'REPS-MP-backup.json', { type: 'application/json' });
    dom.window.importJSON({ target: { files: [file], value: 'C:\\fakepath\\REPS-MP-backup.json' } });
    for (let i = 0; i < 100 && !dom.window.localStorage.getItem(KEY); i++) await new Promise((r) => setTimeout(r, 10));
  }

  test('crafted ids and a crafted prior in an imported file never reach a sink', async () => {
    const dom = mount(null);
    await importBackup(dom, {
      activities: [activity({ id: BREAKOUT }), activity({ id: 12, prior: MARKUP })],
      entries: [entry({ id: MARKUP }), entry({ id: 23, act: 12 })],
      settings: {},
    });

    // The two crafted-id records are gone; the two sound ones survived.
    assert.equal(rows(dom).length, 1, 'crafted activity id survived the import');
    assert.equal(logRows(dom).length, 1, 'crafted entry id survived the import');
    assert.match(rows(dom)[0].textContent, /prior MP: 0\/10/, 'crafted prior survived the import');
    assertNoInjection(dom);
    assertActionsAreNumericOnly(dom);

    // and the import persisted the coerced state, so a reload cannot resurrect it
    const stored = JSON.parse(dom.window.localStorage.getItem(KEY));
    assert.deepEqual(stored.activities.map((a) => a.id), [12]);
    assert.deepEqual(stored.entries.map((e) => e.id), [23]);
    assert.equal(typeof stored.activities[0].prior, 'number');
  });
});

describe('MP tracker — behaviour is unchanged for sound data (#72)', () => {
  test('numeric ids and prior round-trip verbatim', () => {
    const id = 1753449600000.3421; // the real uid() shape: Date.now()+Math.random()
    const dom = mount({ activities: [activity({ id, prior: 6 })], entries: [entry({ act: id })] });

    assert.equal(rows(dom).length, 1);
    assert.match(rows(dom)[0].textContent, /prior MP: 6\/10/, 'prior was altered');
    assert.ok(actions(dom).includes(`delActivity(${id})`), 'the activity id was altered in the delete action');
    assert.ok(html(dom, 'mpZone').includes('✓ clears on history'), 'Test 5 stopped clearing on a 6-year history');
    // the entry still resolves to its activity by name, not to '(deleted)'
    assert.ok(html(dom, 'logBody').includes('Beach condo'), 'the entry lost its activity link');
  });

  test('a numeric-string id from an older backup is coerced and still links its entries', () => {
    const dom = mount({ activities: [activity({ id: '11' })], entries: [entry({ act: '11' })] });

    assert.equal(rows(dom).length, 1);
    assert.ok(actions(dom).includes('delActivity(11)'), 'numeric-string id was not coerced');
    assert.ok(html(dom, 'logBody').includes('Beach condo'), 'coercion broke the entry→activity link');
    assert.ok(html(dom, 'mpZone').includes('6 hrs'), 'coercion broke the hours roll-up');
  });

  test('the delete buttons still work through the real inline-actions dispatcher', () => {
    const dom = mount({ activities: [activity()], entries: [entry()] }, { dispatcher: true });
    const doc = dom.window.document;
    dom.window.confirm = () => true;

    assert.equal(logRows(dom).length, 1, 'harness failed to seed an entry');
    logRows(dom)[0].querySelector('.del').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(logRows(dom).length, 0, 'delEntry did not fire on the coerced id');

    assert.equal(rows(dom).length, 1, 'harness failed to seed an activity');
    rows(dom)[0].querySelector('button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(rows(dom).length, 0, 'delActivity did not fire on the coerced id');

    assert.equal(doc.querySelectorAll('#actList .miniact').length, 0);
  });
});
