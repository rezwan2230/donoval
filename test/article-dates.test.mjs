// JAY-SEO-E3 — `datePublished` on the blog Article schema.
//
// WHY THIS TEST EXISTS AND WHAT IT REFUSES TO ALLOW
//
// The marketing audit asked for publication dates and offered a fallback: "if
// unknown, use the file modification date as a proxy." That fallback would have
// dated every article to 2026-08-08 — the day of one accessibility commit that
// touched 88 files. Forty tax articles all claiming to be published the same day
// is a false statement on attorney advertising, and a spam signal to Google.
//
// So the rule is: the date in the structured data MUST equal the date already
// printed on the page. Not derived, not inferred, not a file timestamp. If a post
// carries no visible date, it gets no `datePublished` at all — a missing rich
// result is recoverable, a wrong date on legal commentary is not.
//
// Every assertion below enforces that rule rather than merely counting dates.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (f) => readFileSync(new URL(f, SITE), 'utf8');
const POSTS = readdirSync(new URL('.', SITE))
  .filter((f) => f.startsWith('blog-') && f.endsWith('.html'))
  .sort();

/** The bound used for "not in the future". Fixed rather than `new Date()` so the
 *  suite is deterministic; raise it if the repo is still alive in 2027. */
const TODAY_BOUND = '2026-09-04';  // raised for the six posts published 2026-09-04 (OZ 2.0, Kwong after July 10, easement program ended, §163(j) withdrawal, drop-and-swap, §1041)

const MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

/** The date the page PRINTS, in the article-meta byline. The only source of truth. */
function bylineDate(html) {
  const m = html.match(
    /<span>(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (20\d{2})<\/span>/,
  );
  if (!m) return null;
  return `${m[3]}-${String(MONTHS[m[1]]).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}

/** The Article JSON-LD block, parsed. */
function articleSchema(html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const o = JSON.parse(m[1]);
      if (o && o['@type'] === 'Article') return o;
    } catch { /* a non-Article or malformed block is not our concern here */ }
  }
  return null;
}

describe('the corpus is what we think it is (controls)', () => {
  test('there are 55 blog posts and every one carries Article schema', () => {
    assert.equal(POSTS.length, 55);
    for (const f of POSTS) {
      assert.ok(articleSchema(read(f)), `${f} has no parseable Article schema`);
    }
  });

  test('47 posts print a date and 8 do not', () => {
    // If this drifts, someone has added or removed a byline and the split below
    // needs revisiting rather than the numbers being quietly updated.
    const withDate = POSTS.filter((f) => bylineDate(read(f)));
    assert.equal(withDate.length, 47);
    assert.equal(POSTS.length - withDate.length, 8);
  });

  test('3 of those 32 print a FUTURE date and are deliberately held back', () => {
    // A live content error, not ours: these articles display a date months ahead
    // of today. Publishing it as structured data would be worse than publishing
    // nothing. They get their datePublished when the visible date is corrected.
    const future = POSTS.filter((f) => {
      const d = bylineDate(read(f));
      return d && d > TODAY_BOUND;
    });
    assert.equal(future.length, 3, `expected 3 future-dated posts, got ${future.join(', ')}`);
    for (const f of future) {
      assert.equal(articleSchema(read(f)).datePublished, undefined,
        `${f} prints a future date and must not claim it in schema`);
    }
  });

  test('the 8 without a date are exactly the Controversy Roadmap series', () => {
    const without = POSTS.filter((f) => !bylineDate(read(f)));
    assert.ok(
      without.every((f) => f.startsWith('blog-controversy-roadmap-')),
      `unexpected undated post: ${without.filter((f) => !f.startsWith('blog-controversy-roadmap-'))}`,
    );
  });
});

describe('datePublished equals the date the page prints', () => {
  test('every post with a usable byline has a matching datePublished', () => {
    // THE test. A mismatch here means the structured data claims a different
    // date from the one a human reads on the page.
    //
    // Future-dated bylines are excluded and covered by their own test above —
    // those pages carry a live content error and get no date until it is fixed.
    let checked = 0;
    for (const f of POSTS) {
      const html = read(f);
      const byline = bylineDate(html);
      if (!byline || byline > TODAY_BOUND) continue;
      assert.equal(articleSchema(html).datePublished, byline,
        `${f}: page prints ${byline}, schema says ${articleSchema(html).datePublished}`);
      checked += 1;
    }
    // Vacuity guard: if the byline regex ever stops matching, this loop would
    // pass by checking nothing at all.
    assert.equal(checked, 44, `expected to verify 44 posts, verified ${checked}`);
  });

  test('no post without a printed date has a datePublished', () => {
    // The refusal. These would have to be invented, so they stay absent.
    for (const f of POSTS) {
      const html = read(f);
      if (bylineDate(html)) continue;
      assert.equal(articleSchema(html).datePublished, undefined,
        `${f} has no visible date, so it must not claim one`);
    }
  });

  test('nothing is dated 2026-08-08 — the file-mtime trap', () => {
    // That is the date the accessibility commit touched 88 files. If several
    // posts ever share it, someone has used the file timestamp as a proxy.
    const counts = {};
    for (const f of POSTS) {
      const d = articleSchema(read(f)).datePublished;
      if (d) counts[d] = (counts[d] || 0) + 1;
    }
    assert.equal(counts['2026-08-08'], undefined,
      'a post is dated to the day of a bulk edit — almost certainly a file timestamp');
  });

  test('the dates are not all one day — the bulk-import shape', () => {
    // An earlier version of this test capped a shared date at three and failed:
    // 16 posts genuinely print 9 June and 7 print 8 June, because the firm
    // seeded the blog with a content batch at launch. That is legitimate, and
    // the byline-match test above is what actually proves provenance.
    //
    // What is NOT legitimate is EVERY post sharing one date, which is what a
    // file-timestamp proxy would produce. That is what this now guards.
    const counts = {};
    let dated = 0;
    for (const f of POSTS) {
      const d = articleSchema(read(f)).datePublished;
      if (d) { counts[d] = (counts[d] || 0) + 1; dated += 1; }
    }
    assert.ok(Object.keys(counts).length >= 5,
      `only ${Object.keys(counts).length} distinct dates across ${dated} posts — suspicious`);
    for (const [d, n] of Object.entries(counts)) {
      assert.ok(n < dated, `all ${n} dated posts share ${d} — that is a timestamp, not a byline`);
    }
  });
});

describe('the dates are well-formed and plausible', () => {
  test('every datePublished is a bare ISO date, with no invented time', () => {
    // Date-only is deliberate: we know the day, not the hour. Appending
    // T09:00:00 would be inventing precision we do not have.
    for (const f of POSTS) {
      const d = articleSchema(read(f)).datePublished;
      if (!d) continue;
      assert.match(d, /^20\d{2}-\d{2}-\d{2}$/, `${f}: ${d} is not a bare ISO date`);
    }
  });

  test('no date is in the future or absurdly old', () => {
    for (const f of POSTS) {
      const d = articleSchema(read(f)).datePublished;
      if (!d) continue;
      assert.ok(d >= '2020-01-01', `${f}: ${d} predates the firm`);
      // A published date cannot be in the future. This bound only ever becomes
      // MORE true as time passes, so it cannot start failing on its own — but it
      // will fail loudly if anyone re-adds a future-dated post.
      assert.ok(d <= TODAY_BOUND, `${f}: ${d} is in the future — a page cannot be published yet`);
    }
  });

  test('dateModified is NOT set anywhere', () => {
    // We know when these were published; we do not know when they were last
    // edited in any meaningful sense. The a11y sweep touched every file without
    // changing a word of content. Claiming that as a modification date would be
    // the same error as inventing the publication date.
    for (const f of POSTS) {
      assert.equal(articleSchema(read(f)).dateModified, undefined,
        `${f} claims a dateModified we cannot substantiate`);
    }
  });
});

describe('nothing else in the schema changed', () => {
  test('headline, url, author and publisher all survive', () => {
    for (const f of POSTS) {
      const s = articleSchema(read(f));
      assert.ok(s.headline, `${f} lost its headline`);
      assert.ok(s.url && s.url.startsWith('https://www.donovan.law/'), `${f} lost its url`);
      assert.ok(s.author && s.author.name, `${f} lost its author`);
      assert.ok(s.publisher && s.publisher.name, `${f} lost its publisher`);
    }
  });

  test('the JSON-LD still parses on every post (no trailing comma damage)', () => {
    // The insertion was a string replace into compact JSON. If it went wrong the
    // block would fail to parse, and articleSchema() would return null.
    for (const f of POSTS) {
      assert.ok(articleSchema(read(f)), `${f}: Article JSON-LD no longer parses`);
    }
  });
});
