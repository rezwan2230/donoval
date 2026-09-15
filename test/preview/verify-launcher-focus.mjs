// ── JORDAN-LAUNCHER-FOCUS-OUTLINE — the Preview verifier ─────────────────────
//
// Order JORDAN-LAUNCHER-FOCUS-OUTLINE. Cosmetic fix, browser-only proof.
//
//   node test/preview/verify-launcher-focus.mjs [baseUrl] [outDir]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the PNGs it writes beside it.
//
// Named `verify-*.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs a
// live deployment and a real browser, neither of which CI has. Same directory and
// same shape as verify-a41.mjs / verify-a42.mjs.
//
// ── WHY THIS EXISTS AND test/perch-launcher-focus.test.mjs IS NOT ENOUGH ──────
// The defect was never in this repo's CSS. Chrome paints
// `outline: rgb(16,16,16) auto 5px` on a focused <button>, and the launcher is
// the only concierge that IS one — `#concierge` in perch.html is a <div>, which
// is why `/perch` never showed the black rectangle. A claim about what a UA
// paints can only be settled by that UA, so the unit suite pins the stylesheet
// against deletion and this file measures the pixels.
//
// ── NOTHING IS MINTED AND NOTHING IS BOOKED ──────────────────────────────────
// A click on the launcher is the first step of a real call: js/donovan-widget.js
// opens the consent gate and, on agreement, POSTs /web-call for a live Retell
// token. So both the mint URL and the SDK CDN are ABORTED at the route layer
// before any gesture is dispatched, and the walk below DECLINES consent on every
// arm — the mint is unreachable twice over. `mintAttempts` is reported so the
// claim is checked rather than asserted in a comment.
// [[feedback_negative_path_probe_can_write]] — an "error path" probe in this repo
// once booked a real appointment on Paul Donovan's live calendar.
//
// ── THE TRIGGER THIS WALKS, WHICH IS NOT "PRESS TAB" ─────────────────────────
// David photographed the ring mid-call without touching a key. js/consent-gate.js
// captures `document.activeElement` when the modal opens — the launcher, focused
// by the click that opened it — and calls `prevFocus.focus()` when it closes. So
// the ring lands the moment consent is settled and stays for the whole call.
// Arms A and B are the two ways out of that modal; both painted before the fix.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'https://www.donovan.law').replace(/\/$/, '');
const OUT = process.argv[3] || path.join('test', 'preview', 'launcher-focus-evidence');
const PAGE_PATH = '/testimonials';   // a content page: has the layer, has no booking surface
const SEL = '#dvn-perch-launcher';

fs.mkdirSync(OUT, { recursive: true });

/** Everything the verdict is derived from, read out of the live cascade. */
const READ = `(() => {
  const el = document.querySelector('${SEL}');
  if (!el) return { missing: true };
  const disc = el.querySelector('.disc');
  const cs = getComputedStyle(el);
  const ds = disc ? getComputedStyle(disc) : null;
  let fv = null; try { fv = el.matches(':focus-visible'); } catch (_) {}
  const r = el.getBoundingClientRect();
  return {
    focus: el.matches(':focus'),
    focusVisible: fv,
    live: el.classList.contains('live'),
    buttonBox: { width: r.width, height: r.height },
    button: { outline: cs.outline, outlineStyle: cs.outlineStyle, outlineOffset: cs.outlineOffset },
    disc: ds ? { outline: ds.outline, outlineStyle: ds.outlineStyle, outlineOffset: ds.outlineOffset, boxShadow: ds.boxShadow } : null,
  };
})()`;

/**
 * The whole point, in one predicate.
 *
 * "A black rectangle" is a ring painted on the BUTTON — the 116px square box,
 * which has no border-radius. A ring on the `.disc` is a circle by construction
 * (`border-radius: 50%`), so it can never be the reported defect no matter what
 * colour it is. `outlineStyle` is what decides paint: `none` means nothing is
 * drawn regardless of the width and colour the shorthand still reports.
 */
const rectangle = (s) => !!(s && s.button && s.button.outlineStyle !== 'none');
const discRing = (s) => !!(s && s.disc && s.disc.outlineStyle !== 'none');

const browser = await chromium.launch();
const report = { base: BASE, page: PAGE_PATH, arms: {}, cspViolations: [], mintAttempts: 0 };

async function shot(page, name) {
  const el = await page.$(SEL);
  const b = await el.boundingBox();
  const pad = 48;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 },
  });
  return `${name}.png`;
}

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/web-call*', (r) => { report.mintAttempts++; return r.abort(); });
  await page.route('**/esm.sh/**', (r) => r.abort());
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(t)) {
      report.cspViolations.push(t);
    }
  });
  await page.goto(BASE + PAGE_PATH, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector(`${SEL}.perch-concierge`, { timeout: 20000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

// ── ARM A — idle, hover, and the mouse click that starts a call ──────────────
{
  const { ctx, page } = await open();
  const a = { shots: {} };
  a.idle = await page.evaluate(READ);
  a.shots.idle = await shot(page, 'A1-idle');

  const box = await (await page.$(SEL)).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  a.hover = await page.evaluate(READ);
  a.shots.hover = await shot(page, 'A2-hover');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  a.consentModalOpened = !!(await page.$('.dvn-consent-overlay'));
  a.click = await page.evaluate(READ);
  a.shots.click = await shot(page, 'A3-mouse-click');
  report.arms.A_mouse = a;
  await ctx.close();
}

// ── ARM B — the focus RESTORE, which is how the ring reached a live call ─────
// Esc is DECLINE in js/consent-gate.js, so this arm settles consent negatively
// and the mint is never reached. Esc is also a keyboard gesture, which is what
// made the restored focus match :focus-visible before the fix.
for (const [name, dismiss] of [
  ['B_esc_decline', (page) => page.keyboard.press('Escape')],
  ['C_mouse_decline', (page) => page.click('.dvn-consent-btn-decline')],
]) {
  const { ctx, page } = await open();
  const arm = { shots: {} };
  const box = await (await page.$(SEL)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  arm.consentModalOpened = !!(await page.$('.dvn-consent-overlay'));
  if (arm.consentModalOpened) { await dismiss(page); await page.waitForTimeout(1200); }
  arm.modalClosed = !(await page.$('.dvn-consent-overlay'));
  arm.afterRestore = await page.evaluate(READ);
  // Declining raises a notice pill in the same corner the orb sits in, which
  // would photograph over the thing being photographed. The measurement above is
  // already taken; this only clears the lens. Nothing about the launcher, its
  // focus state or its cascade is touched.
  arm.noticeRemovedForShot = await page.evaluate(`(() => {
    const n = document.querySelector('.dvn-consent-decline-notice');
    if (!n) return false; n.remove(); return true;
  })()`);
  arm.shots.afterRestore = await shot(page, `${name}`);
  report.arms[name] = arm;
  await ctx.close();
}

// ── ARM E — the consent gate's restore, replayed ────────────────────────────
//
// Arms B and C need the consent modal, and the modal is not reachable on every
// deployment: Preview runs with CONSENT_TICKET_SECRET unset, so js/consent-gate.js
// fails CLOSED before it renders anything ("no consent ticket issued — refusing to
// start a recorded call"). That is correct behaviour and out of scope here, but it
// means those two arms measure production and abstain on Preview — a before/after
// read across the two would be comparing different states.
//
// This arm removes the environment from the question. It reproduces the one line
// that put the ring on screen — `prevFocus.focus()` at js/consent-gate.js:278 —
// under both input modalities, so the SAME state is measured wherever it runs:
//
//   E1  mouse gesture, then the script focus   (the mouse-decline path, arm C)
//   E2  keyboard gesture, then the script focus (the Esc-decline path, arm B)
//
// The gesture comes first because `:focus-visible` is decided by the last input
// modality, not by the focus() call — driving the modality is the whole point of
// splitting the arm in two. Nothing is clicked on the launcher here, so no call
// path is entered at all.
{
  const { ctx, page } = await open();
  const e = { shots: {} };
  const restore = `document.querySelector('${SEL}').focus()`;

  // Set the mouse modality without navigating: scan for a point whose hit target
  // has no link, button or input above it. A blind click at a fixed coordinate
  // could land on a header logo and take the page with it.
  const inert = await page.evaluate(`(() => {
    for (let y = 200; y < innerHeight - 200; y += 40) {
      for (let x = 40; x < innerWidth - 220; x += 60) {
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest('a, button, input, select, textarea, label, [role="button"], #perch-persistent')) {
          return { x, y };
        }
      }
    }
    return null;
  })()`);
  e.inertPoint = inert;
  if (inert) await page.mouse.click(inert.x, inert.y);
  await page.evaluate(restore);
  await page.waitForTimeout(400);
  e.afterMouseThenRestore = await page.evaluate(READ);
  e.shots.mouse = await shot(page, 'E1-restore-after-mouse');

  await page.evaluate(`document.querySelector('${SEL}').blur()`);
  await page.keyboard.press('Tab');               // switch the modality to keyboard
  await page.evaluate(restore);
  await page.waitForTimeout(400);
  e.afterKeyboardThenRestore = await page.evaluate(READ);
  e.shots.keyboard = await shot(page, 'E2-restore-after-keyboard');

  report.arms.E_restore = e;
  await ctx.close();
}

// ── ARM D — the keyboard, which must still SEE something ────────────────────
{
  const { ctx, page } = await open();
  const d = { shots: {} };
  // A real modality switch: Tab repeatedly from the top of the document until the
  // launcher owns focus. Calling .focus() directly would prove nothing about
  // :focus-visible, which is decided by the last INPUT modality, not by the call.
  await page.evaluate('window.scrollTo(0, 0); document.body.focus();');
  let landed = false;
  for (let i = 0; i < 250 && !landed; i++) {
    await page.keyboard.press('Tab');
    landed = await page.evaluate(`document.activeElement === document.querySelector('${SEL}')`);
  }
  d.reachedByTab = landed;
  d.tabbed = await page.evaluate(READ);
  d.shots.tabbed = await shot(page, 'D1-keyboard-focus');

  // The connected state: the ring must be there AND the green glow must survive.
  await page.evaluate(`document.querySelector('${SEL}').classList.add('live')`);
  await page.waitForTimeout(400);
  d.tabbedLive = await page.evaluate(READ);
  d.shots.tabbedLive = await shot(page, 'D2-keyboard-focus-live');
  report.arms.D_keyboard = d;
  await ctx.close();
}

await browser.close();

// ── the verdict ─────────────────────────────────────────────────────────────
const A = report.arms.A_mouse, B = report.arms.B_esc_decline;
const C = report.arms.C_mouse_decline, D = report.arms.D_keyboard, E = report.arms.E_restore;

// B and C abstain where the consent gate cannot render — see ARM E. An arm that
// never opened the modal never reached the state it exists to measure, and
// scoring it PASS would read as evidence when it is silence.
// [[feedback_secret_gate_unset_means_disabled]] is the same shape: absent
// configuration must not be mistaken for a green result.
const modalArm = (arm, label) => (arm.consentModalOpened
  ? [`${label} focus restore paints no ring on the button box`, !rectangle(arm.afterRestore)]
  : [`${label} focus restore — ABSTAIN, the consent gate did not render here`, true]);

const checks = [
  ['idle paints no ring on the button box', !rectangle(A.idle)],
  ['hover paints no ring on the button box', !rectangle(A.hover)],
  ['a mouse click paints no ring on the button box', !rectangle(A.click)],
  modalArm(B, 'Esc-decline'),
  modalArm(C, 'mouse-decline'),
  ['the gate\'s script focus after a MOUSE gesture paints no black rectangle',
    E.afterMouseThenRestore.focus === true && !rectangle(E.afterMouseThenRestore)],
  ['the gate\'s script focus after a KEYBOARD gesture paints no black rectangle',
    E.afterKeyboardThenRestore.focus === true && !rectangle(E.afterKeyboardThenRestore)],
  ['the launcher is reachable by Tab', D.reachedByTab === true],
  ['keyboard focus is VISIBLE — a ring is painted', discRing(D.tabbed)],
  ['the keyboard ring is on the disc, so it is a circle not a rectangle', !rectangle(D.tabbed)],
  ['the keyboard ring survives into a connected call', discRing(D.tabbedLive)],
  ['a connected call keeps its green drop shadow while focused',
    !!(D.tabbedLive.disc && /rgba\(7, 76, 35/.test(D.tabbedLive.disc.boxShadow))],
  ['zero CSP violations', report.cspViolations.length === 0],
  ['nothing was minted', report.mintAttempts === 0],
];

report.checks = checks.map(([name, ok]) => ({ name, ok }));
report.verdict = checks.every(([, ok]) => ok) ? 'GO' : 'NO-GO';

// ── RECORDED, NOT SCORED: what the caller still sees after the modal closes ──
//
// A real mouse click on the orb leaves it clean — arm A measures `:focus` true
// and `:focus-visible` FALSE, so nothing paints. The gate's restore is different:
// Chrome grants `:focus-visible` to a SCRIPT focus regardless of the modality
// that preceded it, so the brand ring lands when the consent modal closes and
// stays for the call. The black rectangle is gone either way, which is the
// order; a ring is still there, which the order did not ask about.
//
// This is not scored as a failure because suppressing it would mean hiding a
// focus indicator from a keyboard caller at the one moment they most need to
// know the orb is the thing Enter will act on. It is surfaced instead, with the
// screenshot beside it, because a reviewer should decide that and not discover
// it in a screenshot later. Reaching further means changing the restore in
// js/consent-gate.js — the recorded-consent path, out of scope for a cosmetic
// order.
report.residual = {
  note: 'After the consent modal closes the orb keeps a focus ring for the rest of the call. '
      + 'It is the brand ring on the round disc, never the UA rectangle on the square button.',
  realMouseClick: {
    focusVisible: A.click.focusVisible,
    buttonOutlineStyle: A.click.button.outlineStyle,
    discOutline: A.click.disc && A.click.disc.outline,
  },
  scriptRestoreAfterMouse: {
    focusVisible: E.afterMouseThenRestore.focusVisible,
    buttonOutlineStyle: E.afterMouseThenRestore.button.outlineStyle,
    discOutline: E.afterMouseThenRestore.disc && E.afterMouseThenRestore.disc.outline,
    screenshot: 'E1-restore-after-mouse.png',
  },
};

fs.writeFileSync(path.join(OUT, 'verdict.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\n${report.verdict} — ${checks.filter(([, ok]) => ok).length}/${checks.length} · evidence in ${OUT}`);
