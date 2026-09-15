// The analytics tracker, under jsdom (JAY-TRACKING-A1).
//
// What this suite is really guarding is a class of failure that produces no
// error anywhere: an event that is counted twice, or not at all. Both look
// exactly like healthy silence in a browser console, and both corrupt the
// number an ad platform bids against. So every guard in the tracker has a test
// that makes it fail loudly here instead of quietly in production.
//
// The tracker takes its window by injection precisely so this can run in CI. A
// tracker only exercisable in a real browser would be a tracker nobody
// exercised.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createTracker } from '../donovan-legal-site/js/analytics/tracker.js';
import { CATALOGUE, BOOKING_CONFIRMED, CALL_STARTED, QUALIFIER_SUBMITTED }
  from '../donovan-legal-site/js/analytics/events.js';

const ORIGIN = 'https://www.donovan.law';

/** A jsdom window with recording stand-ins for the two vendor tags. */
function mount({ url = `${ORIGIN}/`, withVendors = true } = {}) {
  const dom = new JSDOM('<!doctype html><title>Donovan Legal</title><body></body>', { url });
  const win = dom.window;
  const gtagCalls = [];
  const fbqCalls = [];
  if (withVendors) {
    win.gtag = (...args) => gtagCalls.push(args);
    win.fbq = (...args) => fbqCalls.push(args);
  }
  return { win, doc: win.document, gtagCalls, fbqCalls };
}

const adsCalls   = (calls) => calls.filter(([kind, name]) => kind === 'event' && name === 'conversion');
const ga4Named   = (calls, name) => calls.filter(([kind, n]) => kind === 'event' && n === name);
const fbqTracked = (calls, name) => calls.filter(([kind, n]) => kind === 'track' && n === name);

describe('page views', () => {
  let ctx;
  beforeEach(() => { ctx = mount(); });

  test('the initial load reports one page view to both platforms', () => {
    createTracker(ctx).start();
    assert.equal(ga4Named(ctx.gtagCalls, 'page_view').length, 1);
    assert.equal(fbqTracked(ctx.fbqCalls, 'PageView').length, 1);
  });

  test('each router swap reports another', () => {
    const t = createTracker(ctx).start();
    for (const url of ['/real-estate', '/book']) {
      ctx.doc.dispatchEvent(new ctx.win.CustomEvent('perch:content-swapped', { detail: { url } }));
    }
    // Three navigations, three page views — the whole reason this module exists.
    assert.equal(ga4Named(ctx.gtagCalls, 'page_view').length, 3);
    assert.equal(fbqTracked(ctx.fbqCalls, 'PageView').length, 3);
    assert.equal(t.buffer.filter((e) => e.name === 'page_view').length, 3);
  });

  test('the router dispatching BOTH event names for one navigation counts once', () => {
    // announce() picks perch:content-swapped or dl:content-swapped by phase. A
    // document that saw both must not report two page views.
    createTracker(ctx).start();
    ctx.doc.dispatchEvent(new ctx.win.CustomEvent('perch:content-swapped', { detail: { url: '/real-estate' } }));
    ctx.doc.dispatchEvent(new ctx.win.CustomEvent('dl:content-swapped',    { detail: { url: '/real-estate' } }));
    assert.equal(ga4Named(ctx.gtagCalls, 'page_view').length, 2); // initial + one swap
  });

  test("the router's documented one-time double run counts once", () => {
    createTracker(ctx).start();
    const fire = () => ctx.doc.dispatchEvent(
      new ctx.win.CustomEvent('perch:content-swapped', { detail: { url: '/book' } }));
    fire(); fire();
    assert.equal(ga4Named(ctx.gtagCalls, 'page_view').length, 2);
  });

  test('navigating away and back counts both visits', () => {
    createTracker(ctx).start();
    for (const url of ['/book', '/real-estate', '/book']) {
      ctx.doc.dispatchEvent(new ctx.win.CustomEvent('perch:content-swapped', { detail: { url } }));
    }
    assert.equal(ga4Named(ctx.gtagCalls, 'page_view').length, 4);
  });

  test('carries the resolved URL and the document title', () => {
    createTracker(ctx).start();
    ctx.doc.dispatchEvent(new ctx.win.CustomEvent('perch:content-swapped', { detail: { url: '/real-estate' } }));
    const [, , params] = ga4Named(ctx.gtagCalls, 'page_view').at(-1);
    assert.equal(params.page_location, `${ORIGIN}/real-estate`);
    assert.equal(params.page_title, 'Donovan Legal');
  });

  test('a page view is not a Google Ads conversion', () => {
    createTracker(ctx).start();
    assert.equal(adsCalls(ctx.gtagCalls).length, 0);
  });
});

describe('call_started', () => {
  test('fires on the call-start the voice modules already dispatch', () => {
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));

    assert.equal(ga4Named(ctx.gtagCalls, CALL_STARTED).length, 1);
    assert.equal(fbqTracked(ctx.fbqCalls, CATALOGUE[CALL_STARTED].meta).length, 1);
    assert.equal(adsCalls(ctx.gtagCalls)[0][2].send_to, CATALOGUE[CALL_STARTED].ads);
  });

  test('two dispatchers announcing one call still counts one', () => {
    // js/perch/call.js and js/donovan-widget.js both dispatch this. A document
    // that loaded both would otherwise report two calls for one conversation.
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    assert.equal(ga4Named(ctx.gtagCalls, CALL_STARTED).length, 1);
  });

  test('a genuine second call in the same session counts again', () => {
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-end'));
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    assert.equal(ga4Named(ctx.gtagCalls, CALL_STARTED).length, 2);
  });
});

describe('booking_confirmed', () => {
  test('fires on the same-origin postMessage the booking widget already sends', () => {
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', {
      data: { __perchBooking: 'confirmed', call_id: 'c1' }, origin: ORIGIN,
    }));

    assert.equal(ga4Named(ctx.gtagCalls, BOOKING_CONFIRMED).length, 1);
    assert.equal(adsCalls(ctx.gtagCalls)[0][2].send_to, CATALOGUE[BOOKING_CONFIRMED].ads);
    assert.equal(fbqTracked(ctx.fbqCalls, 'Schedule').length, 1);
    assert.equal(ga4Named(ctx.gtagCalls, BOOKING_CONFIRMED)[0][2].call_id, 'c1');
  });

  test('a message from another origin is ignored', () => {
    // Same check js/perch/command-channel.js makes, for the same reason
    // (security finding F-01): a message from elsewhere is not ours.
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', {
      data: { __perchBooking: 'confirmed' }, origin: 'https://evil.example',
    }));
    assert.equal(ga4Named(ctx.gtagCalls, BOOKING_CONFIRMED).length, 0);
  });

  test('unrelated same-origin messages are ignored', () => {
    const ctx = mount();
    createTracker(ctx).start();
    for (const data of [null, 'hello', { __perchBookingAck: true, action: 'prefill' }, { __perchBooking: 'cancelled' }]) {
      ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', { data, origin: ORIGIN }));
    }
    assert.equal(ga4Named(ctx.gtagCalls, BOOKING_CONFIRMED).length, 0);
  });
});

describe('qualifier_submitted', () => {
  test('fires on the qualifier dispatch and carries the matter', () => {
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('dl:qualifier-submitted', { detail: { matter: 'tax' } }));

    assert.equal(ga4Named(ctx.gtagCalls, QUALIFIER_SUBMITTED).length, 1);
    assert.equal(ga4Named(ctx.gtagCalls, QUALIFIER_SUBMITTED)[0][2].matter, 'tax');
    assert.equal(fbqTracked(ctx.fbqCalls, 'Lead').length, 1);
  });
});

describe('deduplication ids', () => {
  test('the Meta eventID matches the id sent to GA4 and Google Ads', () => {
    // This is what stops PR C's server-side copy being counted as a second
    // conversion. If these three ever diverge, every booking is worth double.
    const ctx = mount();
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));

    const ga4Id = ga4Named(ctx.gtagCalls, CALL_STARTED)[0][2].event_id;
    const adsId = adsCalls(ctx.gtagCalls)[0][2].transaction_id;
    const fbqId = fbqTracked(ctx.fbqCalls, 'Contact')[0][3].eventID;

    assert.ok(ga4Id);
    assert.equal(adsId, ga4Id);
    assert.equal(fbqId, ga4Id);
  });

  test('two occurrences get different ids', () => {
    const ctx = mount();
    const t = createTracker(ctx).start();
    t.emit(CALL_STARTED);
    t.emit(CALL_STARTED);
    assert.notEqual(t.buffer.at(-1).eventId, t.buffer.at(-2).eventId);
  });
});

describe('attribution', () => {
  test('the click id from the landing URL rides on every event', () => {
    const ctx = mount({ url: `${ORIGIN}/?gclid=ABC&utm_source=google` });
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));

    const params = ga4Named(ctx.gtagCalls, CALL_STARTED)[0][2];
    assert.equal(params.gclid, 'ABC');
    assert.equal(params.utm_source, 'google');
  });
});

describe('inertness — the property that makes this safe to merge before the CSP change', () => {
  test('with no vendor tags present, nothing throws and events still buffer', () => {
    // Until PR B allows the hosts, gtag and fbq cannot exist. The wiring must
    // still be observable, or PR B would be switching on something unverified.
    const ctx = mount({ withVendors: false });
    const t = createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    ctx.doc.dispatchEvent(new ctx.win.CustomEvent('perch:content-swapped', { detail: { url: '/book' } }));

    assert.deepEqual(t.buffer.map((e) => e.name), ['page_view', CALL_STARTED, 'page_view']);
  });

  test('a throwing vendor tag does not propagate into the page', () => {
    // An ad blocker can leave a stub that throws. A booking must still complete.
    const ctx = mount();
    ctx.win.gtag = () => { throw new Error('blocked'); };
    createTracker(ctx).start();
    assert.doesNotThrow(() => {
      ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', {
        data: { __perchBooking: 'confirmed' }, origin: ORIGIN,
      }));
    });
  });

  test('an unknown event name buffers but reaches no platform', () => {
    const ctx = mount();
    const t = createTracker(ctx).start();
    t.emit('not_a_real_event');
    assert.equal(adsCalls(ctx.gtagCalls).length, 0);
    assert.equal(ctx.fbqCalls.length, 1); // the initial PageView only
    assert.ok(t.buffer.some((e) => e.name === 'not_a_real_event'));
  });

  test('the buffer is bounded, so a long-lived tab cannot grow without bound', () => {
    const ctx = mount();
    const t = createTracker(ctx).start();
    for (let i = 0; i < 200; i += 1) t.emit(CALL_STARTED);
    assert.ok(t.buffer.length <= 50);
  });
});

describe('lifecycle', () => {
  test('start is idempotent — listeners are not doubled', () => {
    const ctx = mount();
    const t = createTracker(ctx);
    t.start(); t.start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    assert.equal(ga4Named(ctx.gtagCalls, CALL_STARTED).length, 1);
  });

  test('stop detaches every listener', () => {
    const ctx = mount();
    const t = createTracker(ctx).start();
    const before = ctx.gtagCalls.length;
    t.stop();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('vantage:call-start'));
    ctx.doc.dispatchEvent(new ctx.win.CustomEvent('perch:content-swapped', { detail: { url: '/x' } }));
    assert.equal(ctx.gtagCalls.length, before);
  });

  test('refuses to build without a window rather than failing later', () => {
    assert.throws(() => createTracker({}), TypeError);
  });
});
