// JORDAN — public tier marketing pages (ORDER JORDAN-MEMBERS-MARKETING, Ticket B).
//
// WHAT SHIPS
// Four public, indexable marketing pages — membership-{gold,platinum,diamond,
// reserve}.html — built from the framing in Donovan_Legal_KB.md, section
// "[ALL] Membership levels (Gold / Platinum / Diamond / Reserve)".
//
// THE HARD CONSTRAINT
// There must be no window in which the private, Basic-auth-gated content under
// /gold/, /platinum/, /diamond/, /reserve/ is served publicly. Un-gating is
// Ticket C (105), sequenced after the member cutover. So this ticket publishes
// at NEW paths and leaves the gate alone. These tests pin both halves:
//
//   1. The four pages are real, indexable, chrome-complete marketing pages that
//      carry the KB tagline and end in a consultation CTA.
//   2. They carry NO fee value and NO privileged/member-portal content, and the
//      gate itself is untouched — the four middlewares still delegate to
//      tierGuard and tier-auth.js still fails closed.
//
// Assertions run against the PARSED DOM, not the source text: an HTML entity
// still spells its payload in source, so source-grep alone would be the wrong
// instrument for "no dollar amount appears on the page".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const KB = join(ROOT, 'Donovan_Legal_KB.md');

// Verbatim from Donovan_Legal_KB.md, "[ALL] Membership levels".
const TIERS = {
  gold: {
    tagline: 'The Playbook for Your First Move Into Real Estate',
    heading: 'GOLD MEMBERSHIP',
    cta: 'book.html',
  },
  platinum: {
    tagline: 'Your Portfolio Deserves More Than a Generalist',
    heading: 'PLATINUM MEMBERSHIP',
    cta: 'book.html',
  },
  diamond: {
    tagline: 'Built for the Real Estate Professional',
    heading: 'DIAMOND MEMBERSHIP',
    cta: 'book.html',
  },
  reserve: {
    tagline: 'Counsel That Operates at Your Level',
    heading: 'RESERVE MEMBERSHIP',
    cta: 'contact.html', // Reserve is by application, not a booking.
  },
};

const NAV = ['HOME', 'ABOUT', 'PRACTICE', 'EXPERIENCE', 'TESTIMONIALS', 'RESOURCES', 'MEMBERS', 'CONTACT'];

// Currency / fee VALUES. Deliberately broad — a fee can be spelled without a
// currency sign ("12,500 per year", "8k"), and a page that quotes one is a
// publish the order forbids.
const MONEY = [
  /[$£€¥]/,
  /\b\d[\d,]*(?:\.\d+)?\s*(?:dollars?|USD|per\s+(?:month|year|hour|annum)|\/(?:mo|yr|hr))\b/i,
  /\b(?:fee|price|cost|rate|retainer|deposit)s?\s*(?:of|:|is|are|starts?\s+at|from)\s*\d/i,
  /\b\d{1,3}(?:,\d{3})+\b/,
  /\b\d+(?:\.\d+)?\s*[kKmM]\b(?!\w)/,
];

// Strings whose presence would mean gated member-portal content had been copied
// into a public page. Sourced from the actual portal pages under /<tier>/.
const PRIVATE = [
  /privileged\s*(?:&|and)\s*confidential/i,
  /welcome,?\s*member/i,
  /for the named member/i,
  /member portal/i,
  /your (?:tools|file|member tools)/i,
];

const docFor = (slug) => {
  const file = join(SITE, `membership-${slug}.html`);
  assert.ok(existsSync(file), `${file} must exist`);
  return new JSDOM(readFileSync(file, 'utf8')).window.document;
};

const visibleText = (doc) => doc.body.textContent.replace(/\s+/g, ' ');

describe('JORDAN-MEMBERS-MARKETING — KB source', () => {
  const kb = readFileSync(KB, 'utf8');

  test('the KB Membership levels section exists', () => {
    assert.match(kb, /^##\s+`\[ALL\]`\s+Membership levels/m);
  });

  // STOP condition of the order: a tier missing its framing means stop and
  // report, not invent copy. If the KB is edited so a tagline no longer appears,
  // this fails before the page tests can quietly drift away from the source.
  for (const [slug, t] of Object.entries(TIERS)) {
    test(`the KB carries the ${slug} framing`, () => {
      assert.ok(kb.includes(t.tagline), `KB must contain the ${slug} tagline verbatim`);
    });
  }
});

describe('JORDAN-MEMBERS-MARKETING — the four public pages', () => {
  for (const [slug, t] of Object.entries(TIERS)) {
    describe(`membership-${slug}.html`, () => {
      test('renders one h1 naming the tier', () => {
        const doc = docFor(slug);
        const h1s = doc.querySelectorAll('h1');
        assert.equal(h1s.length, 1);
        assert.equal(h1s[0].textContent.replace(/\s+/g, ' ').trim(), t.heading);
      });

      test('carries the site chrome — desktop nav, mobile nav, footer', () => {
        const doc = docFor(slug);
        const labels = [...doc.querySelectorAll('#menu-desktop > li.nav-item > a.nav-link')]
          .map((a) => a.textContent.trim());
        assert.deepEqual(labels, NAV);
        assert.ok(doc.querySelector('.nav-mobile-overlay .nav-mobile-list'), 'mobile nav overlay');
        assert.ok(doc.querySelector('.dl-connect'), 'connect strip');
        assert.match(doc.querySelector('.copy-inside').textContent, /Donovan Legal PLLC/);
        assert.ok(doc.querySelector('a.disclaimer-link[href="disclaimer.html"]'), 'disclaimer link');
      });

      // The MEMBERS dropdown links the tier routes; js/members-gate.js (loaded by
      // js/main.js) intercepts those clicks. A page shipping tier anchors without
      // main.js re-exposes the bare 503 — see members-gate.test.mjs.
      test('loads the shared js/main.js that gates the MEMBERS dropdown', () => {
        const doc = docFor(slug);
        const srcs = [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
        assert.ok(srcs.some((s) => /(^|\/)js\/main\.js$/.test(s)), `main.js not loaded: ${srcs}`);
      });

      test('is retired: noindex, canonical to How We Engage (2026-09-05)', () => {
        const doc = docFor(slug);
        const robots = doc.querySelector('meta[name="robots"]');
        assert.ok(robots && /noindex/.test(robots.getAttribute('content')), 'a retired marketing page must be noindex');
        const canon = doc.querySelector('link[rel="canonical"]');
        assert.equal(canon.getAttribute('href'), 'https://www.donovan.law/engagement');
      });

      test('renders the KB tagline verbatim', () => {
        const doc = docFor(slug);
        assert.equal(doc.querySelector('.tier-tagline').textContent.trim(), t.tagline);
      });

      test('ends in a book-a-consultation / contact call to action', () => {
        const doc = docFor(slug);
        const ctas = [...doc.querySelectorAll('.cta-band a[href]')];
        assert.equal(ctas.length, 1, 'exactly one CTA-band action');
        assert.equal(ctas[0].getAttribute('href'), t.cta);
        assert.ok(ctas[0].textContent.trim().length > 0);
      });

      test('publishes no fee value', () => {
        const text = visibleText(docFor(slug));
        for (const re of MONEY) {
          const m = text.match(re);
          assert.equal(m, null, `fee-like text on the page: ${m && JSON.stringify(m[0])}`);
        }
      });

      test('publishes no privileged or member-portal content', () => {
        const text = visibleText(docFor(slug));
        for (const re of PRIVATE) {
          const m = text.match(re);
          assert.equal(m, null, `gated-portal string on the page: ${m && JSON.stringify(m[0])}`);
        }
      });

      // Marketing pages must not become a new door into the gated area. The nav
      // chrome legitimately carries tier anchors (intercepted by members-gate.js);
      // nothing in the page BODY may link there.
      test('adds no link into the gated tier roots outside the nav chrome', () => {
        const doc = docFor(slug);
        const stray = [...doc.querySelectorAll('a[href]')].filter(
          (a) => /^(?:\.\/)?(?:gold|platinum|diamond|reserve)\//.test(a.getAttribute('href')) && !a.closest('nav')
        );
        assert.deepEqual(stray.map((a) => a.getAttribute('href')), []);
      });
    });
  }
});

describe('MEMBERS-CLIO-GATED-ACCESS — the gate still gates, on the new credential', () => {
  // SUPERSEDES the "the gate is untouched" block that stood here.
  //
  // Ticket B published marketing and deliberately left the HTTP Basic gate alone,
  // so this block asserted the gate had NOT changed. MEMBERS-CLIO-GATED-ACCESS-R1
  // is the change it was waiting for: the credential stops being a shared per-tier
  // password in a Cloudflare secret and becomes a signed cookie carrying the
  // engagement level from the member's own Clio contact. Ticket C's un-gate is off
  // — it existed to free the tier roots for Clio for Clients, which #130 proved
  // cannot host them, so the roots stay gated and this block keeps guarding them.
  //
  // WHAT DOES NOT CHANGE IS WHY THESE RUN THE MIDDLEWARE INSTEAD OF READING IT.
  // Ticket B's own control proved a middleware rewritten to keep the right import
  // and call, but export `context.next()`, PASSED the source-shape assertion while
  // being a completely disabled gate. Every property below is therefore asserted
  // against a real Request and Response, and every deny path also asserts that
  // `next()` was never reached — a gate that redirects after serving the content
  // is not a gate.
  //
  // Each test below is the one-for-one descendant of the Basic-auth test it
  // replaces: 503-when-unconfigured survives unchanged, the two 401 arms become
  // redirect arms, the positive arm survives, and per-tier isolation survives.
  const invoke = async (onRequest, { env = {}, cookie, url } = {}) => {
    let nextCalled = false;
    const headers = new Headers();
    if (cookie) headers.set('Cookie', cookie);
    const res = await onRequest({
      request: new Request(url || 'https://www.donovan.law/tier/index.html', { headers }),
      env,
      next: async () => {
        nextCalled = true;
        return new Response('GATED MEMBER CONTENT', { headers: { 'Content-Type': 'text/html' } });
      },
    });
    return { res, nextCalled };
  };

  const guardFor = async (slug) =>
    (await import(new URL(`../donovan-legal-site/functions/${slug}/_middleware.js`, import.meta.url))).onRequest;

  const SIGNING_SECRET = 'members-marketing-test-secret';
  const env = { MEMBERS_SESSION_SECRET: SIGNING_SECRET };

  /** A cookie header for a member holding `level`, signed with the test secret. */
  const sessionFor = async (level) => {
    const { mintSession } = await import(
      new URL('../donovan-legal-site/functions/_lib/member-auth.js', import.meta.url)
    );
    return (await mintSession(level, env)).split(';')[0];
  };

  for (const slug of Object.keys(TIERS)) {
    const Level = slug.charAt(0).toUpperCase() + slug.slice(1);

    test(`functions/${slug}/_middleware.js delegates to memberGuard`, () => {
      // Kept from Ticket B, and kept for the same reason: it is not sufficient (see
      // the header), but it catches an accidental revert to the Basic gate cheaply.
      const src = readFileSync(join(SITE, 'functions', slug, '_middleware.js'), 'utf8');
      assert.match(src, /from ["']\.\.\/_lib\/member-auth\.js["']/);
      assert.match(src, new RegExp(`memberGuard\\(["']${slug}["']\\)`));
      assert.doesNotMatch(src, /tier-auth/, 'the Basic gate must not linger alongside the new one');
    });

    test(`/${slug}/ fails CLOSED (503) when the signing secret is unset`, async () => {
      // UNCHANGED IN SPIRIT from the Basic-auth original. An environment that cannot
      // verify a session cannot make an access decision, so it serves nothing — and
      // it must not degrade to a redirect, which would read as an ordinary signed-out
      // member and leave a missing Pages variable invisible.
      const { res, nextCalled } = await invoke(await guardFor(slug), { env: {} });
      assert.equal(res.status, 503, 'unconfigured level must 503, never fall through to public');
      assert.equal(nextCalled, false, 'gated content must not be fetched');
      assert.doesNotMatch(await res.text(), /GATED MEMBER CONTENT/);
    });

    test(`/${slug}/ redirects an unauthenticated request to its public page`, async () => {
      // Replaces the 401 + `Basic realm=` challenge. There is no browser credential
      // prompt any more, so an anonymous visitor is sent to the public marketing page
      // for the level they asked for — which already exists and already carries the
      // description and the consultation CTA. No dead end.
      const { res, nextCalled } = await invoke(await guardFor(slug), { env });
      assert.equal(res.status, 302);
      assert.match(res.headers.get('Location') || '', new RegExp(`/membership-${slug}`));
      assert.equal(nextCalled, false, 'gated content must not be fetched');
    });

    test(`/${slug}/ rejects a forged session`, async () => {
      // Replaces "rejects wrong credentials". The modern equivalent of a wrong
      // password is a cookie whose signature does not verify.
      const good = await sessionFor(Level);
      const [name, value] = good.split('=');
      const [body, sig] = value.split('.');
      const forged = `${name}=${body}.${'a'.repeat(sig.length)}`;
      const { res, nextCalled } = await invoke(await guardFor(slug), { env, cookie: forged });
      assert.equal(res.status, 302);
      assert.equal(nextCalled, false);
    });

    // The positive arm. Without it, "every request is refused" would also satisfy
    // the three tests above — a gate that refuses everyone proves nothing about
    // whether it is still a working gate.
    test(`/${slug}/ serves the member content to a valid ${Level} session`, async () => {
      const { res, nextCalled } = await invoke(await guardFor(slug), {
        env,
        cookie: await sessionFor(Level),
      });
      assert.equal(res.status, 200);
      assert.equal(nextCalled, true);
      assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
    });

    // Per-level independence: one level's session must not open another's. There is
    // no hierarchy and no master credential — the same property the per-tier passwd
    // files gave the Basic gate, preserved on the new credential.
    test(`/${slug}/ session does not open a different level`, async () => {
      const other = Object.keys(TIERS).find((s) => s !== slug);
      const { res, nextCalled } = await invoke(await guardFor(other), {
        env,
        cookie: await sessionFor(Level),
      });
      assert.equal(res.status, 302);
      assert.equal(nextCalled, false);
    });
  }

  // The gated portal index pages stay noindex and stay where they are. If a
  // future edit moved marketing copy into them, or dropped the noindex, the
  // private area would start competing for the same queries it is hidden from.
  for (const slug of Object.keys(TIERS)) {
    test(`/${slug}/index.html remains the noindex member portal`, () => {
      const doc = new JSDOM(readFileSync(join(SITE, slug, 'index.html'), 'utf8')).window.document;
      const robots = doc.querySelector('meta[name="robots"]');
      assert.ok(robots && /noindex/.test(robots.getAttribute('content')), 'portal must stay noindex');
    });
  }
});

describe('JORDAN-MEMBERS-MARKETING — discoverability (2026-09-05: the tiers are retired)', () => {
  // The four marketing pages and the tier roots are no longer offered. The pages
  // stay on disk for now (the gate still redirects to them and this suite still
  // drives it), but they are out of the sitemap and engagement.html no longer
  // sells the tiers. Phase 2 removes the gate, the pages and this suite together.
  test('sitemap.xml lists none of the marketing pages or the gated tier roots', () => {
    const sitemap = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
    for (const slug of Object.keys(TIERS)) {
      assert.ok(!sitemap.includes(`<loc>https://www.donovan.law/membership-${slug}</loc>`), `retired marketing page membership-${slug} is still in the sitemap`);
      assert.ok(!sitemap.includes(`donovan.law/${slug}`), `gated /${slug}/ must not be in the sitemap`);
    }
  });

  test('engagement.html no longer carries tier cards, and describes how the firm engages', () => {
    const doc = new JSDOM(readFileSync(join(SITE, 'engagement.html'), 'utf8')).window.document;
    assert.equal(doc.querySelectorAll('.tier-body a.tier-learn').length, 0, 'a tier card survived the retirement');
    assert.match(doc.body.textContent, /How We Engage/i);
  });

  test('the retired pages 301 to the engagement page and the portal (edge redirects)', () => {
    const redirects = readFileSync(join(SITE, '_redirects'), 'utf8');
    for (const slug of Object.keys(TIERS)) {
      assert.match(redirects, new RegExp(`^/membership-${slug}(\\.html)?\\s+/engagement\\.html\\s+301`, 'm'), `no redirect for membership-${slug}`);
    }
    assert.match(redirects, /^\/members\/\*\s+\/client-portal\.html\s+301/m);
  });
});
