/**
 * JORDAN-PAUL-CONTENT — the Paul batch content deltas (#224, #225, #226) as pure
 * string transforms over the CURRENT `main` copies.
 *
 * ── WHY THIS IS A MODULE AND NOT A PATCH ─────────────────────────────────────
 *
 * Same reason `scripts/a11y/waiver-edits.mjs` is one: three statements have to be
 * made about the same edits, and they must be made from a single definition.
 *
 *   • `apply-paul-content.mjs` writes them to disk;
 *   • `waiver-evidence.mjs` re-derives the "after" from `origin/main`'s "before"
 *     and requires it to be BYTE-IDENTICAL to what is on disk — so the waiver
 *     register describes the diff that actually shipped, not a proposal; and
 *   • the same before/after pair is fed to the real `planFromHtml` and to the
 *     guards `structuralWaiver` enforces.
 *
 * ── WHAT IS DELIBERATELY NOT DONE HERE ───────────────────────────────────────
 *
 * NOTHING is copied out of Paul's package files. Paul's copies are a stale fork
 * of this site: they carry the pre-#195 brand green `#169B62` where `main` now
 * has `#107A4D`, and they predate every `lang`/`aria-*`/`role` attribute PR #220
 * and #221 shipped. Overlaying one of his pages would revert both in one move and
 * neither revert would show up as a test failure. So every transform below is an
 * INSERTION into, or a text replacement inside, the file as `main` has it, and
 * every colour it introduces is read off `main`'s own `tax-controversy.html`.
 *
 * Paul's insertion OFFSETS are ignored for the same reason the order says to
 * ignore them: 11 of his 14 land mid-word or mid-entity. Every insertion here is
 * anchored on a string that is unique in the file, and `apply-paul-content.mjs`
 * fails loud when an anchor does not match exactly once.
 *
 * ── THE ONE STRUCTURAL DECISION ──────────────────────────────────────────────
 *
 * #225 names the anchor as "immediately before `<div class="dl-connect">`". On
 * all 36 pages that anchor is a direct child of `div.border-grey` — a sibling of
 * the page's `div.container`, NOT a node inside the content column. Dropped in
 * bare, a `.dl-cta` panel there would run edge to edge and sit out of alignment
 * with every section above it. Each inserted block is therefore wrapped, in a
 * `div.dl-endcap` that restates Bootstrap's `.container` metrics.
 *
 * A LITERAL `class="container"` WAS TRIED FIRST AND IS WRONG, and the suite is
 * what says so rather than taste: `test/perch-main.test.mjs` reported 35 changed
 * selector match sets. The reason is the injector. The nav's `div.container`
 * sits OUTSIDE `main#perch-main`, but anything at this anchor is INSIDE it, so a
 * `.container` here reads as `.box > .border-grey > .container` before the edge
 * runs and as `.box > .border-grey > main#perch-main > .container` after — and
 * `.box > .border-grey > .container{position:relative;z-index:100}`, the single
 * most load-bearing child combinator on this site, silently stops applying to it.
 * `.dl-endcap` is referenced by no combinator anywhere, so it cannot do that.
 */

const S = 'donovan-legal-site/';

// ── The anchor ───────────────────────────────────────────────────────────────

/**
 * The two lines that open the click-to-call block, byte for byte, on all 36
 * pages. Matched as a PAIR rather than on `<div class="dl-connect">` alone so the
 * comment stays attached to the block it describes and the new content lands
 * above both, and so a page that ever grew a second `.dl-connect` would stop
 * matching once instead of being edited twice.
 */
const CONNECT_ANCHOR = '      <!-- JORDAN-LAUNCH-POLISH: click-to-call / email / social. Styles live in css/main.css. -->\n      <div class="dl-connect">';

/**
 * Insert `block` immediately above the click-to-call block.
 *
 * The whitespace run in front of the anchor is rewritten to exactly one blank
 * line rather than being left alone: eleven of these pages already carry a blank
 * line there and ten do not, so appending would leave the tree with two
 * different spacings for the same edit.
 */
function insertBeforeConnect(s, block) {
  if (s.split(CONNECT_ANCHOR).length !== 2) return s; // 0 or 2+ matches → no edit; the applier reports it
  const at = s.indexOf(CONNECT_ANCHOR);
  let head = at;
  while (head > 0 && /\s/.test(s[head - 1])) head--;
  return `${s.slice(0, head)}\n\n${block}${s.slice(at)}`;
}

// ── CSS ports ────────────────────────────────────────────────────────────────
//
// Copied out of `donovan-legal-site/tax-controversy.html` on `main` — the page
// that already carries these rules — so the ported values are `main`'s values.
// That includes `.dl-cta-btn-2 .n{color:#806633}`, which is the DARKENED gold
// PR #220 landed for contrast; Paul's package still spells it `#C9A961` on the
// dark green panel, which is the 2.2:1 pairing that order was opened to fix.

/**
 * The wrapper that lines an inserted block up with the content column.
 *
 * Bootstrap's own `.container` metrics, restated under a name no selector on this
 * site reaches through a combinator. `width`, the two paddings, the two auto
 * margins and the four breakpoint max-widths are copied from
 * `css/bootstrap.min.css`; nothing here is a structure-sensitive selector, so the
 * differential in `test/perch-main.test.mjs` has nothing new to see.
 */
const CSS_ENDCAP = `
    /* JORDAN-PAUL-CONTENT — content-column wrapper for the end-of-page blocks.
       Bootstrap .container metrics under a name no combinator selects, so the
       injected <main> cannot change what .box > .border-grey > .container matches. */
    .dl-endcap{width:100%;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}
    @media (min-width:576px){.dl-endcap{max-width:540px}}
    @media (min-width:768px){.dl-endcap{max-width:720px}}
    @media (min-width:992px){.dl-endcap{max-width:960px}}
    @media (min-width:1200px){.dl-endcap{max-width:1140px}}
`;

const CSS_CREDS = `
    /* JORDAN-PAUL-CONTENT (#225) — credibility band. Values as on tax-controversy.html. */
    .dl-creds{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin:2.2rem 0;
      border:1px solid #d9d7d1;border-left:4px solid #C9A961;background:#fff;border-radius:3px}
    .dl-cred{flex:1 1 0;min-width:150px;padding:16px 18px;border-right:1px solid #ece9e3;
      text-align:center}
    .dl-cred:last-child{border-right:0}
    .dl-cred-n{display:block;font-family:Georgia,serif;font-size:1.42rem;font-weight:700;
      color:#0C5334;line-height:1.1}
    .dl-cred-l{display:block;font-size:.7rem;letter-spacing:1.3px;text-transform:uppercase;
      color:#6e6e6e;font-weight:700;margin-top:.35rem}
    @media (max-width:760px){
      .dl-cred{flex:1 1 45%;border-right:0;border-bottom:1px solid #ece9e3}
    }
`;

const CSS_CTA = `
    /* JORDAN-PAUL-CONTENT (#225) — conversion call-out. Values as on tax-controversy.html. */
    .dl-cta{margin:2.6rem 0;padding:30px 32px 28px;background:#0C5334;
      border-left:6px solid #C9A961;border-radius:4px}
    .dl-cta-q{font-family:Georgia,'Times New Roman',serif;font-size:1.44rem;font-weight:700;
      color:#F6F5F1;line-height:1.25;margin:0}
    .dl-cta-s{font-size:.92rem;color:#C6D8CC;margin:.5rem 0 0;line-height:1.55;max-width:62ch}
    .dl-cta-act{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:1.5rem;
      max-width:640px}
    .dl-cta-btn{display:flex;flex-direction:column;justify-content:center;align-items:center;
      min-height:78px;padding:12px 18px;border-radius:3px;text-align:center;font-family:inherit;
      text-decoration:none;cursor:pointer;border:2px solid #C9A961;
      transition:background .16s ease,color .16s ease}
    .dl-cta-btn .l{display:block;font-size:.72rem;letter-spacing:1.5px;text-transform:uppercase;
      font-weight:700;margin-bottom:4px}
    .dl-cta-btn .n{display:block;font-size:1.22rem;font-weight:700;letter-spacing:.4px;
      line-height:1.2}
    .dl-cta-btn-1{background:#C9A961;color:#0C5334}
    .dl-cta-btn-1 .l{color:#0C5334;opacity:.72}
    .dl-cta-btn-1 .n{color:#0C5334}
    .dl-cta-btn-1:hover{background:#dcc07f;color:#0C5334;text-decoration:none}
    .dl-cta-btn-2{background:transparent}
    .dl-cta-btn-2 .l{color:#C6D8CC}
    .dl-cta-btn-2 .n{color:#806633}
    .dl-cta-btn-2:hover{background:rgba(201,169,97,.14);text-decoration:none}
    .dl-cta-note{font-size:.76rem;color:#A1BDAA;margin:.9rem 0 0;line-height:1.5}
    @media (max-width:860px){
      .dl-cta{padding:24px}
      .dl-cta-q{font-size:1.2rem}
      .dl-cta-act{grid-template-columns:1fr}
    }
`;

/**
 * The library cross-link band (#226). No page on `main` carries a `.dl-refs`
 * rule, so unlike the two above this one is authored rather than ported — but
 * every value in it is already in use on `main`'s controversy pages, in the same
 * pairing:
 *   #806633 on #F6F5F1 is `.dl-two-l` on `.dl-two-item` (the darkened gold #220
 *   landed); #0C5334 on #F6F5F1 is darker again; and #107A4D on #F6F5F1 measures
 *   4.92:1, over the 4.5:1 floor for body text. Nothing here reintroduces the
 *   old brand green.
 */
const CSS_REFS = `
    /* JORDAN-PAUL-CONTENT (#226) — library cross-links. Palette as on tax-controversy.html. */
    .dl-refs{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:2.4rem 0 .4rem;
      padding-top:1.6rem;border-top:1px solid #d4d4d0}
    .dl-refs-col{padding:20px 22px;background:#F6F5F1;border:1px solid #e0ded8;
      border-left:3px solid #C9A961;border-radius:3px}
    .dl-refs-l{display:block;font-size:.7rem;letter-spacing:1.6px;text-transform:uppercase;
      font-weight:700;color:#806633;margin-bottom:.6rem}
    .dl-refs-list{list-style:none;margin:0;padding:0}
    .dl-refs-list li{margin:0 0 .5rem;line-height:1.5}
    .dl-refs-list li:last-child{margin-bottom:0}
    .dl-refs-list a{color:#0C5334;font-weight:600;font-size:.92rem}
    .dl-refs-list a:hover{color:#107A4D}
    @media (max-width:760px){
      .dl-refs{grid-template-columns:1fr}
    }
`;

/**
 * Append CSS to the LAST `<style>` in the head.
 *
 * Keyed on the last `</style>` BEFORE `</head>` rather than on the first, because
 * `tool-1031-exchange.html` carries two head style blocks and the first one is
 * not where its page rules live. A page whose CSS already carries the marker is
 * left alone, so re-running the applier is a no-op rather than a duplication.
 */
function appendHeadCss(s, css, marker) {
  if (s.includes(marker)) return s;
  const headEnd = s.indexOf('</head>');
  if (headEnd === -1) return s;
  const at = s.lastIndexOf('</style>', headEnd);
  if (at === -1) return s;
  // Insert at the START of the closing tag's own line, so `</style>` keeps the
  // indentation it had. Inserting at `at` instead leaves the old indent stranded
  // on a whitespace-only line and moves `</style>` to column zero.
  let line = at;
  while (line > 0 && s[line - 1] !== '\n') line--;
  const indent = s.slice(line, at);
  return `${s.slice(0, line)}${css}${indent}${s.slice(at)}`;
}

// ── Block templates ──────────────────────────────────────────────────────────

const CREDS_BAND = `        <div class="dl-creds">
          <div class="dl-cred">
            <span class="dl-cred-n">JD &middot; CPA</span>
            <span class="dl-cred-l">Attorney and accountant</span>
          </div>
          <div class="dl-cred">
            <span class="dl-cred-n">30+</span>
            <span class="dl-cred-l">Years in tax practice</span>
          </div>
          <div class="dl-cred">
            <span class="dl-cred-n">U.S. Tax Court</span>
            <span class="dl-cred-l">Admitted to practice</span>
          </div>
          <div class="dl-cred">
            <span class="dl-cred-n">FL &middot; MA</span>
            <span class="dl-cred-l">Bar admissions</span>
          </div>
          <div class="dl-cred">
            <span class="dl-cred-n">1</span>
            <span class="dl-cred-l">Signature on every return</span>
          </div>
        </div>
`;

const PRACTICE_NOTE = 'Scheduling does not create an attorney-client relationship. No such relationship exists until the firm has run a conflicts check and both sides have signed a written engagement agreement.';
const TOOL_NOTE = 'This tool provides general estimates only and is not legal or tax advice. Scheduling does not create an attorney-client relationship.';

function ctaBlock(headline, subline, note) {
  return `        <div class="dl-cta">
          <p class="dl-cta-q">${headline}</p>
          <p class="dl-cta-s">${subline}</p>
          <div class="dl-cta-act">
            <a href="book.html" class="dl-cta-btn dl-cta-btn-1">
              <span class="l">No charge, 30 minutes</span>
              <span class="n">Book a Free Consultation</span>
            </a>
            <a href="tel:+15615295873" class="dl-cta-btn dl-cta-btn-2">
              <span class="l">Call Donovan Legal</span>
              <span class="n">(561)&nbsp;529-5873</span>
            </a>
          </div>
          <p class="dl-cta-note">${note}</p>
        </div>
`;
}

function conversionBlock({ headline, subline, creds, note }) {
  return `      <!-- JORDAN-PAUL-CONTENT (#225): conversion call-out. -->
      <div class="dl-endcap">
${creds ? CREDS_BAND : ''}${ctaBlock(headline, subline, note)}      </div>

`;
}

function refsColumn(label, links) {
  const items = links
    .map(([href, text]) => `              <li><a href="${href}">${text}</a></li>`)
    .join('\n');
  return `          <div class="dl-refs-col">
            <span class="dl-refs-l">${label}</span>
            <ul class="dl-refs-list">
${items}
            </ul>
          </div>
`;
}

/** The three-link column the order calls "Related". */
const RELATED = [
  ['tax-controversy.html', 'All controversy topics'],
  ['blog.html', 'The full library'],
  ['tools.html', 'Calculators and guides'],
];

function refsBlock(reading, second) {
  return `      <!-- JORDAN-PAUL-CONTENT (#226): library cross-links. -->
      <div class="dl-endcap">
        <div class="dl-refs">
${refsColumn('Further reading', reading)}${refsColumn(second.label, second.links)}        </div>
      </div>

`;
}

// ── #225 — the 13 practice pages and the 8 tool pages ────────────────────────

/** page → [headline, subline], exactly as issue #225 tabulates them. */
const PRACTICE = {
  'practice.html': ['Tax, real estate, and the disputes that follow.', 'One firm across planning, compliance, and controversy &mdash; and the same signature on all three.'],
  'tax.html': ['Tax work that has to survive being read by someone else.', 'Positions are designed to be reported, and reported to be defended.'],
  'tax-planning.html': ['A plan is only as good as its documentation.', 'The firm that designs the structure reports it, and defends it if the Service disagrees.'],
  'tax-compliance.html': ['Every return leaves this firm under one signature.', 'Prepared and signed by Paul K. Donovan &mdash; attorney and CPA.'],
  'real-estate.html': ['Real estate decisions are tax decisions.', 'Acquisition, ownership, and disposition, with the tax consequence priced in from the start.'],
  're-acquisition.html': ['The structure is decided before the closing, not after.', 'Entity choice, basis, and debt allocation are cheapest to get right at acquisition.'],
  're-disposition.html': ['A sale is the year the planning is tested.', 'Section 1031, installment treatment, and FIRPTA all turn on decisions made before signing.'],
  're-ownership.html': ['Depreciation, allocations, and the passive activity rules.', 'The issues that decide most real estate examinations are set during ownership.'],
  'special-counsel.html': ['Tax counsel to other lawyers&rsquo; matters.', 'Divorce, estate and trust disputes, business divorce, and litigation damages.'],
  'ourfirm.html': ['A tax-first practice built around real estate.', 'Attorney and CPA, thirty years, admitted to the United States Tax Court.'],
  'profile.html': ['Discuss a matter with Paul directly.', 'Attorney and CPA. Admitted in Florida and Massachusetts, and before the U.S. Tax Court.'],
  'tefera.html': ['Controversy support from a former LB&amp;I auditor and manager.', 'Dr. Beyene supports the firm&rsquo;s examination work. Every matter is directed by the firm.'],
  'experience.html': ['These are engagements, not promises.', 'Every matter turns on its own facts. Bring yours and the firm will tell you what it sees.'],
};

const TOOLS = {
  'tool-1031-exchange.html': ['The exchange succeeds or fails on the calendar and the paperwork.', 'Forty-five days to identify, one hundred eighty to close, a qualified intermediary in place before closing, and debt replaced as well as equity. Any one breaks the whole thing.'],
  'tool-capital-gains.html': ['An estimate is not a plan.', 'This calculator does not know your basis history, holding period, state, or what a like-kind exchange or installment sale would do to the same transaction.'],
  'tool-cost-segregation.html': ['The study is the easy part.', 'What decides the benefit is the placed-in-service date, the &sect;&nbsp;481(a) computation on a Form 3115, the partial-asset-disposition elections, and the recapture waiting on exit.'],
  'tool-firpta-withholding.html': ['Withholding is not the tax.', 'It is a deposit against a liability that may be far smaller &mdash; or larger. Reduced-withholding certificates, treaty positions, and the actual gain computation all change what you owe.'],
  'tool-irs-notice-guide.html': ['You have identified the notice. The clock is already running.', 'Every notice here carries a deadline from the date printed on it, and some doors close in thirty days.'],
  'tool-oic-rcp-estimator.html': ['Reasonable collection potential is the whole test.', 'If this estimate is near or above what you owe, an offer will not be accepted, and filing one costs time the collection statute does not refund. There are other alternatives.'],
  'tool-rental-real-estate-tax-strategy-analyzer.html': ['The strategy is only as good as the log.', 'Material participation, real estate professional status, and grouping elections are decided on evidence. What the analyzer models, an examiner will ask you to prove.'],
  'tool-str-strategy-analyzer.html': ['The seven-day rule is a documentation problem.', 'Average stay, material participation hours, and the cost segregation study have to hold up together. The failures are almost always in the record.'],
};

const PRACTICE_FILES = Object.keys(PRACTICE).map((f) => `${S}${f}`);
const TOOL_FILES = Object.keys(TOOLS).map((f) => `${S}${f}`);

// ── #226 — library cross-links on the 15 tax-controversy pages ───────────────

/** Post slug → the link text, taken from that post's own `<title>`. */
const POST = {
  'controversy-roadmap-0-overview': 'The Tax Controversy Roadmap &mdash; Overview',
  'controversy-roadmap-1-processing-assessment': 'Processing and Assessment',
  'controversy-roadmap-2-exam': 'The Exam Station',
  'controversy-roadmap-3-exam-alternatives': 'Exam Alternatives',
  'controversy-roadmap-4-appeals': 'The Appeal Station',
  'controversy-roadmap-5-collection': 'The Collection Station',
  'controversy-roadmap-6-collection-alternatives': 'Collection Alternatives',
  'controversy-roadmap-7-litigation': 'The Litigation Station',
  'irs-audit-notice-what-to-do': 'IRS Audit Notice: What to Do First',
  'penalty-regime-6751b': 'Civil Penalties and the &sect;6751(b) Defense',
  'criminal-tax-overview': 'Criminal Tax: Offenses and Investigation',
  'jeopardy-termination-assessments': 'Jeopardy and Termination Assessments',
  'substitute-for-return': 'The Substitute for Return: How to Undo It',
  'currently-not-collectible-csed': 'Currently Not Collectible and the CSED Clock',
  'passport-revocation-tax-debt': 'Passport Revocation for Tax Debt: &sect;7345',
  'fbar-foreign-account-penalties': 'FBAR and Foreign-Asset Reporting Penalties',
  'civil-fraud-eggshell-audit': 'Civil Tax Fraud and the Eggshell Audit',
  'firpta-foreign-sellers': 'FIRPTA Withholding for Foreign Sellers',
  'irs-levy': 'IRS Levies: How to Stop or Release One',
  'notice-of-federal-tax-lien': 'The Notice of Federal Tax Lien Explained',
  'tenancy-by-entirety-federal-tax-lien': 'Tenancy by the Entirety and the Tax Lien',
  'irs-co-owned-marital-real-estate': 'When One Spouse Owes: Co-Owned Real Estate',
  'foreclose-federal-tax-lien-suit': 'Tax Judgments and Lien Foreclosure Suits',
  'transferee-nominee-alter-ego': 'Transferee, Nominee and Alter-Ego Liability',
  'irs-summons': 'The IRS Summons and How to Fight It',
  'material-participation-seven-tests': 'Material Participation: The Seven Tests',
  'conservation-easement-settlement': 'Conservation Easement Settlement IR-2026-65',
  'tax-opinions': 'Tax Opinions and the Confidence Ladder',
  'kwong-covid-deadlines': 'Kwong and the COVID Refund Window',
  'trust-fund-recovery-penalty': 'The Trust Fund Recovery Penalty (&sect;6672)',
  'character-amount-timing': 'Character, Amount and Timing',
  'partnership-agreement-tax-document': 'The Partnership Agreement as a Tax Document',
  '461l-excess-business-loss-and-172-nol': '&sect;461(l), NOL Carryforward and the 80% Cap',
};

const TOOL_LINK = {
  'tool-irs-notice-guide.html': 'IRS Notice &amp; Correspondence Guide',
  'tool-oic-rcp-estimator.html': 'IRS Offer in Compromise: RCP Estimator',
  'tool-firpta-withholding.html': 'FIRPTA Withholding Calculator',
};

const post = (slug) => [`blog-${slug}.html`, POST[slug]];
const tool = (file) => [file, TOOL_LINK[file]];

/**
 * page → { reading, second }, exactly as issue #226 maps them.
 *
 * `partnership-audits.html` is the one departure, and it is the departure the
 * issue itself asks for: Paul's file points its tool link at
 * `tool-entity-formation-multi.html`. That page DOES exist on `main` (it did not
 * when the issue was written), but the order says to drop the link, so this page
 * takes the three-link `Related` column like its twelve siblings. Flagged in the
 * PR so David can add the tool link back as a one-line follow-up.
 */
const REFS = {
  'tax-controversy.html': {
    reading: ['controversy-roadmap-0-overview', 'irs-audit-notice-what-to-do', 'penalty-regime-6751b', 'criminal-tax-overview'].map(post),
    second: { label: 'Use the tool', links: ['tool-irs-notice-guide.html', 'tool-oic-rcp-estimator.html'].map(tool) },
  },
  'irs-notice.html': {
    reading: ['controversy-roadmap-1-processing-assessment', 'irs-audit-notice-what-to-do', 'jeopardy-termination-assessments', 'substitute-for-return'].map(post),
    second: { label: 'Use the tool', links: ['tool-irs-notice-guide.html'].map(tool) },
  },
  'tax-debt-resolution.html': {
    reading: ['controversy-roadmap-6-collection-alternatives', 'currently-not-collectible-csed', 'passport-revocation-tax-debt'].map(post),
    second: { label: 'Use the tool', links: ['tool-oic-rcp-estimator.html'].map(tool) },
  },
  'voluntary-disclosure.html': {
    reading: ['fbar-foreign-account-penalties', 'criminal-tax-overview', 'civil-fraud-eggshell-audit', 'firpta-foreign-sellers'].map(post),
    second: { label: 'Use the tool', links: ['tool-firpta-withholding.html'].map(tool) },
  },
  'irs-liens-levies.html': {
    reading: ['controversy-roadmap-5-collection', 'irs-levy', 'notice-of-federal-tax-lien', 'tenancy-by-entirety-federal-tax-lien', 'irs-co-owned-marital-real-estate', 'foreclose-federal-tax-lien-suit', 'transferee-nominee-alter-ego'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'irs-audit-defense.html': {
    reading: ['controversy-roadmap-2-exam', 'irs-summons', 'civil-fraud-eggshell-audit', 'penalty-regime-6751b', 'material-participation-seven-tests'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'irs-appeals.html': {
    reading: ['controversy-roadmap-4-appeals', 'penalty-regime-6751b', 'conservation-easement-settlement', 'tax-opinions'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'tax-court.html': {
    reading: ['controversy-roadmap-7-litigation', 'kwong-covid-deadlines', 'tax-opinions'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'tax-penalties.html': {
    reading: ['penalty-regime-6751b', 'trust-fund-recovery-penalty', 'tax-opinions', 'civil-fraud-eggshell-audit'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'audit-reconsideration.html': {
    reading: ['controversy-roadmap-3-exam-alternatives', 'substitute-for-return', 'irs-co-owned-marital-real-estate'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'unfiled-returns.html': {
    reading: ['substitute-for-return', 'criminal-tax-overview', 'controversy-roadmap-1-processing-assessment'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'florida-sales-tax-audit.html': {
    reading: ['controversy-roadmap-2-exam', 'penalty-regime-6751b'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'massachusetts-tax-appeal.html': {
    reading: ['controversy-roadmap-4-appeals', 'controversy-roadmap-7-litigation'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'residency-audit.html': {
    reading: ['irs-co-owned-marital-real-estate', 'character-amount-timing'].map(post),
    second: { label: 'Related', links: RELATED },
  },
  'partnership-audits.html': {
    reading: ['partnership-agreement-tax-document', '461l-excess-business-loss-and-172-nol', 'controversy-roadmap-2-exam'].map(post),
    second: { label: 'Related', links: RELATED },
  },
};

const REFS_FILES = Object.keys(REFS).map((f) => `${S}${f}`);

// ── #224 — the homepage pack ─────────────────────────────────────────────────

const HOME = [`${S}home.html`, `${S}index.html`];

/**
 * The homepage testimonial, replaced text-for-text inside the `<blockquote>` the
 * page already has. Paul's package ships a bare `<blockquote><p>` pair; using it
 * would drop `class="lt-blockquote-large"`, `class="quote-text"` and
 * `class="quote-attribution"`, which is how the band is styled. So only the words
 * move, and the attribution gains the `<br><em>` second line that
 * `testimonials.html` already uses for this same speaker.
 *
 * #224 asks David to choose between this SHORT homepage quote and the fuller one
 * already on `testimonials.html`. The issue's own default is the short one and
 * that is what ships here; the fuller version is a two-line follow-up if he wants
 * it instead.
 */
const OLD_QUOTE = '&ldquo;Paul has been our trusted tax advisor for years. He not only handles our complex personal taxes but also advises my husband on the tax and legal aspects of his construction business. Paul is proactive, thorough, and brings a &lsquo;Big Four&rsquo; level of expertise and service. I have such confidence in Paul&rsquo;s skills that I routinely refer my own wealth management clients to him when they need a knowledgeable, reliable tax and legal resource.&rdquo;';
const NEW_QUOTE = '&ldquo;I&rsquo;ve had the opportunity to work with Paul as co-counsel on several of the most complex and high-stakes divorce matters our firm has handled. Paul is a unicorn who seamlessly bridges the gap between law, tax, accounting, valuation, and forensic litigation strategy. His ability to untangle intricate issues across sophisticated domestic and international asset holding structures &mdash; including foreign trusts, offshore holding companies, closely held businesses, and real estate portfolios &mdash; has been instrumental for our clients. Paul is not only a trusted strategic advisor, but a critical asset for any high-net-worth litigation team.&rdquo;';

const OLD_ATTRIB = '                  <strong>&mdash; Elyssa Coleman-Polster, CRPC&trade;</strong>\n';
const NEW_ATTRIB = '                  <strong>&mdash; Zachary Potter, Esq.</strong><br>\n                  <em>Managing Partner, RFB+Fisher Potter Hodas</em>\n';

/** Bar 4-7.13. Sits between the blockquote and the "Read more testimonials" link. */
const HOME_DISCLAIMER = '              <p>Testimonials reflect the experience of specific clients in specific matters. A prospective client may not obtain the same or similar results.</p>\n';
const READ_MORE_ANCHOR = '              <p style="text-align: right; margin-top: 1.5rem;">\n';

const TESTIMONIALS_DISCLAIMER = '\n                <p>Every matter turns on its own facts, its own record, and its own law. <strong>A prospective client may not obtain the same or similar results.</strong> Nothing on this page is a promise or prediction about any other matter.</p>\n';
const CO_COUNSEL_ANCHOR = '\n                <h5 class="g-bold green" style="margin-top: 2.5rem;">CO-COUNSEL &amp; TAX CONSULTING</h5>';

// ── The edits ────────────────────────────────────────────────────────────────

export const EDITS = [
  {
    rule: '#224 homepage testimonial swap',
    files: HOME,
    apply: (s) => s.replace(OLD_QUOTE, NEW_QUOTE).replace(OLD_ATTRIB, NEW_ATTRIB),
  },
  {
    rule: '#224 homepage testimonial disclaimer',
    files: HOME,
    apply: (s) => (s.includes(HOME_DISCLAIMER) ? s : s.replace(READ_MORE_ANCHOR, `${HOME_DISCLAIMER}${READ_MORE_ANCHOR}`)),
  },
  {
    rule: '#224 self-quote reword',
    files: HOME,
    apply: (s) => s.replace('&ldquo;To be a top tax lawyer, you must have', '&ldquo;To be effective as a tax lawyer, you must have'),
  },
  {
    rule: '#224 testimonials-page disclaimer',
    files: [`${S}testimonials.html`],
    apply: (s) => (s.includes(TESTIMONIALS_DISCLAIMER) ? s : s.replace(CO_COUNSEL_ANCHOR, `${TESTIMONIALS_DISCLAIMER}${CO_COUNSEL_ANCHOR}`)),
  },

  {
    rule: '#225 practice conversion CSS',
    files: PRACTICE_FILES,
    apply: (s) => appendHeadCss(s, `${CSS_ENDCAP}${CSS_CREDS}${CSS_CTA}`, '.dl-creds{'),
  },
  {
    rule: '#225 tool conversion CSS',
    files: TOOL_FILES,
    apply: (s) => appendHeadCss(s, `${CSS_ENDCAP}${CSS_CTA}`, '.dl-cta{'),
  },
  {
    rule: '#225 conversion block',
    files: [...PRACTICE_FILES, ...TOOL_FILES],
    apply: (s, file) => {
      if (s.includes('JORDAN-PAUL-CONTENT (#225)') && s.includes('<div class="dl-cta">')) return s;
      const name = file.slice(S.length);
      const practice = PRACTICE[name];
      const [headline, subline] = practice || TOOLS[name];
      return insertBeforeConnect(s, conversionBlock({
        headline,
        subline,
        creds: Boolean(practice),
        note: practice ? PRACTICE_NOTE : TOOL_NOTE,
      }));
    },
  },

  {
    rule: '#226 library cross-link CSS',
    files: REFS_FILES,
    apply: (s) => appendHeadCss(s, `${CSS_ENDCAP}${CSS_REFS}`, '.dl-refs{'),
  },
  {
    rule: '#226 library cross-link block',
    files: REFS_FILES,
    apply: (s, file) => {
      if (s.includes('<div class="dl-refs">')) return s;
      const { reading, second } = REFS[file.slice(S.length)];
      return insertBeforeConnect(s, refsBlock(reading, second));
    },
  },
];

/** Every file this order edits. */
export const SCOPE = [...new Set(EDITS.flatMap((e) => e.files))].sort();

/** Apply every edit whose scope includes `file` to that file's source. */
export function applyAll(file, source) {
  const key = file.replace(/\\/g, '/');
  let out = source;
  const applied = [];
  for (const e of EDITS) {
    if (!e.files.includes(key)) continue;
    const next = e.apply(out, key);
    if (next !== out) applied.push(e.rule);
    out = next;
  }
  return { after: out, applied };
}

export { CONNECT_ANCHOR, HOME, PRACTICE_FILES, TOOL_FILES, REFS_FILES, PRACTICE, TOOLS, REFS };
