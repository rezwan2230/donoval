// PerchBridge — a Durable Object that relays Paola's page-control commands to the
// browser, and holds the two read-once records the Retell tool endpoints exchange
// (`qual:<call_id>` from qualifier_submit, `booked:<call_id>` from booking_confirmed).
// Strongly consistent + single-instance, so a write by Retell is instantly visible
// to the browser's next poll (unlike KV, which is eventually-consistent and
// read-cached). One instance per tenant (functions/_lib/tenant.js) holds a map of
// call_id -> pending work.
//
// ── SHELDON-PERCHDO-QUEUE: the slot is an append QUEUE, not one overwritable cell ─
//
// ── WHAT THIS FIXES, AND WHAT IS ALREADY FIXED ───────────────────────────────
// The user-facing bug is gone: #94 made functions/fn/do_page_action.js drain the
// bridge before it writes and re-queue both commands inside one `batch`, so a
// `goto_booking` + `booking_prefill` pair issued inside one 1.2 s poll window both
// reach the caller. That repair works — and it is the ONLY thing standing between
// a burst and data loss, because the storage underneath it was still
//
//     await this.state.storage.put('a:' + call_id, action)   // one cell, last write wins
//
// so any writer that skipped the coalesce — a future call site, a retry that races
// the drain, a rollback of the Pages deploy — silently destroyed a pending command.
// This module removes that property at the source: `/set` APPENDS, `/get` DRAINS in
// order. The coalesce in do_page_action becomes redundant rather than load-bearing,
// which is the point; nothing about it changes and nothing depends on it changing.
//
// ── BACKWARD COMPATIBILITY IS THE WHOLE CONSTRAINT ───────────────────────────
// perch-do has no CI lane, it is deployed by hand, and ONE instance serves
// production and every Preview at once. So this class must be correct against the
// Pages code that is live TODAY, against the storage that instance is already
// holding, and against a rollback:
//
//   • One item drains to the item VERBATIM. `{cmd:'navigate',target:'/book.html'}`
//     round-trips byte-for-byte, which is the wire shape Paula's tool configs, the
//     `/perch` shell and js/perch/command-channel.js are all written against.
//   • More than one COMMAND drains as `{cmd:'batch',actions:[…]}` — the shape #94
//     already taught both hosts to execute, in order.
//   • More than one NON-command record (no `cmd`: the `qual:` / `booked:` slots)
//     drains as the LAST one written, which is exactly the overwrite semantics
//     qualifier_result and booking_result have today. A batch would be wrong there:
//     those readers look for `.status`, and wrapping the record would read as
//     "pending" / "not_booked" and lose a real submission.
//   • A `batch` arriving at `/set` (what today's coalescing do_page_action writes)
//     is FLATTENED into the queue, so the queue never nests and the bound below
//     counts actions rather than wrappers.
//   • Records the OLD build already stored under `a:<id>` are still read, and are
//     ordered FIRST — they were queued first. They migrate into the queue on the
//     next write and are cleared on drain, so the legacy key drains itself out.
//   • Rollback: the queue lives under a NEW key prefix (`q:`), so the previous
//     build reads `a:<id>`, finds nothing, and answers `{}` — it never deserialises
//     an array it cannot understand into an action. A rollback drops commands that
//     were in flight at that instant; it cannot emit a malformed one.
//
// `/has` is unchanged in contract: boolean only, and it NEVER deletes. The booking
// call_id bind (functions/booking/_lib/qualifier-bind.js) is the only caller and
// depends on both properties.

/** Most actions one call's queue may hold. Matches MAX_BATCH in do_page_action. */
const MAX_QUEUE = 8;

/** Queue key — new shape, an array. */
const QK = (id) => 'q:' + id;
/** Pre-queue key — a single action. Read for compatibility, never written. */
const AK = (id) => 'a:' + id;

/** A page-control command, as opposed to a `qual:` / `booked:` record. */
function isCommand(x) {
  return !!x && typeof x === 'object' && typeof x.cmd === 'string' && x.cmd !== '';
}

/**
 * Render a drained queue as the body `/get` returns.
 *
 * Empty → `{}`. One item → that item verbatim. Many commands → one `batch`, in
 * order. Anything else (the non-command records) → the last one written, which is
 * the overwrite behaviour those slots had before this change.
 */
function drained(items) {
  if (items.length === 0) return {};
  if (items.length === 1) return items[0];
  if (items.every(isCommand)) return { cmd: 'batch', actions: items };
  return items[items.length - 1];
}

export class PerchBridge {
  constructor(state) {
    this.state = state;
    // Tail of the serialised operation chain — see _serialize().
    this._tail = Promise.resolve();
  }

  /**
   * Run `fn` after every operation already queued against this instance.
   *
   * `/set` and `/get` are read-modify-write. Cloudflare's input gate already
   * prevents another event from being delivered while a storage operation is
   * outstanding, so in production this chain is belt to that suspenders — but the
   * whole point of this ticket is that a second writer must not be able to destroy
   * a first, and "must not" should not rest on a subtlety of the runtime that the
   * class itself cannot state. Serialising here also makes the property TESTABLE:
   * with a storage double that yields on every await, two concurrent `/set` calls
   * genuinely interleave, and without this they lose each other.
   *
   * The tail never rejects (failures propagate to the caller only), so one failed
   * request cannot wedge the instance.
   */
  _serialize(fn) {
    const run = this._tail.then(fn);
    this._tail = run.then(() => {}, () => {});
    return run;
  }

  /**
   * Read the pending queue for `id`, oldest first, WITHOUT mutating storage.
   * Folds in a pre-queue `a:<id>` value if the previous build left one.
   */
  async _read(id) {
    const q = await this.state.storage.get(QK(id));
    const items = Array.isArray(q) ? q.slice() : (q === undefined || q === null ? [] : [q]);
    const legacy = await this.state.storage.get(AK(id));
    // Queued by the previous build, therefore queued BEFORE anything in `q:`.
    if (legacy !== undefined && legacy !== null) items.unshift(legacy);
    return items;
  }

  /** Append `action` to `id`'s queue, flattening a batch and bounding the result. */
  async _append(id, action) {
    const items = await this._read(id);
    const incoming = isCommand(action) && action.cmd === 'batch' && Array.isArray(action.actions)
      ? action.actions
      : (action === undefined || action === null ? [] : [action]);
    // Oldest-first drop on overflow: the newest command is the one Paula just
    // issued and the one the caller is waiting on, so it is never the casualty.
    // Same direction as do_page_action's `.slice(-MAX_BATCH)`.
    const next = items.concat(incoming).slice(-MAX_QUEUE);
    if (next.length === 0) await this.state.storage.delete(QK(id));
    else await this.state.storage.put(QK(id), next);
    // Whatever the old key held is now inside `next` (or was dropped by the bound).
    await this.state.storage.delete(AK(id));
  }

  async fetch(req) {
    const url = new URL(req.url);
    const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });

    if (url.pathname === '/set') {
      const { call_id, action } = await req.json();
      const id = String(call_id);
      await this._serialize(() => this._append(id, action));
      return new Response('ok');
    }

    if (url.pathname === '/get') {
      const callId = url.searchParams.get('call_id') || 'default';
      const out = await this._serialize(async () => {
        const items = await this._read(callId);
        if (items.length) {
          await this.state.storage.delete(QK(callId));
          await this.state.storage.delete(AK(callId));
        }
        return drained(items);
      });
      // `out || {}` mirrors the previous build: a falsy stored value reads as `{}`.
      return json(out || {});
    }

    // /has — NON-destructive existence probe (SHELDON-PERCH-A32-CALLID-BIND, #57).
    // /get is read-once: it drains the queue it returns, which is correct for the
    // command queue and for Paula's one-shot qualifier read, but useless as a
    // validity check — probing with /get would CONSUME the record it was meant to
    // confirm. /has answers the only question the booking path needs ("did this
    // server write a record under this call_id?") and returns a boolean ONLY, never
    // the record, so it discloses no caller PII and cannot be used to harvest one.
    // No default bucket: an absent call_id is `present:false`, never 'default'.
    //
    // Unchanged by the queue: "present" is "there is at least one pending item",
    // which for the `qual:` slot this probe reads is the same single record it was.
    if (url.pathname === '/has') {
      const callId = url.searchParams.get('call_id') || '';
      const present = callId
        ? await this._serialize(async () => (await this._read(callId)).length > 0)
        : false;
      return json({ present });
    }

    return json({});
  }
}
export default { async fetch() { return new Response('perch-do'); } };
