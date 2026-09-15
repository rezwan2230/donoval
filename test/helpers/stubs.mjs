// Shared test doubles for the Cloudflare Pages runtime.
//
// These are deliberately thin. The point of the suite is to exercise OUR logic —
// signature checks, allow-lists, fail-closed branches — not to re-implement
// Workers. Anything a stub fakes is called out where it could hide a real defect.

/**
 * In-memory stand-in for a Workers KV namespace.
 *
 * NOT eventually consistent, unlike the real thing. That difference is why the
 * rate limiter and the consent-ticket jti burn are documented in the source as
 * race-window controls rather than hard guarantees — a test against this stub
 * CANNOT prove those are atomic, and no assertion here claims otherwise.
 */
export function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    _store: store,
    calls: { get: 0, put: 0, delete: 0 },
    async get(key) {
      this.calls.get++;
      const v = store.get(key);
      return v === undefined ? null : v;
    },
    async put(key, value) {
      this.calls.put++;
      store.set(key, String(value));
    },
    // Real KV namespaces expose delete(); the stub did not, so create.js's one-shot
    // `qualbk:` clear threw into its own catch and the "a second booking cannot
    // re-append the summary" behaviour was untestable (SHELDON-PERCH-A32-CALLID-BIND).
    async delete(key) {
      this.calls.delete++;
      store.delete(key);
    },
  };
}

/** A KV whose every operation throws — for the fail-open / fail-closed branches. */
export function makeBrokenKV() {
  return {
    async get() { throw new Error('kv down'); },
    async put() { throw new Error('kv down'); },
    async delete() { throw new Error('kv down'); },
  };
}

/**
 * Minimal Durable Object namespace stub that records what was written.
 * `writes` captures the parsed body of every https://do/set call, across all
 * instances; `reads` likewise. Per-instance traffic is under `instance(name)`.
 *
 * INSTANCE-AWARE (SHELDON-PERCH-A04-DO-ISOLATION). The previous version ignored
 * the id passed to get() and served ONE shared Map to every caller. That faithfully
 * modelled the bug — every call site named the same 'global' object — but it also
 * made the fix untestable: with one backing store, two tenant ids would still have
 * read each other's slots and no assertion could have told the difference. Each
 * distinct idFromName() string now gets its own storage, which is what Cloudflare
 * actually does, so a regression that re-shares the instance fails a test instead of
 * passing one.
 *
 * Still NOT faithful in one respect, called out so no assertion over-claims: the
 * real DO is a single-threaded actor with strong consistency and this is a plain
 * Map. Tests here can prove WHICH instance a call addressed; they cannot prove
 * anything about concurrency or ordering inside one.
 */
export function makeDurableObject() {
  const writes = [];
  const reads = [];
  const probes = [];
  const instances = new Map();

  /** Storage + traffic log for one DO name, created on first address. */
  function instance(name) {
    const key = String(name);
    let inst = instances.get(key);
    if (!inst) {
      inst = { name: key, writes: [], reads: [], probes: [], state: new Map() };
      instances.set(key, inst);
    }
    return inst;
  }

  return {
    writes,
    reads,
    /** Every `/has` existence probe, across all instances (A32). */
    probes,
    instance,
    /** Every DO name addressed so far — the isolation assertion reads this. */
    names() { return [...instances.keys()]; },
    idFromName(name) { return { name: String(name) }; },
    get(id) {
      // An unnamed stub is exactly the shared-bucket shape this ticket removes;
      // refuse it loudly rather than inventing one more implicit global.
      if (!id || id.name === undefined) {
        throw new Error('PERCH_BRIDGE.get() requires an id from idFromName()');
      }
      const inst = instance(id.name);
      return {
        async fetch(url, init) {
          const u = new URL(url);
          if (u.pathname === '/set') {
            const body = JSON.parse(init.body);
            writes.push(body);
            inst.writes.push(body);
            inst.state.set(body.call_id, body.action);
            return new Response('ok');
          }
          if (u.pathname === '/get') {
            const callId = u.searchParams.get('call_id');
            reads.push(callId);
            inst.reads.push(callId);
            const a = inst.state.get(callId);
            if (a !== undefined) inst.state.delete(callId); // read-once, like the real DO
            return new Response(JSON.stringify(a || {}), {
              headers: { 'content-type': 'application/json' },
            });
          }
          // /has — non-destructive existence probe (SHELDON-PERCH-A32-CALLID-BIND).
          // Mirrors perch-do/src/index.js: boolean only, and it must NOT delete —
          // a stub that consumed the slot here would hide the whole reason /has
          // exists rather than /get.
          if (u.pathname === '/has') {
            const callId = u.searchParams.get('call_id') || '';
            probes.push(callId);
            inst.probes.push(callId);
            return new Response(JSON.stringify({ present: callId ? inst.state.has(callId) : false }), {
              headers: { 'content-type': 'application/json' },
            });
          }
          return new Response('{}');
        },
      };
    },
  };
}

/** Build a Request with JSON body + the headers the functions actually read. */
export function jsonRequest(body, { origin = 'https://www.donovan.law', headers = {}, url = 'https://www.donovan.law/web-call', method = 'POST' } = {}) {
  const h = { 'content-type': 'application/json', ...headers };
  if (origin !== null) h['Origin'] = origin;
  return new Request(url, { method, headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

/** Swap globalThis.fetch for the duration of a test; returns a restore fn. */
export function stubFetch(impl) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return impl(...args);
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

/** Silence expected console noise (fail-closed paths log loudly by design). */
export function muteConsole() {
  const saved = { warn: console.warn, error: console.error, log: console.log };
  const lines = [];
  console.warn = (...a) => lines.push(['warn', a.join(' ')]);
  console.error = (...a) => lines.push(['error', a.join(' ')]);
  console.log = (...a) => lines.push(['log', a.join(' ')]);
  return {
    lines,
    /** True if any captured line contains the substring. */
    saw(sub) { return lines.some(([, m]) => m.includes(sub)); },
    restore() { Object.assign(console, saved); },
  };
}
