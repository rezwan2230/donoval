// JORDAN — material-participation tracker: how-held is a closed set (#67).
//
// The tracker restores `activities` straight out of localStorage and out of an
// imported backup file, and it interpolates the how-held label into HTML in
// three places (the activity chip, the per-activity MP card, and the printed
// turnover record). Before this guard, a persisted `hold` was an arbitrary
// attacker-chosen string that fell through `HOLD_LABEL[a.hold] || a.hold`
// straight into innerHTML — a self-XSS, and what CodeQL flagged as
// js/xss-through-dom.
//
// Two independent halves are proved here:
//   1. Read paths (load / importJSON) normalise anything outside the allowed
//      set, so no invalid hold ever reaches the activities state at all.
//   2. Even if a bad value somehow reaches the state, every one of the three
//      HTML sites escapes it — defence in depth, asserted against rendered DOM
//      rather than against the source text.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const PAGE = readFileSync(fileURLToPath(new URL('gold/tool-material-participation-tracker.html', SITE)), 'utf8');
const TRACKER = readFileSync(fileURLToPath(new URL('js/page/tool-material-participation-tracker.js', SITE)), 'utf8');

const KEY = 'donovan_reps_mp_v3';
const PAYLOAD = '"><img src=x onerror=alert(1)>';
const ALLOWED = ['Direct', 'GP', 'LLC', 'SCorp', 'LP'];
// Baseline for the injection check: how many <script> the page legitimately has.
const PAGE_SCRIPTS = new JSDOM(PAGE).window.document.querySelectorAll('script').length;

/** The real tool page under jsdom, with the tracker evaluated against it. */
function mount(seed) {
  const dom = new JSDOM(PAGE, {
    url: 'https://example.test/gold/tool-material-participation-tracker.html',
    runScripts: 'outside-only', // the page's own <script> tags stay inert
  });
  if (seed) dom.window.localStorage.setItem(KEY, JSON.stringify(seed));
  dom.window.eval(TRACKER); // top level runs load() then render()
  return dom;
}

const html = (dom, id) => dom.window.document.getElementById(id).innerHTML;

/** The rendered holds, read back off the DOM the way a user would see them. */
function holdChips(dom) {
  return [...dom.window.document.querySelectorAll('#actList .pill')]
    .filter((el) => el.className.includes('hold') || el.className.includes('lp'))
    .map((el) => el.textContent);
}

/** No element the payload would have created exists anywhere in the document. */
function assertNoInjection(dom) {
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('img[onerror]').length, 0, 'payload created an element');
  assert.equal(doc.querySelectorAll('script').length, PAGE_SCRIPTS, 'payload created a script');
  for (const id of ['actList', 'mpZone', 'turnover']) {
    assert.ok(!html(dom, id).includes('<img'), `raw markup rendered into #${id}`);
  }
}

const activity = (hold) => ({ id: 1, name: 'Beach condo', type: 'Rental', hold, gp: false, psa: false, prior: 0 });

describe('MP tracker — how-held is validated on every read path (#67)', () => {
  test('a crafted localStorage hold is normalised, not rendered', () => {
    const dom = mount({ activities: [activity(PAYLOAD)], entries: [] });

    assert.deepEqual(holdChips(dom), ['Direct'], 'crafted hold survived into the chip');
    assertNoInjection(dom);
  });

  test('every non-member of the allowed set is normalised on load', () => {
    for (const bad of [PAYLOAD, '', null, undefined, 0, 'direct', 'GP ', 'Trust', {}, ['LP']]) {
      const dom = mount({ activities: [activity(bad)], entries: [] });
      assert.deepEqual(holdChips(dom), ['Direct'], `hold ${JSON.stringify(bad)} was not normalised`);
    }
  });

  test('each allowed hold is preserved verbatim — behaviour unchanged', () => {
    const labels = { Direct: 'Direct', GP: 'General partner', LLC: 'LLC member', SCorp: 'S-corp', LP: 'Limited partner' };
    for (const good of ALLOWED) {
      const dom = mount({ activities: [activity(good)], entries: [] });
      assert.deepEqual(holdChips(dom), [labels[good]], `hold ${good} was altered`);
    }
  });

  test('an LP holding still triggers the limited-partner restriction', () => {
    const dom = mount({ activities: [activity('LP')], entries: [] });
    assert.ok(html(dom, 'mpZone').includes('lpbanner'), 'LP restriction lost');
    assert.ok(html(dom, 'mpZone').includes('n/a · limited partner'), 'LP test suppression lost');
  });

  test('a crafted hold in an imported backup file is normalised, not rendered', async () => {
    const dom = mount(null);
    const backup = { activities: [activity(PAYLOAD)], entries: [], settings: {} };
    const file = new dom.window.File([JSON.stringify(backup)], 'REPS-MP-backup.json', { type: 'application/json' });
    const target = { files: [file], value: 'C:\\fakepath\\REPS-MP-backup.json' };

    dom.window.importJSON({ target });
    for (let i = 0; i < 100 && !holdChips(dom).length; i++) await new Promise((r) => setTimeout(r, 10));

    assert.deepEqual(holdChips(dom), ['Direct'], 'crafted hold survived the import');
    assertNoInjection(dom);
    // and the import persisted the normalised value, so a reload cannot resurrect it
    assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).activities[0].hold, 'Direct');
  });
});

describe('MP tracker — the three HTML sites escape the hold fallback (#67)', () => {
  // Defence in depth: poison the state through the add path (which the read
  // validation does not cover) by widening the select, then assert all three
  // renderers escape rather than execute.
  let dom;

  beforeEach(() => {
    dom = mount(null);
    const doc = dom.window.document;
    const rogue = doc.createElement('option');
    rogue.value = PAYLOAD;
    doc.getElementById('naHold').appendChild(rogue);
    doc.getElementById('naHold').value = PAYLOAD;
    doc.getElementById('naName').value = 'Beach condo';
    dom.window.addActivity();
    assert.equal(holdChips(dom).length, 1, 'harness failed to seed a poisoned hold');
  });

  test('the activity chip renders it as text', () => {
    assert.deepEqual(holdChips(dom), [PAYLOAD]);
    assert.ok(!html(dom, 'actList').includes('<img'));
  });

  test('the per-activity MP card renders it as text', () => {
    assert.ok(html(dom, 'mpZone').includes('&lt;img'), 'hold not escaped in #mpZone');
    assert.ok(!html(dom, 'mpZone').includes('<img'));
  });

  test('the printed turnover record renders it as text', () => {
    assert.ok(html(dom, 'turnover').includes('&lt;img'), 'hold not escaped in #turnover');
    assert.ok(!html(dom, 'turnover').includes('<img'));
  });

  test('no injected element reaches the document from any site', () => {
    assertNoInjection(dom);
  });
});
