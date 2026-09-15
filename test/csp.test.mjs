// CSP nonce delivery — the header and the body must agree, every request.
//
// The security property under test is NOT "a CSP exists". It is that the nonce
// in the Content-Security-Policy header equals the nonce stamped into the HTML
// on that same response. If those ever diverge the page is not merely
// unprotected, it is BROKEN — every inline <script> is refused. That is the
// stale-nonce defect this file guards (SHELDON-NOSTORE).
//
// ── WHAT THE HTMLRewriter STUB FAKES, AND WHAT IT THEREFORE CANNOT PROVE ──────
// Workers' HTMLRewriter is a streaming parser; the stub below is a regex over
// the buffered body that understands exactly one selector ('script') and the
// three element methods the NonceStamper actually calls. It is faithful enough
// to prove the STAMPING CONTRACT — every inline <script> gets this request's
// nonce, <script src> gets none — because that is a per-element decision the
// real rewriter makes identically.
//
// It CANNOT prove parser-level behaviour: malformed markup, <script> inside a
// comment or CDATA, or chunk-boundary handling. No assertion here claims to.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, buildCsp } from '../donovan-legal-site/functions/_middleware.js';

// ── Test doubles ─────────────────────────────────────────────────────────────

/** Thin stand-in for Workers' HTMLRewriter. See the caveat block above. */
class FakeHTMLRewriter {
  constructor() { this.handlers = []; }

  on(selector, handler) {
    this.handlers.push([selector, handler]);
    return this;
  }

  transform(res) {
    const handlers = this.handlers;
    const { readable, writable } = new TransformStream();
    (async () => {
      const html = await res.text();
      const rewritten = html.replace(/<script\b([^>]*)>/gi, (_full, rawAttrs) => {
        let attrs = rawAttrs;
        // Only the surface NonceStamper touches. Anything else is absent on
        // purpose so a future handler using it fails loudly here rather than
        // silently passing against a stub that invented the behaviour.
        const el = {
          hasAttribute: (n) => new RegExp(`\\s${n}(?=[\\s=]|$)`, 'i').test(attrs),
          getAttribute: (n) => {
            const m = attrs.match(new RegExp(`\\s${n}="([^"]*)"`, 'i'));
            return m ? m[1] : null;
          },
          setAttribute: (n, v) => { attrs = `${attrs} ${n}="${v}"`; },
        };
        for (const [selector, handler] of handlers) {
          if (selector === 'script') handler.element(el);
        }
        return `<script${attrs}>`;
      });
      const writer = writable.getWriter();
      await writer.write(new TextEncoder().encode(rewritten));
      await writer.close();
    })();
    return new Response(readable, res);
  }
}

/**
 * Drive the real onRequest against a stubbed downstream.
 *
 * `served` is what the Pages asset handler would return. `seenRequest` captures
 * what next() actually received, which is how the request-side validator strip
 * is asserted — the alternative would be trusting that it happened.
 */
async function run({
  url = 'https://www.donovan.law/perch.html',
  requestHeaders = {},
  body = '<html><head><script>window.x=1;</script><script src="/js/app.js"></script></head></html>',
  responseHeaders = { 'content-type': 'text/html; charset=utf-8' },
  status = 200,
} = {}) {
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = FakeHTMLRewriter;
  const captured = {};
  try {
    const request = new Request(url, { headers: requestHeaders });
    const res = await onRequest({
      request,
      next: async (...args) => {
        // `rebuilt` distinguishes "next() got a reconstructed request" from
        // "next() was called bare" — a test that only reads headers cannot tell
        // those apart, and the pass-through path is exactly that difference.
        captured.rebuilt = args.length > 0;
        captured.request = args[0] || request;
        return new Response(status === 304 ? null : body, { status, headers: responseHeaders });
      },
    });
    return {
      res,
      text: status === 304 ? '' : await res.text(),
      seenRequest: captured.request,
      rebuilt: captured.rebuilt,
      original: request,
    };
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

/** Pull the nonce out of the live policy string. */
function nonceFromCsp(csp) {
  const m = /'nonce-([a-f0-9]{32})'/.exec(csp || '');
  return m ? m[1] : null;
}

/** Pull the nonce off the first inline <script> in the rewritten body. */
function nonceFromBody(html) {
  const m = /<script(?![^>]*\bsrc=)[^>]*\bnonce="([a-f0-9]{32})"/i.exec(html);
  return m ? m[1] : null;
}

// ── The defect this file exists for ──────────────────────────────────────────

describe('SHELDON-NOSTORE — an HTML response cannot be cached into a stale nonce', () => {
  test('HTML is Cache-Control: no-store', async () => {
    const { res } = await run();
    assert.equal(
      res.headers.get('Cache-Control'),
      'no-store',
      'THE DEFECT: a stored HTML body outlives the CSP header issued with it'
    );
  });

  test('HTML carries no ETag or Last-Modified to revalidate against', async () => {
    const { res } = await run({
      responseHeaders: {
        'content-type': 'text/html; charset=utf-8',
        // What Pages actually attaches to a static HTML asset.
        etag: 'W/"5d8c72a5edda8d6a3b4b6d4f"',
        'last-modified': 'Mon, 20 Jul 2026 10:00:00 GMT',
      },
    });
    assert.equal(res.headers.get('ETag'), null, 'an echoed validator earns a bodyless 304');
    assert.equal(res.headers.get('Last-Modified'), null);
  });

  test('the header nonce and the stamped body nonce are the same value', async () => {
    const { res, text } = await run();
    const header = nonceFromCsp(res.headers.get('Content-Security-Policy'));
    const stamped = nonceFromBody(text);
    assert.ok(header, 'the policy must carry a nonce');
    assert.ok(stamped, 'the inline <script> must have been stamped');
    assert.equal(stamped, header, 'THE DEFECT: policy and body disagree, so inline scripts are blocked');
  });

  test('a <script src> is left unstamped (host allow-list authorises it)', async () => {
    const { text } = await run();
    const external = /<script[^>]*\bsrc="\/js\/app\.js"[^>]*>/i.exec(text);
    assert.ok(external, 'the external script survived the rewrite');
    assert.doesNotMatch(external[0], /nonce=/, 'stamping a src= script is pointless noise');
  });

  test('every request gets a distinct nonce', async () => {
    const a = await run();
    const b = await run();
    const na = nonceFromCsp(a.res.headers.get('Content-Security-Policy'));
    const nb = nonceFromCsp(b.res.headers.get('Content-Security-Policy'));
    assert.notEqual(na, nb, 'a reused nonce is a guessable nonce');
    // ...and each body still matches its OWN header, not the other request's.
    assert.equal(nonceFromBody(a.text), na);
    assert.equal(nonceFromBody(b.text), nb);
  });
});

describe('SHELDON-NOSTORE — already-cached clients are forced back to a full 200', () => {
  test('a document request has its validators stripped before the asset handler', async () => {
    const { seenRequest } = await run({
      requestHeaders: {
        'sec-fetch-dest': 'document',
        'if-none-match': 'W/"5d8c72a5edda8d6a3b4b6d4f"',
        'if-modified-since': 'Mon, 20 Jul 2026 10:00:00 GMT',
      },
    });
    assert.equal(seenRequest.headers.get('If-None-Match'), null, 'a surviving validator earns a 304 with no body');
    assert.equal(seenRequest.headers.get('If-Modified-Since'), null);
  });

  test('the Perch shell iframing the site is treated as a document', async () => {
    // frame-ancestors deliberately allows this (the F-10 path), and it is where
    // the stale nonce was actually observed.
    const { seenRequest } = await run({
      requestHeaders: { 'sec-fetch-dest': 'iframe', 'if-none-match': 'W/"abc"' },
    });
    assert.equal(seenRequest.headers.get('If-None-Match'), null);
  });

  test('a client sending no Fetch-Metadata falls back to Accept', async () => {
    const { seenRequest } = await run({
      requestHeaders: { accept: 'text/html,application/xhtml+xml', 'if-none-match': 'W/"abc"' },
    });
    assert.equal(seenRequest.headers.get('If-None-Match'), null);
  });

  test('the strip is conditional — a request with no validator is not rebuilt', async () => {
    // Asserting "If-None-Match is null" here would be vacuous: it was never set.
    // The real claim is that we did not reconstruct the request at all.
    const { rebuilt, seenRequest, original } = await run({ requestHeaders: { 'sec-fetch-dest': 'document' } });
    assert.equal(rebuilt, false, 'no validator to strip, so next() should be called bare');
    assert.equal(seenRequest, original, 'the asset handler must see the untouched original');
  });

  test('a validator-bearing document request IS rebuilt (control for the test above)', async () => {
    const { rebuilt, seenRequest, original } = await run({
      requestHeaders: { 'sec-fetch-dest': 'document', 'if-none-match': 'W/"abc"' },
    });
    assert.equal(rebuilt, true);
    assert.notEqual(seenRequest, original, 'the stripped request must be a different object');
  });
});

// ── The other half of the contract: static assets must NOT be disturbed ──────

describe('SHELDON-NOSTORE — non-HTML keeps the caching `_headers` gives it', () => {
  const ASSETS = [
    ['text/css', 'no-cache'],
    ['application/javascript', 'no-cache'],
    ['image/png', 'public, max-age=31536000, immutable'],
    ['font/woff2', 'public, max-age=31536000, immutable'],
    ['application/json', 'public, max-age=60'],
  ];

  for (const [ctype, cache] of ASSETS) {
    test(`${ctype} keeps Cache-Control: ${cache}`, async () => {
      const { res } = await run({
        url: 'https://www.donovan.law/css/main.css',
        body: 'body{}',
        responseHeaders: { 'content-type': ctype, 'cache-control': cache, etag: 'W/"asset"' },
      });
      assert.equal(res.headers.get('Cache-Control'), cache, 'THE STOP CONDITION: a static asset lost its caching');
      assert.equal(res.headers.get('ETag'), 'W/"asset"', 'assets revalidate by design — the validator must survive');
    });
  }

  test('a subresource request keeps its validators (it should still 304)', async () => {
    const { seenRequest } = await run({
      url: 'https://www.donovan.law/css/main.css',
      requestHeaders: { 'sec-fetch-dest': 'style', 'if-none-match': 'W/"asset"' },
      responseHeaders: { 'content-type': 'text/css' },
    });
    assert.equal(
      seenRequest.headers.get('If-None-Match'),
      'W/"asset"',
      'stripping this would turn every 304 into a full transfer'
    );
  });

  test('non-HTML is still covered by the CSP', async () => {
    // The early return must not skip the policy — only the HTML-specific work.
    const { res } = await run({
      responseHeaders: { 'content-type': 'text/css' },
    });
    assert.match(res.headers.get('Content-Security-Policy') || '', /default-src 'self'/);
  });
});

// ── Controls: every guard above must be capable of failing ───────────────────

describe('SHELDON-NOSTORE — the guards would actually fire', () => {
  test('the nonce-equality assertion rejects a desynced pair', () => {
    // The exact shape of the live defect: fresh header, stale body.
    const header = buildCsp('a'.repeat(32));
    const staleBody = `<script nonce="${'b'.repeat(32)}">x</script>`;
    assert.notEqual(nonceFromBody(staleBody), nonceFromCsp(header));
  });

  test('nonceFromBody does not match a src= script (so the unstamped test is not vacuous)', () => {
    assert.equal(nonceFromBody('<script src="/js/app.js" nonce="' + 'c'.repeat(32) + '"></script>'), null);
  });

  test('the extractors find nothing in an unstamped page', () => {
    assert.equal(nonceFromBody('<script>x</script>'), null);
    assert.equal(nonceFromCsp("script-src 'self'"), null);
  });

  test('the stub rewriter actually stamps (otherwise every nonce test passes trivially)', async () => {
    const { text } = await run();
    assert.match(text, /nonce="[a-f0-9]{32}"/, 'the stub must be doing the work it claims');
  });
});
