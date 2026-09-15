// JORDAN — MEMBERS portal gate (ORDER JORDAN-MEMBERS-GATE-MODAL).
//
// THE DEFECT
// The MEMBERS nav dropdown links GOLD / PLATINUM / DIAMOND / RESERVE at the four
// tier directories. functions/_lib/tier-auth.js gates those with HTTP Basic and
// fails closed, so with TIER_*_USER / TIER_*_PASS unset every one of those links
// answers a bare 503 to the public — on all 74 pages that carry the dropdown.
//
// The fix is a shared capture-phase intercept in js/members-gate.js, loaded
// site-wide by one line in js/main.js. These tests guard it from BOTH directions,
// because either one alone is vacuous:
//
//   1. TREE      — no page may ship a tier-route anchor without loading the
//                  shared js/main.js. A new page that forgets the script is a
//                  page whose MEMBERS menu 503s again, and the behaviour test
//                  below would never see it.
//   2. BEHAVIOUR — the shared script must actually intercept the click (default
//                  prevented, no navigation), open the modal with the RIGHT
//                  portal name per tier, and hold no password input anywhere.
//
// The suite also pins the two hard constraints of the order: the modal performs
// no authentication (no password field, no network), and nothing inline is added
// (the site runs a nonce CSP).

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const MAIN_JS = join(SITE, 'js', 'main.js');
const GATE_JS = join(SITE, 'js', 'members-gate.js');
const GATE_CSS = join(SITE, 'css', 'members-gate.css');

const mainSrc = readFileSync(MAIN_JS, 'utf8');
const gateSrc = readFileSync(GATE_JS, 'utf8');

function walk(dir, filter, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');
const pages = walk(SITE, (p) => p.endsWith('.html') || p.endsWith('.shtml'));

// The four rooms, exactly as the order names them. Hardcoded here on purpose:
// reading them out of the script's own CONFIG would make the test agree with
// whatever the script says, which proves nothing about the approved naming.
const TIERS = [
  { key: 'gold', label: 'GOLD', portal: 'The Strategy Room', persona: 'Strategy Consumer' },
  { key: 'platinum', label: 'PLATINUM', portal: 'The Partners Room', persona: 'Strategic Partner' },
  { key: 'diamond', label: 'DIAMOND', portal: 'The Operators Room', persona: 'Qualifying Operator' },
  { key: 'reserve', label: 'RESERVE', portal: 'The Reserve Room', persona: 'Principal' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. TREE
// ─────────────────────────────────────────────────────────────────────────────

// Non-global on purpose: a /g regex carries lastIndex between .test() calls and
// would start skipping files halfway through the walk.
const TIER_ANCHOR_SRC =
  '<a\\b[^>]*\\bhref\\s*=\\s*"\\s*(?:\\.\\./|/)?(?:gold|platinum|diamond|reserve)/?\\s*"[^>]*>';
const TIER_ANCHOR = new RegExp(TIER_ANCHOR_SRC, 'i');
const allTierAnchors = (src) => src.match(new RegExp(TIER_ANCHOR_SRC, 'gi')) || [];
const LOADS_MAIN = /<script[^>]*\bsrc\s*=\s*"[^"]*\/?js\/main\.js"/i;

/** Tier anchors on this page that would navigate straight into the 503. */
function ungatedAnchors(src) {
  if (LOADS_MAIN.test(src)) return []; // the shared intercept covers the whole page
  return allTierAnchors(src);
}

describe('tree invariant — no tier-route anchor ships without the shared intercept', () => {
  test('the corpus under guard is non-empty (control)', () => {
    // If a refactor ever empties this list the invariant below silently stops
    // asserting anything. Fail loudly instead.
    const withTierLinks = pages.filter((p) => TIER_ANCHOR.test(readFileSync(p, 'utf8')));
    assert.ok(pages.length > 50, `only ${pages.length} pages walked`);
    assert.ok(
      withTierLinks.length > 50,
      `only ${withTierLinks.length} pages carry a MEMBERS tier link`,
    );
  });

  test('every page with a tier-route anchor loads js/main.js', () => {
    const offenders = [];
    for (const p of pages) {
      const bad = ungatedAnchors(readFileSync(p, 'utf8'));
      if (bad.length) offenders.push(`${rel(p)} (${bad.length})`);
    }
    assert.deepEqual(
      offenders,
      [],
      'these pages would navigate the public straight into the tier-auth 503 — ' +
        `load js/main.js: ${offenders.join(', ')}`,
    );
  });

  test('the guard would actually fire (control)', () => {
    const newPage =
      '<!doctype html><body><a class="dropdown-item" href="gold/"><span class="brand-gold">GOLD</span></a></body>';
    assert.equal(ungatedAnchors(newPage).length, 1);

    const gated =
      '<!doctype html><body><a href="/reserve/">RESERVE</a><script src="js/main.js"></script></body>';
    assert.equal(ungatedAnchors(gated).length, 0);

    // …and the absolute / parent-relative forms the tier pages use are matched.
    assert.equal(ungatedAnchors('<a href="/platinum/">P</a>').length, 1);
    assert.equal(ungatedAnchors('<a href="../diamond/">D</a>').length, 1);
  });

  test('js/main.js loads the gate as an external, same-origin script', () => {
    assert.match(
      mainSrc,
      /createElement\('script'\)[\s\S]{0,120}\/js\/members-gate\.js/,
      'js/main.js must append js/members-gate.js as an external script element',
    );
    // Absolute, because main.js is loaded as both "js/main.js" (root pages) and
    // "../js/main.js" (tier pages) — a relative src would 404 from a tier page.
    assert.match(mainSrc, /src:\s*'\/js\/members-gate\.js'/);
  });

  test('the loader runs before the first jQuery call', () => {
    // main.js is otherwise a jQuery file. If jQuery is missing or late, the gate
    // must still install — the 503 is a public-facing defect, not a nicety.
    const loaderAt = mainSrc.indexOf('/js/members-gate.js');
    const jqAt = mainSrc.search(/^\s*(?:\$|jQuery)\s*\(/m);
    assert.ok(loaderAt >= 0, 'the gate loader is gone from js/main.js');
    assert.ok(jqAt >= 0 && loaderAt < jqAt, 'the loader must run before jQuery can throw');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. NO INLINE ANYTHING (nonce CSP)
// ─────────────────────────────────────────────────────────────────────────────

// Every guard below greps CODE, never comments.
//
// This is not fussiness. The first run of this suite failed five of its own
// assertions because js/members-gate.js documents in prose that it holds no
// password field, injects no <style>, and does not touch tier-auth — and the
// naive greps matched the sentences saying so. A guard that fires on the comment
// explaining the invariant is a guard that has to be disabled to ship, which is
// how invariants get deleted. So: strip first, then assert.
//
// String- and template-aware, because the source legitimately contains
// 'http://www.w3.org/2000/svg' and 'mailto:…' — a naive stripper would treat
// those slashes as a comment and eat the rest of the line.
function stripComments(src, { js = true } = {}) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (js && (c === '"' || c === "'" || c === '`')) {
      const quote = c;
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (js && c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const gateCssSrc = readFileSync(GATE_CSS, 'utf8');
const gateCode = stripComments(gateSrc);
const gateCssCode = stripComments(gateCssSrc, { js: false });

describe('CSP — the gate adds nothing inline', () => {
  test('the comment stripper works (control)', () => {
    // If the stripper over-reaches, every guard below silently passes on an
    // empty string. If it under-reaches, the comment-grep bug is back.
    assert.doesNotMatch(gateCode, /THE DEFECT/, 'block comments must be stripped');
    assert.doesNotMatch(gateCode, /TODO\(IdP\)/, 'line comments must be stripped');
    assert.match(gateCode, /function startAuth\(/, 'code must survive');
    assert.match(gateCode, /'\/members\/auth\/signin'/, 'string literals must survive');
    assert.ok(gateCode.length > gateSrc.length / 4, 'the stripper ate the file');
    // And it really does hide the sentences that broke the naive greps.
    assert.match(gateSrc, /password/i, 'the prose does discuss passwords…');
    assert.doesNotMatch(gateCode, /password/i, '…and the code does not');
  });

  for (const [name, code] of [['js/members-gate.js', gateCode], ['css/members-gate.css', gateCssCode]]) {
    test(`${name} writes no inline style and injects no inline script`, () => {
      assert.doesNotMatch(code, /\.style\s*[.[]/, `${name} writes el.style`);
      assert.doesNotMatch(code, /Object\.assign\(\s*\w+\.style/, `${name} writes el.style`);
      assert.doesNotMatch(code, /setAttribute\(\s*['"]style['"]/, `${name} sets a style attribute`);
      assert.doesNotMatch(code, /<style[\s>]/i, `${name} injects a <style> block`);
      assert.doesNotMatch(code, /\binnerHTML\b/, `${name} uses innerHTML`);
      // MEMBERS-CLIO-GATED-ACCESS-R1: the gate now injects ONE script — Cloudflare
      // Turnstile, already allow-listed in the CSP (functions/_middleware.js) for the
      // booking widget and the consent gate. Asserting "no script" would now be
      // asserting the feature does not exist, so the assertion narrows instead: the
      // injected script gets its src from a variable, never from inline source text.
      assert.doesNotMatch(code, /createElement\(\s*['"]script['"]\)[^;]*innerHTML/, `${name} injects an inline script`);
      assert.doesNotMatch(code, /\.text\s*=|appendChild\(\s*document\.createTextNode[^)]*\)\s*\)?\s*;\s*\}?\s*script/i, `${name} writes inline script text`);
    });
  }

  test('the gate stylesheet is external and self-hosted', () => {
    assert.match(gateCode, /stylesheet:\s*'\/css\/members-gate\.css'/);
    // ONE third-party origin is permitted, and only this one: Cloudflare Turnstile,
    // which proves a human before the sign-in POST. It is already in script-src,
    // connect-src and frame-src for the booking widget and the consent gate, so this
    // ticket adds no CSP change. Every other off-origin URL is still a failure — an
    // allow-list of one is not a relaxation.
    const urls = (gateCode.match(/https?:\/\/[^\s'"`)]+/g) || [])
      .filter((u) => !u.startsWith('https://challenges.cloudflare.com/'));
    assert.deepEqual(urls, [], `the gate loads third-party assets: ${urls.join(', ')}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BEHAVIOUR
// ─────────────────────────────────────────────────────────────────────────────

/** A page carrying the real MEMBERS dropdown markup, in every href form used. */
const NAV = `<!doctype html><html><body>
  <ul class="navbar-nav">
    <li class="nav-item dropdown">
      <a class="nav-link" href="engagement.html">MEMBERS</a>
      <div class="dropdown-menu">
        <a class="dropdown-item" id="gold" href="gold/"><span class="brand-gold">GOLD</span></a>
        <a class="dropdown-item" id="platinum" href="platinum/"><span class="brand-platinum">PLATINUM</span></a>
        <a class="dropdown-item" id="diamond" href="diamond/"><span class="brand-diamond">DIAMOND</span></a>
        <a class="dropdown-item" id="reserve" href="reserve/"><span class="brand-reserve"><span class="re">RE</span>SERVE</span></a>
      </div>
    </li>
  </ul>
  <a id="abs-gold" href="/gold/">GOLD</a>
  <a id="up-platinum" href="../platinum/">PLATINUM</a>
  <a id="deep-gold" href="/gold/tool-1031-exchange.html">A tool inside the tier</a>
  <a id="plain" href="contact.html">CONTACT</a>
  <a id="offsite" href="https://example.com/gold/">Somebody else's gold</a>
  <a id="fallback" href="engagement.html"><span class="brand-diamond">DIAMOND</span></a>
</body></html>`;

function boot(html = NAV, url = 'https://www.donovan.law/index.html') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  // Any network call at all would contradict "performs NO authentication".
  const calls = [];
  dom.window.fetch = (...a) => { calls.push(a); return Promise.reject(new Error('no network')); };
  dom.window.XMLHttpRequest = function () { calls.push(['xhr']); };
  dom.window.eval(gateSrc);

  // Two observers, registered AFTER the gate so they see what it did.
  //
  // `probe` is a CAPTURE listener on document. The gate calls stopPropagation()
  // — which stops the event descending further, but NOT the remaining listeners
  // on the same node — so this still runs and can read defaultPrevented for both
  // intercepted and untouched clicks. It then swallows the default action,
  // because jsdom answers a real anchor navigation with a thrown
  // "Not implemented: navigation", which would bury genuine failures in noise.
  const probe = { prevented: null, bubbled: false };
  dom.window.document.addEventListener('click', (e) => {
    probe.prevented = e.defaultPrevented;
    e.preventDefault();
  }, true);
  // Bubble phase on window: reached only if the gate did NOT stopPropagation.
  dom.window.addEventListener('click', () => { probe.bubbled = true; });

  clickProbes.set(dom.window, probe);
  return { dom, win: dom.window, doc: dom.window.document, calls, probe };
}

/** win → probe, so click() stays a two-argument call at every call site. */
const clickProbes = new WeakMap();

/**
 * Dispatch a click and report what the GATE did with it.
 * `.defaultPrevented` is read mid-flight by the capture probe above, before the
 * test harness suppresses the default action — so it reflects the gate, not us.
 */
function click(win, el, init = {}) {
  const probe = clickProbes.get(win);
  if (probe) { probe.prevented = null; probe.bubbled = false; }
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(ev);
  return {
    defaultPrevented: probe ? probe.prevented === true : ev.defaultPrevented,
    propagated: probe ? probe.bubbled : true,
  };
}

function key(win, target, k, init = {}) {
  const ev = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

const overlay = (doc) => doc.getElementById('dvnmg-overlay');
const isOpen = (doc) => !!overlay(doc) && overlay(doc).hidden === false;

describe('behaviour — the click is intercepted and the modal opens', () => {
  test('no modal exists before the first tier click', () => {
    const { doc } = boot();
    assert.equal(overlay(doc), null, 'the gate must not paint DOM until it is needed');
  });

  for (const t of TIERS) {
    test(`${t.label} — intercepted, no navigation, opens ${t.portal}`, () => {
      const { win, doc, calls } = boot();
      const a = doc.getElementById(t.key);
      const before = win.location.href;

      const ev = click(win, a);

      assert.equal(ev.defaultPrevented, true, 'the 503 route must never be navigated');
      assert.equal(ev.propagated, false, 'the click must not also reach the dropdown handlers');
      assert.equal(win.location.href, before, 'the page must not navigate');
      assert.equal(isOpen(doc), true, 'the gate modal must open');
      assert.equal(
        doc.getElementById('dvnmg-title').textContent,
        t.portal,
        `${t.label} must open ${t.portal}`,
      );
      assert.match(doc.getElementById('dvnmg-persona').textContent, new RegExp(t.persona));
      assert.match(doc.getElementById('dvnmg-eyebrow').textContent, new RegExp(t.label));
      assert.match(doc.getElementById('dvnmg-eyebrow').textContent, /Member Portal/);
      // SUPERSEDED by MEMBERS-CLIO-GATED-ACCESS-R1, deliberately. Opening the gate
      // now makes exactly ONE call: /members/auth/config, to fetch the Turnstile
      // site key and start the browser check while the member is still typing.
      // Starting it at submit instead posted an empty token and refused a real
      // member — found on the live preview.
      //
      // What the original assertion protected is kept and made explicit: merely
      // OPENING the card must not sign anyone in, and must send no address
      // anywhere. So the call is allowed, but only that one, and only to that path.
      assert.ok(calls.length <= 1, `opening the gate made ${calls.length} network calls`);
      for (const c of calls) {
        const target = typeof c === 'string' ? c : (c && (c.url || c[0])) || String(c);
        assert.match(String(target), /\/members\/auth\/config/, `unexpected call on open: ${target}`);
        assert.doesNotMatch(String(target), /signin|request-access/, 'opening must not sign in');
      }
    });
  }

  test('a click on the brand span inside the anchor is intercepted too', () => {
    const { win, doc } = boot();
    const span = doc.querySelector('#reserve .brand-reserve');
    const ev = click(win, span);
    assert.equal(ev.defaultPrevented, true);
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Reserve Room');
  });

  test('absolute and parent-relative tier hrefs resolve to the same gate', () => {
    const { win, doc } = boot(NAV, 'https://www.donovan.law/gold/tool-1031-exchange.html');
    assert.equal(click(win, doc.getElementById('abs-gold')).defaultPrevented, true);
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Strategy Room');
    key(win, doc.getElementById('dvnmg-card'), 'Escape');
    assert.equal(click(win, doc.getElementById('up-platinum')).defaultPrevented, true);
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Partners Room');
  });

  test('the brand-tier span is the fallback when the href is not a tier route', () => {
    const { win, doc } = boot();
    assert.equal(click(win, doc.getElementById('fallback')).defaultPrevented, true);
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Operators Room');
  });

  test('non-tier, in-tier and off-site links are left alone', () => {
    const { win, doc } = boot();
    for (const id of ['plain', 'deep-gold', 'offsite']) {
      const ev = click(win, doc.getElementById(id));
      assert.equal(ev.defaultPrevented, false, `#${id} must not be intercepted`);
      assert.equal(isOpen(doc), false, `#${id} must not open the gate`);
    }
  });

  test('a modified click is left to the browser', () => {
    const { win, doc } = boot();
    for (const mod of ['ctrlKey', 'metaKey', 'shiftKey']) {
      const ev = click(win, doc.getElementById('gold'), { [mod]: true });
      assert.equal(ev.defaultPrevented, false, `${mod}-click is a deliberate open-elsewhere`);
      assert.equal(isOpen(doc), false, `${mod}-click must not open the gate`);
    }
  });

  test('the script is idempotent — a second load does not double-bind', () => {
    const { win, doc } = boot();
    win.eval(gateSrc);
    click(win, doc.getElementById('gold'));
    assert.equal(doc.querySelectorAll('#dvnmg-overlay').length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. NO CREDENTIAL SURFACE
// ─────────────────────────────────────────────────────────────────────────────

describe('the gate collects no credential', () => {
  test('no password input exists anywhere in the modal, in any state', () => {
    const { win, doc, calls } = boot();
    click(win, doc.getElementById('gold'));
    const card = doc.getElementById('dvnmg-card');

    const assertNoPassword = (where) => {
      assert.equal(
        card.querySelectorAll('input[type="password"]').length,
        0,
        `a password input appeared ${where}`,
      );
      const types = [...card.querySelectorAll('input')].map((i) => i.type);
      assert.deepEqual(
        types.filter((t) => t !== 'email'),
        [],
        `only the notify-me email field may exist — found ${types.join(', ')} ${where}`,
      );
    };

    // STILL TRUE AFTER THE CLIO CUTOVER, and still worth pinning: the member types
    // an address and nothing else. There is no password field because there is no
    // password anywhere in this design — the order's accepted-risk section is candid
    // that the address IS the credential, and this test is what stops a well-meaning
    // future edit from quietly adding one and calling it an improvement.
    assertNoPassword('on the sign-in panel');
    click(win, doc.getElementById('dvnmg-request'));
    assertNoPassword('after Request member access');
    click(win, doc.getElementById('dvnmg-back'));
    assertNoPassword('back on the sign-in panel');
  });

  test('the source holds no password field and no credential vocabulary', () => {
    assert.doesNotMatch(gateCode, /['"]password['"]/i);
    assert.doesNotMatch(
      gateCode,
      /\b(client_secret|clientSecret|api_key|apiKey|password|passwd|credential)\b/i,
    );
    // THE SESSION MUST NOT BE READABLE FROM HERE. The cookie is set by the server as
    // HttpOnly; if this file ever grows a document.cookie read, either the cookie
    // stopped being HttpOnly or somebody started keeping a second copy of the answer
    // somewhere a page script can reach.
    assert.doesNotMatch(gateCode, /\b(localStorage|sessionStorage|document\.cookie)\b/);

    // The no-transport arm is deliberately retired: this file now posts to
    // /members/auth/signin. What replaces it is a tighter question than "does it talk"
    // — WHERE may it talk. Every fetch target must come from CONFIG.endpoints, so a
    // hard-coded or page-supplied URL cannot slip in beside them.
    const fetched = (gateCode.match(/fetch\(\s*[^,)]+/g) || []);
    assert.ok(fetched.length > 0, 'the gate must actually sign members in');
    for (const f of fetched) {
      assert.match(f, /CONFIG\.endpoints\.[a-zA-Z]+/, `fetch target not from CONFIG.endpoints: ${f}`);
    }
    assert.doesNotMatch(gateCode, /\.submit\s*\(|createElement\(\s*['"]form['"]/);
  });

  // SUPERSEDED by MEMBERS-CLIO-GATED-ACCESS-R1. The IdP seam marked a redirect to an
  // identity provider that is not being built — membership is resolved from the
  // member's own Clio contact, so there is no provider to redirect to. What the
  // marker actually guarded, that this file invents no auth of its own and holds no
  // client secret, is covered by the two tests above and by this one.
  test('the sign-in target is same-origin and server-owned', () => {
    assert.match(gateSrc, /function submitSignin\(/);
    assert.match(gateSrc, /signin: '\/members\/auth\/signin'/, 'the endpoint must be a same-origin path');
    // No absolute URL among the endpoints. A full URL here is how a sign-in target
    // becomes something other than us.
    const block = (gateCode.match(/endpoints:\s*\{[^}]*\}/) || [''])[0];
    assert.doesNotMatch(block, /https?:\/\//, 'endpoints must be same-origin paths');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE PLACEHOLDER PANEL
// ─────────────────────────────────────────────────────────────────────────────

describe('the launching-soon stub', () => {
  let win, doc;
  beforeEach(() => {
    ({ win, doc } = boot());
    click(win, doc.getElementById('diamond'));
  });

  test('the sign-in panel carries an email field, the request-access route and the footnote', () => {
    // The two SSO buttons are gone — there is no identity provider. Everything the
    // approved mockup kept is still asserted here, because #27 left the modal's brand
    // treatment as David's call and this ticket changes wiring, not appearance.
    const email = doc.getElementById('dvnmg-signin-email');
    assert.equal(email.type, 'email', 'the credential is an email address and nothing else');
    assert.equal(doc.getElementById('dvnmg-signin-submit').textContent, 'Enter');
    assert.ok(doc.querySelector('.dvnmg-divider'), 'the divider is part of the approved layout');
    assert.equal(doc.getElementById('dvnmg-request').textContent, 'Request member access');
    assert.match(doc.getElementById('dvnmg-footnote').textContent, /by application only/i);
    // The room names are the mockup's and must survive a wiring change untouched.
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Operators Room');
  });

  test('Request member access hands off to the firm’s real intake', () => {
    // REPLACES two tests that asserted an email-capture panel: one for the notify
    // field, one for the mailto/lead POST. Both described a path that no longer
    // exists, and keeping either would have pinned the weaker route in place.
    //
    // An address in a dashboard gives the firm no matter type, no urgency, no
    // appointment and nobody committed to watching for it. The booking flow —
    // qualifier, slot, contact in Clio, calendar invite — is the firm's actual
    // intake, and every membership page's own CTA already points there.
    click(win, doc.getElementById('dvnmg-request'));
    assert.equal(doc.getElementById('dvnmg-panel-signin').hidden, true);
    assert.equal(doc.getElementById('dvnmg-panel-soon').hidden, false);
    assert.match(doc.getElementById('dvnmg-soon-lede').textContent, /request member access/i);
    assert.match(doc.getElementById('dvnmg-soon-body').textContent, /consultation/i);

    const consult = doc.getElementById('dvnmg-consult');
    assert.match(consult.textContent, /schedule a consultation/i);

    // THE ATTRIBUTE IS THE FLOW; the href is only the failure floor.
    //
    // Found live: /book.html on its own lands on the date/time picker and skips the
    // qualifier, so the firm would get a booking with no matter type and no urgency.
    // data-perch-book is perch-layer.js's published contract (BOOK_INTENT_ATTR) —
    // its handler opens the no-voice qualifier and runs the whole chain, and only
    // preventDefault()s on success, which is why the href must ALSO stay.
    assert.equal(
      consult.getAttribute('data-perch-book'),
      'members_gate',
      'the consultation button must open the qualifier, not jump to the picker',
    );
    assert.match(
      consult.getAttribute('href'),
      /^\/book\.html$/,
      'and must keep the href, which perch-layer treats as the failure floor',
    );
  });

  test('handing off to the consultation closes the card', () => {
    // FOUND LIVE. The hand-off worked and the visitor saw nothing happen: this
    // overlay sits at z-index > 2147483000, so the qualifier opened BEHIND it.
    //
    // perch-layer's book-intent handler is a DOCUMENT-level CAPTURE listener that
    // calls stopPropagation() on success, so a listener on the anchor itself never
    // runs. The closer is registered on `window` for that reason — capture goes
    // window → document → target — and this test would pass on a listener attached
    // anywhere, so the assertion below pins the mechanism too.
    click(win, doc.getElementById('dvnmg-request'));
    assert.equal(isOpen(doc), true);
    click(win, doc.getElementById('dvnmg-consult'));
    assert.equal(isOpen(doc), false, 'the qualifier would open behind a card left open');
  });

  test('the closer captures on window, not on the anchor', () => {
    // Without this, the test above still passes when someone "simplifies" the
    // listener onto the anchor — and it silently stops working in the browser,
    // because perch-layer has already stopped the event by then.
    assert.match(
      gateCode,
      /window\.addEventListener\(\s*'click'[\s\S]{0,220}dvnmg-consult[\s\S]{0,120}true\s*\)/,
      'the consult closer must be a window capture listener',
    );
  });

  test('the book-intent attribute is the one perch-layer actually listens for', () => {
    // Pins our value against its source rather than against a literal we copied.
    // If BOOK_INTENT_ATTR is ever renamed, this fails instead of the button quietly
    // reverting to a bare link that skips the qualifier.
    const layer = readFileSync(join(SITE, 'js', 'perch-layer.js'), 'utf8');
    const m = /BOOK_INTENT_ATTR\s*=\s*'([^']+)'/.exec(layer);
    assert.ok(m, 'perch-layer.js no longer declares BOOK_INTENT_ATTR');
    assert.match(gateCode, new RegExp(`setAttribute\\(\\s*'${m[1]}'`), `the gate must use ${m[1]}`);
  });

  test('no email is collected on the request panel, and no lead is posted', () => {
    // The ONLY input anywhere in this modal is the sign-in address, and that is the
    // credential. Nothing here captures a second one, and nothing POSTs.
    click(win, doc.getElementById('dvnmg-request'));
    const panel = doc.getElementById('dvnmg-panel-soon');
    assert.equal(panel.querySelectorAll('input').length, 0, 'the request panel takes no input');
    // gateCode, not gateSrc — this file's own header explains why, and I proved it
    // the hard way: the comment describing the removal names the removed endpoint,
    // so a source-level grep fires on the sentence saying it is gone.
    assert.doesNotMatch(gateCode, /members\/request-access/, 'the lead endpoint is gone, not orphaned');
    assert.doesNotMatch(gateCode, /mailto:/, 'and no mailto was left behind either');
  });

  test('Back returns to the sign-in panel', () => {
    click(win, doc.getElementById('dvnmg-request'));
    click(win, doc.getElementById('dvnmg-back'));
    assert.equal(doc.getElementById('dvnmg-panel-signin').hidden, false);
    assert.equal(doc.getElementById('dvnmg-panel-soon').hidden, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACCESSIBILITY & LAYER SAFETY
// ─────────────────────────────────────────────────────────────────────────────

describe('accessibility', () => {
  test('the card is a labelled modal dialog', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('platinum'));
    const card = doc.getElementById('dvnmg-card');
    assert.equal(card.getAttribute('role'), 'dialog');
    assert.equal(card.getAttribute('aria-modal'), 'true');
    assert.equal(card.getAttribute('aria-labelledby'), 'dvnmg-title');
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Partners Room');
  });

  test('focus moves into the card on open and back to the trigger on close', () => {
    const { win, doc } = boot();
    const trigger = doc.getElementById('gold');
    trigger.focus();
    click(win, trigger);
    assert.ok(
      doc.getElementById('dvnmg-card').contains(doc.activeElement),
      'focus must move into the dialog',
    );
    key(win, doc.getElementById('dvnmg-card'), 'Escape');
    assert.equal(doc.activeElement, trigger, 'focus must return to the dropdown item');
  });

  test('ESC closes the gate', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    key(win, doc.getElementById('dvnmg-card'), 'Escape');
    assert.equal(isOpen(doc), false);
  });

  test('a backdrop click closes the gate; a click inside the card does not', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    const ov = overlay(doc);
    doc.getElementById('dvnmg-card').dispatchEvent(
      new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    );
    assert.equal(isOpen(doc), true, 'a click inside the card must not close it');
    ov.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    assert.equal(isOpen(doc), false, 'a backdrop click must close it');
  });

  test('the close button closes the gate', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    click(win, doc.getElementById('dvnmg-close'));
    assert.equal(isOpen(doc), false);
  });

  test('Tab is trapped inside the card', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    const card = doc.getElementById('dvnmg-card');
    const focusable = [...card.querySelectorAll('a[href], button, input')].filter((el) => {
      for (let n = el; n && n !== card; n = n.parentNode) if (n.hidden) return false;
      return true;
    });
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    const fwd = key(win, card, 'Tab');
    assert.equal(fwd.defaultPrevented, true, 'Tab off the last control must be trapped');
    assert.equal(doc.activeElement, first, 'and must wrap to the first control');

    first.focus();
    const back = key(win, card, 'Tab', { shiftKey: true });
    assert.equal(back.defaultPrevented, true, 'Shift+Tab off the first control must be trapped');
    assert.equal(doc.activeElement, last, 'and must wrap to the last control');
  });

  test('hidden-panel controls are excluded from the trap', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    // The launching-soon panel is hidden on open; its email field must not be a
    // tab stop, or the trap would park focus on an invisible control.
    const card = doc.getElementById('dvnmg-card');
    card.querySelector('#dvnmg-signin-email').focus();
    key(win, card, 'Tab', { shiftKey: true });
    assert.notEqual(doc.activeElement, doc.getElementById('dvnmg-notify-email'));
  });
});

describe('layer safety and portability', () => {
  const cssSrc = readFileSync(GATE_CSS, 'utf8');

  test('the overlay sits above the Perch launcher and below the consent gate', () => {
    const z = Number(/\.dvnmg-overlay\s*\{[^}]*z-index:\s*(\d+)/.exec(cssSrc)[1]);
    assert.ok(z > 2147483000, 'the gate must render above the Perch launcher');
    assert.ok(z < 2147483600, 'a marketing modal must never cover the §934.03 consent gate');
  });

  test('every display-setting component that can be hidden has a [hidden] rule', () => {
    // `display: flex` beats the UA sheet's [hidden] { display: none }, so any class
    // that sets display AND gets hidden by the .hidden property needs its own rule.
    // The file already carries two — .dvnmg-overlay and .dvnmg-panel — because this
    // trap was hit twice before. .dvnmg-cta was the third: the wrong-level offer
    // button rendered as an empty green bar until it got one.
    for (const cls of ['dvnmg-overlay', 'dvnmg-panel', 'dvnmg-cta']) {
      assert.match(
        cssSrc,
        new RegExp(`\\.${cls}\\[hidden\\]`),
        `.${cls} sets display and can be hidden, so it needs a [hidden] rule`,
      );
    }
  });

  test('an anchor styled as a button keeps its own colour against the site sheet', () => {
    // FOUND LIVE, not by a test, and it could not have been found by one here:
    // asserting this properly needs a cascade engine, and the suite has jsdom.
    //
    // css/main.css:1772 forces `color: #169B62` on every non-nav anchor under
    // .home-section — which <body> always is — with specificity (0,5,1). That
    // buries .dvnmg-cta's single class, and #169B62 is also --dvn-green, this
    // button's background. The wrong-level offer rendered green-on-green: a
    // working link with an invisible label.
    //
    // So this is a source-shape assertion, deliberately and with its limits stated.
    // It cannot prove the colour wins; it can prove nobody deleted the override
    // while tidying up, which is the realistic regression.
    assert.match(
      cssSrc,
      /\.dvnmg-overlay\s+\.dvnmg-cta[^{]*\{[^}]*color:[^;]*!important/,
      'the gate must re-assert its button colour against main.css .home-section a',
    );
    const siteCss = readFileSync(join(SITE, 'css', 'main.css'), 'utf8');
    assert.match(
      siteCss,
      /\.home-section a:not\(/,
      'if this rule is ever removed from main.css, the override above can go too',
    );
  });

  test('the overlay is fixed, so it works inside the /perch iframe', () => {
    assert.match(cssSrc, /\.dvnmg-overlay\s*\{[^}]*position:\s*fixed/);
  });

  test('the gate is responsive', () => {
    assert.match(cssSrc, /@media\s*\(max-width:\s*480px\)/);
    assert.match(cssSrc, /@media\s*\(max-height:\s*620px\)/, 'the iframe viewport is short');
  });

  test('every class and id is namespaced so the gate can move to a Perch overlay', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    const nodes = [overlay(doc), ...overlay(doc).querySelectorAll('*')];
    const stray = [];
    for (const n of nodes) {
      for (const c of n.classList || []) {
        // .brand-* is the firm's shared tier treatment from css/main.css and is
        // intentionally reused; everything else the gate owns must be namespaced.
        if (!c.startsWith('dvnmg-') && !c.startsWith('brand-')) stray.push(`class=${c}`);
      }
      if (n.id && !n.id.startsWith('dvnmg-')) stray.push(`id=${n.id}`);
    }
    assert.deepEqual(stray, [], `un-namespaced nodes leak into the page: ${stray.join(', ')}`);
  });

  test('the whole gate detaches to nothing — it owns exactly one subtree', () => {
    const { win, doc } = boot();
    click(win, doc.getElementById('gold'));
    assert.equal(doc.querySelectorAll('#dvnmg-overlay').length, 1);
    assert.equal(overlay(doc).parentNode, doc.body);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. THE ROUTE IS UNTOUCHED
// ─────────────────────────────────────────────────────────────────────────────

describe('the fix is front-end only', () => {
  test('the gate script never references tier-auth or a tier credential variable', () => {
    // Code only — the header comment names tier-auth.js to explain WHY the fix
    // lives on the client, and that sentence must not be what fails this test.
    assert.doesNotMatch(gateCode, /tier-auth|tierGuard|TIER_[A-Z]+_(USER|PASS)/);
  });

  test('functions/_lib/tier-auth.js still fails closed (it is not this order to change)', () => {
    const src = readFileSync(join(SITE, 'functions', '_lib', 'tier-auth.js'), 'utf8');
    assert.match(src, /FAIL CLOSED/, 'tier-auth must keep its fail-closed contract');
    assert.match(src, /503/, 'an unconfigured tier must still 503, not fall through to public');
  });
});
