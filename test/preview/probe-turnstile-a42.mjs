// Focused differential: does Turnstile fail on production because production is
// broken, or because it refuses THIS browser? Same page, same sitekey, run once
// headless and once headed. Nothing here writes: it stops at the details form.
//
//   node test/preview/probe-turnstile-a42.mjs
import { chromium } from 'playwright';

const BASE = process.env.A42_BASE_URL || 'https://www.donovan.law';
const WRITE_RE = /(\/booking\/create|\/web-call|\/fn\/(qualifier_submit|save_lead|take_message|booking_confirmed)|upsert-lead)/;

async function run(headless) {
  const browser = await chromium.launch({ headless });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route((u) => WRITE_RE.test(u.href), (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(`${BASE}/book?unlock=dev`, { waitUntil: 'networkidle' });
  const res = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (s) => document.querySelector(s);
    const waitFor = async (s, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (q(s)) return true; await sleep(200); } return false; };
    if (!await waitFor('#dl-booking .dl-bk-date-btn:not([disabled])', 25000)) return { why: 'no days' };
    q('#dl-booking .dl-bk-date-btn:not([disabled])').click(); await sleep(2500);
    if (!await waitFor('#dl-booking .dl-bk-slot-btn:not([disabled])', 20000)) return { why: 'no slots' };
    q('#dl-booking .dl-bk-slot-btn:not([disabled])').click(); await sleep(1200);
    // Since JORDAN-BOOKING-WIDGET-DETAILS-R1 the slot click advances to the
    // details step on its own, so #dl-bk-next is no longer on this path.
    // Press it only if this build renders one; what this probe is after is the
    // Turnstile mount inside the details form, not the button that used to
    // precede it. Bailing on "no next" would report a working widget as broken.
    if (q('#dl-bk-next')) { q('#dl-bk-next').click(); await sleep(1500); }
    if (!await waitFor('#dl-bk-form', 10000)) return { why: 'no details form' };
    await sleep(6000);
    const mount = q('#dl-bk-turnstile');
    const kids = mount ? [...mount.children] : [];
    return {
      mountPresent: !!mount,
      childCount: kids.length,
      childIds: kids.map((k) => k.id || k.tagName).slice(0, 5),
      // A successfully RENDERED widget mints a cf-chl-widget-* id. This is the
      // identity check the A23 work settled on, because an iframe count is not
      // portable across hosts.
      widgetId: kids.map((k) => k.id).find((i) => /cf-chl-widget/.test(i || '')) || null,
      iframePresent: !!(mount && mount.querySelector('iframe')),
      responseInput: !!(mount && mount.querySelector('input[name="cf-turnstile-response"]')),
      tokenLength: (() => { const i = mount && mount.querySelector('input[name="cf-turnstile-response"]'); return i ? i.value.length : null; })(),
      sitekeyOnMount: mount ? (mount.getAttribute('data-sitekey') || null) : null,
    };
  });
  await browser.close();
  return { headless, ...res, errors };
}

const headlessRun = await run(true);
console.log('HEADLESS', JSON.stringify(headlessRun, null, 2));
const headedRun = await run(false);
console.log('HEADED  ', JSON.stringify(headedRun, null, 2));
