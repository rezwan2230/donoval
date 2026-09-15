// JORDAN-PERCH-A02 (#47, parent #15) — the swap container carries no inline
// <script>, and the booking-gate reveal survives a content swap.
//
// THE DEFECT (review blockers frontend B1 / security B1).
//
// functions/_middleware.js issues a per-request CSP nonce and HTMLRewriter stamps
// that request's nonce onto every inline <script> as the HTML streams past. For a
// full page load that is airtight. For a client-side content swap it is fatal:
//
//   js/perch-router.js:30   document.body.innerHTML = doc.body.innerHTML
//
// The swap container is the whole <body>, and the markup going into it came from
// a SECOND request, so its inline blocks carry that request's nonce — not the one
// the live document's CSP names. The browser refuses them. Two independent
// mechanisms, either of which alone is fatal:
//
//   1. innerHTML never executes a <script> at all, nonce or no nonce. The router
//      works around that by re-creating each script element (step 5) —
//   2. — but a script element created by JS has no nonce attribute, and the CSP
//      carries no 'strict-dynamic', so the re-created INLINE block is refused too.
//
// The visible consequence was specific and bad: book.html's booking-gate reveal
// was an inline block. After a swap it never ran, so a caller Paula had already
// qualified would sit looking at the "a quick step first" placeholder with no way
// to reach Paul's calendar. A CSP refusal is a console message, not an exception —
// nothing anywhere would have gone red.
//
// THE RULE THIS FILE ENFORCES: no inline <script> inside <body>, in any HTML file
// in the tree, with no exceptions.
//
// WHY NO EXCEPTIONS, AND WHY NOT "ONLY THE LOAD-BEARING ONES". An allow-list of
// files or of `type=` values is the seam the problem grows back through: `type`
// decides whether CSP treats a block as executable, so a rule that trusts `type`
// is a rule an author can defeat by typing four characters, and a rule that trusts
// a file list is one that says nothing about the file added next month. The
// tree currently has ZERO inline blocks in <body> of any type, so the absolute
// form costs nothing to adopt and cannot be quietly widened.
//
// The parser-time jQuery CDN fallback was the one genuinely awkward case — it has
// to document.write() at the parser insertion point, so it could not simply be
// deferred into <head>. It moved to js/vendor/jquery-fallback.js, which is a
// classic parser-blocking external script in the same position and writes the same
// tag. That is what let this rule be absolute instead of allow-listed.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');

function walk(dir, filter, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const htmlFiles = walk(SITE, (p) => p.endsWith('.html') || p.endsWith('.shtml'));
const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ── the scanner ───────────────────────────────────────────────────────────────

// WHY THIS PARSES INSTEAD OF PATTERN-MATCHING. The first version of this scanner
// used a /<script\b([^>]*)>([\s\S]*?)<\/script>/ regex plus a comment strip, and
// CodeQL was right to flag it (js/bad-tag-filter, js/incomplete-multi-character-
// sanitization). Two concrete evasions, both valid HTML that a browser executes:
//
//   <script>evil()</script >   — a space before the closing '>' is legal; the
//                                regex demands "</script>" exactly and matches
//                                nothing, so the block is invisible to the guard.
//   <!--> <script>evil()</script>
//                              — "<!-->" is a complete (abrupt-closing) comment.
//                                A /<!--[\s\S]*?-->/ strip does not see it as
//                                closed, so it swallows the real script as if it
//                                were comment text.
//
// A guard whose entire value is completeness cannot be built on a regex that
// approximates the HTML grammar. jsdom is already a devDependency and already
// used further down this file, so parsing costs nothing extra and is exact:
// comments become Comment nodes rather than needing to be stripped, and every
// legal spelling of a tag resolves to the same element.

/**
 * The swap container of one page, as a live DOM.
 *
 * A file with NO <body> is a FRAGMENT (nav-block.html is the one in the tree).
 * Its entire contents get pasted into a container somewhere, so head AND body are
 * in scope — treating "no body tag" as "nothing to check" would be a hole shaped
 * exactly like the include mechanism. It matters concretely: the HTML parser puts
 * a <script> that leads a fragment into <head>, so scoping a fragment to body
 * alone would miss precisely the block most likely to be there.
 */
function containerRootsOf(html) {
  const { document: doc } = new JSDOM(html).window;
  return /<body\b/i.test(html) ? [doc.body] : [doc.head, doc.body];
}

/** The markup a swap would move — what js/perch-router.js reads as doc.body.innerHTML. */
const markupCache = new Map();
function containerMarkupOf(html) {
  if (!markupCache.has(html)) markupCache.set(html, new JSDOM(html).window.document.body.innerHTML);
  return markupCache.get(html);
}

/**
 * Inline <script> elements inside the container. An element with a `src`
 * attribute is EXTERNAL: it is admitted by the CSP host allow-list rather than by
 * a nonce, and js/perch-router.js re-creates it successfully on a swap. Those are
 * out of scope here (they are the re-init question, not the nonce question).
 *
 * Records are {path, html} so the controls below can feed synthetic pages through
 * the REAL scanner rather than through a copy of it written next door.
 */
// Parsing 143 files is ~100ms of jsdom per pass, and every mutation bite below
// re-scans the whole tree with one page appended. Memoise on the source text so
// the tree is parsed once and the bites only pay for their own synthetic page.
const scanCache = new Map();

function scanOne(html) {
  let hit = scanCache.get(html);
  if (hit) return hit;
  hit = [];
  for (const root of containerRootsOf(html)) {
    if (!root) continue;
    for (const el of root.querySelectorAll('script')) {
      if (el.hasAttribute('src')) continue;
      if (!el.textContent.trim()) continue; // <script></script> executes nothing
      hit.push(el.textContent.trim().slice(0, 60).replace(/\s+/g, ' '));
    }
  }
  scanCache.set(html, hit);
  return hit;
}

function inlineOffenders(records) {
  const offenders = [];
  for (const { path, html } of records) {
    for (const body of scanOne(html)) offenders.push(`${path}: ${body}…`);
  }
  return offenders;
}

const siteRecords = htmlFiles.map((p) => ({ path: rel(p), html: read(p) }));

// ── 0. the premise: what IS the swap container ────────────────────────────────

describe('the swap container is <body> (premise)', () => {
  test('js/perch-router.js still swaps document.body.innerHTML', () => {
    // Everything below is scoped to <body> because that is what the router
    // replaces. If the container is ever narrowed to a sub-element, this test is
    // the one that should be read first — the rule below stays SAFE (it is then
    // stricter than strictly necessary) but its rationale needs restating.
    const src = read(join(SITE, 'js', 'perch-router.js'));
    assert.match(
      src,
      /document\.body\.innerHTML\s*=/,
      'the container definition moved — re-derive the scope of this whole file'
    );
  });

  test('the scan scope matches what actually ships', () => {
    // This file walks donovan-legal-site/ only. There ARE inline body scripts left
    // in the repo — under reference/extracted-html/ and the root-level src/ tree —
    // but neither is deployed: `wrangler pages deploy` runs with
    // working-directory: donovan-legal-site and pages_build_output_dir ".", so
    // nothing outside that directory reaches a browser. Pinning it here means a
    // change to what ships reds this test instead of silently widening the gap
    // between "scanned" and "served".
    const wf = read(join(ROOT, '.github', 'workflows', 'deploy-pages.yml'));
    assert.match(wf, /working-directory:\s*donovan-legal-site/, 'the deployed root moved — re-scope this scan');
    assert.match(read(join(SITE, 'wrangler.jsonc')), /"pages_build_output_dir":\s*"\."/);
  });

  test('the router announces the swap so head-loaded page scripts can re-run', () => {
    // Without this dispatch, externalising to <head> would fix the CSP refusal and
    // still leave the reveal not running after a swap — a different silent failure
    // with the same symptom.
    const src = read(join(SITE, 'js', 'perch-router.js'));
    assert.match(src, /dl:content-swapped/, 'the router must dispatch dl:content-swapped');
  });
});

// ── 1. the tree rule ──────────────────────────────────────────────────────────

describe('no inline <script> inside the swap container', () => {
  test('the scan covers a real, non-empty file set (non-vacuity)', () => {
    // A guard that walks zero files passes forever. Pin the volume and the two
    // pages that carried the named blockers.
    assert.ok(siteRecords.length > 100, `expected the site tree, scanned ${siteRecords.length} files`);
    // Was book.html + perch.html — "the two pages that carried the named blockers".
    // perch.html is deleted; index.html replaces it as the second landmark, being the
    // page `/` now serves and therefore the one a broken walk would most obviously miss.
    for (const must of ['donovan-legal-site/book.html', 'donovan-legal-site/index.html']) {
      assert.ok(siteRecords.some((r) => r.path === must), `${must} must be in scope`);
    }
  });

  test('the container extractor yields real markup for every file (non-vacuity)', () => {
    // If the extractor ever yielded an empty container the rule above would pass
    // over nothing at all, which is the failure mode a tree guard dies of.
    const empty = siteRecords.filter((r) => containerMarkupOf(r.html).trim() === '').map((r) => r.path);
    assert.deepEqual(empty, [], `these pages yielded no container — the extractor is broken: ${empty.join(', ')}`);
  });

  test('a fragment with no <body> is scanned whole (control)', () => {
    // nav-block.html is the live case. It is pasted INTO a container, so its
    // contents are container contents.
    const frag = [{ path: 'nav-block.html', html: '<nav>…</nav>\n<script>bindNav()</script>' }];
    assert.equal(inlineOffenders(frag).length, 1, 'a fragment must not escape the rule');
    assert.ok(siteRecords.some((r) => r.path === 'donovan-legal-site/nav-block.html'), 'the real fragment must be in scope');
  });

  test('every HTML file in the tree is clean', () => {
    assert.deepEqual(
      inlineOffenders(siteRecords),
      [],
      'THE B1 DEFECT: an inline <script> in the swap container is refused by the ' +
        'nonce CSP after a content swap and dies silently. Move it to an external ' +
        '.js referenced from <head> and register it with DL.ready (js/dl-init.js). ' +
        'Do not delete this assertion to make it pass.'
    );
  });

  test('MUTATION BITE — re-adding the booking-gate block reds the guard', () => {
    // Verbatim shape of what was removed from book.html. This is the assertion
    // that matters: the guard has to catch THE regression, not a strawman.
    const mutated = [
      ...siteRecords,
      {
        path: 'donovan-legal-site/book.html',
        html:
          '<html><head></head><body><div id="book-gate"></div>\n' +
          '<script>\n(function () {\n  try {\n    var raw = localStorage.getItem(\'donovan_booking_unlock\');\n' +
          '    if (raw) { document.getElementById(\'book-gate\').style.display = \'none\'; }\n  } catch (e) {}\n})();\n</script>\n' +
          '</body></html>',
      },
    ];
    const offenders = inlineOffenders(mutated);
    assert.equal(offenders.length, 1, `expected exactly the mutated page to fire, got: ${offenders.join(' | ')}`);
    assert.match(offenders[0], /book\.html/);
  });

  test('MUTATION BITE — a NEW page cannot smuggle one in', () => {
    // The reason this asserts on the tree and not on a known file list.
    const mutated = [...siteRecords, { path: 'donovan-legal-site/new-tool.html', html: '<body><script>init()</script></body>' }];
    assert.ok(inlineOffenders(mutated).length > 0, 'a page that does not exist yet must be in scope too');
  });

  test('MUTATION BITE — a type= attribute is not an escape hatch', () => {
    // `type="module"` is executable and `type="text/javascript"` is the default
    // spelled out. A rule keyed on `type` would wave both through.
    for (const t of ['module', 'text/javascript', 'application/ld+json']) {
      const rec = [{ path: 'x.html', html: `<body><script type="${t}">x()</script></body>` }];
      assert.equal(inlineOffenders(rec).length, 1, `type="${t}" must not exempt an inline block`);
    }
  });

  test('CONTROL — external, empty and <head> scripts all pass', () => {
    const ok = [
      { path: 'a.html', html: '<head><script>redirect()</script></head><body></body>' },
      { path: 'b.html', html: '<body><script src="/js/page/booking-gate.js" defer></script></body>' },
      { path: 'c.html', html: '<body><script src="/js/vendor/jquery-fallback.js"></script></body>' },
      { path: 'd.html', html: '<body><script></script></body>' },
    ];
    assert.deepEqual(inlineOffenders(ok), []);
  });

  test('MUTATION BITE — a space before the closing tag is not an escape hatch', () => {
    // "</script >" is legal HTML and a browser executes the block. The regex
    // scanner this file used to carry demanded "</script>" exactly and saw
    // nothing at all. CodeQL flagged that as js/bad-tag-filter; it was right.
    const rec = [{ path: 'x.html', html: '<body><script>evil()</script ></body>' }];
    assert.equal(inlineOffenders(rec).length, 1, 'a spaced closing tag must still red the guard');
  });

  test('MUTATION BITE — an abrupt-closing comment cannot hide a block', () => {
    // "<!-->" is a COMPLETE comment per the HTML parser, so the <script> after it
    // is live markup. A /<!--[\s\S]*?-->/ strip does not agree, and swallowed the
    // script as comment text (js/incomplete-multi-character-sanitization).
    const rec = [{ path: 'x.html', html: '<body><!--> <script>evil()</script></body>' }];
    assert.equal(inlineOffenders(rec).length, 1, 'a block after <!--> must still red the guard');
  });

  test('MUTATION BITE — a fragment whose FIRST node is a script is caught', () => {
    // The parser puts a leading <script> into <head>, not <body>. Scoping a
    // fragment to body alone would miss exactly the block most likely to be there.
    const rec = [{ path: 'frag.html', html: '<script>evil()</script><nav>…</nav>' }];
    assert.equal(inlineOffenders(rec).length, 1, 'a leading fragment script must red the guard');
  });

  test('CONTROL — a commented-out block does not red the guard', () => {
    // The guard must not fail on the comment explaining why the block was removed.
    const rec = [{ path: 'e.html', html: '<body><!-- was: <script>oldGate()</script> --></body>' }];
    assert.deepEqual(inlineOffenders(rec), []);
  });
});

// ── 2. the DL.ready wiring is complete ────────────────────────────────────────

describe('pages using DL.ready load the helper that defines it', () => {
  // Same shape as the existing data-dvn-on → js/inline-actions.js invariant: a
  // page that references a DL.ready script but not js/dl-init.js has dead
  // behaviour AND throws a ReferenceError on load.
  const DL_SCRIPTS = walk(join(SITE, 'js', 'page'), (p) => p.endsWith('.js'))
    .filter((p) => /\bDL\.ready\s*\(/.test(read(p)))
    .map((p) => '/' + relative(SITE, p).split(sep).join('/'));

  test('at least one page script uses DL.ready (non-vacuity)', () => {
    assert.ok(DL_SCRIPTS.length > 0, 'expected js/page/booking-gate.js at minimum');
    assert.ok(DL_SCRIPTS.includes('/js/page/booking-gate.js'));
  });

  test('every page referencing one also loads /js/dl-init.js', () => {
    const offenders = [];
    for (const { path, html } of siteRecords) {
      if (!DL_SCRIPTS.some((s) => html.includes(s))) continue;
      if (!html.includes('/js/dl-init.js')) offenders.push(path);
    }
    assert.deepEqual(offenders, [], `these throw ReferenceError: DL is not defined on load: ${offenders.join(', ')}`);
  });

  test('js/dl-init.js is loaded BEFORE the scripts that call DL.ready', () => {
    // dl-init.js is not deferred and the page scripts are, so document order is
    // enough — but only if the tag actually comes first.
    for (const { path, html } of siteRecords) {
      const init = html.indexOf('/js/dl-init.js');
      if (init < 0) continue;
      for (const s of DL_SCRIPTS) {
        const at = html.indexOf(s);
        if (at >= 0) assert.ok(init < at, `${path}: ${s} is referenced before /js/dl-init.js`);
      }
    }
  });
});

// ── 3. the behaviour the whole change exists for ──────────────────────────────

const dlInitSrc = read(join(SITE, 'js', 'dl-init.js'));
const gateSrc = read(join(SITE, 'js', 'page', 'booking-gate.js'));
const bookBody = containerMarkupOf(read(join(SITE, 'book.html')));

/**
 * A document that has ALREADY loaded the head scripts (as a real browser would on
 * any page of the site) but is not currently showing /book.
 */
function mountElsewhere() {
  const dom = new JSDOM('<!doctype html><html><head></head><body><p>some other page</p></body></html>', {
    url: 'https://www.donovan.law/practice',
    runScripts: 'outside-only',
  });
  dom.window.eval(dlInitSrc);
  dom.window.eval(gateSrc);
  return dom;
}

/** What js/perch-router.js does: replace the container, then announce it. */
function swapIn(dom, markup, { announce = true } = {}) {
  dom.window.document.body.innerHTML = markup;
  if (announce) dom.window.document.dispatchEvent(new dom.window.CustomEvent('dl:content-swapped'));
}

const shown = (dom, id) => dom.window.document.getElementById(id)?.style.display;

/**
 * jsdom reports readyState 'loading' until it fires DOMContentLoaded on a later
 * tick, so on the FULL-LOAD path DL.ready correctly defers the callback and the
 * reveal has not happened yet when the constructor returns. Real browsers behave
 * the same way; the test just has to wait for the event it is testing.
 */
function domReady(dom) {
  if (dom.window.document.readyState !== 'loading') return Promise.resolve();
  return new Promise((r) => dom.window.document.addEventListener('DOMContentLoaded', () => r()));
}

describe('booking-gate reveal survives a content swap', () => {
  test('the swapped-in /book markup carries NO script of its own', () => {
    // The premise of every assertion below: nothing in the fetched markup needs to
    // execute for the reveal to happen. If this ever fails, the reveal has been
    // put back where the CSP will refuse it.
    assert.deepEqual(inlineOffenders([{ path: 'book.html', html: read(join(SITE, 'book.html')) }]), []);
  });

  test('a qualified caller who soft-navigates to /book sees the widget', () => {
    const dom = mountElsewhere();
    dom.window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    swapIn(dom, bookBody);
    assert.equal(shown(dom, 'book-live'), 'block', 'THE B1 DEFECT: the booking widget stayed hidden after a swap');
    assert.equal(shown(dom, 'book-gate'), 'none', 'the placeholder should be gone');
  });

  test('an unqualified visitor still gets the gate after a swap', () => {
    // The reveal must not become unconditional in the process of becoming
    // swap-safe — this is the soft gate keeping walk-ups off Paul's calendar.
    const dom = mountElsewhere();
    swapIn(dom, bookBody);
    assert.notEqual(shown(dom, 'book-live'), 'block');
    assert.notEqual(shown(dom, 'book-gate'), 'none');
  });

  test('an expired unlock does not reveal (the 30-minute window still applies)', () => {
    const dom = mountElsewhere();
    dom.window.localStorage.setItem('donovan_booking_unlock', String(Date.now() - 31 * 60 * 1000));
    swapIn(dom, bookBody);
    assert.notEqual(shown(dom, 'book-live'), 'block');
  });

  test('NEGATIVE CONTROL — without the swap announcement it stays hidden', () => {
    // Proves the reveal is driven by dl:content-swapped and not by something
    // incidental in the markup, i.e. that the test above tests what it claims.
    const dom = mountElsewhere();
    dom.window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    swapIn(dom, bookBody, { announce: false });
    assert.notEqual(shown(dom, 'book-live'), 'block');
  });

  test('the reveal still works on a plain full page load', async () => {
    // The swap path must not have been bought at the cost of the normal one.
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${bookBody}</body></html>`, {
      url: 'https://www.donovan.law/book',
      runScripts: 'outside-only',
    });
    dom.window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    dom.window.eval(dlInitSrc);
    dom.window.eval(gateSrc);
    await domReady(dom);
    assert.equal(shown(dom, 'book-live'), 'block');
  });

  // ── JORDAN-SITE-UX-FIXES-R1: the dev bypass is Preview-and-loopback only ────
  //
  // This test used to read `?unlock=dev still bypasses the gate` against
  // `https://www.donovan.law/book?unlock=dev`, and it passed, and that WAS the
  // third defect in JORDAN-SITE-UX-FIXES-R1: a query string anyone can type,
  // on the production host, revealing Paul's calendar to a visitor who has
  // answered nothing. The affordance is kept for the surfaces it is for; the
  // pair below is what makes "kept" and "scoped" one statement instead of two.
  test('?unlock=dev still bypasses the gate on a Preview host', async () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${bookBody}</body></html>`, {
      url: 'https://donovan-site.pages.dev/book?unlock=dev',
      runScripts: 'outside-only',
    });
    dom.window.eval(dlInitSrc);
    dom.window.eval(gateSrc);
    await domReady(dom);
    assert.equal(shown(dom, 'book-live'), 'block');
  });

  test('?unlock=dev is REFUSED on the production host', async () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${bookBody}</body></html>`, {
      url: 'https://www.donovan.law/book?unlock=dev',
      runScripts: 'outside-only',
    });
    dom.window.eval(dlInitSrc);
    dom.window.eval(gateSrc);
    await domReady(dom);
    assert.notEqual(shown(dom, 'book-live'), 'block',
      'the calendar must not be reachable from a query string on www.donovan.law');
    assert.notEqual(shown(dom, 'book-gate'), 'none',
      'and the pre-qualification placeholder is what the visitor is left looking at');
  });

  test('swapping AWAY from /book does not throw', () => {
    // Every registered callback re-runs on every swap, so the gate callback runs
    // on pages where #book-gate does not exist. That has to be silent.
    const dom = mountElsewhere();
    dom.window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    swapIn(dom, bookBody);
    assert.doesNotThrow(() => swapIn(dom, '<p>contact page</p>'));
  });

  test('a throwing callback does not stop the ones after it', () => {
    // dl-init.js runs every callback in a try/catch for this reason: one page's
    // broken init must not take the booking reveal down with it.
    const dom = mountElsewhere();
    dom.window.eval('DL.ready(function () { throw new Error("boom"); });');
    dom.window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    swapIn(dom, bookBody);
    assert.equal(shown(dom, 'book-live'), 'block');
  });
});
