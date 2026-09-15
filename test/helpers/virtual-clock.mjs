// ── A clock the poll loop can be run against, minutes at a time ──────────────
//
// ADAM-PAGEPOLL-THROTTLE-R1 task 5 is "measure per-call invocation count before
// and after on a representative flow". A representative flow is a THREE MINUTE
// call, and the thing being measured is how often a loop wakes up over those
// three minutes — so the measurement cannot be taken in real time (180 s per
// arm, twice) and it must not be taken by reading the constants and multiplying,
// which measures arithmetic rather than code.
//
// So the clock moves instead. `setTimeout` / `setInterval` / `Date.now` are
// swapped for a virtual scheduler, and `advance()` walks simulated time forward
// firing whatever is due. The REAL js/perch/command-channel.js loop and the REAL
// functions/fn/page-poll.js handler run against it unmodified — including the
// Function's own hold, which sleeps on the same swapped timer — so the counts
// below are the shipped code's counts, not a model of it.
//
// ── WHAT IS AND IS NOT FAITHFUL ──────────────────────────────────────────────
// Faithful: which code path runs, how many times each side is entered, and the
// ORDER of everything. Not faithful: wall-clock cost, network latency (a fetch
// here resolves after zero simulated time), and CPU. A number from this harness
// is an invocation count and nothing else — it cannot say what a request cost,
// only how many there were.
//
// Timer globals are swapped in PAIRS. A `setTimeout` from this clock returns an
// id only this clock can cancel, so a run that swapped `setTimeout` without
// `clearTimeout` would leave `stop()` unable to cancel anything it scheduled —
// the loop would look like it kept polling after the call ended, and the bug
// would be in the harness.

/**
 * Build a virtual clock. Nothing is patched until `install()`.
 *
 * @returns {{now: () => number, install: Function, restore: Function,
 *            advance: (ms: number) => Promise<void>, pending: () => number}}
 */
export function makeVirtualClock() {
  // Captured BEFORE anything is swapped: `advance()` needs a real macrotask to
  // let awaited continuations run between virtual ticks, and after install()
  // there is no real setTimeout left to reach for.
  //
  // `setImmediate`, not `setTimeout(…, 0)`: Node clamps a zero timeout to 1 ms, and
  // a 45-minute simulated call is thousands of virtual ticks — at eight real
  // drains apiece that clamp turns a sub-second measurement into a two-minute one.
  // setImmediate is a check-phase callback with no clamp.
  const realSetImmediate = globalThis.setImmediate;

  let now = 0;
  let nextId = 1;
  let installed = false;
  const timers = new Map();
  const saved = {};

  function schedule(fn, ms, repeat) {
    const delay = Math.max(0, Number(ms) || 0);
    const id = nextId++;
    timers.set(id, { at: now + delay, fn, every: repeat ? Math.max(1, delay) : null, seq: id });
    return id;
  }

  function cancel(id) { timers.delete(id); }

  /** The earliest due timer, ties broken by scheduling order. */
  function due(limit) {
    let best = null;
    for (const [id, t] of timers) {
      if (t.at > limit) continue;
      if (!best || t.at < best.t.at || (t.at === best.t.at && t.seq < best.t.seq)) best = { id, t };
    }
    return best;
  }

  /**
   * Let everything the last callback set in motion actually run.
   *
   * One real macrotask is not enough. The code under measurement awaits a chain
   * that reaches real runtime promises — `Response.text()` resolves through
   * undici's stream machinery, not on the microtask queue — so a single yield
   * would leave the Function's hold suspended mid-drain and the harness would
   * report a poll loop that stopped polling. Draining several real ticks is what
   * makes the counts the code's counts.
   */
  const REAL_TICKS = 8;
  async function yieldReal() {
    for (let i = 0; i < REAL_TICKS; i++) await new Promise((r) => realSetImmediate(r));
  }

  function install() {
    if (installed) return;
    installed = true;
    const patch = {
      setTimeout: (fn, ms) => schedule(fn, ms, false),
      clearTimeout: (id) => cancel(id),
      setInterval: (fn, ms) => schedule(fn, ms, true),
      clearInterval: (id) => cancel(id),
    };
    for (const [k, v] of Object.entries(patch)) {
      saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
      Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    }
    saved.dateNow = Date.now;
    Date.now = () => now;
  }

  function restore() {
    if (!installed) return;
    installed = false;
    for (const k of ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]);
      else delete globalThis[k];
    }
    Date.now = saved.dateNow;
    timers.clear();
  }

  /**
   * Move simulated time forward by `ms`, running everything that comes due.
   *
   * A real macrotask yield after each callback is what lets the `await` chains
   * inside the poll loop and the Function's hold actually progress; without it
   * the loop's continuation would still be a queued microtask when the next
   * virtual timer fired, and the run would deadlock at the first await.
   */
  async function advance(ms) {
    const end = now + Math.max(0, Number(ms) || 0);
    for (;;) {
      // The yield comes BEFORE the scan, every time. A continuation that is still
      // in flight has not scheduled its next timer yet, so scanning first would
      // find an empty queue, conclude the loop under test had stopped, and jump
      // the clock to `end` — which then dates that timer from the wrong instant.
      // That is not a slow harness, it is a harness that reports the wrong number.
      await yieldReal();
      const next = due(end);
      if (!next) break;
      now = Math.max(now, next.t.at);
      if (next.t.every) next.t.at = now + next.t.every;
      else timers.delete(next.id);
      try { next.t.fn(); } catch (e) { /* a thrown timer callback is the code's problem, not the clock's */ }
    }
    now = end;
  }

  return {
    now: () => now,
    pending: () => timers.size,
    install,
    restore,
    advance,
  };
}
