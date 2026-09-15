// JAY-SEO-E1 — social preview tags injected at the edge.
//
// Two classes of failure are worth guarding here, and neither throws:
//
//   1. DUPLICATION. Two `og:title`s is not cosmetic — scrapers take the first,
//      or the last, or neither. Everything this module emits must be skipped
//      when the page already declares it.
//   2. WRONG CLAIMS. A declared image dimension the file does not have is worse
//      than the absence it replaces: the platform trusts the declaration over
//      the artefact, so a wrong number makes the crop worse, not better.
//
// Plus the repo invariant this module had to be cut back to respect: the edge
// injects NO inline <script>, not even application/ld+json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import { socialMetaTags }
  from '../donovan-legal-site/functions/_lib/social-meta-inject.js';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (f) => readFileSync(new URL(f, SITE), 'utf8');

const URL_HOME = 'https://www.donovan.law/';

/** Parse the emitted fragment so assertions are about the DOM, not substrings. */
function frag(html) {
  return new JSDOM(`<!doctype html><html><head>${html}</head><body></body></html>`).window.document;
}
const metaOf = (doc, sel) => {
  const el = doc.querySelector(sel);
  return el ? el.getAttribute('content') : null;
};

const PAGE = `<!doctype html><html><head>
<title>Paul K. Donovan, Tax Attorney &amp; CPA | Donovan Legal PLLC</title>
<meta name="description" content="A plain description.">
<meta property="og:title" content="Paul K. Donovan, Tax Attorney &amp; CPA">
<meta property="og:description" content="Thirty years advising real estate investors.">
<meta property="og:image" content="https://www.donovan.law/img/PKD Headshot.jpg">
</head><body></body></html>`;

// ── Twitter cards ───────────────────────────────────────────────────────────

describe('twitter cards are derived from the page\'s own OG tags', () => {
  test('title and description come from OG, not re-authored', () => {
    // Derived rather than written by hand, because a second hand-written set is
    // a second thing to keep in step — and the pair drifts silently, since
    // nothing on the site renders both.
    const doc = frag(socialMetaTags(PAGE));
    assert.equal(metaOf(doc, 'meta[name="twitter:title"]'), 'Paul K. Donovan, Tax Attorney & CPA');
    assert.equal(metaOf(doc, 'meta[name="twitter:description"]'), 'Thirty years advising real estate investors.');
  });

  test('the image and an alt are carried across', () => {
    const doc = frag(socialMetaTags(PAGE));
    assert.equal(metaOf(doc, 'meta[name="twitter:image"]'), 'https://www.donovan.law/img/PKD Headshot.jpg');
    assert.ok(metaOf(doc, 'meta[name="twitter:image:alt"]'));
  });

  test('the card is `summary`, NOT `summary_large_image`', () => {
    // Deliberate divergence from the audit. The only declared image is a
    // portrait headshot; a large card crops it through the face. Upgrade when
    // the branded 1200x630 cover exists, not before.
    const doc = frag(socialMetaTags(PAGE));
    assert.equal(metaOf(doc, 'meta[name="twitter:card"]'), 'summary');
  });

  test('NO image dimensions are declared for an unmeasured file', () => {
    // Declaring 1200x630 for a portrait would make the crop worse, not better —
    // a platform trusts the numbers over the file.
    const out = socialMetaTags(PAGE);
    assert.ok(!out.includes('image:width'), 'must not claim a width it has not measured');
    assert.ok(!out.includes('image:height'));
  });

  test('a page that already has a card is left entirely alone', () => {
    const withCard = PAGE.replace('</head>', '<meta name="twitter:card" content="summary_large_image"></head>');
    const out = socialMetaTags(withCard);
    assert.ok(!out.includes('twitter:'), 'must not top up an existing card into a mixture');
  });

  test('a page with no OG title and no <title> gets no card', () => {
    const bare = '<!doctype html><html><head></head><body>x</body></html>';
    assert.ok(!socialMetaTags(bare).includes('twitter:'));
  });

  test('the title falls back to <title> when og:title is absent', () => {
    const noOg = `<!doctype html><html><head><title>Contact | Donovan Legal PLLC</title></head><body></body></html>`;
    const doc = frag(socialMetaTags(noOg));
    assert.equal(metaOf(doc, 'meta[name="twitter:title"]'), 'Contact | Donovan Legal PLLC');
  });
});

// ── OG completions ──────────────────────────────────────────────────────────

describe('og completions only ever add', () => {
  test('locale is added when missing', () => {
    const doc = frag(socialMetaTags(PAGE));
    assert.equal(metaOf(doc, 'meta[property="og:locale"]'), 'en_US');
  });

  test('an existing locale is not duplicated', () => {
    const withLocale = PAGE.replace('</head>', '<meta property="og:locale" content="en_GB"></head>');
    assert.ok(!socialMetaTags(withLocale).includes('og:locale'));
  });

  test('secure_url is emitted only for an https image', () => {
    const doc = frag(socialMetaTags(PAGE));
    assert.ok(metaOf(doc, 'meta[property="og:image:secure_url"]').startsWith('https://'));

    const httpImg = PAGE.replace('https://www.donovan.law/img/PKD Headshot.jpg', 'http://example.com/a.jpg');
    assert.ok(!socialMetaTags(httpImg).includes('secure_url'),
      'declaring a secure_url that is not secure is worse than omitting it');
  });

  test('nothing image-related is emitted when the page declares no image', () => {
    const noImg = PAGE.replace(/<meta property="og:image"[^>]*>/, '');
    const out = socialMetaTags(noImg);
    assert.ok(!out.includes('og:image'));
  });

  test('attribute order in the source page does not matter', () => {
    // These ~130 pages are hand-written and the order genuinely varies.
    const reversed = '<!doctype html><html><head><title>T</title>'
      + '<meta content="Reversed Order Title" property="og:title">'
      + '</head><body></body></html>';
    const doc = frag(socialMetaTags(reversed));
    assert.equal(metaOf(doc, 'meta[name="twitter:title"]'), 'Reversed Order Title');
  });
});

// ── Safety ──────────────────────────────────────────────────────────────────

describe('safety', () => {
  test('it injects NO <script> at all — the repo invariant the edge must keep', () => {
    // Five other suites enforce "the edge injects no inline <script>". A
    // BreadcrumbList was written here and removed for exactly that reason; this
    // test is what stops it being reintroduced by someone who did not hit them.
    for (const f of ['profile.html', 'blog-conservation-easement-settlement.html', 'contact.html']) {
      assert.ok(!socialMetaTags(read(f)).includes('<script'), f);
    }
    assert.ok(!socialMetaTags(PAGE).includes('<script'));
  });

  test('a quote in a title cannot break out of an attribute', () => {
    const nasty = PAGE.replace('content="Paul K. Donovan, Tax Attorney &amp; CPA"',
      'content="A&quot; onload=&quot;alert(1)"');
    const doc = frag(socialMetaTags(nasty));
    const el = doc.querySelector('meta[name="twitter:title"]');
    assert.equal(el.getAttribute('onload'), null);
  });

  test('never throws, whatever it is handed', () => {
    for (const h of ['', null, undefined, 42, '<html', '<'.repeat(5000)]) {
      assert.doesNotThrow(() => socialMetaTags(h));
    }
  });

  test('running it twice on its own output adds nothing the second time', () => {
    // Idempotence matters because the middleware could one day run over an
    // already-processed document (a preview of a preview, a cached edge copy).
    const once = PAGE.replace('</head>', socialMetaTags(PAGE) + '</head>');
    const twice = socialMetaTags(once);
    assert.ok(!twice.includes('twitter:'), 'no duplicate cards');
    assert.ok(!twice.includes('og:locale'), 'no duplicate locale');
  });
});

// ── Against the real pages ──────────────────────────────────────────────────

describe('against the pages actually in this repo', () => {
  const pages = readdirSync(new URL('.', SITE))
    .filter((f) => f.endsWith('.html') && !['nav-block.html', '404.shtml'].includes(f));

  test('every content page yields well-formed, parseable tags', () => {
    let withCards = 0;
    for (const f of pages) {
      const html = read(f);
      const out = socialMetaTags(html);
      if (!out) continue;
      // Must parse without swallowing what follows it.
      const doc = frag(out + '<meta name="sentinel" content="ok">');
      assert.equal(metaOf(doc, 'meta[name="sentinel"]'), 'ok', `${f} emitted unbalanced markup`);
      if (out.includes('twitter:card')) withCards += 1;
    }
    assert.ok(withCards > 80, `expected most pages to gain a card, got ${withCards}`);
  });

  test('no page is given a duplicate of a tag it already has', () => {
    for (const f of pages) {
      const html = read(f);
      const out = socialMetaTags(html);
      if (html.includes('twitter:card')) {
        assert.ok(!out.includes('twitter:card'), `${f} would get two cards`);
      }
      if (/property=["']og:locale["']/.test(html)) {
        assert.ok(!out.includes('og:locale'), `${f} would get two locales`);
      }
    }
  });
});
