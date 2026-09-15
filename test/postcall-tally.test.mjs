// ORDER ADAM-POSTCALL-OBSERVABILITY-R1 — the tally over a captured wrangler tail.
//
// The script exists to produce ONE number a decision rests on: the qualifier-skip
// rate that gates the #180 joinKey trade. A parser that miscounts is worse than no
// parser, because the output looks exactly as authoritative either way. So the
// fixture below has KNOWN COUNTS, hand-tallied in the comment beside each block,
// and every assertion here names the number it expects rather than comparing the
// parser against itself.
//
// The fixture lines are the SHIPPED strings, copied from the source that emits
// them. If a line here stops matching the deployed source, this suite is the thing
// that says so — a tally that silently reads zero of a category it no longer
// recognises is indistinguishable from a healthy integration.
//
// Two properties get their own tests because they are the ones that fail quietly:
//   1. `fields not applied` must NOT be counted as `fields applied`. One literal
//      is a substring-adjacent neighbour of the other, and getting this wrong
//      turns every failed write into a success in the table.
//   2. an unrecognised line must land in `other` and NEVER take the run down.
//      A tail capture contains request lines, exceptions, ANSI, half-written
//      JSON at the truncation point, and log lines from every other route.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  tally,
  classify,
  extractMessages,
  formatReport,
  CATEGORIES,
} from '../scripts/postcall-tally.mjs';

/** One `--format json` tail line carrying a single log message. */
const j = (message, level = 'log') =>
  JSON.stringify({
    outcome: 'ok',
    scriptName: null,
    exceptions: [],
    logs: [{ message: [message], level, timestamp: 1785000000000 }],
    eventTimestamp: 1785000000000,
    event: { request: { url: 'https://donovan.law/webhooks/retell-postcall', method: 'POST' } },
  });

// ── The fixture ─────────────────────────────────────────────────────────────
//
// POST-CALL DELIVERIES (11 terminal outcomes, one per delivery):
//   applied              2
//   not_applied          1
//   no_contact           3
//   event_ignored        2
//   agent_missing        1
//   agent_mismatch       1
//   no_change            1
//   ── deliveries       11
//
// SIGNATURE REFUSALS (counted apart — see the docs caveat):
//   signature_invalid    2
//
// DETAIL (must NOT be summed into deliveries — fires alongside an outcome):
//   analysis_selected    3
//
// BOOKING PRODUCER:
//   qualifier_join       6
//   join_recovered_cookie 1
//   callmap_no_contact   1
//   callmap_write_failed 1
//
// THE SEVEN qualifier_join LINES, and what each one is:
//   1. attached,            call_id=yes, key_source=body    → verified
//   2. verified_no_summary, call_id=yes, key_source=body    → verified
//   3. attached,            call_id=yes, key_source=cookie  → verified
//   4. unverified,          call_id=yes, NO key_source      → SKIP
//   5. unverified,          call_id=yes, NO key_source      → SKIP  (claims_nothing=yes)
//   6. none,                call_id=no,  NO key_source      → web booking, neither
//   7. attached,            call_id=no,  key_source=cookie  → cookie-only GAIN
//
//   voiceBookings = 5   (lines 1–5, the ones with call_id_present=yes)
//   verified      = 3   (lines 1, 2, 3)
//   skips         = 2   (lines 4, 5)
//   rate          = 2/5 = 40.0%
//   cookieOnlyKey = 1   (line 7)
//   claimsNothing = 1   (line 5)
//
// OTHER (unrecognised, must not crash): 5 — see the block at the end.

const FIXTURE = [
  // ── deliveries ────────────────────────────────────────────────────────────
  j('[postcall] fields applied count=4 names=urgency,interest,sentiment,summary'),
  j('[postcall] fields applied count=2 names=urgency,summary'),
  j('[postcall] fields not applied: HTTP 422 unprocessable named=custom_field_values other=1', 'warn'),
  j('[postcall] no contact resolved: absent — nothing written'),
  j('[postcall] no contact resolved: absent — nothing written'),
  j('[postcall] no contact resolved: no_call_id — nothing written'),
  j('[postcall] ignored event=call_ended — only call_analyzed carries the analysis'),
  j('[postcall] ignored event=call_started — only call_analyzed carries the analysis'),
  j('[postcall] AGENT_MISSING — no call.agent_id on the envelope; refused', 'warn'),
  j('[postcall] AGENT_MISMATCH — post-call delivery for another agent; refused', 'warn'),
  j('[postcall] nothing to apply: no_change wanted=urgency,summary resolved=4', 'warn'),

  // ── signature ─────────────────────────────────────────────────────────────
  j('[retell-auth] SIGNATURE_INVALID — page action refused', 'warn'),
  j('[retell-auth] SIGNATURE_INVALID — page action refused', 'warn'),

  // ── detail ────────────────────────────────────────────────────────────────
  j('[postcall] analysis selected count=4 omitted=(none) placeholders=(none) truncated=(none)'),
  j('[postcall] analysis selected count=2 omitted=interest,sentiment placeholders=(none) truncated=(none)'),
  j('[postcall] analysis selected count=0 omitted=urgency,interest,sentiment,summary placeholders=(none) truncated=(none)'),

  // ── booking producer: the six qualifier_join lines ────────────────────────
  j('[booking/create] qualifier_join=attached source=kv key_source=body call_id_present=yes cookie_present=no claims_nothing=no'),
  j('[booking/create] qualifier_join=verified_no_summary source=bridge key_source=body call_id_present=yes cookie_present=no claims_nothing=no'),
  j('[booking/create] qualifier_join=attached source=kv key_source=cookie call_id_present=yes cookie_present=yes claims_nothing=no'),
  j('[booking/create] qualifier_join=unverified call_id_present=yes cookie_present=no claims_nothing=no'),
  j('[booking/create] qualifier_join=unverified call_id_present=yes cookie_present=yes claims_nothing=yes'),
  j('[booking/create] qualifier_join=none call_id_present=no cookie_present=no claims_nothing=no'),

  // A seventh join line: no body call_id, but the cookie carried a verified key.
  // #180 would GAIN a callmap here, and it must not be read as a voice booking.
  j('[booking/create] qualifier_join=attached source=kv key_source=cookie call_id_present=no cookie_present=yes claims_nothing=no'),

  j('[booking/create] body call_id unverified — recovered the join from the qualifier cookie', 'warn'),
  j('[booking/create] callmap not written — a call booked but no Clio contact was resolved', 'warn'),
  j('[booking/create] callmap write failed: KV PUT timed out', 'warn'),

  // ── OTHER: five unrecognised messages that must not crash the run ─────────
  j('[booking/create] ok provider=clio typeId=7 confirmed=true kvWriteOk=true'),
  j('[clio] calendar entries read: 12 (pages: 1)'),
  'GET https://donovan.law/fn/page-poll - Ok @ 7/25/2026, 11:02:14 AM',   // pretty-format line
  '{"outcome":"ok","logs":[{"message":["[postcall] fields appl',            // truncated JSON
  '',                                                                       // blank — skipped entirely
  '   ',                                                                    // whitespace — skipped entirely
  JSON.stringify({ outcome: 'exception', logs: [], exceptions: [{ name: 'Error', message: 'boom' }] }),
].join('\n');

const EXPECTED_QUALIFIER_JOIN_LINES = 7;

describe('ADAM-POSTCALL-OBSERVABILITY-R1 — tally', () => {
  const t = tally(FIXTURE);

  test('deliveries: every terminal outcome is counted exactly once', () => {
    assert.equal(t.counts.applied, 2);
    assert.equal(t.counts.not_applied, 1);
    assert.equal(t.counts.no_contact, 3);
    assert.equal(t.counts.event_ignored, 2);
    assert.equal(t.counts.agent_missing, 1);
    assert.equal(t.counts.agent_mismatch, 1);
    assert.equal(t.counts.no_change, 1);
    assert.equal(t.deliveries, 11);
  });

  test('agent refusals are summed, and are part of the delivery total', () => {
    assert.equal(t.agentRefusals, 2);
  });

  test('signature refusals are counted, and are NOT folded into deliveries', () => {
    assert.equal(t.counts.signature_invalid, 2);
    assert.equal(t.signatureRefusals, 2);
    // 11 = the eleven terminal outcomes above. If a signature refusal had been
    // summed in, this would read 13 and the "deliveries" row would be a claim
    // about a route the `[retell-auth]` prefix cannot attribute.
    assert.equal(t.deliveries, 11);
  });

  test('`analysis selected` is a detail line and never inflates the delivery count', () => {
    assert.equal(t.counts.analysis_selected, 3);
    // Three analysis lines beside eleven deliveries: if it were summed, 14.
    assert.equal(t.deliveries, 11);
  });

  test('`fields not applied` is never counted as `fields applied`', () => {
    assert.equal(classify('[postcall] fields not applied: HTTP 422 named=x'), 'not_applied');
    assert.equal(classify('[postcall] fields not applied: error wanted=urgency'), 'not_applied');
    assert.equal(classify('[postcall] fields applied count=4 names=urgency'), 'applied');
    // And in the aggregate: two applied, one failed, not three applied.
    assert.equal(t.counts.applied, 2);
    assert.equal(t.counts.not_applied, 1);
  });

  test('booking producer lines are counted', () => {
    assert.equal(t.counts.qualifier_join, EXPECTED_QUALIFIER_JOIN_LINES);
    assert.equal(t.counts.join_recovered_cookie, 1);
    assert.equal(t.counts.callmap_no_contact, 1);
    assert.equal(t.counts.callmap_write_failed, 1);
  });
});

describe('ADAM-POSTCALL-OBSERVABILITY-R1 — the #180 qualifier-skip rate', () => {
  const t = tally(FIXTURE);

  test('voice bookings are the lines that carry a body call_id', () => {
    // Five of the seven join lines have call_id_present=yes. The `none` line and
    // the cookie-only line are not voice bookings and have no callmap to lose.
    assert.equal(t.join.voiceBookings, 5);
  });

  test('a missing key_source is the skip — that is what #180 would drop', () => {
    assert.equal(t.join.verified, 3);
    assert.equal(t.join.skips, 2);
    assert.equal(t.join.verified + t.join.skips, t.join.voiceBookings);
  });

  test('the rate is skips over voice bookings, as a percentage', () => {
    assert.equal(t.skipRatePct, 40);
    assert.match(formatReport(t), /qualifier-skip rate: 40\.0%/);
  });

  test('a cookie-only verified key is a GAIN under #180, not a voice booking', () => {
    assert.equal(t.join.cookieOnlyKey, 1);
  });

  test('claims_nothing is reported so an opt-out is not read as a skip', () => {
    assert.equal(t.join.claimsNothing, 1);
  });

  test('the qualifier_join histogram covers every join line', () => {
    // Spread before comparing: the histogram is a null-prototype object on
    // purpose, so a delivery spelling `qualifier_join=__proto__` increments a
    // key instead of writing the prototype. deepEqual compares prototypes.
    assert.equal(Object.getPrototypeOf(t.join.byJoin), null);
    assert.deepEqual({ ...t.join.byJoin }, {
      attached: 3,
      verified_no_summary: 1,
      unverified: 2,
      none: 1,
    });
    const total = Object.values(t.join.byJoin).reduce((a, b) => a + b, 0);
    assert.equal(total, EXPECTED_QUALIFIER_JOIN_LINES);
  });

  test('no voice booking means no rate — null, never NaN and never 0%', () => {
    const empty = tally(j('[postcall] no contact resolved: absent — nothing written'));
    assert.equal(empty.join.voiceBookings, 0);
    assert.equal(empty.skipRatePct, null);
    // 0% would read as "nothing is skipping", which is the opposite of "we did
    // not observe a single voice booking, so this window decides nothing".
    assert.match(formatReport(empty), /qualifier-skip rate: n\/a/);
  });
});

describe('ADAM-POSTCALL-OBSERVABILITY-R1 — defensive parsing', () => {
  const t = tally(FIXTURE);

  test('unrecognised messages land in `other`', () => {
    // [booking/create] ok · [clio] calendar entries read · the pretty GET line ·
    // the truncated JSON object · the exception message. Five.
    assert.equal(t.counts.other, 5);
  });

  test('blank and whitespace-only lines are skipped, not counted as other', () => {
    assert.equal(tally('\n\n   \n\t\n').counts.other, 0);
    assert.equal(tally('\n\n   \n').lines, 0);
    assert.equal(tally('\n\n   \n').messages, 0);
  });

  test('every message is accounted for: the counts reconcile against the total', () => {
    const summed = Object.values(t.counts).reduce((a, b) => a + b, 0);
    assert.equal(summed, t.messages);
  });

  test('malformed and hostile input never throws', () => {
    const nasty = [
      '',
      '{',
      '{"logs": null}',
      '{"logs": [{"message": null}]}',
      '{"logs": [{"message": {"nested": true}}]}',
      '{"logs": [{}]}',
      '[1,2,3]',
      'null',
      '  binary-ish',
      '{"logs":[{"message":["[postcall] fields applied count=1 names=urgency"]}]}',
    ].join('\n');
    let out;
    assert.doesNotThrow(() => { out = tally(nasty); });
    assert.equal(out.counts.applied, 1);
    assert.doesNotThrow(() => formatReport(out));
  });

  test('a non-string capture is tallied as empty rather than throwing', () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      assert.doesNotThrow(() => tally(bad));
      assert.equal(tally(bad).messages, 0);
    }
  });

  test('classify never throws on a non-string and answers null', () => {
    for (const bad of [undefined, null, 42, {}, [], '']) {
      assert.equal(classify(bad), null);
    }
  });

  test('both capture formats are read: json logs[] and a plain line', () => {
    assert.deepEqual(
      extractMessages(j('[postcall] fields applied count=4 names=urgency')),
      ['[postcall] fields applied count=4 names=urgency'],
    );
    assert.deepEqual(
      extractMessages('[postcall] fields applied count=4 names=urgency'),
      ['[postcall] fields applied count=4 names=urgency'],
    );
    // A pretty-format capture must tally identically to a json one.
    const pretty = '[postcall] fields applied count=4 names=urgency,summary';
    assert.equal(tally(pretty).counts.applied, 1);
  });

  test('a multi-argument console call is joined, not dropped', () => {
    const line = JSON.stringify({
      logs: [{ message: ['[postcall]', 'fields applied count=4 names=urgency'], level: 'log' }],
    });
    assert.equal(tally(line).counts.applied, 1);
  });
});

describe('ADAM-POSTCALL-OBSERVABILITY-R1 — the category table is honest', () => {
  test('every category names the source line it was quoted from', () => {
    for (const c of CATEGORIES) {
      assert.ok(c.literal && typeof c.literal === 'string', `${c.key} has no literal`);
      assert.match(c.source, /\.js:\d+/, `${c.key} does not cite a source line`);
      assert.ok(c.label, `${c.key} has no label`);
    }
  });

  test('no category literal is a substring of another', () => {
    // The failure this guards: adding `[postcall] fields applied` above a broader
    // `[postcall] fields` would silently reclassify half the table, and first-match
    // ordering would hide it.
    for (const a of CATEGORIES) {
      for (const b of CATEGORIES) {
        if (a.key === b.key) continue;
        assert.ok(
          !a.literal.includes(b.literal),
          `${a.key} literal contains ${b.key} literal — first-match ordering is load-bearing`,
        );
      }
    }
  });

  test('category keys are unique', () => {
    const keys = CATEGORIES.map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});
