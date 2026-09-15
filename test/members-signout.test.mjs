// JORDAN — the member sign-out control, and the retirement of the login orphan.
// ORDER JORDAN-196-LOGIN-SIGNOUT-R1 (#196).
//
// TWO DEFECTS, ONE MEMBER JOURNEY.
//
//   1. `donovan-legal-site/login.html` was a "Coming Soon" splash carrying the
//      PREVIOUS site's nav, on a site whose member authentication has been live
//      since MEMBERS-CLIO-GATED-ACCESS-R1. It is deleted, and both spellings of
//      its URL 301 to /engagement — the canonical MEMBERS page, which carries the
//      four tier links js/members-gate.js intercepts to open the sign-in card.
//
//   2. `functions/members/auth/signout.js` had NO CALLER. A member who signed in
//      could not sign out; on a shared machine the session survived until the
//      browser was closed. js/members-signout.js is the missing control.
//
// WHY EACH HALF OF THIS SUITE EXISTS, because either alone is vacuous:
//
//   REACHABILITY — a behaviour test that drives the module in jsdom proves the
//      module works, and proves nothing about whether it is ON the 39 member
//      pages. No page file references it: it rides js/perch-layer.js, which the
//      edge injects. So the first suite drives the REAL injector decision
//      (`planFromHtml` → `wantsLayer`) over every page under the four tier roots
//      and requires all of them to get the layer, and requires the layer to
//      import this module. Break either link and this suite goes red before the
//      behaviour suite can pass on a control nobody can see.
//
//   BEHAVIOUR — the reachability suite would be satisfied by an empty file. The
//      second suite mounts the real source in jsdom on real member paths, clicks
//      the control, and reads what it did with the endpoint.
//
//   THE ENDPOINT IS NOT OURS TO CHANGE — the order forbids touching server-side
//      auth. The third suite pins the client's endpoint string to the Function's
//      own path on disk, and pins the two properties of that Function this
//      control depends on (POST-only, clears the cookie) so a future edit to
//      either side is caught rather than discovered in production.
//
//   NO DEAD LINK — the fourth suite reads the tree and `_redirects` and requires
//      that nothing still resolves to a page that is gone.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { HTMLRewriter } from './helpers/html-rewriter.mjs';
import { planFromHtml } from '../donovan-legal-site/functions/_lib/perch-main.js';
import { wantsLayer, LAYER_MODULE } from '../donovan-legal-site/functions/_lib/perch-layer-inject.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');

const SIGNOUT_JS = join(SITE, 'js', 'members-signout.js');
const SIGNOUT_CSS = join(SITE, 'css', 'members-signout.css');
const LAYER_JS = join(SITE, 'js', 'perch-layer.js');

const signoutSrc = readFileSync(SIGNOUT_JS, 'utf8');
const layerSrc = readFileSync(LAYER_JS, 'utf8');

/** The module path the layer must import, written out rather than derived. */
const SIGNOUT_MODULE = '/js/members-signout.js';

/** Exactly the four folders `functions/_lib/member-auth.js` gates. */
const TIER_ROOTS = ['gold', 'platinum', 'diamond', 'reserve'];

const rel = (p) => relative(ROOT, p).split(sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Every page inside the member area, as repo-relative paths. */
const MEMBER_PAGES = TIER_ROOTS.flatMap((t) => walk(join(SITE, t))).sort();

/**
 * Does `src` carry a LIVE side-effect import of `spec`?
 *
 * Line-based and comment-skipping rather than a regex over the whole file, for a
 * reason the control below drives: both this file's header and the block comment
 * above the import in js/perch-layer.js spell the module path out, so a search
 * over the raw source would be satisfied by the prose explaining the import and
 * would go on passing after the import itself was commented out.
 */
function importsModule(src, spec) {
  return src.split(/\r?\n/).some((line) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    return t === `import '${spec}';` || t === `import "${spec}";`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. REACHABILITY — the control is on every member page, and edits none of them
// ─────────────────────────────────────────────────────────────────────────────

describe('JORDAN-196 — the sign-out control reaches every member page', () => {
  test('the member area is the page set this ticket claims it is (control)', () => {
    // A count, so a page set that quietly collapsed to two files cannot pass the
    // "every page gets the layer" test below by having nothing to check.
    assert.ok(MEMBER_PAGES.length >= 30,
      `expected the four tier roots to hold the member tool tree, found ${MEMBER_PAGES.length} pages`);
    for (const t of TIER_ROOTS) {
      assert.ok(existsSync(join(SITE, t, 'index.html')), `${t}/index.html is missing`);
    }
  });

  test('the real injector gives js/perch-layer.js to every page in the member area', async () => {
    // `planFromHtml` is the module `functions/_middleware.js` actually calls, and
    // `wantsLayer` is the predicate `perch-layer-inject.js` actually gates on.
    // Neither is restated here — a change to how the injector reads these pages
    // turns this red instead of silently taking the control off them.
    const missing = [];
    for (const p of MEMBER_PAGES) {
      const plan = await planFromHtml(readFileSync(p, 'utf8'), HTMLRewriter);
      if (!wantsLayer(plan)) missing.push(`${rel(p)} (plan ${plan.kind})`);
    }
    assert.deepEqual(missing, [],
      'these member pages get no persistent layer, so the sign-out control never loads on them');
  });

  test('the layer module imports the sign-out module', () => {
    assert.equal(LAYER_MODULE, '/js/perch-layer.js',
      'the injected module moved; the load path in this suite is describing a file that is not injected');
    assert.equal(importsModule(layerSrc, SIGNOUT_MODULE), true,
      'js/perch-layer.js must side-effect import the sign-out module — it is the only load path');
  });

  test('the import check would actually fire (control)', () => {
    // `importsModule` reads LINES and skips comments, which matters here more than
    // it looks: this file's own header, and the block comment above the import in
    // perch-layer.js, both SPELL the module path. A substring search over the
    // source would be satisfied by the explanation of the import rather than by the
    // import, and would keep passing after somebody commented the line out.
    assert.equal(importsModule("import '/js/members-signout.js';", SIGNOUT_MODULE), true);
    assert.equal(importsModule('import "/js/members-signout.js";', SIGNOUT_MODULE), true);
    assert.equal(importsModule("// import '/js/members-signout.js';", SIGNOUT_MODULE), false,
      'a commented-out import is not a load path');
    assert.equal(importsModule(" * see import '/js/members-signout.js'", SIGNOUT_MODULE), false,
      'a block-comment mention is not a load path');
    assert.equal(importsModule("import '/js/members-signout-2.js';", SIGNOUT_MODULE), false,
      'a near-miss specifier inherits nothing');
  });

  test('no member page was edited to load it — the load path is the injector', () => {
    // The whole reason the control rides the layer. `test/chrome-diff.test.mjs`
    // compares the `<script src>` / `<link href>` manifest of every changed page
    // and fails on ANY change to it, and `REVIEWED_STRUCTURAL` waives
    // `page-structure` and nothing else. A page that names this module would mean
    // that gate had been walked past.
    const naming = MEMBER_PAGES.filter((p) => readFileSync(p, 'utf8').includes('members-signout'));
    assert.deepEqual(naming.map(rel), [],
      'a member page references the sign-out asset directly; it must arrive through the injected layer');
  });

  test('nothing inline ships with it — the site runs a nonce CSP', () => {
    // Neither an `on…=` attribute (a nonce cannot stamp an attribute) nor an
    // el.style write (style-src 'self' with no 'unsafe-inline' is the direction
    // this site is moving). Presentation is css/members-signout.css.
    assert.ok(existsSync(SIGNOUT_CSS), 'the control ships a stylesheet, not inline style');
    assert.doesNotMatch(signoutSrc, /\.setAttribute\(\s*['"]style['"]/i);
    assert.doesNotMatch(signoutSrc, /\.style\s*\./);
    assert.doesNotMatch(signoutSrc, /Object\.assign\([^)]*\.style/);
    assert.doesNotMatch(signoutSrc, /\bon(click|load|change|submit)\s*=/i);
    assert.doesNotMatch(signoutSrc, /innerHTML|insertAdjacentHTML|document\.write/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BEHAVIOUR — it mounts where a session exists, and only there
// ─────────────────────────────────────────────────────────────────────────────

/** The three header shapes the 39 member pages come in. */
const PORTAL = `<!doctype html><html><body>
  <div class="dl-ubar"><a class="dl-ubar-cta" href="/book">Book</a></div>
  <header class="phead"><div class="wrap">
    <a class="phead-logo" href="index.html">logo</a>
    <div class="phead-right">
      <span class="ptier">Gold Member</span>
      <a class="pback" href="../index.html">Return to donovan.law</a>
    </div>
  </div></header>
</body></html>`;

const TOOL = `<!doctype html><html><body>
  <div class="dl-ubar"></div>
  <div id="tool_main"><header class="tool-header"><div class="tool-header-inner">
    <span class="tool-header-brand">DONOVAN</span>
    <a href="../index.html" class="tool-header-back">&larr; donovan.law</a>
  </div></header></div>
</body></html>`;

const BARE = `<!doctype html><html><body>
  <div class="dl-ubar"></div>
  <div class="tool-container"><h1>A sample document with no header bar</h1></div>
</body></html>`;

/**
 * Boot the real module inside a real jsdom window at a real member URL.
 *
 * This is the harness for everything that does not click: it proves the module's
 * wiring against a genuine `window` and `document`, with nothing faked.
 */
function boot(html, path) {
  const dom = new JSDOM(html, {
    url: 'https://www.donovan.law' + path,
    runScripts: 'outside-only',
  });
  dom.window.fetch = () => Promise.reject(new Error('this harness does not click'));
  dom.window.eval(signoutSrc);
  return { win: dom.window, doc: dom.window.document, api: dom.window.__dvnMembersSignoutApi };
}

/**
 * The same module, with a WINDOW this test can watch — used only by the click
 * suite, and only because jsdom will not let a test watch its own.
 *
 * `Location.replace` in jsdom is an own property that is `writable: false,
 * configurable: false`, and so are `window.location` and `window.top`, so there is
 * no seam to stub: a real click would reach jsdom's navigation, which throws
 * "Not implemented" and reports nothing about WHERE it was going. The destination
 * is exactly what the sharpest test in this file is about — a control that
 * navigates on a FAILED sign-out shows the member a page that reads like success
 * while their cookie is still live — so it has to be observable.
 *
 * So the module source is evaluated with `window` supplied as a parameter rather
 * than taken from the global. The DOCUMENT is still the real jsdom document, and
 * the click is still a real dispatched event through a real listener; the only
 * fabricated object is the host whose navigation jsdom refuses to perform. `top`
 * points at the same object, which is what `window.top` is on these pages.
 */
function bootClickable(html, path, fetchImpl) {
  const dom = new JSDOM(html, { url: 'https://www.donovan.law' + path });
  const doc = dom.window.document;
  const nav = [];
  const win = {
    location: {
      pathname: path.split('?')[0],
      replace: (to) => { nav.push(to); },
      assign: (to) => { nav.push(['assign', to]); },
    },
  };
  win.top = win;
  const posts = [];
  const fetchSpy = (url, init) => {
    posts.push({ url, init });
    return fetchImpl ? fetchImpl(url, init) : Promise.resolve({ ok: true, status: 200 });
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', signoutSrc)(win, doc, fetchSpy);
  return { win, doc, nav, posts, api: win.__dvnMembersSignoutApi };
}

const buttonOf = (doc) => doc.getElementById('dvnms-signout');

/** Let the fetch promise chain settle. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('JORDAN-196 — where the control mounts', () => {
  test('it mounts on all three member page shapes', () => {
    for (const [name, html, path] of [
      ['portal index', PORTAL, '/gold/'],
      ['tool page with a header', TOOL, '/reserve/tool-structuring.html'],
      ['document with no header', BARE, '/diamond/SAMPLE_Small_JV_No_Reg_D.html'],
    ]) {
      const { doc } = boot(html, path);
      const b = buttonOf(doc);
      assert.ok(b, `no sign-out control on the ${name} shape`);
      assert.equal(b.tagName, 'BUTTON', 'it ends a session; it is an action, not a destination');
      assert.equal(b.textContent.trim(), 'Sign out');
      assert.ok((b.getAttribute('aria-label') || '').length > 'Sign out'.length,
        'the accessible name must say what the visitor is signing out of');
    }
  });

  test('it lands in the page\'s own header when there is one', () => {
    const portal = boot(PORTAL, '/platinum/').doc;
    assert.ok(portal.querySelector('.phead-right #dvnms-signout'),
      'on a portal index it belongs beside "Return to donovan.law"');

    const tool = boot(TOOL, '/gold/tool-1031-exchange.html').doc;
    assert.ok(tool.querySelector('.tool-header-inner #dvnms-signout'),
      'on a tool page it belongs in the header row');

    // The fallback bar is IN FLOW and sits after the injected utility bar, never
    // over it — a fixed chip would land on the bar's own right-hand CTA.
    const bare = boot(BARE, '/reserve/SAMPLE_Small_JV_No_Reg_D.html').doc;
    const bar = bare.querySelector('.dvnms-bar');
    assert.ok(bar && bar.contains(buttonOf(bare)), 'the fallback bar must carry the control');
    assert.equal(bar.previousElementSibling.className, 'dl-ubar',
      'the fallback bar goes after the utility bar, in the flow');
  });

  test('it does NOT mount outside the member area', () => {
    for (const path of [
      '/', '/contact.html', '/engagement', '/membership-gold', '/book',
      // A near-miss folder inherits nothing: the guard matches a tier ROOT
      // followed by a slash or the end of the path, never a prefix.
      '/goldfinger/', '/reserved/', '/platinum-club/',
    ]) {
      const { doc } = boot(PORTAL, path);
      assert.equal(buttonOf(doc), null, `a sign-out control appeared on ${path}`);
    }
  });

  test('the path guard would actually fire (control)', () => {
    const { api } = boot(PORTAL, '/gold/');
    assert.equal(api.inMemberArea('/gold/'), true);
    assert.equal(api.inMemberArea('/reserve/tool-economics.html'), true);
    assert.equal(api.inMemberArea('/DIAMOND/'), true, 'the guard is case-insensitive, like the routes');
    assert.equal(api.inMemberArea('/goldfinger/'), false);
    assert.equal(api.inMemberArea('/contact.html'), false);
    assert.equal(api.inMemberArea(''), false);
  });

  test('mounting twice adds one control, not two', () => {
    const { doc, api } = boot(PORTAL, '/gold/');
    api.mount();
    api.mount();
    assert.equal(doc.querySelectorAll('#dvnms-signout').length, 1);
    assert.equal(doc.querySelectorAll('link[data-dvnms-styles]').length, 1);
  });

  test('it brings its own stylesheet rather than a style attribute', () => {
    const { doc } = boot(PORTAL, '/gold/');
    const link = doc.querySelector('link[data-dvnms-styles]');
    assert.ok(link, 'no stylesheet was appended');
    assert.equal(link.getAttribute('href'), '/css/members-signout.css');
    assert.equal(buttonOf(doc).getAttribute('style'), null);
  });
});

describe('JORDAN-196 — what the control does when it is clicked', () => {
  test('it POSTs to /members/auth/signout with the session cookie', async () => {
    const { doc, posts } = bootClickable(PORTAL, '/gold/');
    buttonOf(doc).click();
    await settle();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, '/members/auth/signout');
    assert.equal(posts[0].init.method, 'POST');
    assert.equal(posts[0].init.credentials, 'same-origin',
      'without the cookie on the request the endpoint has nothing to clear');
  });

  test('on success it leaves the member area and does not leave it in history', async () => {
    const { doc, nav } = bootClickable(PORTAL, '/gold/');
    buttonOf(doc).click();
    await settle();
    assert.deepEqual(nav, ['/'],
      'replace(), not assign(): Back must not walk into the portal page');
  });

  test('a refused sign-out does NOT navigate — the session is still open', async () => {
    // THE SHARPEST ROW IN THIS FILE. Navigating on a failed POST shows the member
    // the public homepage, which reads exactly like a successful sign-out, while
    // their cookie is still live for whoever sits down next. That is worse than
    // the defect this control fixes.
    for (const [name, impl] of [
      ['a 500 from the endpoint', () => Promise.resolve({ ok: false, status: 500 })],
      ['the network refusing', () => Promise.reject(new Error('offline'))],
    ]) {
      const { doc, nav } = bootClickable(PORTAL, '/gold/', impl);
      const b = buttonOf(doc);
      b.click();
      await settle();
      assert.deepEqual(nav, [], `the control navigated away on ${name}`);
      assert.equal(b.disabled, false, 'the member must be able to try again');
      assert.equal(b.textContent.trim(), 'Sign out', 'the busy label must be cleared');
      const msg = doc.getElementById('dvnms-msg');
      assert.equal(msg.hidden, false, 'the refusal must be visible, not silent');
      assert.match(msg.textContent, /could not sign you out/i);
      assert.equal(msg.getAttribute('aria-live'), 'polite',
        'a message that appears after a click has to be announced');
    }
  });

  test('the success control: the same suite passes a real 200 (control)', async () => {
    const { doc, nav } = bootClickable(PORTAL, '/gold/', () => Promise.resolve({ ok: true, status: 200 }));
    buttonOf(doc).click();
    await settle();
    assert.deepEqual(nav, ['/'], 'the failure assertions above would be vacuous if 200 also stayed put');
  });

  test('a double click posts once', async () => {
    const { doc, posts } = bootClickable(PORTAL, '/gold/', () => new Promise(() => {}));
    const b = buttonOf(doc);
    b.click();
    b.click();
    await settle();
    assert.equal(posts.length, 1, 'the control disables itself while the POST is in flight');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE ENDPOINT IS UNCHANGED — this ticket is frontend only
// ─────────────────────────────────────────────────────────────────────────────

describe('JORDAN-196 — the server side is untouched', () => {
  const FN = join(SITE, 'functions', 'members', 'auth', 'signout.js');
  const fnSrc = readFileSync(FN, 'utf8');

  test('the client posts to the path the Function is actually mounted at', () => {
    // A Pages Function's route IS its path under functions/. Deriving the expected
    // URL from the file location means a moved or renamed Function turns this red
    // rather than leaving the button posting into a 404.
    const routeFromDisk = '/' + rel(FN).replace(/^donovan-legal-site\//, '').replace(/^functions\//, '').replace(/\.js$/, '');
    assert.equal(routeFromDisk, '/members/auth/signout');
    const { api } = boot(PORTAL, '/gold/');
    assert.equal(api.config.endpoint, routeFromDisk);
  });

  test('the two properties the control depends on still hold', () => {
    // POST-only, and the cookie is cleared by the endpoint rather than by us.
    assert.match(fnSrc, /method\s*!==\s*"POST"/, 'the control sends POST because the endpoint requires it');
    assert.match(fnSrc, /status:\s*405/);
    assert.match(fnSrc, /clearSession\(\)/, 'the Set-Cookie is the endpoint\'s to write, not the page\'s');
  });

  test('the control mints, reads and decides nothing', () => {
    // The order's hard constraint. It holds no credential, cannot read the
    // HttpOnly session cookie, and never branches on an answer from the server
    // other than "did the POST succeed".
    assert.doesNotMatch(signoutSrc, /document\.cookie/);
    assert.doesNotMatch(signoutSrc, /localStorage|sessionStorage/);
    assert.doesNotMatch(signoutSrc, /res\.json\(\)|response\.json\(\)/);
    // Exactly one endpoint, and it is the sign-out one.
    const urls = signoutSrc.match(/fetch\(\s*[A-Za-z_.]+/g) || [];
    assert.equal(urls.length, 1, 'the control talks to one endpoint');
    assert.doesNotMatch(signoutSrc, /\/members\/auth\/signin|\/members\/auth\/config/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE LOGIN ORPHAN IS GONE, AND NOTHING DEAD-ENDS AT IT
// ─────────────────────────────────────────────────────────────────────────────

describe('JORDAN-196 — the Coming Soon orphan is retired', () => {
  const redirectsSrc = readFileSync(join(SITE, '_redirects'), 'utf8');

  /** The live rules, as `from → {to, code}`. Comments are not rules. */
  const RULES = new Map();
  for (const line of redirectsSrc.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [from, to, code] = t.split(/\s+/);
    if (from && to) RULES.set(from, { to, code });
  }

  test('neither the page nor its script ships any more', () => {
    assert.equal(existsSync(join(SITE, 'login.html')), false);
    assert.equal(existsSync(join(SITE, 'js', 'page', 'login-coming-soon.js')), false);
  });

  test('no page still says "Coming Soon" where a member would look for a login', () => {
    const offenders = walk(SITE)
      .filter((p) => /coming\s*soon/i.test(readFileSync(p, 'utf8')))
      .map(rel);
    assert.deepEqual(offenders, [], 'a Coming Soon splash is still live in the tree');
  });

  test('BOTH spellings of the URL redirect, and to a page that exists', () => {
    // CF Pages serves `login.html` at `/login` as well as `/login.html`, so an
    // .html-only rule leaves the deleted file's canonical URL answering 404 —
    // the /desclimer lesson, written into `_redirects` itself.
    for (const from of ['/login.html', '/login']) {
      const rule = RULES.get(from);
      assert.ok(rule, `${from} has no redirect and the file is gone — that is a 404`);
      assert.equal(rule.code, '301');
      assert.equal(rule.to, '/engagement');
    }
    assert.ok(existsSync(join(SITE, 'engagement.html')),
      'the redirect target must be a page that ships');
  });

  test('the destination survives the retirement of the tiers: /engagement is How We Engage (2026-09-05)', () => {
    // The tier links that used to open the members gate from this page are gone with
    // the program. Judged on the CONTENT column: every page still ships the dead static
    // nav markup (the edge injects the real nav, and chrome-diff holds that markup
    // byte-for-byte), so the tier hrefs inside <nav> are not the page's doing.
    const html = readFileSync(join(SITE, 'engagement.html'), 'utf8');
    assert.match(html, /How We Engage/i);
    const doc = new JSDOM(html).window.document;
    const content = doc.querySelector('.box-practice') || doc.body;
    const tierLinks = [...content.querySelectorAll('a[href]')]
      .filter((a) => !a.closest('nav'))
      .map((a) => a.getAttribute('href'))
      .filter((h) => TIER_ROOTS.some((tier) => new RegExp(`(^|/)${tier}/?$`, 'i').test(h)));
    assert.deepEqual(tierLinks, [], `/engagement's content still links to a retired tier root: ${tierLinks.join(', ')}`);
    assert.match(html, /<script[^>]+js\/main\.js/, 'the page keeps the shared script (tel/mailto frame escape, nav)');
  });

  test('every remaining link to the old page resolves through the redirect', () => {
    // Seventeen legacy pages still spell the nav item `href="login.html"`. They are
    // NOT edited — `nav.menubar` is compared byte-for-byte by chrome-diff and that
    // rule is not waivable — so the redirect is what has to carry them. This asserts
    // the link and the rule agree, which is the only reason those pages are not dead.
    const linkers = walk(SITE).filter((p) => /href="\.?\/?login(\.html)?"/i.test(readFileSync(p, 'utf8')));
    assert.ok(linkers.length > 0, 'control: if nothing links to it, this test is proving nothing');
    assert.ok(RULES.has('/login.html') && RULES.has('/login'),
      `${linkers.length} pages still link to the retired page and would 404 without both rules`);
  });

  test('the swap policy no longer carries the dead script entry', () => {
    // `test/perch-swup-router.test.mjs` fails on an ADOPT_SCRIPTS row referenced by
    // no interceptable page. Deleting the page without the row is the same defect
    // in the other direction, so it is pinned here next to the deletion.
    const policy = readFileSync(join(SITE, 'js', 'perch', 'swap-policy.js'), 'utf8');
    assert.doesNotMatch(policy, /\[\s*'\/js\/page\/login-coming-soon\.js'/,
      'the adoption entry outlived the page it was for');
  });
});
