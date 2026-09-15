// ── JORDAN-NOVOICE-FRONTDOOR: the join key for a visitor who never called ────
//
// ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────────
// The whole intake pipeline is keyed on ONE value, `call_id`, and every store the
// firm reads is addressed by it:
//
//   • the bridge DO slot   `qual:<id>`    — fn/qualifier_submit writes, Paula's
//                                            get_qualifier_result reads once
//   • the KV back-office copy `qualbk:<id>` — the durable witness the BOOKING
//                                            joins to (booking/_lib/qualifier-bind.js)
//   • the Vantage lead      `call_id=<id>` — the merge key /upsert-lead folds on
//
// On the voice path that value is Retell's call id. On the no-voice path there is
// no call and therefore no such id — and `fn/qualifier_submit` does not treat that
// as a lesser submission, it REFUSES it outright:
//
//     if (!callId) { …; return J({ ok:false, reason:'call_id_required' }, 400); }
//
// That refusal is correct and must stay: it is the B2 fix that removed the shared
// `qual:default` bucket, where one visitor's answers were served to whoever asked
// next. So a no-voice door that submits with no id does not degrade — it produces
// NO RECORD AT ALL, silently, because the modal's POST is fire-and-forget and a
// 400 is a resolved fetch rather than a rejection. The card renders its done state,
// the visitor books, and the firm receives an appointment with nothing attached.
//
// This module mints the missing value. It is the smallest thing that makes the two
// doors produce the SAME record in the SAME three stores under the SAME key name,
// so the booking side keeps its single join on `call_id` and needs no change and no
// journey state machine (#114) to tell the doors apart.
//
// ── WHAT THIS ID IS, AND WHAT IT IS NOT ──────────────────────────────────────
// It is NOT a credential. Retell's call id is a bearer capability for the whole
// bridge — fn/page-poll.js authenticates polls with it, which is why the layer
// keeps it off `window.*` and out of every form field. This id is minted by the
// browser, names nothing but the qualifier record that same browser just wrote, and
// authenticates no endpoint: there is no poll to start with it and no action queue
// to drain. Presenting it at /booking/create asks exactly one question — "does a
// server-written record exist under this name?" — which is the same question
// `resolveQualifierBinding` already asks of a Retell id, with the same documented
// answer that it is not proof of ownership (SHELDON-PERCH-A32, #57).
//
// The `web-` prefix is load-bearing in two directions. It cannot collide with
// Retell's `call_*` namespace, so the two doors can never address one another's
// slot; and it makes the door legible in Vantage without a second field.
//
// ── THE CHARSET IS THE SERVER'S, NOT A NEW ONE ───────────────────────────────
// `booking/_lib/qualifier-bind.js` gates the join on CALL_ID_RE —
// /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/ — and refuses the reserved id `default`.
// An id that fails that guard is dropped at the join with `unverified`, so the
// record would exist and never attach. `web-` + 32 lowercase hex is 36 characters
// of that alphabet, which the test asserts against the server's OWN exported
// regex rather than against a copy of it here.

/** sessionStorage key. SESSION, never local — see the note on `read()`. */
export const SESSION_KEY = 'donovan_perch_session';

/** How a minted id is spelled. Asserted against the server's CALL_ID_RE in CI. */
export const ID_PREFIX = 'web-';

/**
 * The marker a booking presents to say IT CLAIMS NOTHING.
 *
 * ── WHY A NEGATIVE ASSERTION HAS TO EXIST AT ALL ─────────────────────────────
 * SHELDON-QUALIFIER-JOIN-COMPOSE-R1. This module's `qualified` flag is per TAB;
 * `booking/_lib/qualifier-cookie.js`'s `dl_qual` carrier is per BROWSER for six
 * hours. Composed, the two disagree about whose booking is whose.
 *
 * Visitor A completes the qualifier and never books. Visitor B opens a new tab on
 * the same browser — fresh sessionStorage, so nothing of A's claim is visible —
 * opens the card from the utility bar, ABANDONS it, and books. B's body carries no
 * `call_id`, exactly as `abandonAfterQualifier` promises. `booking/create.js` then
 * falls back to the cookie, finds A's live record, and writes A's income band, net
 * worth band, for whom, matter category, matter sub, language and source onto B's
 * Clio contact, A's state as B's address, A's summary onto the note and the Grow
 * lead, and A's id as the Vantage merge key. The join reports `attached`.
 *
 * The server cannot tell that booking apart from the one the cookie exists FOR — a
 * visitor who qualified in an earlier tab and is booking now — because both arrive
 * with an empty `call_id` and a live cookie. Absence of a key is the same byte in
 * both. Only the browser knows which of the two happened, so only the browser can
 * say so, and it has to say so out loud.
 *
 * ── WHY SAYING IT LEAKS NOTHING ──────────────────────────────────────────────
 * This is the whole of the value: the four characters `none`. It names no record,
 * carries no answer, and authenticates nothing — it is not the join key in another
 * spelling, and it is not the join key's absence made readable. The `dl_qual`
 * cookie stays HttpOnly and page script still cannot read it.
 *
 * Its forgery direction is the reason it is safe to put in a request body a client
 * controls. `booking/create.js` honours it by SKIPPING the cookie fallback, so the
 * most an attacker achieves by setting it is that their own booking is enriched
 * LESS. There is no value of this field that attaches anything, to anyone. That is
 * the same fail-closed-on-attachment posture `_lib/qualifier-bind.js` already
 * holds: every failure withholds the qualifier context and none of them refuses
 * the appointment.
 *
 * Held equal to the server's `QUALIFIER_CLAIM_NONE` by CI rather than by two
 * people spelling one string the same way twice.
 */
export const CLAIM_NONE = 'none';

/**
 * In-memory fallback, and the reason it is not merely a nicety.
 *
 * Private mode, a storage quota, and a third-party-cookie policy that partitions
 * storage all make `sessionStorage` throw on ACCESS, not just on write. Without
 * this, every `sessionId()` call in such a browser would mint a fresh id: the
 * qualifier would POST under one id and the booking would present another, and the
 * join would resolve `unverified` — a failure that looks exactly like a forged id
 * in the logs. Holding the id in module scope keeps a single tab coherent.
 *
 * What it cannot survive is a document LOAD, which is the no-router fallback's
 * navigation. In that browser the record is still written and the booking still
 * completes; only the enrichment join is lost. That is the documented degradation
 * (`join: 'none'`), not a new failure mode — qualifier-bind fails closed on
 * attachment and never on the booking.
 */
let memo = null;

/** Test seam. Never called by the site. */
export function __reset() { memo = null; }

function store(win) {
  try {
    const s = (win || globalThis).sessionStorage;
    // Touch it: a partitioned/blocked store throws HERE rather than on setItem.
    s.getItem(SESSION_KEY);
    return s;
  } catch (e) {
    return null;
  }
}

function read(win) {
  const s = store(win);
  if (!s) return memo;
  try {
    const raw = s.getItem(SESSION_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    return (rec && typeof rec === 'object' && typeof rec.id === 'string' && rec.id) ? rec : null;
  } catch (e) {
    return null;
  }
}

function write(rec, win) {
  memo = rec;
  const s = store(win);
  if (!s) return false;
  try {
    s.setItem(SESSION_KEY, JSON.stringify(rec));
    return true;
  } catch (e) {
    return false; // quota — `memo` still carries the tab
  }
}

/**
 * Merge fields into the tab's record, minting it if this is the first ask.
 *
 * Every mutator below goes through here rather than hand-building the whole record,
 * because hand-building is how a field gets dropped: the record now carries FOUR
 * things, and a writer that spells three of them silently resets the fourth to
 * `undefined`. `claims` is the one that would go first and the one whose loss is
 * invisible — a dropped claim reads as "an ordinary booking", which is precisely
 * the state that lets the cookie fall back onto someone else's record.
 */
function patch(fields, win) {
  const id = sessionId(win);
  const rec = read(win) || { id, qualified: false, prefill: null, claims: '' };
  write({ ...rec, id, ...fields }, win);
  return id;
}

/**
 * 32 hex characters from the platform CSPRNG.
 *
 * `crypto.randomUUID` is deliberately NOT used: it emits a canonical UUID whose
 * hyphens are fine but which carries no door marker, and it is absent on http
 * origins in older Safari. `getRandomValues` is present wherever this site runs.
 * The `Math.random` branch is the last resort and is only reachable in an
 * environment with no WebCrypto at all; it is still 128 bits of key space against
 * an id that guards nothing, and collision — not prediction — is the only stake.
 */
function randomHex(win) {
  const c = (win || globalThis).crypto;
  try {
    if (c && typeof c.getRandomValues === 'function') {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* fall through */ }
  let out = '';
  while (out.length < 32) out += Math.floor(Math.random() * 16).toString(16);
  return out.slice(0, 32);
}

/**
 * The tab's qualifier id, minted on first ask and stable thereafter.
 *
 * Stable is the requirement, not an optimisation: a visitor who abandons the card
 * and reopens it must land in the SAME record rather than scattering half-finished
 * rows across Vantage, and the booking that follows must present the id the
 * qualifier POSTed under or the join has nothing to find.
 */
export function sessionId(win) {
  const rec = read(win);
  if (rec) return rec.id;
  const fresh = { id: ID_PREFIX + randomHex(win), qualified: false, prefill: null, claims: '' };
  write(fresh, win);
  return fresh.id;
}

/**
 * Record that the card was COMPLETED under this id.
 *
 * `qualified` is what licenses the later `set_call_id`, and the two are kept apart
 * from the prefill on purpose. Presenting an id under which no qualifier was ever
 * submitted would make every /book visit in the tab claim a record that does not
 * exist, and each one would resolve `unverified` — a clean signal turned into noise
 * the firm cannot read. So this is set ONLY where a POST actually went out.
 *
 * An ABANDONED card therefore stashes its partial prefill (below) and never calls
 * this: the visitor keeps the answers they tapped, and the booking travels the
 * ordinary no-call_id path (`join: 'none'`) because there is genuinely no record to
 * join to.
 */
export function markQualified(win) {
  // `claims: ''` RETRACTS a claims-nothing marker left by an earlier abandon in
  // this tab. A visitor who walks away from the card and then comes back and
  // finishes it has a real record, and a stale marker from the first attempt would
  // suppress the join to the record the second attempt just wrote — the #153
  // defect, re-created by the fix for the one after it.
  return patch({ qualified: true, claims: '' }, win);
}

/**
 * Record that this tab's booking DELIBERATELY presents no join key.
 *
 * Set on the abandon path only — see `abandonAfterQualifier` in js/perch-layer.js
 * for which abandon, and why the live-call and non-book-intent dismissals are
 * excluded from it.
 *
 * A NO-OP ON A QUALIFIED TAB, which is the asymmetry that keeps this from becoming
 * its own defect. Once a card has completed here, the tab owns a real server-side
 * record; abandoning a SECOND card afterwards does not retract the first, and
 * letting it write a marker would make the visitor's own answers unreachable from
 * their own booking. The marker is only ever the statement "nothing was ever
 * submitted in this tab", never "forget what was".
 */
export function markClaimsNothing(win) {
  if (isQualified(win)) return false;
  patch({ claims: CLAIM_NONE }, win);
  return true;
}

/** Does this tab's booking claim nothing? "" — the default — is not a claim either way. */
export function claimsNothing(win) {
  const rec = read(win);
  return !!(rec && rec.claims === CLAIM_NONE);
}

/**
 * Spend the tab's claim, on a booking the provider CONFIRMED.
 *
 * The other half of the one-shot. `booking/create.js` clears the `dl_qual` cookie
 * on exactly the same event, and before this the two stores went out of step at
 * that moment: the cookie was spent while `qualified` stayed true, so
 * `resumeNoVoiceBooking` kept re-presenting a key whose record had been consumed
 * and every later booking in the tab resolved `unverified` — a forged-id signal
 * raised by the firm's own returning visitor. One shot now means one shot in both
 * stores, or it means nothing.
 *
 * The PREFILL is deliberately left alone: `takePrefill` is already read-once and
 * owns its own spending.
 *
 * SO IS THE CLAIM, and for a reason worth stating: a tab that never submitted a
 * qualifier has still never submitted one after it books, so a claims-nothing
 * marker is not something a confirmation spends — it is a standing fact about the
 * tab. Clearing it here would leave a second booking from the same tab silent
 * again, and silent is the state the cookie fallback answers.
 */
export function clearQualified(win) {
  if (!read(win)) return false;
  patch({ qualified: false }, win);
  return true;
}

/**
 * Park a prefill so it can survive a document load.
 *
 * Deliberately NOT gated on `qualified`: the payload is the visitor's own answers,
 * restated into a form they can edit or clear, and a visitor who abandoned the card
 * halfway has still earned the two questions they did answer. The id claim is the
 * thing that has to be earned; the answers are not.
 */
export function stashPrefill(prefill, win) {
  patch({ prefill: prefill || null }, win);
  return !!prefill;
}

/** Did the card complete in this tab? */
export function isQualified(win) {
  const rec = read(win);
  return !!(rec && rec.qualified);
}

/**
 * Take the parked prefill, once.
 *
 * Read-once so a payload cannot be replayed onto a later booking in the same tab.
 * `qualified` and the id SURVIVE the take — they are the join key, and the join
 * must still work if the visitor reloads /book after the form was filled.
 */
export function takePrefill(win) {
  const rec = read(win);
  if (!rec || !rec.prefill) return null;
  const p = rec.prefill;
  patch({ prefill: null }, win);
  return p;
}
