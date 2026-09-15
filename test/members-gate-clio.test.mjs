// MEMBERS — the Clio-gated engagement-level gate (ORDER MEMBERS-CLIO-GATED-ACCESS-R1).
//
// WHAT SHIPS
// `memberGuard(level)` replaces `tierGuard(level)` on the four level middlewares.
// The credential stops being a shared per-level password held in a Cloudflare
// secret and becomes a signed cookie whose payload is the engagement level Clio
// returned for the member's own contact.
//
// THESE TESTS RUN THE GUARD. THEY DO NOT READ IT.
// JORDAN-MEMBERS-MARKETING documented the control that makes this non-negotiable:
// a middleware rewritten to keep the `tierGuard` import and call but export
// `context.next()` PASSED the source-shape assertion while being a completely
// disabled gate. Only the behavioural arm caught it. So every assertion below
// invokes the middleware against a real Request and checks the Response — and,
// on every deny path, that `next()` was never reached. A gate that returns 302
// after already serving the content is not a gate.
//
// THE PROPERTY WORTH PROTECTING MOST
// There is no list of levels anywhere in the server code. The guard compares the
// label Clio returned against the folder name, case-insensitively, and that is the
// entire decision. `opens a level this code has never heard of` is the test that
// pins it: if anyone ever adds an enum, an allow-list, or a rank ladder, that test
// goes red. It is the reason the firm can add an engagement level with a picklist
// option and a folder instead of a deploy.
//
// WHAT IS DELIBERATELY NOT TESTED HERE
// The Clio lookup itself (`resolveTier`) talks to a live API and is covered by the
// endpoint tests, not by these. This file is about the DECISION, not the fetch.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  memberGuard,
  mintSession,
  readSession,
  clearSession,
  MEMBER_COOKIE,
} from '../donovan-legal-site/functions/_lib/member-auth.js';
import { checkOrigin } from '../donovan-legal-site/functions/_lib/abuse.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const GATE_JS = fileURLToPath(new URL('../donovan-legal-site/js/members-gate.js', import.meta.url));

const SECRET = 'test-signing-secret-not-a-real-one';
const env = { MEMBERS_SESSION_SECRET: SECRET };

const req = (url, cookie) =>
  new Request(url, cookie ? { headers: { Cookie: cookie } } : undefined);

/** Build a context whose next() records whether the gate ever reached the content. */
function ctx(request, environment) {
  const state = { served: false };
  return [
    {
      request,
      env: environment,
      next: async () => {
        state.served = true;
        return new Response('MEMBER CONTENT');
      },
    },
    state,
  ];
}

/** A Set-Cookie value reduced to the `name=value` a browser would send back. */
const asCookie = (setCookie) => setCookie.split(';')[0];

const sessionFor = async (level, environment = env, now = undefined) =>
  asCookie(await mintSession(level, environment, now));

describe('memberGuard — fail closed', () => {
  test('an unset MEMBERS_SESSION_SECRET answers 503 and never serves', async () => {
    const [c, state] = ctx(req('https://www.donovan.law/gold/'), {});
    const res = await memberGuard('gold')(c);
    assert.equal(res.status, 503, 'an environment that cannot verify a session must refuse');
    assert.equal(state.served, false, 'next() must not be reached');
  });

  test('503 is returned rather than a redirect', async () => {
    // A redirect would look like an ordinary signed-out member and would leave the
    // real cause — a missing Pages variable — invisible to the only person who can
    // fix it. This is the same rule tier-auth.js states for its own 503.
    const [c] = ctx(req('https://www.donovan.law/gold/'), {});
    const res = await memberGuard('gold')(c);
    assert.notEqual(res.status, 302);
  });
});

describe('memberGuard — no session', () => {
  test('redirects to the public membership page for the level requested', async () => {
    const [c, state] = ctx(req('https://www.donovan.law/gold/'), env);
    const res = await memberGuard('gold')(c);
    assert.equal(res.status, 302);
    assert.match(res.headers.get('Location') || '', /\/membership-gold/);
    assert.equal(state.served, false);
  });

  test('each level redirects to its own page, not a shared one', async () => {
    for (const level of ['gold', 'platinum', 'diamond', 'reserve']) {
      const [c] = ctx(req(`https://www.donovan.law/${level}/`), env);
      const res = await memberGuard(level)(c);
      assert.match(res.headers.get('Location') || '', new RegExp(`/membership-${level}`));
    }
  });
});

describe('memberGuard — a valid session', () => {
  test('the matching level opens', async () => {
    const [c, state] = ctx(req('https://www.donovan.law/gold/', await sessionFor('Gold')), env);
    const res = await memberGuard('gold')(c);
    assert.equal(res.status, 200);
    assert.equal(state.served, true, 'the positive arm — without it, "refuses everyone" would pass');
  });

  test('the response is marked private and uncacheable', async () => {
    const [c] = ctx(req('https://www.donovan.law/gold/', await sessionFor('Gold')), env);
    const res = await memberGuard('gold')(c);
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  });

  test('the level match is case-insensitive', async () => {
    // Clio holds the label as the firm typed it — "Gold", "GOLD", "gold" are one
    // level, and a member must not be locked out by the firm's capitalisation.
    for (const spelling of ['Diamond', 'DIAMOND', 'diamond']) {
      const [c] = ctx(req('https://www.donovan.law/diamond/', await sessionFor(spelling)), env);
      assert.equal((await memberGuard('diamond')(c)).status, 200, spelling);
    }
  });

  test('the session slides — every page inside a level renews it', async () => {
    const [c] = ctx(req('https://www.donovan.law/gold/tool-1031-exchange.html', await sessionFor('Gold')), env);
    const res = await memberGuard('gold')(c);
    assert.ok(
      (res.headers.get('Set-Cookie') || '').startsWith(`${MEMBER_COOKIE}=`),
      'expiry must be measured from last activity, not from sign-in',
    );
  });
});

describe('memberGuard — levels are independent, not ranked', () => {
  test('a Gold session does not open Platinum', async () => {
    const [c, state] = ctx(req('https://www.donovan.law/platinum/', await sessionFor('Gold')), env);
    const res = await memberGuard('platinum')(c);
    assert.equal(res.status, 302);
    assert.equal(state.served, false);
  });

  test('a Reserve session does not open Gold either — there is no hierarchy', async () => {
    // Reserve is the firm's most selective level, and it still does not open Gold.
    // A member paid for a level; a wrong link opens THEIR room, never a different one.
    const [c, state] = ctx(req('https://www.donovan.law/gold/', await sessionFor('Reserve')), env);
    assert.equal((await memberGuard('gold')(c)).status, 302);
    assert.equal(state.served, false);
  });

  test('the redirect carries the level actually held, verbatim', async () => {
    // This is what lets the sign-in card say "you're a Platinum member — enter The
    // Partners Room" instead of dead-ending. The label is echoed exactly as Clio
    // spelled it; the guard does not know any room names.
    const [c] = ctx(req('https://www.donovan.law/gold/', await sessionFor('Platinum')), env);
    const loc = (await memberGuard('gold')(c)).headers.get('Location') || '';
    assert.match(loc, /holds=Platinum/);
  });
});

describe('memberGuard — the cookie cannot be forged or replayed', () => {
  test('a tampered signature is refused', async () => {
    const good = await sessionFor('Gold');
    const [body, sig] = good.slice(`${MEMBER_COOKIE}=`.length).split('.');
    const forged = `${MEMBER_COOKIE}=${body}.${'a'.repeat(sig.length)}`;
    const [c, state] = ctx(req('https://www.donovan.law/gold/', forged), env);
    assert.equal((await memberGuard('gold')(c)).status, 302);
    assert.equal(state.served, false);
  });

  test('an upgraded payload without a matching signature is refused', async () => {
    // The attack this exists for: take a real Gold cookie, rewrite the payload to
    // say Reserve, keep the signature. It must not open Reserve.
    const payload = Buffer.from(JSON.stringify({ t: 'Reserve', e: Date.now() + 3.6e6 }))
      .toString('base64url');
    const good = await sessionFor('Gold');
    const sig = good.split('.')[1];
    const [c, state] = ctx(req('https://www.donovan.law/reserve/', `${MEMBER_COOKIE}=${payload}.${sig}`), env);
    assert.equal((await memberGuard('reserve')(c)).status, 302);
    assert.equal(state.served, false);
  });

  test('rotating the signing secret invalidates every existing session at once', async () => {
    const before = await sessionFor('Gold');
    const [c, state] = ctx(req('https://www.donovan.law/gold/', before), {
      MEMBERS_SESSION_SECRET: 'rotated-in-an-emergency',
    });
    assert.equal((await memberGuard('gold')(c)).status, 302, 'the emergency revoke-all');
    assert.equal(state.served, false);
  });

  test('an expired session is refused even with a valid signature', async () => {
    const stale = await sessionFor('Gold', env, Date.now() - 13 * 3600 * 1000);
    const [c, state] = ctx(req('https://www.donovan.law/gold/', stale), env);
    assert.equal((await memberGuard('gold')(c)).status, 302);
    assert.equal(state.served, false);
  });

  test('a garbage cookie is refused rather than throwing', async () => {
    for (const junk of ['', 'nonsense', 'a.b.c', `${MEMBER_COOKIE}=`, `${MEMBER_COOKIE}=....`]) {
      const [c, state] = ctx(req('https://www.donovan.law/gold/', junk), env);
      const res = await memberGuard('gold')(c);
      assert.equal(res.status, 302, junk);
      assert.equal(state.served, false, junk);
    }
  });
});

describe('the cookie carries no personal data', () => {
  test('the payload is the level and an expiry, and nothing else', async () => {
    const value = (await sessionFor('Gold')).slice(`${MEMBER_COOKIE}=`.length).split('.')[0];
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString());
    assert.deepEqual(Object.keys(payload).sort(), ['e', 't']);
    assert.equal(payload.t, 'Gold');
  });

  test('no email, name, or contact id appears anywhere in the Set-Cookie', async () => {
    const setCookie = await mintSession('Gold', env);
    for (const leak of ['@', 'email', 'contact', 'name']) {
      assert.ok(!setCookie.toLowerCase().includes(leak), `cookie must not carry ${leak}`);
    }
  });

  test('the cookie is HttpOnly, Secure, SameSite=Lax and site-wide', async () => {
    const setCookie = await mintSession('Gold', env);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Lax/);
    // Path=/ and not /gold: a Platinum member landing on /gold/ must still present
    // a cookie, or the guard sees an anonymous visitor and dead-ends them.
    assert.match(setCookie, /Path=\//);
  });

  test('it is a session cookie — closing the browser ends it', async () => {
    assert.ok(!/Max-Age|Expires/i.test(await mintSession('Gold', env)));
  });

  test('signing out clears it', async () => {
    assert.match(clearSession(), /Max-Age=0/);
    assert.equal(await readSession(req('https://www.donovan.law/', asCookie(clearSession())), env), null);
  });
});

describe('no list of levels exists in the server code', () => {
  test('opens a level this code has never heard of', async () => {
    // THE LOAD-BEARING TEST. The firm adds "Sapphire" as a picklist option in Clio
    // and creates a /sapphire/ folder. No deploy, no ticket, no engineer. If anyone
    // ever introduces an enum, an allow-list or a rank ladder, this goes red — which
    // is the point of writing it down as a test rather than as a comment.
    const [c, state] = ctx(req('https://www.donovan.law/sapphire/', await sessionFor('Sapphire')), env);
    assert.equal((await memberGuard('sapphire')(c)).status, 200);
    assert.equal(state.served, true);
  });

  test('and still refuses a level the member does not hold', async () => {
    const [c, state] = ctx(req('https://www.donovan.law/sapphire/', await sessionFor('Gold')), env);
    assert.equal((await memberGuard('sapphire')(c)).status, 302);
    assert.equal(state.served, false);
  });
});

describe('mintSession refuses to issue an unverifiable session', () => {
  test('throws when the signing secret is unset', async () => {
    // HMAC with an empty key is a perfectly valid HMAC, so without this the gate
    // would mint cookies anyone could forge and look like it was working.
    await assert.rejects(() => mintSession('Gold', {}), /MEMBERS_SESSION_SECRET/);
  });
});

describe('checkOrigin — same-origin accept (preview must be reviewable)', () => {
  // The members endpoints exist on every deployment. With only the fixed
  // production allow-list, a preview build answered 403 to every sign-in — which
  // looks exactly like an attack being blocked, so the reviewer debugs the wrong
  // thing. This was found on the live preview, not in a test, which is why it is
  // now a test.
  const post = (url, origin) =>
    new Request(url, { method: 'POST', headers: origin ? { Origin: origin } : {} });

  test('a preview deployment accepts its own origin', () => {
    const url = 'https://members-clio-gated-tier-acce.donovan-site.pages.dev/members/auth/signin';
    const origin = 'https://members-clio-gated-tier-acce.donovan-site.pages.dev';
    assert.equal(checkOrigin(post(url, origin), {}).ok, false, 'without the opt it is refused');
    assert.equal(checkOrigin(post(url, origin), {}, { allowSameOrigin: true }).ok, true);
  });

  test('production is unaffected — it was already on the allow-list', () => {
    const url = 'https://www.donovan.law/members/auth/signin';
    assert.equal(checkOrigin(post(url, 'https://www.donovan.law'), {}).ok, true);
    assert.equal(checkOrigin(post(url, 'https://www.donovan.law'), {}, { allowSameOrigin: true }).ok, true);
  });

  test('a DIFFERENT origin is still refused, opt or no opt', () => {
    // The accept is "the page was served by the host it posted to" — the textbook
    // CSRF check. It is not "any origin will do".
    const url = 'https://members-clio-gated-tier-acce.donovan-site.pages.dev/members/auth/signin';
    for (const evil of ['https://evil.example', 'https://donovan-site.pages.dev.evil.example', 'null']) {
      assert.equal(checkOrigin(post(url, evil), {}, { allowSameOrigin: true }).ok, false, evil);
    }
  });

  test('a request with no Origin at all is still refused', () => {
    const url = 'https://members-clio-gated-tier-acce.donovan-site.pages.dev/members/auth/signin';
    assert.equal(checkOrigin(post(url), {}, { allowSameOrigin: true }).ok, false);
  });
});

describe('arriving from the gate redirect — no dead end', () => {
  // memberGuard sends an unauthenticated visitor to /membership-<level>?signin=1.
  // On the first live run nothing read that parameter, so the redirect landed on
  // the public page with no card and no explanation — the exact dead end this work
  // exists to remove. These pin the contract between the two halves.
  const boot = (href) => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: href,
      runScripts: 'outside-only',
    });
    dom.window.fetch = () => new Promise(() => {});   // config fetch never settles
    dom.window.eval(readFileSync(GATE_JS, 'utf8'));
    return dom.window.document;
  };

  test('?signin=1 on a membership page opens that level\'s card', () => {
    const doc = boot('https://www.donovan.law/membership-gold?signin=1');
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Strategy Room');
  });

  test('the level comes from the PATH, not the query', () => {
    // A crafted ?signin=1 must not be able to open a card for a different room
    // than the page is about. It decides nothing, but it should not mislead either.
    const doc = boot('https://www.donovan.law/membership-reserve?signin=1&tier=gold');
    assert.equal(doc.getElementById('dvnmg-title').textContent, 'The Reserve Room');
  });

  test('&holds=Platinum offers the member their own room', () => {
    const doc = boot('https://www.donovan.law/membership-gold?signin=1&holds=Platinum');
    const link = doc.getElementById('dvnmg-elsewhere');
    assert.equal(link.hidden, false);
    assert.match(link.textContent, /Partners Room/);
    assert.equal(link.getAttribute('href'), '/platinum/');
    // The SENTENCE names the level, the BUTTON names the room. Asserting both
    // separately is the point: passing the room to both produced "You are a The
    // Partners Room member." live, and a test that only checked for "Partners
    // Room" somewhere on the card passed straight through it.
    const msg = doc.getElementById('dvnmg-signin-msg').textContent;
    assert.match(msg, /You are a Platinum member/);
    assert.doesNotMatch(msg, /You are a The /, 'the level, not the room, belongs in the sentence');
  });

  test('a level the client has never heard of degrades to its own name', () => {
    // The fallback that makes a new engagement level a Clio edit rather than a deploy.
    const doc = boot('https://www.donovan.law/membership-gold?signin=1&holds=Sapphire');
    const link = doc.getElementById('dvnmg-elsewhere');
    assert.match(link.textContent, /Sapphire/);
    assert.equal(link.getAttribute('href'), '/sapphire/');
    assert.match(doc.getElementById('dvnmg-signin-msg').textContent, /You are a Sapphire member/);
  });

  test('no ?signin=1 means no card — the public page stays a public page', () => {
    const doc = boot('https://www.donovan.law/membership-gold');
    assert.equal(doc.getElementById('dvnmg-card'), null);
  });
});

describe('the gate never lets a per-identity answer be cached', () => {
  // Found by sweeping the live preview's response headers, not by a test. The 200
  // and 503 arms already carried no-store; the 302 carried nothing. A 302 is not
  // cacheable by default, but that depends on every intermediary agreeing, and the
  // failure is silent: a member signs in, opens their own room, and a cached
  // redirect bounces them back to the sign-in card with nothing going red.
  const cases = [
    ['no session', undefined, 302],
    ['wrong level', 'Gold', 302],
  ];

  for (const [name, level, expected] of cases) {
    test(`${name} → ${expected} carries no-store`, async () => {
      const cookie = level ? await sessionFor(level) : undefined;
      const [c] = ctx(req('https://www.donovan.law/platinum/', cookie), env);
      const res = await memberGuard('platinum')(c);
      assert.equal(res.status, expected);
      assert.match(res.headers.get('Cache-Control') || '', /no-store/);
      assert.ok(res.headers.get('Location'), 'the redirect must still redirect');
    });
  }

  test('the served page carries no-store as well', async () => {
    const [c] = ctx(req('https://www.donovan.law/gold/', await sessionFor('Gold')), env);
    const res = await memberGuard('gold')(c);
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  });

  test('an unconfigured environment carries no-store', async () => {
    const [c] = ctx(req('https://www.donovan.law/gold/'), {});
    const res = await memberGuard('gold')(c);
    assert.match(res.headers.get('Cache-Control') || '', /no-store/);
  });
});
