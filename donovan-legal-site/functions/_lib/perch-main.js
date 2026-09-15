// ── SHELDON-PERCH-A01: the canonical swap container ───────────────────────────
//
// THE DEFECT (frontend review B2). The site is ~143 hand-authored HTML files that
// share no common region. A survey of the tree found **30 distinct body shapes**:
// 92 pages bury the site nav four levels deep (`div.box > div.border-grey >
// div.container > nav.menubar`) with the page content as a LATER SIBLING of that
// container; 3 put the nav in a body-level `<header>`; 47 have no site nav at all;
// 15 already ship a `<main>` of their own. A client-side router therefore has
// nothing stable to swap — `perch-router.js` today falls back to replacing
// `document.body.innerHTML` wholesale, which is why the nav and the persistent
// layer have to be torn down and re-attached on every navigation.
//
// This module injects ONE canonical region — `<main id="perch-main">` — into the
// HTML as it is served, so the router gets a fixed selector on every page and no
// page file is edited. The site nav and the persistent layers (the `.dl-callbar`
// click-to-call bar, the widget root, and the Perch orb in the shell) stay OUTSIDE
// it, because those are exactly the things a swap must not destroy.
//
// ── WHY TWO PASSES, AND WHY THE RESPONSE IS BUFFERED ─────────────────────────
// HTMLRewriter (lol-html) is a STREAMING rewriter with no lookahead. Injecting a
// wrapper needs an open tag and a close tag at the SAME depth — insert them at
// mismatched depths and the browser's parser silently closes `<main>` at the first
// enclosing `</div>`, leaving an empty container with the content outside it. But
// which depth is correct cannot be known when the open tag has to be written:
//
//   • On a `div.box` page the open belongs after `</div.container>` (the nav's
//     block) and the close before `</div.border-grey>` — one level up.
//   • On a `<header>` page that same "one level up" rule wraps nothing, because
//     the nav's block is the only child of its parent; the anchors are body-level.
//   • On a page with NO site nav the open belongs at the first body child — but
//     "has no site nav" is only knowable AFTER the nav would have appeared.
//
// So the plan is computed in a first HTMLRewriter pass over a buffered copy, and
// applied in a second. Cost: pages here are 44 KB on average, 152 KB at the
// largest, so the buffer is trivial and the extra parse is sub-millisecond. HTML
// responses are already `no-store` (see the stale-nonce note in _middleware.js),
// so nothing downstream was relying on the streamed body.
//
// REJECTED ALTERNATIVE — a checked-in path→shape map. It removes the second parse
// but it is a 143-entry artifact that goes stale silently whenever a page is
// restructured, and a page whose shape changed would still match its old anchors
// and wrap the wrong region. The scan is derived from the bytes actually served,
// so it cannot drift.
//
// ── THE PLAN IS EXPRESSED AS ORDINALS, NOT SELECTORS ─────────────────────────
// The scan does not record "wrap at `div.border-grey`". It records "open after the
// 31st `</div>`, close before the 50th". Both passes parse the SAME bytes with the
// SAME parser, so the Nth end tag is the same element in both — and the anchors
// carry no assumption about class names, so a new page template needs no change
// here. `decidePlan` finds those ordinals from the nav's live div-ancestor stack,
// not from a hardcoded shape list.

/** The one selector the router is allowed to depend on. */
export const CONTAINER_ID = 'perch-main';

const OPEN_TAG = `<main id="${CONTAINER_ID}">`;
const CLOSE_TAG = '</main>';

/**
 * Body-level nodes that must never end up inside the container.
 *
 * `dl-callbar` is the sticky mobile click-to-call bar (JORDAN-LAUNCH-POLISH) and
 * `dvn-perch-root` is the widget root the router already detaches by hand — both
 * are persistent chrome, not page content. `script`/`noscript`/`template` are
 * excluded because a swap re-executes whatever it finds inside the container, and
 * the trailing vendor tags (jQuery, Bootstrap, the Perch beacon) must not re-run.
 */
const PERSISTENT_CLASSES = ['dl-callbar'];
const PERSISTENT_IDS = ['dvn-perch-root'];
const NON_CONTENT_TAGS = ['script', 'noscript', 'template'];

/**
 * The Perch orb. A document that hosts it is the concierge SHELL (perch.html,
 * served at `/`), which iframes the real site — it is not a swappable page, and
 * wrapping it would put the persistent orb layer inside the container. Keyed on
 * the orb element rather than on the path so a renamed/duplicated shell is still
 * recognised.
 */
const ORB_SELECTOR = 'div#concierge';

/** The site nav. NOT `nav` — the tool pages carry their own in-content sidebar
 *  navs (`.oa-nav`, `.struct-nav`, `.econ-nav`) which ARE swappable content. */
const SITE_NAV_SELECTOR = 'nav.menubar';

function isNonContent(kid) {
  if (NON_CONTENT_TAGS.includes(kid.tag)) return true;
  if (PERSISTENT_IDS.includes(kid.id)) return true;
  const classes = kid.cls.split(/\s+/);
  return PERSISTENT_CLASSES.some((c) => classes.includes(c));
}

/** Fresh accumulator for a scan pass. */
export function newScan() {
  return {
    /** every element start, in document order — used to tell "wraps content" from "wraps nothing" */
    elemStarts: 0,
    /** `</div>` count, the ordinal space the plan is written in */
    divEnds: 0,
    /** live stack of open <div>s */
    divStack: [],
    /** snapshot of divStack taken at the site nav's start tag */
    navDivStack: null,
    /** index of the body child that contains the site nav (-1 = no site nav) */
    navBodyKidIndex: -1,
    /** body children in order: {tag, cls, id} */
    bodyKids: [],
    /** `<main>` elements already in the page */
    mains: [],
    /** persistent-layer elements, in document order: {ordinal, divDepth, divEnds} */
    persistent: [],
    hasOrb: false,
  };
}

/**
 * Handlers for pass 1. Registered on a real HTMLRewriter; the output is discarded,
 * only `scan` matters.
 */
export function scanHandlers(scan) {
  return [
    ['*', { element() { scan.elemStarts++; } }],

    // Every <div> pushes; its end tag pops and stamps the two numbers the plan is
    // built from. <div> is used rather than '*' on purpose: divs always carry an
    // explicit end tag, whereas <p>/<li>/<td> are routinely left implicitly closed
    // in this tree and would desynchronise a generic stack.
    ['div', {
      element(el) {
        const frame = { endDivOrdinal: null, elemStartsAtEnd: null };
        scan.divStack.push(frame);
        el.onEndTag(() => {
          frame.endDivOrdinal = scan.divEnds++;
          frame.elemStartsAtEnd = scan.elemStarts;
          if (scan.divStack.length) scan.divStack.pop();
        });
      },
    }],

    // Persistent chrome wherever it is authored. On most pages it sits at body
    // level and falls outside the container for free, but `the-cmm2.html` authors
    // the call bar INSIDE the nav's wrapper, where the div-family anchors would
    // otherwise swallow it. Registered AFTER the 'div' handler above so that, for
    // a layer that is itself a <div>, `divStack` already contains it — which makes
    // `divDepth === navDivStack.length` mean exactly "sibling of the nav's block".
    ...PERSISTENT_CLASSES.map((cls) => [`.${cls}`, {
      element() {
        scan.persistent.push({
          ordinal: scan.persistent.length,
          divDepth: scan.divStack.length,
          divEnds: scan.divEnds,
        });
      },
    }]),

    ['body > *', {
      element(el) {
        scan.bodyKids.push({
          tag: el.tagName.toLowerCase(),
          cls: el.getAttribute('class') || '',
          id: el.getAttribute('id') || '',
        });
      },
    }],

    [SITE_NAV_SELECTOR, {
      element() {
        if (scan.navDivStack) return; // first site nav wins; the mobile overlay nests inside it
        scan.navDivStack = scan.divStack.slice();
        scan.navBodyKidIndex = scan.bodyKids.length - 1;
      },
    }],

    ['main', { element(el) { scan.mains.push({ id: el.getAttribute('id') }); } }],

    [ORB_SELECTOR, { element() { scan.hasOrb = true; } }],
  ];
}

/**
 * Turn a completed scan into an injection plan.
 *
 * Order of the cases is the whole argument:
 *   1. shell            → do nothing (the orb must stay outside any container)
 *   2. page already has exactly one un-id'd <main> → STAMP it. Wrapping instead
 *      would nest one <main> inside another, which is a conformance error and
 *      gives assistive tech two `main` landmarks. The page's own <main> already
 *      IS its content region, so it is the better container anyway.
 *   3. the nav sits in a div whose PARENT holds the content → wrap between them
 *   4. otherwise the split is at body level, after whichever body child holds the
 *      nav (or from the first child when there is no site nav), and before the
 *      trailing run of scripts / persistent layers
 *   5. nothing to wrap → do nothing, and say so (the caller reports it)
 */
export function decidePlan(scan) {
  if (scan.hasOrb) return { kind: 'skip', reason: 'perch shell' };

  if (scan.mains.length === 1 && !scan.mains[0].id) return { kind: 'stamp' };

  // A pre-existing <main> that we are about to wrap. Not fatal at runtime — the
  // container is still unique and correctly placed — but it is a nesting the CI
  // check asserts never happens, so it surfaces instead of rotting.
  const nestedMain = scan.mains.length > 0;

  const stack = scan.navDivStack;
  if (stack && stack.length >= 2) {
    const container = stack[stack.length - 1];
    const wrapper = stack[stack.length - 2];
    const closed = container.endDivOrdinal !== null && wrapper.endDivOrdinal !== null;
    // "> 0 element starts between the two end tags" is the test for "the parent
    // actually holds content after the nav". On a <header> page it is 0, which is
    // precisely why that shape falls through to the body-level case below.
    const contentElements = closed ? wrapper.elemStartsAtEnd - container.elemStartsAtEnd : 0;
    if (closed && contentElements > 0) {
      // Close early if persistent chrome is authored as a sibling of the nav's
      // block: it must stay outside the container even when the page buries it
      // inside the wrapper. Same depth, so `</main>` before it still nests.
      const stranded = scan.persistent.find(
        (p) => p.divDepth === stack.length
          && p.divEnds > container.endDivOrdinal
          && p.divEnds <= wrapper.endDivOrdinal,
      );
      return {
        kind: 'wrap-div',
        openAfterDivEnd: container.endDivOrdinal,
        closeBeforeDivEnd: stranded ? null : wrapper.endDivOrdinal,
        closeBeforePersistent: stranded ? stranded.ordinal : null,
        nestedMain,
      };
    }
  }

  const kids = scan.bodyKids;
  let close = kids.length;
  while (close > 0 && isNonContent(kids[close - 1])) close--;
  const open = scan.navBodyKidIndex >= 0 ? scan.navBodyKidIndex + 1 : 0;
  if (close - open <= 0) return { kind: 'skip', reason: 'no swappable content' };

  return {
    kind: 'wrap-body',
    openBeforeBodyKid: open,
    closeBeforeBodyKid: close < kids.length ? close : null, // null → close at </body>
    nestedMain,
  };
}

/**
 * Handlers for pass 2. `plan` came from `decidePlan` over the SAME bytes, so the
 * ordinals below land on the elements the scan measured.
 */
export function injectHandlers(plan) {
  if (plan.kind === 'stamp') {
    let done = false;
    return [['main', {
      element(el) {
        if (done) return;
        done = true;
        el.setAttribute('id', CONTAINER_ID);
      },
    }]];
  }

  if (plan.kind === 'wrap-div') {
    let seen = 0;
    const handlers = [['div', {
      element(el) {
        el.onEndTag((tag) => {
          const n = seen++;
          // after() on the container's end tag and before() on its parent's put
          // both injected tags at the same nesting depth — the only arrangement
          // the browser parser will honour.
          if (n === plan.openAfterDivEnd) tag.after(OPEN_TAG, { html: true });
          if (n === plan.closeBeforeDivEnd) tag.before(CLOSE_TAG, { html: true });
        });
      },
    }]];
    if (plan.closeBeforePersistent !== null && plan.closeBeforePersistent !== undefined) {
      let ordinal = 0;
      for (const cls of PERSISTENT_CLASSES) {
        handlers.push([`.${cls}`, {
          element(el) {
            if (ordinal++ === plan.closeBeforePersistent) el.before(CLOSE_TAG, { html: true });
          },
        }]);
      }
    }
    return handlers;
  }

  if (plan.kind === 'wrap-body') {
    let seen = 0;
    const handlers = [['body > *', {
      element(el) {
        const n = seen++;
        if (n === plan.openBeforeBodyKid) el.before(OPEN_TAG, { html: true });
        if (n === plan.closeBeforeBodyKid) el.before(CLOSE_TAG, { html: true });
      },
    }]];
    if (plan.closeBeforeBodyKid === null) {
      handlers.push(['body', { element(el) { el.onEndTag((tag) => tag.before(CLOSE_TAG, { html: true })); } }]);
    }
    return handlers;
  }

  return [];
}

/**
 * Pass 1 driver. `Rewriter` is injected so the test suite can drive the same code
 * with a real lol-html build outside the Workers runtime.
 *
 * The output stream is drained and thrown away — HTMLRewriter is lazy, so the
 * handlers only run while something reads the transformed body.
 */
export async function planFromHtml(html, Rewriter) {
  const scan = newScan();
  let rewriter = new Rewriter();
  for (const [selector, handler] of scanHandlers(scan)) rewriter = rewriter.on(selector, handler);
  await rewriter.transform(new Response(html)).arrayBuffer();
  return decidePlan(scan);
}
