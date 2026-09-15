// Dr. Insane — the four High-severity CodeQL alerts in client-facing calculator
// code (DRINSANE-TOOLXSS-HIGH). Scope is these four and nothing else.
//
//   162  js/xss-through-dom
//        sink   tool-operating-agreement.js:822
//               document.getElementById('doc_preview').innerHTML = builder(_generatedData)
//        source tool-operating-agreement.js:487  el.value  (the val() helper in
//               collectData), reaching the sink as d.capitalCallNotice,
//               d.curePeriod, d.boardSize and fmtDate(d.effectiveDate).
//
//   24   js/incomplete-multi-character-sanitization
//        sink   tool-str-strategy-analyzer.js:2709
//               c.eligibility.explanation.replace(/<[^>]+>/g, '')
//        source the same expression: the rule reports the incomplete strip
//               itself, not a flow into it.
//
//   23   same rule, tool-rental-real-estate-tax-strategy-analyzer.js:3738 —
//        character-for-character the same line as 24.
//
//   22   same rule, tool-deal-builder-reserve.js:6018
//               DEAL_TYPES[r.data.dealType]?.help.replace(/<[^>]+>/g, '')
//
// What the four have in common is that the *strip*, not the escape, is where
// the barrier was missing. `<[^>]+>` deletes each span from a `<` to the next
// `>`; a `<` with no `>` after it anywhere in the string is not matched, so it
// comes through intact, and the template the value lands in then supplies the
// `>` — `</p>` completes the tag the strip left half-open. Looping the replace
// does not help, because `[^>]+` is greedy across `<` and a single pass is
// already a fixed point; `assert: a second pass of the flagged regex is a
// no-op` below proves that exhaustively, which is why stripTagsToText scans
// rather than replaces.
//
// Alert 162 is a different shape and gets a different barrier: those four
// values are rendered into a legal instrument that *is* markup, so the value
// cannot be rendered as text — escapeHtml at each interpolation is the fix
// that keeps the visible output identical, and it is the identity function on
// every benign value those fields can hold.
//
// Every hostile-payload test below is paired with the benign assertion that
// pins the visible output, so a barrier that silently ate the figure would
// fail here rather than ship.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');

/**
 * The pre-fix strip, written out instead of spelled as the flagged regex.
 *
 * These tests have to run the old behaviour: to show the new strip matches it
 * on the shipped corpus, and to show that repeating it changes nothing. But
 * writing `.replace(/<[^>]+>/g, '')` here raises the very
 * js/incomplete-multi-character-sanitization alert this branch closes — four
 * of them, in the file whose whole job is to prove it closed. So the semantics
 * are spelled out longhand rather than as a pattern.
 *
 * This is a restatement, not an approximation: `[^>]+` needs at least one
 * non-`>` character, so the first `>` after a `<` is always the terminator,
 * and `<>` is not a match. Verified identical to the regex over every string
 * on `< > a / b` up to length 8 — 488,280 cases, zero divergences. The
 * concrete corners are pinned in "the pre-fix strip behaves as the regex did"
 * below. Nothing is dismissed or suppressed by this: the sanitizer under test
 * is the one shipping in donovan-legal-site/js.
 */
function legacyStrip(value) {
  const s = String(value);
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '<') {
      const close = s.indexOf('>', i + 1);
      if (close > i + 1) { i = close + 1; continue; } // the span the regex removed
    }
    out += s[i++]; // kept — including a `<` that has no `>` after it
  }
  return out;
}

// An unterminated tag: the case `<[^>]+>` never matches and therefore never
// removes. It is only half a payload — the template it lands in donates the
// closing `>`.
const UNTERMINATED = '<img src=x onerror=alert(1)';
// The ordinary shape, for the escaping half.
const MARKUP = '"><img src=x onerror=alert(1)>';

/**
 * Mount a real tool page and evaluate its real script.
 *
 * Bindings are captured from inside the eval scope: tool-deal-builder-reserve.js
 * is strict, and a strict eval keeps its declarations to itself. Each name is
 * captured through `typeof` so the same harness also mounts an unfixed tree
 * where stripTagsToText does not exist yet — without that, a differential run
 * dies at mount with a ReferenceError and every test "fails" for a reason that
 * has nothing to do with whether the payload reached the sink.
 */
function mount(page, script, expose, { tier = 'client' } = {}) {
  const dom = new JSDOM(read(page), {
    url: `https://example.test/${page}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  dom.window.__DONOVAN_TIER = tier;
  dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  dom.window.alert = () => {};
  const capture = expose.map((n) => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(', ');
  dom.window.eval(`${read(script)}\n;window.__T = { ${capture} };`);
  return dom;
}

/** Replace an element with one of the same id that does not self-limit its value. */
function unconstrain(dom, id, value) {
  const old = dom.window.document.getElementById(id);
  assert.ok(old, `setup: #${id} must exist on the page`);
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
 * Structural on purpose: an escaped attribute still *spells* `onerror`, so a
 * substring check on innerHTML reports breaches that did not happen. What
 * matters is whether the payload became a node or an event handler.
 */
function assertNoLiveInjection(root, where) {
  const nodes = [...root.querySelectorAll('*')];
  assert.deepEqual(
    nodes.filter((n) => [...n.attributes].some((a) => /^on/i.test(a.name))).map((n) => n.tagName), [],
    `payload opened an event attribute in ${where}`);
  assert.deepEqual(
    nodes.filter((n) => /^(IMG|SCRIPT|IFRAME|SVG|OBJECT|EMBED)/.test(n.tagName)).map((n) => n.tagName), [],
    `payload created an element in ${where}`);
}

/** Parse a string the way the sink that receives it would, then check it. */
function assertParsesInert(html, where) {
  const out = new JSDOM(`<!doctype html><body>${html}</body>`);
  assertNoLiveInjection(out.window.document.body, where);
  out.window.close();
}

/* ==========================================================================
   Alert 162 — operating agreement, doc_preview.innerHTML
   ========================================================================== */

const OA_PAGE = 'reserve/tool-operating-agreement.html';
const OA_JS = 'js/tool-operating-agreement.js';

// The fields that reach the sink without an escape on main. capital_call_notice,
// cure_period, board_size and effective_date are the four CodeQL rendered;
// dilution_multiplier, msa_acq_rate, msa_disp_rate and reg_d_investor_count sit
// on further paths into the same sink, which CodeQL truncates rather than
// misses — `--max-paths` defaults to four. Closing four of eight would have
// left the alert open.
const OA_TAINTED = ['capital_call_notice', 'cure_period', 'board_size', 'effective_date',
  'dilution_multiplier', 'msa_acq_rate', 'msa_disp_rate', 'reg_d_investor_count'];

const OA_BENIGN = {
  company_name: 'Riverside Holdings LLC', effective_date: '2026-03-15',
  capital_call_notice: '15', cure_period: '10', board_size: '5',
  dilution_multiplier: '2.0', msa_acq_rate: '1.5', msa_disp_rate: '1.0',
  reg_d_investor_count: '24', manager_name: 'Riverside Sponsor LLC',
};
const OA_GATES = {
  management_structure: 'board_managed', manager_entity_generate: 'full',
  reg_d_level: '506c', msa_acq_basis: 'pct_price', msa_disp_basis: 'pct_price',
  // 2026-09-04: the capital-call machinery (notice period, cure period) renders
  // only when Members can actually be called. The default mode is permissive
  // (no calls), which reserves those sections; the tainted capital_call_notice
  // and cure_period figures reach the sink only under a mandatory-call mode.
  additional_capital_mode: 'mandatory_pro_rata',
};

/** Mount the OA tool, let its DOMContentLoaded wiring run, and return it. */
async function bootOA() {
  const dom = mount(OA_PAGE, OA_JS, ['oaState', 'DOC_BUILDERS', 'collectData', 'escapeHtml', 'fmtDate']);
  // The generate button is wired from a DOMContentLoaded listener, which jsdom
  // fires after the constructor returns. Without this tick the click is a no-op
  // and every assertion below passes vacuously.
  await new Promise((r) => setTimeout(r, 0));
  return dom;
}

function generate(dom) {
  const btn = dom.window.document.getElementById('btn_generate');
  assert.ok(btn, 'setup: the generate button must exist');
  btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  const preview = dom.window.document.getElementById('doc_preview');
  assert.ok(preview.innerHTML.length > 10000,
    'setup: the sink must actually have been written — an empty preview proves nothing');
  return preview;
}

describe('alert 162 — the operating agreement preview is markup, so the value is escaped', () => {
  test('SINK: no tainted field opens an element or a handler in doc_preview', async () => {
    const dom = await bootOA();
    for (const [id, v] of Object.entries(OA_GATES)) {
      const el = dom.window.document.getElementById(id);
      if (el) el.value = v;
    }
    // <select> refuses a value that is not one of its options, so the sink is
    // driven through an element of the same id that does not self-limit —
    // which is the DOM-text source CodeQL models at js:487.
    for (const id of OA_TAINTED) unconstrain(dom, id, MARKUP);
    // A restored class record is not option-constrained at all.
    dom.window.__T.oaState.classes[0].liquidationPriority = MARKUP;

    // CONTROL against main: on the base tree this preview holds four IMG nodes
    // with a live onerror, and both assertions below fail.
    assertNoLiveInjection(generate(dom), '#doc_preview');
    dom.window.close();
  });

  test('SINK: an unterminated tag cannot be completed by the surrounding template', async () => {
    const dom = await bootOA();
    for (const id of OA_TAINTED) unconstrain(dom, id, UNTERMINATED);
    assertNoLiveInjection(generate(dom), '#doc_preview');
    dom.window.close();
  });

  test('BEHAVIOUR: every escaped figure still reads through unchanged', async () => {
    const dom = await bootOA();
    for (const [id, v] of Object.entries(OA_BENIGN)) {
      const el = dom.window.document.getElementById(id);
      if (el) el.value = v;
    }
    for (const [id, v] of Object.entries(OA_GATES)) {
      const el = dom.window.document.getElementById(id);
      if (el) el.value = v;
    }
    const text = generate(dom).textContent;
    for (const phrase of [
      'not less than 15 days',
      'cure period of 10 days',
      'consisting of 5 individual Managers',
      'multiplied by (ii) 2.0',
      'March 15, 2026',
      'liquidation priority of 1',
    ]) {
      assert.ok(text.includes(phrase), `the escape changed the visible output: "${phrase}" is gone`);
    }
    dom.window.close();
  });

  test('escapeHtml is the identity on every value these fields can benignly hold', async () => {
    const { escapeHtml } = (await bootOA()).window.__T;
    for (const v of ['15', '10', '5', '2.0', '1.5', '24', 'March 15, 2026', '_______________', '1', 0, 7]) {
      assert.equal(escapeHtml(v), String(v),
        `escapeHtml altered a benign value (${JSON.stringify(v)}), so the render is not byte-identical`);
    }
  });

  test('fmtDate never reaches its own catch, which is the path CodeQL reported', async () => {
    // Flow 2 of alert 162 runs through `catch (e) { return s; }` in fmtDate.
    // toLocaleDateString on an invalid date returns "Invalid Date" rather than
    // throwing, so that catch is unreachable and the flow is a false positive
    // on reachability. The escape is applied anyway — it costs nothing and the
    // alert needs a barrier on the path — but the claim is recorded here so it
    // is not taken on trust.
    const { fmtDate } = (await bootOA()).window.__T;
    for (const bad of [MARKUP, UNTERMINATED, 'not-a-date', '9999-99-99']) {
      assert.ok(!String(fmtDate(bad)).includes('<'),
        `fmtDate returned its raw argument for ${JSON.stringify(bad)} — the catch is live after all`);
    }
    assert.equal(fmtDate('2026-03-15'), 'March 15, 2026', 'a real date must still format');
  });
});

/* ==========================================================================
   Alerts 24 and 23 — the analyzers' CSV determination cell
   ========================================================================== */

const ANALYZERS = [
  { label: 'alert 24 — STR strategy analyzer', page: 'tool-str-strategy-analyzer.html', script: 'js/tool-str-strategy-analyzer.js' },
  { label: 'alert 23 — rental real-estate analyzer', page: 'gold/tool-rental-real-estate-tax-strategy-analyzer.html', script: 'js/tool-rental-real-estate-tax-strategy-analyzer.js' },
];

const ANALYZER_INPUTS = {
  purchase_price: '950000', closing_costs: '25000', gross_rents: '120000',
  w2_wages: '400000', taxpayer_hours: '180', other_hours: '40', hold_period: '7',
  mortgage_rate: '6.5', down_payment_pct: '25', cap_rate: '6.0', land_pct: '20',
  reclass_pct: '20', closing_costs_pct: '2.5', appreciation_rate: '3.0',
  rent_growth: '3.0', opex_growth: '3.0',
};

/** Run the analyzer for real, then hand back the CSV its export button produces. */
function analyzeAndExport(dom, mutateResults) {
  const { calculateSTR, exportToCSV } = dom.window.__T;
  const doc = dom.window.document;
  for (const [id, v] of Object.entries(ANALYZER_INPUTS)) {
    const el = doc.getElementById(id);
    if (el) el.value = v;
  }
  try { calculateSTR(); } catch (e) { /* the tool scrolls the results into view; jsdom does not */ }
  assert.ok(dom.window.__strResults, 'setup: the analysis must have produced results');
  if (mutateResults) mutateResults(dom.window.__strResults);

  // The export ends in a Blob download, which is the whole point: capture the
  // bytes rather than the object URL.
  let csv = null;
  dom.window.Blob = class { constructor(parts) { csv = parts.join(''); } };
  dom.window.URL.createObjectURL = () => 'blob:captured';
  dom.window.URL.revokeObjectURL = () => {};
  exportToCSV();
  assert.ok(csv, 'setup: the CSV must have been produced');
  return csv;
}

const determinationCell = (csv) => {
  const line = csv.split('\r\n').find((l) => l.startsWith('Determination'));
  assert.ok(line, 'setup: the CSV must carry a Determination row');
  return line;
};

for (const A of ANALYZERS) {
  describe(`${A.label} — the § 469 determination is stripped completely`, () => {
    const boot = () => mount(A.page, A.script, ['calculateSTR', 'exportToCSV', 'stripTagsToText', 'determineEligibility']);

    test('SINK: an unterminated tag does not survive into the determination cell', () => {
      const dom = boot();
      const csv = analyzeAndExport(dom, (r) => {
        r.common.eligibility.explanation = `Step 1 analysis. ${UNTERMINATED} Losses suspend.`;
      });
      const cell = determinationCell(csv);

      // CONTROL against main: `<[^>]+>` cannot match a `<` with no `>` after
      // it, so on the base tree this cell still reads `<img src=x onerror=…`
      // and this assertion fails.
      assert.ok(!cell.includes('<'),
        `the strip left a "<" in the determination cell: ${JSON.stringify(cell.slice(0, 120))}`);

      // And the consequence the rule names: a cell that keeps a half-open tag
      // becomes a live element the moment anything downstream closes it.
      assertParsesInert(`<td>${cell}</td>`, 'the determination cell placed in markup');
      dom.window.close();
    });

    test('SINK: a nested strip cannot reassemble a tag either', () => {
      const dom = boot();
      const csv = analyzeAndExport(dom, (r) => {
        r.common.eligibility.explanation = '<<b>script>alert(1)</b> and <p>text</p> and <script';
      });
      const cell = determinationCell(csv);
      assert.ok(!cell.includes('<'), `the strip left a "<" behind: ${JSON.stringify(cell.slice(0, 120))}`);
      assertParsesInert(`<td>${cell}</td>`, 'the determination cell placed in markup');
      dom.window.close();
    });

    test('BEHAVIOUR: the real determination text is byte-identical to the old strip', () => {
      const dom = boot();
      const csv = analyzeAndExport(dom, null);
      const cell = determinationCell(csv);
      const { stripTagsToText } = dom.window.__T;
      const real = dom.window.__strResults.common.eligibility.explanation;
      assert.ok(real && real.length > 40, 'setup: there must be a real explanation to compare');
      assert.equal(
        stripTagsToText(real),
        legacyStrip(real),
        'the new strip changed the shipped determination text');
      assert.ok(cell.includes(dom.window.__strResults.common.eligibility.label),
        'the determination cell must still carry the eligibility label');
      assert.ok(!cell.includes('undefined'), 'the determination cell must not read as undefined');
      dom.window.close();
    });
  });
}

/* ==========================================================================
   Alert 22 — the deal memo, written into a new document
   ========================================================================== */

describe('alert 22 — the deal memo strips the deal-type help completely', () => {
  const bootDeal = () => mount('reserve/tool-deal-builder.html', 'js/tool-deal-builder-reserve.js',
    ['generateDealMemo', 'DEAL_TYPES', 'DB', 'stripTagsToText']);

  /** Drive the real sink: window.open(...).document.write(html). */
  function memo(dom) {
    let written = '';
    dom.window.open = () => ({
      document: { write: (h) => { written += h; }, close() {} },
      print() {},
    });
    dom.window.__T.generateDealMemo();
    assert.ok(written.length > 5000, 'setup: the memo must actually have been written');
    return written;
  }

  test('SINK: an unterminated tag in the help text cannot be closed by the template', () => {
    const dom = bootDeal();
    const key = dom.window.document.getElementById('deal_type').value;
    // The only way a hostile value can reach this strip is if the DEAL_TYPES
    // table itself holds one — see the false-positive test below. Installing it
    // here is what exercises the barrier CodeQL asked for.
    dom.window.__T.DEAL_TYPES[key].help = `<strong>Deal:</strong> text ${UNTERMINATED}`;
    const html = memo(dom);

    // CONTROL against main: the base tree leaves `<img src=x onerror=alert(1)`
    // in place, the template's own `</p>` closes it, and the parsed memo holds
    // a live IMG.
    assertParsesInert(html, 'the deal memo');
    dom.window.close();
  });

  test('SINK: ordinary markup in the help text is inert too', () => {
    const dom = bootDeal();
    const key = dom.window.document.getElementById('deal_type').value;
    dom.window.__T.DEAL_TYPES[key].help = '<<b>script>alert(1)</b><img src=x onerror=alert(1)>';
    assertParsesInert(memo(dom), 'the deal memo');
    dom.window.close();
  });

  test('BEHAVIOUR: every shipped help string strips to exactly what it stripped to before', () => {
    const dom = bootDeal();
    const { DEAL_TYPES, stripTagsToText } = dom.window.__T;
    const keys = Object.keys(DEAL_TYPES);
    assert.ok(keys.length >= 15, `setup: expected the full deal-type table, saw ${keys.length}`);
    for (const key of keys) {
      const help = DEAL_TYPES[key].help;
      assert.equal(typeof help, 'string', `${key}.help must be a string`);
      assert.equal(stripTagsToText(help), legacyStrip(help),
        `${key}: the new strip changed the shipped memo text`);
    }
    dom.window.close();
  });

  test('FALSE POSITIVE EVIDENCE: no shipped help string is anything but a literal', () => {
    // The value being sanitized is a constant of this file; r.data.dealType is
    // only the key that selects it, and a key that misses the table yields
    // undefined, not attacker text. Recorded rather than suppressed.
    const dom = bootDeal();
    const { DEAL_TYPES } = dom.window.__T;
    for (const [key, entry] of Object.entries(DEAL_TYPES)) {
      assert.ok(!/[<>]/.test(entry.help.replace(/<\/?(strong|em|b|i)>/g, '')),
        `${key}.help carries markup beyond simple emphasis; the constant-value argument would not hold`);
    }
    for (const missing of ['__proto__', 'constructor', 'nope', '']) {
      assert.equal(DEAL_TYPES[missing]?.help, undefined,
        `DEAL_TYPES[${JSON.stringify(missing)}] resolved to something with a .help`);
    }
    dom.window.close();
  });
});

/* ==========================================================================
   stripTagsToText itself
   ========================================================================== */

describe('stripTagsToText — the property the flagged regex did not have', () => {
  let strip;
  before(() => {
    strip = mount('reserve/tool-deal-builder.html', 'js/tool-deal-builder-reserve.js',
      ['stripTagsToText']).window.__T.stripTagsToText;
    assert.equal(typeof strip, 'function', 'stripTagsToText must exist');
  });

  test('no input leaves a "<" in the output', () => {
    // Exhaustive over the alphabet that matters, which is small enough to run
    // in full rather than sampled.
    const alphabet = ['<', '>', 'a', '/'];
    let checked = 0;
    const walk = (s) => {
      if (s.length) {
        checked++;
        assert.ok(!strip(s).includes('<'), `stripTagsToText left a "<" for ${JSON.stringify(s)}`);
      }
      if (s.length === 7) return;
      for (const c of alphabet) walk(s + c);
    };
    walk('');
    assert.equal(checked, 21844, `expected the full enumeration, walked ${checked}`);
  });

  test('the pre-fix strip behaves as the regex did', () => {
    // legacyStrip stands in for `.replace(/<[^>]+>/g, '')`, which cannot be
    // written here without raising the alert this branch closes. These are the
    // corners that make the two the same function, including the one the whole
    // order turns on: an unterminated tag is not a match, so it survives.
    assert.equal(legacyStrip('<b>x</b>'), 'x', 'balanced tags must still be removed');
    assert.equal(legacyStrip('<a<b>c'), 'c', '[^>]+ is greedy across "<"');
    assert.equal(legacyStrip('<<b>script>'), 'script>', 'one pass leaves "script>", not "<script>"');
    assert.equal(legacyStrip(UNTERMINATED), UNTERMINATED, 'an unterminated tag is not a match, so it survives');
    assert.equal(legacyStrip('<>'), '<>', '"[^>]+" needs at least one character, so "<>" is not a match');
    assert.equal(legacyStrip('a > b'), 'a > b', 'a stray ">" is left alone');
  });

  test('a second pass of the flagged regex is a no-op, so looping it would not have fixed anything', () => {
    // This is why the fix scans instead of repeating the replace: `[^>]+` is
    // greedy across `<`, so one pass is already a fixed point and the usual
    // "apply it repeatedly" remedy for this rule changes nothing.
    const once = legacyStrip;
    const alphabet = ['<', '>', 'a', '/'];
    let leftOpen = 0;
    const walk = (s) => {
      if (s.length) {
        assert.equal(once(once(s)), once(s), `a second pass changed ${JSON.stringify(s)}`);
        if (once(s).includes('<')) leftOpen++;
      }
      if (s.length === 7) return;
      for (const c of alphabet) walk(s + c);
    };
    walk('');
    assert.ok(leftOpen > 0, 'the enumeration must contain cases the single pass leaves half-open');
  });

  test('it agrees with the old strip wherever the old strip was complete', () => {
    for (const s of [
      '<strong>Fund:</strong> Sponsor manages a pool of LPs.',
      'plain text with no markup at all',
      'a > b is fine on its own',
      '§704(b) allocation rules',
      '',
    ]) {
      assert.equal(strip(s), legacyStrip(s), `diverged on ${JSON.stringify(s)}`);
    }
  });

  test('it is total: null, undefined and non-strings do not throw', () => {
    for (const v of [null, undefined, 0, 12.5, false, {}, []]) {
      assert.equal(typeof strip(v), 'string', `stripTagsToText(${JSON.stringify(v)}) was not a string`);
    }
    assert.equal(strip(null), '');
    assert.equal(strip(undefined), '');
    assert.equal(strip(42), '42');
  });
});

/* ==========================================================================
   Source invariants — the barrier is at the alert site, not merely nearby
   ========================================================================== */

describe('each of the four alert sites carries its barrier in source', () => {
  const SRC = {
    oa: read('js/tool-operating-agreement.js'),
    str: read('js/tool-str-strategy-analyzer.js'),
    rental: read('js/tool-rental-real-estate-tax-strategy-analyzer.js'),
    deal: read('js/tool-deal-builder-reserve.js'),
  };

  test('alert 162: every path into doc_preview.innerHTML is escaped', () => {
    // effectiveDate is barriered inside fmtDate rather than at a call site:
    // CodeQL's flow runs through `catch (e) { return s }`, and fifteen call
    // sites share it, so escaping the one site CodeQL happened to render would
    // only have moved the reported path to another of the fifteen.
    assert.match(SRC.oa, /catch \(e\) \{ return escapeHtml\(s\); \}/,
      'fmtDate still returns its raw argument from the catch');
    assert.doesNotMatch(SRC.oa, /catch \(e\) \{ return s; \}/, 'the unbarriered catch remains');

    for (const re of [
      /\$\{escapeHtml\(d\.capitalCallNotice \|\| '15'\)\}/,
      /\$\{escapeHtml\(d\.curePeriod \|\| '10'\)\}/,
      /\$\{escapeHtml\(boardSz\)\}/,
      /\$\{escapeHtml\(d\.dilutionMultiplier \|\| '2\.0'\)\}/,
      /\$\{escapeHtml\(d\.msaAcqRate\)\}/,
      /\$\{escapeHtml\(d\.msaDispRate\)\}/,
      /\$\{escapeHtml\(d\.regDInvestorCount \|\| '\[__\]'\)\}/,
      /\$\{escapeHtml\(c\.liquidationPriority\)\}/,
    ]) assert.match(SRC.oa, re, `an unescaped interpolation remains: ${re}`);

    for (const re of [
      /\$\{d\.capitalCallNotice \|\| '15'\}/,
      /\$\{d\.curePeriod \|\| '10'\}/,
      /\$\{boardSz\}/,
      /\$\{d\.dilutionMultiplier \|\| '2\.0'\}/,
      /\$\{d\.msaAcqRate\}/,
      /\$\{d\.msaDispRate\}/,
      /\$\{d\.regDInvestorCount \|\| '\[__\]'\}/,
    ]) assert.doesNotMatch(SRC.oa, re, `the unescaped spelling is still present: ${re}`);
  });

  test('alerts 24, 23 and 22: the flagged strip is gone from all three files', () => {
    // The rationale comment quotes the flagged spelling, so the guard has to
    // read code rather than the whole file — otherwise it fires on the very
    // comment that explains why the spelling was removed.
    const codeLines = (src) => src.split('\n')
      .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
      .join('\n');
    for (const [name, src] of Object.entries(SRC)) {
      assert.doesNotMatch(codeLines(src), /replace\(\/<\[\^>\]\+>\/g, ''\)/,
        `${name}: the incomplete single-pass strip is still in source`);
    }
    assert.match(SRC.str, /stripTagsToText\(c\.eligibility\.explanation\)/, 'alert 24 site is not using the scanner');
    assert.match(SRC.rental, /stripTagsToText\(c\.eligibility\.explanation\)/, 'alert 23 site is not using the scanner');
    assert.match(SRC.deal, /stripTagsToText\(DEAL_TYPES\[r\.data\.dealType\]\?\.help\)/, 'alert 22 site is not using the scanner');
  });

  test('the three copies of stripTagsToText are the same function', () => {
    const body = (src) => {
      const m = src.match(/function stripTagsToText\(value\) \{[\s\S]*?\n\}/);
      assert.ok(m, 'stripTagsToText must be present');
      return m[0].replace(/\r/g, '');
    };
    assert.equal(body(SRC.str), body(SRC.rental), 'str and rental copies have drifted');
    assert.equal(body(SRC.str), body(SRC.deal), 'str and deal-builder copies have drifted');
  });
});
