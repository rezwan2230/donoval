// Isolate the Turnstile widget from the booking flow.
//
// The page is FULFILLED at a path on https://www.donovan.law, so the browser's
// origin — which is what the sitekey's domain allow-list is checked against — is
// the real production origin. Nothing is requested from the origin except the
// Turnstile script itself. Nothing is written anywhere.
//
// Two variables are being separated:
//   A. sitekey / domain configuration  → would surface as 110200 (unknown domain)
//   B. automation detection            → reduced below as far as a driver can
//
//   node test/preview/probe-turnstile-isolated-a42.mjs
import { chromium } from 'playwright';

const SITEKEY = '0x4AAAAAAD3X3AEk_IbefC4I';
const ORIGIN = 'https://www.donovan.law';

const PAGE = `<!doctype html><meta charset="utf-8"><title>ts</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
<div id="m"></div>
<script>
  window.__r = { errors: [], ok: null, token: null, widgetId: null };
  function go() {
    try {
      window.__r.widgetId = window.turnstile.render('#m', {
        sitekey: ${JSON.stringify(SITEKEY)},
        callback: function (t) { window.__r.ok = true; window.__r.token = (t || '').length; },
        'error-callback': function (c) { window.__r.errors.push(String(c)); window.__r.ok = false; },
      });
    } catch (e) { window.__r.errors.push('threw:' + String(e)); }
  }
  var t = setInterval(function () { if (window.turnstile && window.turnstile.render) { clearInterval(t); go(); } }, 100);
</script>`;

async function run(label, opts) {
  const browser = await chromium.launch({ headless: false, args: opts.args || [] });
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 800 },
    userAgent: opts.userAgent,
    locale: 'en-US',
  });
  if (opts.stealth) {
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });
  }
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  await page.route(`${ORIGIN}/a42-turnstile-probe`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  await page.goto(`${ORIGIN}/a42-turnstile-probe`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(15000);
  const res = await page.evaluate(() => {
    const m = document.getElementById('m');
    const kids = m ? [...m.children] : [];
    return {
      ...window.__r,
      childCount: kids.length,
      childIds: kids.map((k) => k.id || k.tagName),
      iframe: !!(m && m.querySelector('iframe')),
      responseInput: !!(m && m.querySelector('input[name="cf-turnstile-response"]')),
      origin: location.origin,
    };
  });
  await browser.close();
  return { label, ...res, pageErrors };
}

console.log(JSON.stringify(await run('plain-headed', {}), null, 2));
console.log(JSON.stringify(await run('stealth-headed', {
  stealth: true,
  args: ['--disable-blink-features=AutomationControlled'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}), null, 2));
