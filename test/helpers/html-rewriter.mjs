// Workers-shaped HTMLRewriter for Node, backed by the REAL engine.
//
// This is NOT a stub. `html-rewriter-wasm` is lol-html — the same Rust streaming
// parser Cloudflare runs — compiled to wasm. Everything that actually decides
// whether the swap container lands in the right place (implied end tags on
// `<p>`/`<li>`, `:nth-of-type`, `body > *`, `onEndTag` ordering, raw-text handling
// inside `<script>`) is the production parser, not a regex.
//
// What IS local plumbing, and therefore what this file could get wrong: the
// class-shaped API. Workers exposes `new HTMLRewriter().on(sel, h).transform(res)`
// returning a Response synchronously; lol-html exposes a sink-and-write API that
// must be freed. The adapter below is that translation and nothing more.
//
// One sharp edge worth naming: lol-html hands each output chunk back as a view
// into wasm linear memory, which is reused for the next chunk. Enqueuing the view
// itself yields garbled output that looks like a rewriter bug — the `.slice()`
// below copies it out.
//
// csp.test.mjs keeps its own regex double on purpose: it predates this and only
// needs the per-element stamping contract. This file is for the structural work,
// where a regex could not tell a valid nesting from a broken one.

import { HTMLRewriter as LolHTMLRewriter } from 'html-rewriter-wasm';

export class HTMLRewriter {
  constructor() {
    this.handlers = [];
  }

  on(selector, handler) {
    this.handlers.push([selector, handler]);
    return this;
  }

  transform(response) {
    const handlers = this.handlers;
    const stream = new ReadableStream({
      async start(controller) {
        const rewriter = new LolHTMLRewriter((chunk) => controller.enqueue(chunk.slice()));
        for (const [selector, handler] of handlers) rewriter.on(selector, handler);
        try {
          await rewriter.write(new Uint8Array(await response.arrayBuffer()));
          await rewriter.end();
        } finally {
          rewriter.free();
          controller.close();
        }
      },
    });
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
}
