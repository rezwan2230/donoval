// ── Delegated replacement for inline on*= handlers ─────────────────────────────
//
// Dr. Insane RE-GATE R2 blocker B3. Dropping `script-src 'unsafe-inline'` kills
// inline event-handler attributes as well as inline <script> blocks. The nonce in
// functions/_middleware.js rescues the <script> blocks; it cannot rescue
// attributes, because a nonce is an element attribute and `onclick=` is not an
// element. So the 255 handlers on the calculator/tool pages were rewritten to:
//
//     <button onclick="loadPreset('ski')">          →
//     <button data-dvn-on="click" data-dvn-do="loadPreset('ski')">
//
// and this module dispatches them.
//
// WHY DELEGATION AND NOT addEventListener PER ELEMENT.
// Some of those handlers are emitted from inside JS template literals and injected
// with innerHTML — e.g. the activity/entry rows in the material-participation
// tracker build `onclick="delActivity(${a.id})"` at render time. Those elements do
// not exist at load, and their inline handlers would ALSO have been dead under the
// new CSP. A single delegated listener on the document catches them no matter when
// they are created, so dynamic rows keep working without touching the render code
// beyond the attribute rename.
//
// SECURITY NOTE — this is not an eval bridge. The expression is PARSED, never
// evaluated: a dotted callee path is resolved against `window`, and arguments must
// be `this`, `event`, or a plain literal. An attacker who can inject
// `data-dvn-do` can therefore only call an already-global function with literal
// arguments — which is exactly what they could do by injecting a <script> IF they
// had the nonce, and strictly less than `eval` would give them. No `new Function`,
// no `eval`, no string→code path anywhere in this file.

(function () {
  'use strict';

  /** Events we delegate. Matches the attributes that existed on the tool pages. */
  var EVENTS = ['click', 'change', 'input', 'submit'];

  /**
   * Built-in helpers for DOM idioms the old inline handlers expressed inline.
   * Kept tiny and explicit — each exists because a real handler needed it.
   */
  var BUILTINS = {
    // was: onclick="document.getElementById('imp').click()"
    // A method call on the result of another call is beyond the literal-args
    // parser below, and adding general expression support to reach one button
    // would defeat the point of not having an evaluator.
    __click: function (sel) {
      var el = document.querySelector(sel);
      if (el) el.click();
    },
  };

  /**
   * Parse a single argument token into a value.
   * Supported: this | event | 'str' | "str" | 123 | true | false | null
   * Anything else is refused (returns the NOTHING sentinel) so an unparseable
   * handler fails loudly in the console rather than silently passing a string.
   */
  var NOTHING = {};
  function parseArg(tok, el, ev) {
    tok = tok.trim();
    if (tok === '') return NOTHING;
    if (tok === 'this') return el;
    if (tok === 'event') return ev;
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'null') return null;
    // Strings. The source markup sometimes carries backslash-escaped quotes
    // (onclick="toggleHelp(\'reclass_help\')") because the attribute was written
    // inside a JS string; strip those before matching.
    var s = tok.replace(/\\(['"])/g, '$1');
    var m = /^'([^']*)'$/.exec(s) || /^"([^"]*)"$/.exec(s);
    if (m) return m[1];
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return NOTHING;
  }

  /**
   * Split an argument list on top-level commas only, so a comma inside a quoted
   * string does not split the argument.
   */
  function splitArgs(src) {
    var out = [];
    var buf = '';
    var quote = null;
    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (quote) {
        if (c === '\\') { buf += c + (src[++i] || ''); continue; }
        if (c === quote) quote = null;
        buf += c;
      } else if (c === "'" || c === '"') {
        quote = c;
        buf += c;
      } else if (c === ',') {
        out.push(buf);
        buf = '';
      } else {
        buf += c;
      }
    }
    if (buf.trim() !== '') out.push(buf);
    return out;
  }

  /** Resolve a dotted path (e.g. "window.print") to {fn, thisArg}. */
  function resolvePath(path) {
    var parts = path.split('.');
    var ctx = window;
    var obj = window;
    for (var i = 0; i < parts.length; i++) {
      if (ctx == null) return null;
      obj = ctx;
      ctx = ctx[parts[i]];
    }
    if (typeof ctx !== 'function') return null;
    return { fn: ctx, thisArg: obj };
  }

  /** Run one `name(args)` expression against the element and event. */
  function invoke(expr, el, ev) {
    var m = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\((.*)\)\s*$/.exec(expr);
    if (!m) {
      console.warn('[inline-actions] unparseable action, ignored:', expr);
      return;
    }
    var name = m[1];
    var rawArgs = m[2];

    var args = [];
    var toks = splitArgs(rawArgs);
    for (var i = 0; i < toks.length; i++) {
      var v = parseArg(toks[i], el, ev);
      if (v === NOTHING) {
        console.warn('[inline-actions] unsupported argument, action ignored:', expr);
        return;
      }
      args.push(v);
    }

    if (Object.prototype.hasOwnProperty.call(BUILTINS, name)) {
      BUILTINS[name].apply(null, args);
      return;
    }

    var target = resolvePath(name);
    if (!target) {
      // The old inline handler would have thrown into the console here too; this
      // keeps the failure visible rather than swallowing it.
      console.warn('[inline-actions] no such function:', name);
      return;
    }
    target.fn.apply(target.thisArg, args);
  }

  function handler(ev) {
    var el = ev.target;
    if (!el || !el.closest) return;
    var node = el.closest('[data-dvn-on]');
    if (!node) return;
    // An element only responds to the event type it was authored for, so a
    // data-dvn-on="change" input is not also fired by a click.
    if (node.getAttribute('data-dvn-on') !== ev.type) return;
    var expr = node.getAttribute('data-dvn-do');
    if (!expr) return;
    invoke(expr, node, ev);
  }

  for (var i = 0; i < EVENTS.length; i++) {
    // Bubble phase, matching inline-handler semantics.
    document.addEventListener(EVENTS[i], handler, false);
  }
})();
