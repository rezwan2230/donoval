// Dr. Insane — restored state is coerced or escaped before it reaches HTML
// (#78, CodeQL js/xss-through-dom 26/27/28/29/30/31).
//
// #67 and #72 closed the material-participation tracker. Six alerts of the same
// shape were left repo-wide: a value is restored out of localStorage or out of
// an imported backup file, and interpolated into markup with no barrier on it.
//
//   26  tool-deal-builder-reserve.js:1712   target.innerHTML
//         r.data.jurisdiction, r.data.seniorLoanType
//   27  tool-operating-agreement.js:674     review_summary.innerHTML
//         d.rofo, d.rofr, d.dragAlong, d.tagAlong, fmtDate(d.effectiveDate), a.units
//   28  tool-deal-builder-reserve.js:8680   newWindow.document.write(fullHtml)
//   29  tool-deal-builder-reserve.js:10426  newWindow.document.write(fullHtml)
//         both via p7.issuer.formationState in the Form D Blue Sky paragraph
//   30  tool-rental-…-analyzer.js:2362      summary_grid.innerHTML
//   31  tool-str-strategy-analyzer.js:1944  summary_grid.innerHTML
//         both via val('hold_period') in the "Over N-year hold" sublabel
//
// Both halves of the #72 fix are proved here, because they prove different
// things. The read-path guard is the actual security guarantee: a value that
// will not survive coercion never reaches the state at all. The sink-side
// barrier is what CodeQL credits, because JSON.parse taints the whole restored
// object and the heap step re-taints it however it was cleaned on the way in.
//
// A note on the analyzers and on the OA transfer fields: those inputs are
// <select> elements, and a browser already refuses a value that is not one of
// the options. That makes the select itself a barrier the attacker cannot get
// past — so a test that only drove the select would pass against the UNFIXED
// source and prove nothing. Where that is the case the sink is exercised
// through an element of the same id that does not self-limit, which is exactly
// the DOM-text source CodeQL models, and the read path is asserted separately.
// Every assertion below is marked with which half it proves.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');

// Two shapes of hostile value. MARKUP needs `<` and is what escaping catches.
// BREAKOUT needs only a quote and a space: inside a double-quoted attribute it
// closes the attribute and opens an event handler without a single `<`, which
// is why the id/units sinks needed a coercion rather than escaping alone.
const MARKUP = '"><img src=x onerror=alert(1)>';
const BREAKOUT = '0" onmouseover="alert(1)';
const HOSTILE = [MARKUP, BREAKOUT, 'alert(1)', 'NaN', '1e2abc', {}, [], null];

/**
 * Mount a real tool page under jsdom and evaluate its real script.
 *
 * tool-deal-builder-reserve.js opens with 'use strict', and a strict eval keeps
 * its declarations inside the eval scope instead of publishing them as globals.
 * The trailing assignment captures the bindings from inside that scope, so the
 * test drives the same functions the browser would — including picking up the
 * later of two `renderOrgChart` declarations exactly as the browser does.
 */
function mount(page, script, expose, { seed, key, tier = 'client' } = {}) {
  const dom = new JSDOM(read(page), {
    url: `https://example.test/${page}`,
    runScripts: 'outside-only', // the page's own <script> tags stay inert
    pretendToBeVisual: true,
  });
  if (seed) dom.window.localStorage.setItem(key, JSON.stringify(seed));
  // The HTML wrapper sets this before the script loads; the client path is the
  // one that renders the flagged sublabel.
  dom.window.__DONOVAN_TIER = tier;
  // Each binding is captured defensively so the harness still mounts against a
  // source tree where a helper this fix introduces does not exist yet. That is
  // what makes the differential run meaningful: against the unfixed file the
  // security assertions below fail because the payload really does reach the
  // sink, not because the mount blew up on a missing name.
  const capture = expose.map((n) => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(', ');
  dom.window.eval(`${read(script)}\n;window.__T = { ${capture} };`);
  return dom;
}

/** Replace an element with one of the same id that does not self-limit its value. */
function unconstrain(dom, id, value) {
  const old = dom.window.document.getElementById(id);
  const input = dom.window.document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.value = value;
  old.replaceWith(input);
  assert.equal(dom.window.document.getElementById(id).value, value, 'setup: the value must survive');
}

/**
 * Nothing the payload would have created exists, in any form.
 *
 * These assertions are structural on purpose. A serialized attribute value still
 * *spells* `<img` and `onmouseover` after escaping — `value="&quot;><img …>"` is
 * inert because the quote is encoded, not because the words are gone — so a
 * substring check on innerHTML reports a breach that did not happen, and would
 * equally miss one that did. What matters is whether the payload became a node
 * or an event handler, so that is what is asserted.
 */
function assertNoLiveInjection(root, where) {
  const nodes = [...root.querySelectorAll('*')];
  const handlers = nodes.filter((n) => [...n.attributes].some((a) => /^on/i.test(a.name)));
  assert.deepEqual(handlers.map((n) => n.tagName), [],
    `payload broke out into an event attribute in ${where}`);
  assert.deepEqual(
    nodes.filter((n) => ['IMG', 'SCRIPT', 'IFRAME', 'SVG', 'OBJECT'].includes(n.tagName)).map((n) => n.tagName), [],
    `payload created an element in ${where}`);
}

function assertNoInjection(dom, ids) {
  for (const id of ids) assertNoLiveInjection(dom.window.document.getElementById(id), `#${id}`);
}

/** The same check for markup that is produced as a string and written elsewhere. */
function assertStringRendersInert(html, where) {
  const out = new JSDOM(`<!doctype html><body>${html}</body>`);
  assertNoLiveInjection(out.window.document.body, where);
}

/* ==========================================================================
   STR and rental analyzers — hold_period (alerts 30, 31)
   ========================================================================== */

const ANALYZERS = [
  {
    label: 'STR strategy analyzer (alert 31)',
    page: 'tool-str-strategy-analyzer.html',
    script: 'js/tool-str-strategy-analyzer.js',
    sublabel: /Over (\d+)-year hold/,
  },
  {
    label: 'rental real-estate analyzer (alert 30)',
    page: 'gold/tool-rental-real-estate-tax-strategy-analyzer.html',
    script: 'js/tool-rental-real-estate-tax-strategy-analyzer.js',
    sublabel: /Over (\d+)-year hold/,
  },
];

const KEY_STR = 'donovan_str_analyzer_inputs_v1';

// renderSummary reads data.irr to decide whether the sublabel is rendered at
// all; a non-null irr is what puts val('hold_period') on the page.
const SUMMARY = {
  irr: 0.11, cumEffRate: -2.5, computedEffRate: 0.22, computedMarginalRate: 0.32,
  year1NetCashBenefit: 1000, cumFedTaxSavings: 2000, netSaleProceeds: 3000, totalReturn: 4000,
  cumStateTaxSavings: 0, year1FedTaxSavings: 0, year1OpCashFlow: 0,
};

for (const A of ANALYZERS) {
  describe(`${A.label} — hold_period is a number on both halves`, () => {
    const boot = (seed) => mount(A.page, A.script,
      ['renderSummary', 'restoreInputsFromLocalStorage', 'numYears'], { seed, key: KEY_STR });

    test('READ PATH: a crafted hold_period is refused, the field keeps a real year', () => {
      for (const bad of HOSTILE) {
        const dom = boot({ hold_period: bad, purchase_price: '750000' });
        dom.window.__T.restoreInputsFromLocalStorage();
        const held = dom.window.document.getElementById('hold_period').value;
        assert.match(held, /^\d+$/, `hold_period ${JSON.stringify(bad)} survived the read path as ${JSON.stringify(held)}`);
        assert.ok(Number(held) > 0, 'hold_period must remain a positive year count');
      }
    });

    test('READ PATH: a legitimate hold_period still restores unchanged', () => {
      for (const good of ['3', '7', '30']) {
        const dom = boot({ hold_period: good });
        assert.equal(dom.window.__T.restoreInputsFromLocalStorage(), true, 'restore should report success');
        assert.equal(dom.window.document.getElementById('hold_period').value, good,
          'a legitimate hold period must round-trip exactly');
      }
    });

    test('READ PATH: an untracked sibling field is untouched by the coercion', () => {
      const dom = boot({ hold_period: MARKUP, purchase_price: '1250000' });
      dom.window.__T.restoreInputsFromLocalStorage();
      assert.equal(dom.window.document.getElementById('purchase_price').value, '1250000',
        'refusing hold_period must not disturb the rest of the restore');
    });

    test('SINK: a crafted value on an element that does not self-limit never renders raw', () => {
      // A <select> already refuses a non-option value, so the sink is driven
      // through an input of the same id — the DOM-text source CodeQL models.
      for (const bad of [MARKUP, BREAKOUT, 'six']) {
        const dom = boot(null);
        unconstrain(dom, 'hold_period', bad);
        dom.window.__T.renderSummary(SUMMARY);
        assertNoInjection(dom, ['summary_grid']);
        const grid = dom.window.document.getElementById('summary_grid');
        // hold_period is coerced, not escaped, so the payload text should be
        // gone outright rather than merely rendered inert.
        assert.ok(!grid.textContent.includes('alert(1)'),
          `payload text reached the summary grid for ${JSON.stringify(bad)}`);
        assert.ok(!grid.textContent.includes('NaN') && !grid.textContent.includes('undefined'),
          'an unreadable hold period must read as a number, not NaN/undefined');
        assert.match(grid.textContent, /Over 0-year hold/, 'the coerced hold period should read as 0');
      }
    });

    test('SINK: a legitimate hold period still renders its own figure', () => {
      const dom = boot(null);
      unconstrain(dom, 'hold_period', '7');
      dom.window.__T.renderSummary(SUMMARY);
      const m = dom.window.document.getElementById('summary_grid').innerHTML.match(A.sublabel);
      assert.ok(m, 'the hold-period sublabel should still render');
      assert.equal(m[1], '7', 'the coercion must not change a legitimate figure');
    });

    test('numYears refuses everything that is not a positive finite number', () => {
      const { numYears } = mount(A.page, A.script, ['numYears']).window.__T;
      for (const bad of [...HOSTILE, '', false, undefined, -5, 0, Infinity, NaN]) {
        assert.equal(numYears(bad), null, `numYears accepted ${JSON.stringify(bad)}`);
      }
      for (const good of ['5', 5, '10', 30]) assert.equal(numYears(good), Number(good));
    });
  });
}

/* ==========================================================================
   Operating agreement — alert 27
   ========================================================================== */

const KEY_OA = 'donovan_oa_generator_v1';
const OA_EXPOSE = ['renderReviewSummary', 'renderAssignments', 'restoreFromLocalStorage',
  'collectData', 'oaState', 'oaNum', 'oaRestorableValue', 'buildScheduleA'];

const oaMembers = [{ id: 'member_1', name: 'Alice', type: 'Individual', citizenship: 'US' }];
const oaClasses = [{ id: 'class_A', name: 'Class A', type: 'Common', prefReturn: 0, prefCumulative: '', prefCompounding: '', votingRights: 'Voting' }];
const oaAssign = (over = {}) => ({ id: 'assign_1', memberId: 'member_1', classId: 'class_A', units: 900, capitalContribution: 900000, ...over });

const oaSeed = (over = {}) => ({
  members: oaMembers, classes: oaClasses, assignments: [oaAssign()], promoteTiers: [],
  _idCounter: 5, entityFields: {}, checkboxes: {}, ...over,
});

function bootOA(seed) {
  return mount('reserve/tool-operating-agreement.html', 'js/tool-operating-agreement.js', OA_EXPOSE, { seed, key: KEY_OA });
}

describe('operating agreement — restored assignments are numbers (alert 27)', () => {
  test('READ PATH + SINK: a crafted units breaks out of neither attribute nor summary', () => {
    for (const bad of HOSTILE) {
      const dom = bootOA(oaSeed({ assignments: [oaAssign({ units: bad })] }));
      assert.equal(dom.window.__T.restoreFromLocalStorage(), true);
      dom.window.__T.renderAssignments();
      dom.window.__T.renderReviewSummary();
      assertNoInjection(dom, ['assignments_list', 'review_summary']);

      // value="${a.units}" is the double-quoted attribute sink — the sharp one.
      const unitsInput = dom.window.document.querySelector('[data-abind="units"]');
      assert.match(unitsInput.getAttribute('value'), /^-?\d+(\.\d+)?$/,
        `units ${JSON.stringify(bad)} reached the value attribute as ${JSON.stringify(unitsInput.getAttribute('value'))}`);
    }
  });

  test('READ PATH + SINK: a crafted assignment id never opens an event attribute', () => {
    for (const bad of [MARKUP, BREAKOUT, 'x" onclick="alert(1)']) {
      const dom = bootOA(oaSeed({ assignments: [oaAssign({ id: bad })] }));
      dom.window.__T.restoreFromLocalStorage();
      dom.window.__T.renderAssignments();
      assertNoInjection(dom, ['assignments_list']);
    }
  });

  test('BEHAVIOUR: legitimate units and capital survive the coercion exactly', () => {
    const dom = bootOA(oaSeed({ assignments: [oaAssign({ units: 900, capitalContribution: 900000 })] }));
    dom.window.__T.restoreFromLocalStorage();
    dom.window.__T.renderAssignments();
    dom.window.__T.renderReviewSummary();
    assert.equal(dom.window.__T.oaState.assignments[0].units, 900);
    assert.equal(dom.window.__T.oaState.assignments[0].capitalContribution, 900000);
    assert.equal(dom.window.document.querySelector('[data-abind="units"]').getAttribute('value'), '900');
    assert.match(dom.window.document.getElementById('review_summary').textContent, /900 Units/,
      'the review summary must still show the real unit count');
  });

  test('CONSUMER: buildScheduleA still renders the unit count off the coerced value', () => {
    // Schedule A calls a.units.toLocaleString(), which a restored string would
    // have thrown on outright — so this consumer is proof the coercion is
    // load-bearing beyond the escaping, and that it did not change the output.
    const dom = bootOA(oaSeed({ assignments: [oaAssign({ units: 1500 })] }));
    dom.window.__T.restoreFromLocalStorage();
    const d = dom.window.__T.collectData();
    const good = dom.window.__T.buildScheduleA(d, {});
    assert.match(good, /1,500/, 'a legitimate unit count must still format with separators');

    const hostile = bootOA(oaSeed({ assignments: [oaAssign({ units: BREAKOUT })] }));
    hostile.window.__T.restoreFromLocalStorage();
    const out = hostile.window.__T.buildScheduleA(hostile.window.__T.collectData(), {});
    assertStringRendersInert(out, 'Schedule A');
    assert.ok(!out.includes('onmouseover="'), 'a crafted unit count broke out inside Schedule A');
  });

  test('BEHAVIOUR: the coerced id still drives the remove button and the change binding', () => {
    const dom = bootOA(oaSeed());
    dom.window.__T.restoreFromLocalStorage();
    dom.window.__T.renderAssignments();
    // escapeAttr round-trips through dataset, so the handler still matches the record.
    assert.equal(dom.window.document.querySelector('[data-abind="units"]').dataset.id, 'assign_1');
    const rm = dom.window.document.querySelector('[data-rm-assign]');
    assert.equal(rm.dataset.rmAssign, 'assign_1');
    rm.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    // renderAssignments re-provisions an empty assignment for any member that
    // has none, so the check is that *this* record went — not that the list
    // emptied, which the tool never lets happen while a member exists.
    const left = dom.window.__T.oaState.assignments;
    assert.ok(!left.some((a) => a.id === 'assign_1'), 'the remove button must still delete the assignment');
    assert.equal(left[0].units, 0, 'the re-provisioned assignment should start empty');
  });
});

describe('operating agreement — restored transfer fields (alert 27)', () => {
  test('READ PATH: a select only accepts one of its own options', () => {
    for (const id of ['rofo', 'rofr', 'drag_along', 'tag_along']) {
      const dom = bootOA(oaSeed({ entityFields: { [id]: MARKUP } }));
      const before = dom.window.document.getElementById(id).value;
      dom.window.__T.restoreFromLocalStorage();
      const after = dom.window.document.getElementById(id).value;
      assert.equal(after, before, `${id} accepted a value that is not one of its options`);
      assert.ok([...dom.window.document.getElementById(id).options].some((o) => o.value === after),
        `${id} is no longer holding one of its own options`);
    }
  });

  test('READ PATH: a legitimate option still restores', () => {
    const dom = bootOA(oaSeed({ entityFields: { rofo: 'disabled', rofr: 'disabled' } }));
    dom.window.__T.restoreFromLocalStorage();
    assert.equal(dom.window.document.getElementById('rofo').value, 'disabled');
    assert.equal(dom.window.document.getElementById('rofr').value, 'disabled');
  });

  test('READ PATH: a key outside the persisted allowlist cannot address an element', () => {
    // saveToLocalStorage only ever writes PERSISTED_FIELD_IDS, so a key outside
    // that list did not come from this tool.
    const dom = bootOA(oaSeed({ entityFields: { company_name: 'Real Co', attorney_notes: 'note' } }));
    dom.window.__T.restoreFromLocalStorage();
    assert.equal(dom.window.document.getElementById('company_name').value, 'Real Co', 'an allowlisted field must restore');

    const sneaky = bootOA(oaSeed({ entityFields: { review_summary: MARKUP } }));
    const target = sneaky.window.document.getElementById('review_summary');
    const before = target.value;
    sneaky.window.__T.restoreFromLocalStorage();
    assert.equal(target.value, before, 'a non-persisted id was addressable from storage');
    assert.ok(!target.innerHTML.includes('<img'), 'a non-persisted id reached a sink');
  });

  test('SINK: a crafted transfer value on a non-self-limiting element never renders raw', () => {
    for (const id of ['rofo', 'rofr', 'drag_along', 'tag_along']) {
      const dom = bootOA(oaSeed());
      dom.window.__T.restoreFromLocalStorage();
      unconstrain(dom, id, MARKUP);
      dom.window.__T.renderReviewSummary();
      assertNoInjection(dom, ['review_summary']);
    }
  });

  test('SINK: a crafted effective_date never renders raw', () => {
    const dom = bootOA(oaSeed());
    dom.window.__T.restoreFromLocalStorage();
    unconstrain(dom, 'effective_date', MARKUP);
    dom.window.__T.renderReviewSummary();
    assertNoInjection(dom, ['review_summary']);
  });

  test('BEHAVIOUR: the transfer rows still show their real selections', () => {
    const dom = bootOA(oaSeed({ entityFields: { rofo: 'enabled', rofr: 'disabled' } }));
    dom.window.__T.restoreFromLocalStorage();
    dom.window.__T.renderReviewSummary();
    const text = dom.window.document.getElementById('review_summary').textContent;
    assert.match(text, /enabled \/ disabled/, 'the ROFO / ROFR row must still read through');
  });
});

/* ==========================================================================
   Deal builder — alerts 26, 28, 29
   ========================================================================== */

const DEAL_EXPOSE = ['generateFormDWorksheet', 'collectPhase7Data', 'renderOrgChart', 'DB',
  'restorableState', 'restorableValue', 'numOr0', 'escapeHtml'];

const bootDeal = () => mount('reserve/tool-deal-builder.html', 'js/tool-deal-builder-reserve.js', DEAL_EXPOSE);

const issuerEntity = (over = {}) => ({
  id: 1, name: 'Acme Holdings LLC', type: 'LLC', state: 'DE', role: 'issuer', parentId: null,
  formationDate: '2026-01-01', address: '1 Main St', ein: '00-0000000',
  securities: 'Membership Interests', isIssuer: true, generateOpAg: true, ...over,
});

describe('deal builder — issuer formation state reaches document.write (alerts 28, 29)', () => {
  test('SINK: a crafted formation state never renders raw in the Form D worksheet', () => {
    // The Blue Sky paragraph falls back to the formation state when no investor
    // address yields a state code, which is the flow CodeQL reported.
    for (const bad of [MARKUP, BREAKOUT, 'alert(1)']) {
      const dom = bootDeal();
      dom.window.__T.DB.entities = [issuerEntity({ state: bad })];
      dom.window.__T.DB.investors = [];
      const p7 = dom.window.__T.collectPhase7Data();
      const html = dom.window.__T.generateFormDWorksheet(p7, {}, {}, { name: 'L1' }, 5);

      // The package is handed to newWindow.document.write(), so the property
      // that matters is what it becomes once parsed.
      assertStringRendersInert(html, `the Form D package for ${JSON.stringify(bad)}`);
      assert.ok(html.includes('(formation state)'), 'the Blue Sky fallback should still render');
      // Precise breakout checks: escaping leaves `&lt;img` and `onmouseover=&quot;`,
      // so the unescaped spellings below can only appear if the barrier is absent.
      assert.ok(!html.includes('<img'), `raw markup reached the package for ${JSON.stringify(bad)}`);
      assert.ok(!html.includes('onmouseover="'), `attribute breakout reached the package for ${JSON.stringify(bad)}`);
    }
  });

  test('READ PATH: a crafted state in an imported deal file is refused', () => {
    const { restorableState } = bootDeal().window.__T;
    for (const bad of [...HOSTILE, 'Delaware', 'D', 'DEL', '', 12]) {
      assert.equal(restorableState(bad), '', `restorableState accepted ${JSON.stringify(bad)}`);
    }
    // BEHAVIOUR: a real abbreviation still round-trips, normalised as STATE_DATA keys it.
    assert.equal(restorableState('DE'), 'DE');
    assert.equal(restorableState('fl'), 'FL');
  });

  test('READ PATH: a select restored from a deal file only accepts its own options', () => {
    const dom = bootDeal();
    const { restorableValue } = dom.window.__T;
    const juris = dom.window.document.getElementById('jurisdiction');
    for (const bad of [MARKUP, BREAKOUT, 'ZZ', {}, null]) {
      assert.equal(restorableValue(juris, bad), null, `jurisdiction accepted ${JSON.stringify(bad)}`);
    }
    assert.equal(restorableValue(juris, 'WY'), 'WY', 'a real jurisdiction must still restore');

    const loan = dom.window.document.getElementById('senior_loan_type');
    assert.equal(restorableValue(loan, MARKUP), null, 'senior_loan_type accepted crafted markup');
    assert.equal(restorableValue(loan, 'cmbs'), 'cmbs', 'a real loan type must still restore');

    // A free-text field is not option-constrained; it is escaped at the sink instead.
    const proj = dom.window.document.getElementById('project_name');
    assert.equal(restorableValue(proj, 'Riverside Phase II'), 'Riverside Phase II');
  });

  test('numOr0 coerces, and escapeHtml closes the org-chart text sinks (alert 26)', () => {
    const { numOr0, escapeHtml } = bootDeal().window.__T;
    for (const bad of [MARKUP, BREAKOUT, 'six', {}, [], null, undefined, NaN]) {
      assert.equal(numOr0(bad), 0, `numOr0 leaked ${JSON.stringify(bad)}`);
    }
    assert.equal(numOr0('8.5'), 8.5, 'a real pref rate must survive the coercion');
    for (const bad of [MARKUP, BREAKOUT]) {
      const out = escapeHtml(bad);
      assert.ok(!out.includes('<') && !out.includes('"'), `escapeHtml left ${JSON.stringify(bad)} live`);
    }
  });
});

/* ==========================================================================
   Source invariants — both halves present at every one of the six sites
   ========================================================================== */

describe('every one of the six alert sites carries both halves (#78)', () => {
  const SRC = {
    deal: read('js/tool-deal-builder-reserve.js'),
    oa: read('js/tool-operating-agreement.js'),
    rental: read('js/tool-rental-real-estate-tax-strategy-analyzer.js'),
    str: read('js/tool-str-strategy-analyzer.js'),
  };

  // renderOrgChart at 1712 is shadowed at runtime by a second declaration of the
  // same name further down the file, so it cannot be driven from a test. CodeQL
  // reads source, the alert is on this copy, and a later edit could revive it —
  // so the barrier is asserted here directly.
  // Scoped to renderOrgChart's own markup rather than the whole file:
  // exportTermSheet() builds the same figures for a Blob download, which never
  // enters the document and is not a DOM sink, so it is deliberately untouched
  // and must not make this guard fire.
  test('alert 26: the org-chart sinks are escaped and coerced in source', () => {
    assert.match(SRC.deal, /org-node-sub">\$\{escapeHtml\(dealLabel\)\} · \$\{escapeHtml\(r\.data\.jurisdiction\)\}/,
      'jurisdiction is not escaped at the org-chart sink');
    assert.match(SRC.deal, /Senior Debt — \$\{escapeHtml\(String\(r\.data\.seniorLoanType \|\| ''\)\.replace\('_', ' '\)\)\}/,
      'seniorLoanType is not escaped at the org-chart sink');
    assert.match(SRC.deal, /\$\{numOr0\(lp\.prefRate\)\}% pref/, 'prefRate is not coerced at the org-chart sink');
    assert.doesNotMatch(SRC.deal, /org-node-sub">\$\{escapeHtml\(dealLabel\)\} · \$\{r\.data\.jurisdiction\}/,
      'the unescaped org-chart jurisdiction sink remains');
    assert.doesNotMatch(SRC.deal, /Senior Debt — \$\{r\.data\.seniorLoanType\.replace/,
      'the unescaped org-chart seniorLoanType sink remains');
  });

  test('alert 27: the review-summary sinks are escaped and coerced in source', () => {
    assert.match(SRC.oa, /\$\{escapeHtml\(d\.rofo\)\} \/ \$\{escapeHtml\(d\.rofr\)\}/, 'ROFO / ROFR is not escaped');
    assert.match(SRC.oa, /\$\{escapeHtml\(d\.dragAlong\)\} \/ \$\{escapeHtml\(d\.tagAlong\)\}/, 'Drag / Tag is not escaped');
    assert.match(SRC.oa, /escapeHtml\(fmtDate\(d\.effectiveDate\)\)/, 'the effective date is not escaped');
    assert.match(SRC.oa, /\$\{oaNum\(a\.units\)\} Units/, 'the review-summary unit count is not coerced');
    assert.match(SRC.oa, /value="\$\{oaNum\(a\.units\)\}"/, 'the units attribute sink is not coerced');
    assert.doesNotMatch(SRC.oa, /\$\{d\.rofo\}|\$\{d\.rofr\}|\$\{d\.dragAlong\}|\$\{d\.tagAlong\}/, 'an unescaped transfer sink remains');
  });

  test('alerts 28 and 29: the Blue Sky formation state is escaped in source', () => {
    assert.match(SRC.deal, /\$\{escapeHtml\(issuer\.formationState \|\| '\[State\]'\)\}/,
      'the formation state is not escaped at the document.write sink');
    assert.doesNotMatch(SRC.deal, /\$\{issuer\.formationState \|\| '\[State\]'\}/, 'the unescaped sink remains');
  });

  test('alerts 30 and 31: the hold-period sink is coerced in source', () => {
    for (const [name, src] of [['rental', SRC.rental], ['str', SRC.str]]) {
      assert.match(src, /\(numYears\(val\('hold_period'\)\) \|\| 0\)/, `${name}: the hold-period sink is not coerced`);
      assert.doesNotMatch(src, /'Over ' \+ val\('hold_period'\)/, `${name}: the uncoerced sink remains`);
    }
  });

  test('every read path carries its guard', () => {
    assert.match(SRC.deal, /const restorable = restorableValue\(el, val\);/, 'deal builder: form inputs restore unguarded');
    assert.match(SRC.deal, /en\.state = restorableState\(en\.state\);/, 'deal builder: imported entities restore unguarded');
    assert.match(SRC.oa, /oaState\.assignments = sanitizeAssignments\(data\.assignments\)/, 'OA: assignments restore unguarded');
    assert.match(SRC.oa, /if \(!PERSISTED_FIELD_SET\.has\(id\)\) return;/, 'OA: entity fields restore without an allowlist');
    for (const [name, src] of [['rental', SRC.rental], ['str', SRC.str]]) {
      assert.match(src, /const n = numYears\(data\[id\]\);/, `${name}: the restore path does not coerce`);
    }
  });
});
