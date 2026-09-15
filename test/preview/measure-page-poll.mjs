// ── ADAM-PAGEPOLL-THROTTLE-R1 · the before/after measurement ─────────────────
//
// Task 5: "measure per-call invocation count before and after on a representative
// flow and show the reduction." Task 6: "confirm the reduced polling visibly cuts
// the page-poll log volume."
//
// ── WHAT IS BEING COUNTED, AND WHY IT IS THE LOG VOLUME TOO ──────────────────
// One request to /fn/page-poll is one Worker invocation AND one request record in
// the Workers log — that is the same event seen from two sides, which is why a
// single counter answers both tasks. The other two counters are here so a cut in
// one place cannot hide a rise in another: `doDrains` is the bridge reads the
// Function performs (the work that used to happen once per browser request and
// now happens inside the held one), and `commandLogs` is the `[perch]` line the
// browser console prints, which must NOT drop — a quieter log that lost commands
// is not a fix.
//
// ── THE CONTROL IS REAL CODE, NOT A CONSTANT ─────────────────────────────────
// The "before" arm runs the SAME shipped loop against a Function that does not
// hold — which is exactly what an older deployment answers, and exactly what the
// fall-back path is written for. It re-polls on POLL_MS and produces the
// pre-ticket cadence. So the two arms differ in one bit (does the server hold?)
// and nothing else, and a change that broke the fall-back would show up here as a
// control that no longer reproduces ~1 Hz.
//
// `--legacy` additionally measures the module as it stands on `origin/main`,
// pulled through `git show`, for the record. That arm needs a git checkout, so it
// is opt-in and is NOT what the CI assertion in test/page-poll-throttle.test.mjs
// reads.
//
//   node test/preview/measure-page-poll.mjs
//   node test/preview/measure-page-poll.mjs --legacy

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { makeVirtualClock } from '../helpers/virtual-clock.mjs';
import { makeDurableObject } from '../helpers/stubs.mjs';

/** A three-minute consultation — the shape the tail is full of. */
export const CALL_MS = 180000;

/**
 * What Paula queues, and when. Times are seconds into the call.
 *
 * These are the three commands a booking call actually produces: she opens the
 * qualifier card, then the coalesced `goto_booking` + prefill pair the bridge
 * serves as one `batch`, then a date pick. Every one of them has to arrive in
 * both arms or the throttle broke the signal.
 */
export const SCRIPT = [
  { at: 20000, action: { cmd: 'open_qualifier', payload: { lang: 'en', source: 'web' } } },
  {
    at: 45000,
    action: {
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: '/book.html' },
        { cmd: 'booking_prefill', payload: { name: 'Ada Lovelace', email: 'ada@example.test' } },
      ],
    },
  },
  { at: 80000, action: { cmd: 'booking_show_date', payload: { day: '2026-08-12' } } },
];

/**
 * Run one arm.
 *
 * @param {object} opts
 * @param {string} opts.channelUrl  module URL of the command-channel to drive
 * @param {boolean} opts.hold       does the Function hold the connection open?
 * @param {string} opts.pagePollUrl module URL of the page-poll handler to serve with
 */
export async function measureArm({ channelUrl, hold, pagePollUrl }) {
  const { createCommandChannel } = await import(channelUrl);
  const { onRequestGet } = await import(pagePollUrl);

  const clock = makeVirtualClock();
  const bridge = makeDurableObject();
  const env = { PERCH_BRIDGE: bridge };
  const CALL_ID = 'call_measure_1';

  let invocations = 0;
  let commandLogs = 0;
  const delivered = [];

  const host = {
    drive: (cmd, target, payload) => delivered.push({ at: clock.now(), cmd, payload }),
    go: (href) => delivered.push({ at: clock.now(), cmd: 'navigate', target: href }),
    afterNavigate: () => {},
    onContentReady: () => {},
  };

  // The browser side of the wire. Every call here is one Worker invocation and
  // one log line; the Function it hands off to is the real one.
  const win = {
    location: { origin: 'https://www.donovan.law', href: 'https://www.donovan.law/contact' },
    localStorage: { setItem: () => {}, getItem: () => null },
    addEventListener: () => {},
    fetch: async (url, init) => {
      invocations++;
      const headers = Object.assign({}, (init && init.headers) || {});
      // An arm that does not hold is an older deployment: it never saw the header.
      if (!hold) delete headers['x-perch-wait'];
      const request = new Request('https://www.donovan.law' + String(url), {
        headers,
        signal: init && init.signal,
      });
      return onRequestGet({ request, env });
    },
  };

  const realLog = console.log;
  console.log = (...a) => { if (String(a[0]).indexOf('[perch]') === 0) commandLogs++; };

  clock.install();
  try {
    const channel = createCommandChannel(host, { openQualifier: () => delivered.push({ at: clock.now(), cmd: 'open_qualifier' }) }, win);
    channel.start(CALL_ID);

    // When each command was QUEUED, which is what delivery latency is measured
    // from. Recorded per arm rather than read off SCRIPT so the two arms cannot
    // silently disagree about when Paula spoke.
    const queuedAt = {};
    let t = 0;
    for (const step of SCRIPT) {
      await clock.advance(step.at - t);
      t = step.at;
      // Paula's side: do_page_action's write, at the DO's own door.
      await bridge.get(bridge.idFromName('donovan')).fetch('https://do/set', {
        body: JSON.stringify({ call_id: CALL_ID, action: step.action }),
      });
      const members = step.action.cmd === 'batch' ? step.action.actions : [step.action];
      for (const m of members) if (queuedAt[m.cmd] === undefined) queuedAt[m.cmd] = t;
    }
    await clock.advance(CALL_MS - t);

    // The call ends the way js/donovan-widget.js ends it.
    channel.stop();
    const afterStop = invocations;
    await clock.advance(60000);

    return {
      invocations,
      invocationsAfterStop: invocations - afterStop,
      doDrains: bridge.reads.length,
      commandLogs,
      delivered,
      queuedAt,
      /** Delivery latency per command: how long after Paula queued it it landed. */
      latency: Object.fromEntries(Object.keys(queuedAt).map((cmd) => {
        const hit = delivered.find((d) => d.cmd === cmd);
        return [cmd, hit ? hit.at - queuedAt[cmd] : null];
      })),
      probe: channel.probe(),
      polling: channel.probe().polling,
    };
  } finally {
    console.log = realLog;
    clock.restore();
  }
}

const SITE = new URL('../../donovan-legal-site/', import.meta.url);
export const CHANNEL_URL = new URL('js/perch/command-channel.js', SITE).href;
export const PAGE_POLL_URL = new URL('functions/fn/page-poll.js', SITE).href;

/**
 * Both arms of the headline measurement: the same shipped loop, once against a
 * Function that holds and once against one that does not.
 */
export async function measure() {
  const before = await measureArm({ channelUrl: CHANNEL_URL, pagePollUrl: PAGE_POLL_URL, hold: false });
  const after = await measureArm({ channelUrl: CHANNEL_URL, pagePollUrl: PAGE_POLL_URL, hold: true });
  return { before, after, ratio: before.invocations / Math.max(1, after.invocations) };
}

/**
 * The `origin/main` loop, for the record.
 *
 * Extracted with `git show` rather than by checking out a second worktree, and
 * imported through pathToFileURL because a bare Windows path is not a module
 * specifier. Its one import — nothing — makes it safe to drop in a temp dir.
 */
async function measureLegacy(root) {
  const src = execFileSync('git', ['show', 'origin/main:donovan-legal-site/js/perch/command-channel.js'], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  const dir = mkdtempSync(join(tmpdir(), 'pagepoll-'));
  const file = join(dir, 'command-channel.main.mjs');
  writeFileSync(file, src);
  return measureArm({
    channelUrl: pathToFileURL(file).href,
    // Served by the NEW Function, which is the true before/after: the old loop
    // never sends `x-perch-wait`, so it takes the un-held path by itself.
    pagePollUrl: PAGE_POLL_URL,
    hold: true,
  });
}

function row(name, r) {
  const missed = SCRIPT.length - new Set(r.delivered.map((d) => d.cmd)).size;
  return [
    name.padEnd(34),
    String(r.invocations).padStart(12),
    String(r.doDrains).padStart(10),
    String(r.commandLogs).padStart(9),
    String(r.invocationsAfterStop).padStart(11),
    (missed <= 0 ? 'yes' : 'NO').padStart(10),
  ].join(' ');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { before, after, ratio } = await measure();
  const arms = [['BEFORE — no server hold (1.2 s)', before], ['AFTER  — server holds 25 s', after]];
  if (process.argv.includes('--legacy')) {
    const root = new URL('../../', import.meta.url);
    arms.unshift(['origin/main setInterval loop', await measureLegacy(root)]);
  }
  console.info(`\nADAM-PAGEPOLL-THROTTLE-R1 — ${CALL_MS / 1000}s call, ${SCRIPT.length} commands queued\n`);
  console.info([
    'arm'.padEnd(34), 'invocations'.padStart(12), 'DO drains'.padStart(10),
    '[perch]'.padStart(9), 'after stop'.padStart(11), 'delivered'.padStart(10),
  ].join(' '));
  console.info('-'.repeat(90));
  for (const [name, r] of arms) console.info(row(name, r));
  console.info('-'.repeat(90));
  console.info(`\nreduction: ${before.invocations} → ${after.invocations} invocations = ${ratio.toFixed(1)}x fewer\n`);
  console.info('delivery latency — how long after Paula queued it each command landed:\n');
  for (const [name, r] of arms) {
    const lat = Object.entries(r.latency).map(([c, ms]) => `${c}=${ms === null ? 'NEVER' : ms + 'ms'}`).join('  ');
    console.info(`${name.padEnd(34)} ${lat}`);
    console.info(`${''.padEnd(34)} still polling after stop(): ${r.polling} · probe.stopped: ${JSON.stringify(r.probe.stopped)}`);
  }
  console.info('');
}
