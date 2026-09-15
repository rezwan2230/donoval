// JAY-TRACKING-D1 — per-deployment tag configuration, and the two phone paths.
//
// Two things are under test and they share a theme: something that was baked in
// becoming something that is configured, and something that was silent becoming
// something that is counted.
//
//   1. The GA4 / Ads / Meta identifiers move from literals in a browser file to
//      env-driven meta tags. The test that matters is the SECOND TENANT one —
//      a different firm's deployment must report to that firm's accounts and
//      never to Donovan's.
//   2. `tel_click` and the server-side `message_taken`, which close scenarios
//      3 and 4 (declined the modal, wanted a person).

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * jsdom cannot navigate to `tel:` and logs a jsdomError when a click on one is
 * left un-prevented — which is exactly the behaviour under test (we must never
 * block the dialler). Swallowing it keeps CI output readable; real console
 * output from the code under test is unaffected because the tracker never logs.
 */
const quiet = () => new VirtualConsole();

import { resolveTagConfig, isOverridden, META_NAMES }
  from '../donovan-legal-site/js/analytics/config.js';
import {
  DEFAULT_TAG_CONFIG, buildCatalogue, destinationsFor,
  BOOKING_CONFIRMED, MESSAGE_TAKEN, TEL_CLICK, CATALOGUE,
} from '../donovan-legal-site/js/analytics/events.js';
import { createTracker } from '../donovan-legal-site/js/analytics/tracker.js';
import { analyticsTag, tagConfigTags, analyticsEnabled }
  from '../donovan-legal-site/functions/_lib/analytics-inject.js';

const ORIGIN = 'https://www.donovan.law';

/** A jsdom window whose head carries the given meta tags. */
function mount({ metas = {}, url = `${ORIGIN}/`, body = '' } = {}) {
  const head = Object.entries(metas)
    .map(([n, c]) => `<meta name="${n}" content="${c}">`).join('');
  const dom = new JSDOM(
    `<!doctype html><html><head><title>T</title>${head}</head><body>${body}</body></html>`,
    { url, virtualConsole: quiet() },
  );
  const win = dom.window;
  const gtagCalls = [];
  const fbqCalls = [];
  win.gtag = (...a) => gtagCalls.push(a);
  win.fbq = (...a) => fbqCalls.push(a);
  return { win, doc: win.document, gtagCalls, fbqCalls };
}

const ga4Named = (calls, n) => calls.filter(([k, name]) => k === 'event' && name === n);
const adsCalls = (calls) => calls.filter(([k, n]) => k === 'event' && n === 'conversion');

// ── Defaults ────────────────────────────────────────────────────────────────

describe('resolveTagConfig — Donovan is the default, not the only option', () => {
  test('an unconfigured page keeps every Donovan identifier', () => {
    const { win } = mount();
    assert.deepEqual(resolveTagConfig(win), {
      ga4: DEFAULT_TAG_CONFIG.ga4,
      ads: DEFAULT_TAG_CONFIG.ads,
      meta: DEFAULT_TAG_CONFIG.meta,
      clarity: DEFAULT_TAG_CONFIG.clarity,
      labels: { ...DEFAULT_TAG_CONFIG.labels },
    });
  });

  test('the current production deployment is unchanged (regression control)', () => {
    // The whole refactor must be a no-op for Donovan until env vars are set.
    const { win } = mount();
    const cfg = resolveTagConfig(win);
    assert.equal(cfg.ga4, 'G-187CYLV2YX');
    assert.equal(cfg.ads, 'AW-18269868294');
    assert.equal(cfg.meta, '1769060274465061');
    assert.equal(isOverridden(cfg), false);
    assert.deepEqual(buildCatalogue(cfg), CATALOGUE);
  });

  test('no document at all resolves to defaults rather than throwing', () => {
    for (const w of [undefined, null, {}, { document: null }]) {
      assert.equal(resolveTagConfig(w).ga4, DEFAULT_TAG_CONFIG.ga4);
    }
  });
});

// ── The point of the exercise ───────────────────────────────────────────────

describe('a second tenant reports to its own accounts', () => {
  const OTHER = {
    [META_NAMES.ga4]: 'G-ZZZZZZZZZZ',
    [META_NAMES.ads]: 'AW-99999999',
    [META_NAMES.meta]: '5550001112223',
    [META_NAMES.labelPrefix + 'booking_confirmed']: 'OtherFirmLabelAAA',
  };

  test('all three identifiers are taken from the page', () => {
    const cfg = resolveTagConfig(mount({ metas: OTHER }).win);
    assert.equal(cfg.ga4, 'G-ZZZZZZZZZZ');
    assert.equal(cfg.ads, 'AW-99999999');
    assert.equal(cfg.meta, '5550001112223');
    assert.equal(isOverridden(cfg), true);
  });

  test("NOTHING Donovan's is left in the routing table", () => {
    // The failure this exists to prevent: a second firm's site quietly filing
    // conversions into Donovan's Ads account.
    const cat = buildCatalogue(resolveTagConfig(mount({ metas: OTHER }).win));
    const wire = JSON.stringify(cat);
    assert.ok(!wire.includes(DEFAULT_TAG_CONFIG.ads), 'Donovan ads account leaked');
    for (const label of Object.values(DEFAULT_TAG_CONFIG.labels)) {
      assert.ok(!wire.includes(label), `Donovan label ${label} leaked`);
    }
  });

  test('overriding labels REPLACES rather than merges', () => {
    // A merge would keep Donovan's three unset labels alongside the new firm's
    // one — reporting three of four conversions into the wrong account.
    const cfg = resolveTagConfig(mount({ metas: OTHER }).win);
    assert.deepEqual(Object.keys(cfg.labels), ['booking_confirmed']);
  });

  test('an event with no configured label still reaches GA4, just not Ads', () => {
    const cat = buildCatalogue(resolveTagConfig(mount({ metas: OTHER }).win));
    assert.equal(cat[MESSAGE_TAKEN].ads, null);
    assert.equal(cat[MESSAGE_TAKEN].ga4, MESSAGE_TAKEN);
    // Never the string "AW-99999999/undefined", which Google accepts and drops.
    assert.ok(!String(cat[MESSAGE_TAKEN].ads).includes('undefined'));
  });

  test('the tracker actually sends to the overridden account', () => {
    const ctx = mount({ metas: OTHER });
    createTracker({ win: ctx.win, doc: ctx.doc }).start();
    const pv = ga4Named(ctx.gtagCalls, 'page_view')[0];
    assert.equal(pv[2].send_to, 'G-ZZZZZZZZZZ');
  });

  test('partial configuration keeps the rest of the defaults', () => {
    const cfg = resolveTagConfig(mount({ metas: { [META_NAMES.ga4]: 'G-PARTIAL01' } }).win);
    assert.equal(cfg.ga4, 'G-PARTIAL01');
    assert.equal(cfg.ads, DEFAULT_TAG_CONFIG.ads, 'unset fields keep defaults');
  });
});

// ── Malformed configuration ─────────────────────────────────────────────────

describe('a mis-set variable falls back rather than sending nowhere', () => {
  test('a malformed id is rejected in favour of the known-good default', () => {
    // The realistic accident: a trailing newline from a secrets pipeline, or a
    // copied value with the quotes still attached. Honouring it would send every
    // conversion for the life of the deployment to an account that does not exist,
    // with no error anywhere.
    for (const bad of ['G-', 'nonsense', '"G-ABC123"', 'AW-18269868294', '<script>']) {
      const cfg = resolveTagConfig(mount({ metas: { [META_NAMES.ga4]: bad } }).win);
      assert.equal(cfg.ga4, DEFAULT_TAG_CONFIG.ga4, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test('surrounding whitespace is tolerated, not rejected', () => {
    const cfg = resolveTagConfig(mount({ metas: { [META_NAMES.ga4]: '  G-GOOD12345  ' } }).win);
    assert.equal(cfg.ga4, 'G-GOOD12345');
  });

  test('a GA4 id in the Ads slot is refused', () => {
    const cfg = resolveTagConfig(mount({ metas: { [META_NAMES.ads]: 'G-187CYLV2YX' } }).win);
    assert.equal(cfg.ads, DEFAULT_TAG_CONFIG.ads);
  });

  test('a malformed label is dropped, not emitted', () => {
    const metas = { [META_NAMES.labelPrefix + 'call_started']: 'no spaces allowed!' };
    const cfg = resolveTagConfig(mount({ metas }).win);
    assert.equal(cfg.labels.call_started, undefined);
    assert.equal(buildCatalogue(cfg).call_started.ads, null);
  });
});

// ── The edge half ───────────────────────────────────────────────────────────

describe('tagConfigTags — what the edge emits', () => {
  test('nothing when nothing is configured, so production is untouched', () => {
    assert.equal(tagConfigTags({}), '');
    assert.equal(tagConfigTags(undefined), '');
    assert.equal(tagConfigTags({ ANALYTICS: 'on' }), '');
  });

  test('one meta tag per configured variable', () => {
    const out = tagConfigTags({ GA4_MEASUREMENT_ID: 'G-ABC12345', ADS_CONVERSION_ID: 'AW-1234567' });
    assert.ok(out.includes('<meta name="dl:ga4" content="G-ABC12345">'));
    assert.ok(out.includes('<meta name="dl:ads" content="AW-1234567">'));
    assert.ok(!out.includes('dl:meta-dataset'), 'unset vars emit nothing');
  });

  test('a stray quote cannot break out of the attribute', () => {
    // Not a request-borne XSS vector — it comes from our own dashboard — but a
    // typo here would corrupt the <head> of every page on the site.
    const out = tagConfigTags({ GA4_MEASUREMENT_ID: 'G-A" onload="alert(1)' });
    assert.ok(out.includes('&quot;'), 'the quote must be escaped');
    // Parse it rather than string-match: the literal text "onload=" survives
    // inside the escaped value, harmlessly. What matters is that no live
    // attribute exists on the element.
    const dom = new JSDOM(`<!doctype html><html><head>${out}</head><body></body></html>`);
    const el = dom.window.document.querySelector('meta[name="dl:ga4"]');
    assert.ok(el, 'the tag should still parse');
    assert.equal(el.getAttribute('onload'), null, 'must not emit a live attribute');
    assert.equal(el.getAttribute('content'), 'G-A" onload="alert(1)');
    // And the malformed value is then refused by the reader anyway.
    assert.equal(resolveTagConfig(dom.window).ga4, DEFAULT_TAG_CONFIG.ga4);
  });

  test('config rides along with the analytics tag, and only when analytics is on', () => {
    const env = { ANALYTICS: 'on', GA4_MEASUREMENT_ID: 'G-ABC12345' };
    assert.ok(analyticsTag(env).includes('dl:ga4'));
    assert.equal(analyticsTag({ GA4_MEASUREMENT_ID: 'G-ABC12345' }), '',
      'no config leaks onto a page with analytics off');
  });

  test('the injected tags round-trip through a real parse', () => {
    // End to end: what the edge writes is what the browser reads.
    const env = { ANALYTICS: 'on', GA4_MEASUREMENT_ID: 'G-ROUND1234', DL_LABEL_CALL_STARTED: 'RoundTripLbl' };
    const dom = new JSDOM(`<!doctype html><html><head>${tagConfigTags(env)}</head><body></body></html>`);
    const cfg = resolveTagConfig(dom.window);
    assert.equal(cfg.ga4, 'G-ROUND1234');
    assert.equal(cfg.labels.call_started, 'RoundTripLbl');
  });

  test('analyticsEnabled is untouched by any of this', () => {
    assert.equal(analyticsEnabled({ ANALYTICS: 'on' }), true);
    assert.equal(analyticsEnabled({}), false);
  });
});

// ── Scenario 3: phone intent on the web ─────────────────────────────────────

describe('tel_click — the attributable half of "I want to speak to someone"', () => {
  const BODY = '<a id="a" href="tel:+15616666022">Call</a><a id="b" href="/book">Book</a>';
  let ctx;
  beforeEach(() => { ctx = mount({ body: BODY }); });

  const clickEl = (ctx, id) => {
    const el = ctx.doc.getElementById(id);
    el.dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  test('a tel: tap is reported', () => {
    createTracker(ctx).start();
    clickEl(ctx, 'a');
    assert.equal(ga4Named(ctx.gtagCalls, TEL_CLICK).length, 1);
  });

  test('it carries the attribution that makes it worth having', () => {
    const c = mount({ body: BODY, url: `${ORIGIN}/?gclid=ABC123` });
    createTracker(c).start();
    clickEl(c, 'a');
    // The click id is the entire reason to instrument the tap rather than rely
    // on the untrackable call that follows it.
    assert.equal(ga4Named(c.gtagCalls, TEL_CLICK)[0][2].gclid, 'ABC123');
  });

  test('an ordinary link is not reported', () => {
    createTracker(ctx).start();
    clickEl(ctx, 'b');
    assert.equal(ga4Named(ctx.gtagCalls, TEL_CLICK).length, 0);
  });

  test('a tap on a child of the link still counts', () => {
    const c = mount({ body: '<a id="a" href="tel:+15616666022"><span id="s">Call</span></a>' });
    createTracker(c).start();
    clickEl(c, 's');
    assert.equal(ga4Named(c.gtagCalls, TEL_CLICK).length, 1);
  });

  test('a double tap is one intent, not two', () => {
    createTracker(ctx).start();
    clickEl(ctx, 'a');
    clickEl(ctx, 'a');
    assert.equal(ga4Named(ctx.gtagCalls, TEL_CLICK).length, 1);
  });

  test('it is NOT sent to Ads or Meta — no action exists for it', () => {
    createTracker(ctx).start();
    clickEl(ctx, 'a');
    assert.equal(adsCalls(ctx.gtagCalls).length, 0);
    assert.equal(destinationsFor(TEL_CLICK), null, 'must stay out of the catalogue');
    assert.equal(ctx.fbqCalls.filter(([k, n]) => k === 'track' && n === 'Contact').length, 0,
      'would collide with call_started');
  });

  test('the link still works — the dialler is never blocked', () => {
    createTracker(ctx).start();
    const el = ctx.doc.getElementById('a');
    const ev = new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, false,
      'making a client wait to reach a lawyer is the wrong trade');
  });

  test('a link added by a later soft navigation is still caught', () => {
    // Delegation, not per-element binding: the call bar re-renders on every swap.
    createTracker(ctx).start();
    ctx.doc.body.innerHTML = '<a id="late" href="tel:+15616666022">Call</a>';
    const el = ctx.doc.getElementById('late');
    el.dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(ga4Named(ctx.gtagCalls, TEL_CLICK).length, 1);
  });

  test('stop() detaches it', () => {
    const t = createTracker(ctx);
    t.start();
    t.stop();
    clickEl(ctx, 'a');
    assert.equal(ga4Named(ctx.gtagCalls, TEL_CLICK).length, 0);
  });
});

// ── Catalogue integrity ─────────────────────────────────────────────────────

describe('the four conversions are still intact', () => {
  test('every one keeps a GA4 name, an Ads destination and a Meta event', () => {
    for (const [name, d] of Object.entries(CATALOGUE)) {
      assert.equal(d.ga4, name);
      assert.ok(d.ads.startsWith('AW-'), `${name} lost its Ads destination`);
      assert.ok(d.meta, `${name} lost its Meta event`);
    }
  });

  test('booking is still the highest-priority Meta event', () => {
    assert.equal(CATALOGUE[BOOKING_CONFIRMED].meta, 'Schedule');
  });

  test('message_taken is in the catalogue and now has a firing path', () => {
    // It was fully configured and never fired by anything — a dead conversion
    // action, which Google reports as a real zero rather than as missing.
    assert.ok(CATALOGUE[MESSAGE_TAKEN]);
    assert.equal(CATALOGUE[MESSAGE_TAKEN].meta, 'SubmitApplication');
  });
});
