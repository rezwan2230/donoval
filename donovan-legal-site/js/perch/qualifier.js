// ── JORDAN-PERCH-A21: the qualifier modal ────────────────────────────────────
//
// Paula fires `open_qualifier` for a domestic real-estate caller so the caller
// TAPS the sensitive figures (residency → income → net worth) instead of saying
// them aloud on a recorded line. On completion the answers POST to
// `/fn/qualifier_submit`, which stores them for Paula (`get_qualifier_result`)
// and forwards them to Vantage.
//
// It belongs in the persistent layer for the same reason the orb does: it is
// opened DURING a call, and a content swap underneath it must not tear the card
// away mid-answer. Lifted verbatim out of `js/page/perch-shell.js` and made
// adopt-or-build so the shell keeps using the markup it already authors.

// DR-INSANE-A33 (#58): the exposure boundary. A sibling specifier, so the same
// file resolves for the browser (`/js/perch/surface.js`, one module instance
// shared with the layer and the router) and for the Node test runner.
import { lockGlobal } from './surface.js';

// JORDAN-PERCH-PHOTO-PAULA: the header wears the concierge's face, not the firm's
// logo mark, and it reads the asset from the one place that spells it.
import { INTAKE_FACE } from './brand.js';

const QUAL_ID = 'qual';
const QUAL_BODY_ID = 'qual-bd';

// ── Question bank ────────────────────────────────────────────────────────────
// SHARED PROFILE block — EVERYONE answers these (light → heavy, money last).
const Q_PROFILE = [
  { key: 'state', type: 'select', step: { en: 'Where you are', es: 'Su ubicación' }, h: { en: 'Which state do you reside in?', es: '¿En qué estado reside?' } },
  { key: 'for_whom', step: { en: 'One more', es: 'Una más' }, h: { en: 'Who does this matter concern?', es: '¿A quién concierne este asunto?' }, opts: [
    { v: 'yourself', t: { en: 'Yourself (personal)', es: 'Usted (personal)' } },
    { v: 'business', t: { en: 'Your business or company', es: 'Su negocio o empresa' } },
    { v: 'family', t: { en: 'A family member', es: 'Un familiar' } },
    { v: 'other_whom', t: { en: 'Other', es: 'Otro' } },
  ] },
  { key: 'income_band', step: { en: 'Ballpark figures', es: 'Cifras aproximadas' }, h: { en: 'Roughly, your annual household income?', es: 'Aproximadamente, ¿su ingreso familiar anual?' }, sub: { en: 'Just a range — no exact numbers.', es: 'Solo un rango — sin cifras exactas.' },
    info: { en: 'This only helps the firm point you to the right kind of help. It never screens you out.', es: 'Esto solo ayuda a orientarle mejor. Nunca lo descalifica.' }, opts: [
    { v: 'under_500k', t: { en: 'Under $500K', es: 'Menos de $500K' } },
    { v: '500k_1_5m', t: { en: '$500K – $1.5M', es: '$500K – $1.5M' } },
    { v: '1_5m_3m', t: { en: '$1.5M – $3M', es: '$1.5M – $3M' } },
    { v: 'above_3m', t: { en: 'Above $3M', es: 'Más de $3M' } },
    { v: 'declined', t: { en: 'Prefer not to say', es: 'Prefiero no decir' }, declined: true },
  ] },
  { key: 'net_worth_band', step: { en: 'Ballpark figures', es: 'Cifras aproximadas' }, h: { en: 'And roughly, household net worth?', es: 'Y aproximadamente, ¿su patrimonio neto familiar?' }, sub: { en: 'Again, just a range.', es: 'De nuevo, solo un rango.' }, opts: [
    { v: 'under_2m', t: { en: 'Under $2M', es: 'Menos de $2M' } },
    { v: '2m_5m', t: { en: '$2M – $5M', es: '$2M – $5M' } },
    { v: '5m_15m', t: { en: '$5M – $15M', es: '$5M – $15M' } },
    { v: 'above_15m', t: { en: 'Above $15M', es: 'Más de $15M' } },
    { v: 'declined', t: { en: 'Prefer not to say', es: 'Prefiero no decir' }, declined: true },
  ] },
];

// ROLE — 2026-09-06 (Grok/Paul): who is in the chair, asked right after the matter. A party,
// their lawyer, their CPA, someone holding a notice, and a sponsor with a deal are five
// different first calls, and on a divorce booking the answer is what lets the office
// run conflicts before the call. Recorded in the note (see NOTE_ANSWER_KEYS); it does
// not change the calendar and it asks for no confidential fact. It sits after the
// matter questions so the matter stays step one -- the step every suite drives.
const Q_ROLE = { key: 'role', step: { en: 'Who is booking', es: 'Quién reserva' }, h: { en: 'Who are you in this matter?', es: '¿Quién es usted en este asunto?' }, opts: [
  { v: 'party', t: { en: 'A party — this is my own matter', es: 'Una parte — es mi propio asunto' } },
  { v: 'counsel', t: { en: 'Counsel for a party (attorney)', es: 'Abogado de una parte' } },
  { v: 'advisor', t: { en: 'A CPA or advisor for a client', es: 'Contador o asesor de un cliente' } },
  { v: 'notice', t: { en: 'I have an IRS or state notice', es: 'Tengo una notificación del IRS o del estado' } },
  { v: 'deal', t: { en: 'A deal, structure or planning question', es: 'Una operación, estructura o planificación' } },
  { v: 'role_not_sure', t: { en: 'Not sure', es: 'No estoy seguro' }, declined: true },
] };

// MATTER — Paula's two-level question. The ONLY tax-vs-RE-specific step; everyone
// then answers the same PROFILE block. Criminal/urgent matters are handled by a
// human, so there is no separate gatekeeping block here.
const Q_MATTER_CAT = { key: 'matter_category', step: { en: 'To start', es: 'Para comenzar' }, h: { en: 'What type of matter would you like to discuss?', es: '¿Qué tipo de asunto desea tratar?' }, opts: [
  { v: 'tax', t: { en: 'Tax', es: 'Impuestos' } },
  { v: 'real_estate', t: { en: 'Real estate', es: 'Bienes raíces' } },
  { v: 'other', t: { en: 'Other', es: 'Otro' } },
  { v: 'not_sure_matter', t: { en: 'Not sure yet', es: 'Aún no estoy seguro' }, declined: true },
] };
const Q_MATTER_TAX = { key: 'matter_sub', step: { en: 'Tax — a bit more', es: 'Impuestos — un poco más' }, h: { en: 'Which best fits?', es: '¿Cuál describe mejor?' }, opts: [
  { v: 'planning', t: { en: 'Planning', es: 'Planificación' } },
  { v: 'compliance', t: { en: 'Compliance', es: 'Cumplimiento' } },
  { v: 'controversy', t: { en: 'Controversy (a dispute with the IRS or state)', es: 'Controversia (disputa con el IRS o el estado)' } },
  { v: 'tax_not_sure', t: { en: 'Not sure', es: 'No estoy seguro' }, declined: true },
] };
const Q_MATTER_RE = { key: 'matter_sub', step: { en: 'Real estate — a bit more', es: 'Bienes raíces — un poco más' }, h: { en: 'Which best fits?', es: '¿Cuál describe mejor?' }, opts: [
  { v: 'acquisition', t: { en: 'Acquisition (buying)', es: 'Adquisición (compra)' } },
  { v: 'ownership', t: { en: 'Ownership (holding or managing)', es: 'Propiedad (tenencia o gestión)' } },
  { v: 'disposition', t: { en: 'Disposition (selling)', es: 'Disposición (venta)' } },
  { v: 're_not_sure', t: { en: 'Not sure', es: 'No estoy seguro' }, declined: true },
] };

// US states for the 'select' step (+ outside-US). Names read the same in ES.
const US_STATES = 'AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'
  .split('|').map((s) => { const i = s.indexOf(' '); return { v: s.slice(0, i), t: s.slice(i + 1) }; });

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── JORDAN-PERCH-NATIVE-BOOK: the answers, as the booking form's note ────────
//
// A completed card used to end at the done state — "Paula has it. She'll pull up
// the calendar" — and then nothing pulled it up. The route onto the calendar
// already existed (js/perch/command-channel.js writes the unlock flag and soft-
// swaps to /book, js/perch/booking-control.js drives the widget on the page);
// what was missing was a trigger from HERE into it. `ctx.onQualified` is that
// trigger, and this is the payload translation the host needs to go with it.
//
// ── THE WIDGET ACCEPTS FOUR FIELDS, AND THIS CARD COLLECTS NONE OF THREE ─────
// `DLBooking.prefill` takes `{name, email, phone, notes}` and nothing else
// (js/booking-widget.js:1627-1634; the same four are the only keys
// `sanitizeBookingArgs` will queue for `booking_prefill`). The qualifier never
// asks for a name, an email or a phone number — the caller types those into the
// booking form themselves. So `notes` is the ONE field the tapped answers can
// legitimately land in, and no new field is invented to hold the rest.
//
// ── WHY THIS IS AN ALLOW-LIST AND WHAT IS DELIBERATELY OFF IT ────────────────
// `income_band` and `net_worth_band` are ABSENT, and their absence is the design:
// the card exists so a caller taps their income and net worth instead of saying
// them aloud on a recorded line, and `notes` is a visible, caller-editable
// textarea whose contents ride into the Clio calendar description
// (functions/booking/_lib/provider-clio.js) where anyone with calendar access
// reads them. The firm already receives both bands by the route built for them —
// `/fn/qualifier_submit` → `get_qualifier_result` + Vantage — so putting them
// here would add a disclosure surface and no information. Same posture, and the
// same reason, as `ALLOWED_WEB_VARS` in functions/_lib/dynamic-vars.js: widening
// the surface has to be a reviewed diff to this list, not a field someone spreads
// in downstream.
//
// The list is the actual filter — `bookingPrefillFrom` copies through it before it
// composes anything — so removing a key from it removes the key from the note, and
// a key that is not on it cannot reach the note by any path.
export const NOTE_ANSWER_KEYS = Object.freeze([
  'matter_category', 'matter_sub', 'role', 'for_whom', 'state', 'source',
]);

/**
 * Per-field bounds, matching `sanitizeBookingArgs` in
 * functions/fn/do_page_action.js.
 *
 * This path does NOT cross that Function: the qualifier hands the payload to the
 * layer, which hands it to the channel's dispatch table in-process. The
 * server-side sanitiser therefore never runs on it, so the same bound is applied
 * here rather than assumed. `SOURCE_MAX` is tighter than the note itself because
 * `source` is free text Paula relays from the caller, and the matter — the part
 * the firm actually needs on the invite — is composed FIRST and must not be the
 * thing a long source truncates away.
 */
export const NOTE_MAX = 500;
export const SOURCE_MAX = 80;

/** Strip control characters and clamp, exactly as `sanitizeBookingArgs` does. */
function clamp(raw, max) {
  const s = String(raw == null ? '' : raw).replace(/[\x00-\x1F\x7F]/g, '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Every tappable option, keyed `questionKey:value`, so a stored answer can be
 * turned back into the words the caller actually read.
 *
 * Built from the question bank above rather than from a second hand-written table:
 * a new option, or a renamed one, cannot fall out of sync with the note.
 * `matter_sub` is contributed by BOTH sub-type questions — their value sets are
 * disjoint (planning/compliance/controversy vs acquisition/ownership/disposition),
 * so one key space holds them without collision.
 */
const OPT_LABEL = new Map();
for (const q of [Q_ROLE, Q_MATTER_CAT, Q_MATTER_TAX, Q_MATTER_RE].concat(Q_PROFILE)) {
  if (!q.opts) continue;
  for (const o of q.opts) OPT_LABEL.set(q.key + ':' + o.v, o.t);
}

/** The `select` step's options are not in `opts`; they are US_STATES. */
const STATE_LABEL = new Map(US_STATES.map((o) => [o.v, o.t]));
STATE_LABEL.set('outside_us', { en: 'Outside the U.S.', es: 'Fuera de EE. UU.' });

/** Segment captions. Bilingual, because the caller reads this field. */
const NOTE_CAPTION = {
  matter: { en: 'Matter', es: 'Asunto' },
  role: { en: 'Booking as', es: 'Reserva como' },
  for_whom: { en: 'For', es: 'Para' },
  state: { en: 'State', es: 'Estado' },
  source: { en: 'Heard via', es: 'Nos conoció por' },
};

/**
 * Turn the normalized answers `onQualified` hands out into the booking prefill
 * the widget already accepts.
 *
 * Pure, exported and side-effect free for the same reason `sanitizeTarget` is:
 * it is the one place agent- and caller-supplied text is shaped before a browser
 * API sees it, so CI has to be able to exercise THIS function rather than a
 * re-implementation of it.
 *
 * @param {object|null} answers as built by `mountQualifier`'s `onQualified`
 * @returns {{notes: string}|null} null when there is nothing worth prefilling
 */
export function bookingPrefillFrom(answers) {
  if (!answers || typeof answers !== 'object') return null;

  // THE FILTER. Nothing below reads `answers` again — only `a` — so a key that is
  // not on NOTE_ANSWER_KEYS has no path into the note, and `call_id` (a bearer
  // credential for the whole bridge) cannot leak into a form field.
  const a = {};
  for (const k of NOTE_ANSWER_KEYS) if (answers[k] !== undefined && answers[k] !== null) a[k] = answers[k];

  const lang = answers.language === 'es' ? 'es' : 'en';
  const pick = (f) => ((f && typeof f === 'object' && !Array.isArray(f)) ? (f[lang] || f.en) : f);
  const opt = (key, val) => {
    const t = val == null ? null : OPT_LABEL.get(key + ':' + val);
    return t ? pick(t) : null;
  };

  const parts = [];
  // Matter first: it is what the invite is FOR, and it is the segment that must
  // survive if anything gets clamped off the end.
  const cat = opt('matter_category', a.matter_category);
  if (cat) {
    const sub = opt('matter_sub', a.matter_sub);
    parts.push(pick(NOTE_CAPTION.matter) + ': ' + (sub ? cat + ' — ' + sub : cat));
  }
  const role = opt('role', a.role);
  if (role) parts.push(pick(NOTE_CAPTION.role) + ': ' + role);
  const whom = opt('for_whom', a.for_whom);
  if (whom) parts.push(pick(NOTE_CAPTION.for_whom) + ': ' + whom);
  // States are an allow-list too — an unrecognised value is dropped, not printed.
  const st = a.state != null && STATE_LABEL.has(a.state) ? pick(STATE_LABEL.get(a.state)) : null;
  if (st) parts.push(pick(NOTE_CAPTION.state) + ': ' + st);
  const src = clamp(a.source, SOURCE_MAX);
  if (src) parts.push(pick(NOTE_CAPTION.source) + ': ' + src);

  const notes = clamp(parts.join(' · '), NOTE_MAX);
  return notes ? { notes } : null;
}

function buildQual(doc) {
  const qual = doc.createElement('div');
  qual.id = QUAL_ID;
  qual.setAttribute('role', 'dialog');
  qual.setAttribute('aria-modal', 'true');
  qual.setAttribute('aria-label', 'A few quick questions');

  const card = doc.createElement('div');
  card.className = 'card';
  const hd = doc.createElement('div');
  hd.className = 'hd';
  // JORDAN-PERCH-PHOTO-PAULA: `.mk` is the 30px circle in the card header. It used
  // to crop the firm's logo mark; it now crops the concierge portrait, cover-fit
  // and centred, so the card is badged with the face of the person who asked for
  // the figures being tapped into it. The green disc behind the photo is kept as
  // the fallback paint — if the asset ever fails to decode the header shows the
  // firm's green mark rather than a broken-image glyph.
  const mk = doc.createElement('span');
  mk.className = 'mk';
  const emb = doc.createElement('img');
  emb.className = 'mkemb';
  emb.src = INTAKE_FACE;
  // Not decorative, and not a duplicate of anything on screen. The header's
  // visible text is the FIRM's name; this names the PERSON, which is the one
  // thing a screen-reader caller cannot otherwise tell about a card that is
  // asking for their income and net worth. Deliberately not action-worded — the
  // header is not a control (the orb's alt is, see js/perch/brand.js).
  emb.alt = 'Paul Donovan, attorney, Donovan Legal PLLC';
  mk.appendChild(emb);
  const nm = doc.createElement('span');
  nm.className = 'nm';
  nm.textContent = 'Donovan Legal';
  // 2026-09-05: no close button. Paul's decision -- the card is the booking
  // protocol, and an X was a way to leave it without answering. The routes out
  // are Esc, the browser Back button, and the labelled decline control (which
  // goes to the contact page, not the calendar). Backdrop clicks are inert.
  hd.append(mk, nm);
  const bd = doc.createElement('div');
  bd.className = 'bd';
  bd.id = QUAL_BODY_ID;
  card.append(hd, bd);
  qual.appendChild(card);
  return qual;
}

/**
 * Mount (or adopt) the qualifier modal.
 *
 * @param {Element} parent Where to build when the markup is absent.
 * @param {{callId: () => (string|null), onQualified?: (answers: object) => void}} ctx
 *   `onQualified` is OPTIONAL and additive (JORDAN-PERCH-NATIVE-BOOK). A host that
 *   does not pass it gets byte-identical behaviour to what shipped before — which
 *   is how the `/perch` rollback shell (js/page/perch-shell.js) and the layer's
 *   unused `mountShellConcierge()` stay untouched by this change.
 * @returns {{openQualifier: Function, closeQualifier: Function, root: Element}}
 */
export function mountQualifier(parent, ctx) {
  const doc = parent.ownerDocument;

  let qual = doc.getElementById(QUAL_ID);
  if (!qual) {
    qual = buildQual(doc);
    parent.appendChild(qual);
  }
  const qualBd = qual.querySelector('#' + QUAL_BODY_ID) || qual.querySelector('.bd');

  const qualAns = {};
  // Bilingual: every visible string is {en, es}. `qualLang` (set by openQualifier
  // from the language Paula asked verbally) selects which one renders.
  let qualLang = 'en';
  let qualSource = '';
  let qIdx = 0;
  const L = (f) => ((f && typeof f === 'object' && !Array.isArray(f)) ? (f[qualLang] || f.en) : f);

  // Active steps: matter category → (tax OR real-estate sub-type, once a category
  // is picked) → the shared profile block. The sub-type step appears and
  // disappears with the category tap.
  function activeSteps() {
    const cat = qualAns.matter_category;
    const sub = cat === 'tax' ? [Q_MATTER_TAX] : cat === 'real_estate' ? [Q_MATTER_RE] : [];
    return [Q_MATTER_CAT].concat(sub, [Q_ROLE], Q_PROFILE);
  }

  function renderStep() {
    const steps = activeSteps();
    if (qIdx > steps.length - 1) qIdx = steps.length - 1;
    const s = steps[qIdx];
    qual.classList.remove('done-state', 'handoff-state');
    const dots = steps.map((_, i) => `<i class="${i === qIdx ? 'on' : ''}"></i>`).join('');
    const info = s.info ? `<span class="info"><button class="ibtn" aria-label="More info">i</button><span class="blurb">${esc(L(s.info))}</span></span>` : '';
    const backTxt = esc(L({ en: 'Back', es: 'Atrás' }));
    const head = `<div class="step">${esc(L(s.step))}</div><h2>${esc(L(s.h))}</h2>${s.sub ? `<div class="sub">${esc(L(s.sub))}</div>` : ''}`;
    // ── JORDAN-SITE-UX-FIXES-R1: the EXPLICIT decline ─────────────────────────
    //
    // The card is now the only door to the calendar that is not a completed card,
    // so it has to carry one — and it has to be a control the visitor pressed on
    // purpose. Dismissing the card (backdrop, Esc, Back) used to be read as this,
    // which is the defect: an accidental tap outside a dialog is not a decision to
    // skip intake, and it was carrying visitors onto Paul's calendar having
    // answered nothing.
    //
    // NOT class `opt`, deliberately: the option branch below binds `pick()` to
    // every `.opt` inside the body, and a decline that answered the current
    // question would be a different bug wearing this one's label.
    //
    // ── PAINTED ONLY WHERE A HOST CAN HONOUR IT ────────────────────────────────
    //
    // TWO CONDITIONS, and they exclude two different hosts.
    //
    // `onDeclined` — optional, exactly like `onQualified` and `onDismissed`, and
    // `js/page/perch-shell.js` (the `/perch` rollback target) passes none of the
    // three. Rendering the control there would put a button reading "go straight to
    // the calendar" on a card that closes and goes nowhere: a labelled control that
    // lies, which is worse than the absence this ticket is fixing elsewhere.
    //
    // `canDecline` — asked at RENDER time, because one host answers differently at
    // different moments. The layer honours a decline only for a card the visitor
    // opened by asking to BOOK; on a card Paula raised herself mid-conversation
    // (`open_qualifier`) the host deliberately refuses to navigate, because a
    // caller who did not ask to go anywhere must not be moved and, with no router,
    // the move would be a `location.assign` that hangs up the call they are on. So
    // that card must not offer the control either.
    const canDecline = !!(ctx && typeof ctx.onDeclined === 'function'
      && (typeof ctx.canDecline !== 'function' || ctx.canDecline()));
    // 2026-09-04 (Paul): the only alternative to answering is to call. No contact
    // form, no calendar. The control is a tel: link; on a phone it opens the
    // dialer, on a desktop the number is the message. The frame escape for tel:
    // links is applied at click time by js/main.js (capture-phase sweep), so this
    // module does not set a target itself.
    const declineRow = canDecline ? `<div class="exit"><a class="declinebk" data-decline href="tel:+15616666022">${esc(L({
      en: 'Prefer to talk first? Call (561) 666-6022',
      es: '¿Prefiere hablar primero? Llame al (561) 666-6022',
    }))}</a></div>` : '';

    if (s.type === 'select') {
      const ph = esc(L({ en: 'Select…', es: 'Seleccione…' }));
      const outside = esc(L({ en: 'Outside the U.S.', es: 'Fuera de EE. UU.' }));
      const opts = '<option value="">' + ph + '</option>'
        + US_STATES.map((o) => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join('')
        + `<option value="outside_us">${outside}</option>`;
      qualBd.innerHTML = head
        + `<div class="opts"><select id="q-sel" class="opt" style="cursor:pointer;-webkit-appearance:menulist;appearance:auto">${opts}</select></div>
           <div class="foot"><button class="back" ${qIdx === 0 ? 'hidden' : ''}>‹ ${backTxt}</button><div class="dots">${dots}</div>${info}<button class="opt" id="q-cont" style="max-width:150px;justify-content:center">${esc(L({ en: 'Continue', es: 'Continuar' }))} ›</button></div>`
        + declineRow;
      const sel = qualBd.querySelector('#q-sel');
      const cont = qualBd.querySelector('#q-cont');
      cont.onclick = () => { if (sel.value) pick(s.key, sel.value); };
    } else {
      qualBd.innerHTML = head
        + `<div class="opts">${s.opts.map((o) => `<button class="opt${o.declined ? ' declined' : ''}" data-v="${esc(o.v)}">${esc(L(o.t))}<span class="arrow">${o.declined ? '' : '›'}</span></button>`).join('')}</div>
           <div class="foot"><button class="back" ${qIdx === 0 ? 'hidden' : ''}>‹ ${backTxt}</button><div class="dots">${dots}</div>${info}</div>`
        + declineRow;
      qualBd.querySelectorAll('.opt').forEach((b) => { b.onclick = () => pick(s.key, b.dataset.v); });
    }

    const back = qualBd.querySelector('.back');
    if (back) back.onclick = () => { if (qIdx > 0) { qIdx--; renderStep(); } };
    const ib = qualBd.querySelector('.info');
    if (ib) ib.querySelector('.ibtn').onclick = () => ib.classList.toggle('open');
    const dc = qualBd.querySelector('[data-decline]');
    if (dc) dc.onclick = declineQualifier;
  }

  function pick(key, val) {
    qualAns[key] = val;
    // matter category → set the routed matter for the done message + backend
    if (key === 'matter_category') {
      qualAns.matter = (val === 'tax') ? 'tax' : (val === 'real_estate') ? 'real_estate' : val;
    }
    const steps = activeSteps();
    if (qIdx < steps.length - 1) { qIdx++; renderStep(); } else { submitQual(qualAns.matter === 'tax' ? 'tax' : 'done'); }
  }

  // JORDAN-NOVOICE-FRONTDOOR: did this opening of the card reach a submit?
  //
  // `closeQualifier` runs on all four dismissals — the done-state Continue button,
  // the 6.5 s auto-close, the backdrop tap, and the host closing it — so it cannot
  // tell "finished" from "walked away" on its own. This flag is the difference, and
  // it is what stops an ABANDONED card being reported as a completed one.
  let submitted = false;

  // JORDAN-SITE-UX-FIXES-R1: did this opening end at the DECLINE control?
  //
  // The third outcome, and it needs its own flag for the same reason `submitted`
  // does: `closeQualifier` hides the card on every route out, so without this it
  // would fire `onDismissed` immediately after `onDeclined` and the host would be
  // told both "they walked away" and "they asked for the calendar" about one card.
  // Reset by `openQualifier` alongside `submitted`, so it describes one opening.
  let declined = false;

  async function submitQual(kind) {
    submitted = true;
    // language + source are the two VERBAL answers (Paula asked them before the
    // card); they ride in the same payload so they land in the calendar invite
    // alongside the tapped answers.
    const payload = { ...qualAns, language: qualLang, source: qualSource || undefined, call_id: ctx.callId() || undefined };
    // Fire-and-forget; the UI does not block on the network. Every path books.
    try {
      fetch('/fn/qualifier_submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (e) { /* fire and forget */ }

    // JAY-TRACKING-B1. The only conversion on this site with no existing signal.
    // The other three already announce themselves — `vantage:call-start` from
    // call.js and donovan-widget.js, and the `__perchBooking` postMessage from
    // booking-widget.js — so js/analytics/tracker.js listens for those and needed
    // no edit anywhere. This one had only a fire-and-forget POST and a class
    // change, neither of which is observable from outside.
    //
    // Same shape as the call-start dispatch two modules already use: on `window`,
    // wrapped, listener-optional. Nothing in the qualifier reads it back, so a
    // page with no listener behaves exactly as it does today.
    try {
      dispatchEvent(new CustomEvent('dl:qualifier-submitted', {
        detail: { matter: qualAns.matter || null },
      }));
    } catch (e) { /* no-op */ }

    qual.classList.remove('handoff-state');
    qual.classList.add('done-state');
    const es = (qualLang === 'es');
    let msg;
    if (es) {
      msg = (kind === 'tax')
        ? '<strong>Listo.</strong> El calendario se abrirá para agendar una llamada de orientación — ahí el equipo revisa los detalles con usted.'
        : '<strong>Listo.</strong> El calendario se abrirá para que elija una hora.';
    } else {
      msg = (kind === 'tax')
        ? '<strong>Got it.</strong> The calendar will open so you can book an orientation call — that’s where the firm goes through the specifics with you.'
        : '<strong>Got it.</strong> The calendar will open so you can pick a time.';
    }
    const dStep = es ? 'Listo' : 'All set';
    const dH = es ? 'Gracias — eso es lo que necesitaba' : 'Thanks — that’s what I needed';
    const dBtn = es ? 'Continuar' : 'Continue';
    qualBd.innerHTML = `<div class="step">${dStep}</div><h2>${dH}</h2>
      <div class="msg" style="margin-top:8px">${msg}</div>
      <div class="foot" style="justify-content:flex-end"><button class="opt" data-close style="max-width:150px;justify-content:center">${dBtn}</button></div>`;
    setTimeout(closeQualifier, 6500);
    const cb = qualBd.querySelector('[data-close]');
    if (cb) cb.onclick = closeQualifier;

    // ── JORDAN-PERCH-NATIVE-BOOK: keep the promise the message above makes ─────
    //
    // Everything above this line is unchanged, deliberately: the lead POST, the
    // done-state copy in both languages, the 6.5 s auto-close and the Continue
    // button are the caller-facing contract and this ticket does not move them.
    // What it adds is the one thing the copy already promised — the calendar
    // actually opening — and it is fired LAST so no failure in the host's
    // auto-advance can affect what the caller is looking at.
    //
    // The payload is the answers NORMALIZED: every stored key spelled out, absent
    // answers as null rather than missing, and the two verbal answers (language,
    // source) plus the call id alongside them. It is the same field set the lead
    // POST above carries, which is what lets a reviewer read one shape instead of
    // two. Turning it into booking fields is the HOST's job, through
    // `bookingPrefillFrom` — this module hands out answers, not form values.
    //
    // Wrapped, and not awaited: `onQualified` reaches the command channel, which
    // touches localStorage and the router. A caller who has just handed over their
    // income band must not see a broken card because a swap threw.
    try {
      if (ctx && typeof ctx.onQualified === 'function') ctx.onQualified(normalizedAnswers(kind));
    } catch (e) {
      console.error('[perch] qualifier onQualified failed', e);
    }
  }

  /**
   * The completed card's answers, in one flat shape.
   *
   * `call_id` is read through the same try/catch the probe uses — `ctx.callId()`
   * is a host closure and a host that is mid-teardown must not turn a completed
   * qualifier into a thrown error.
   */
  function normalizedAnswers(kind) {
    let callId = null;
    try { callId = ctx.callId() || null; } catch (e) { callId = null; }
    return {
      // Which done-state the caller was shown: 'tax' routes to an orientation
      // call, 'done' straight to a time slot.
      kind,
      matter: qualAns.matter || null,
      matter_category: qualAns.matter_category || null,
      matter_sub: qualAns.matter_sub || null,
      state: qualAns.state || null,
      role: qualAns.role || null,
      for_whom: qualAns.for_whom || null,
      income_band: qualAns.income_band || null,
      net_worth_band: qualAns.net_worth_band || null,
      language: qualLang,
      source: qualSource || null,
      call_id: callId,
    };
  }

  // matter is a tap inside the card, so open only needs language (EN/ES render) +
  // source (the verbal "how did you hear" answer, carried into the calendar invite).
  function openQualifier(lang, source) {
    qualLang = (lang === 'es' || lang === 'spanish' || lang === 'español') ? 'es' : 'en';
    qualSource = source || '';
    qIdx = 0;
    submitted = false;
    declined = false;
    for (const k in qualAns) delete qualAns[k];
    renderStep();
    qual.classList.add('show');
  }

  /**
   * Dismiss the card.
   *
   * ── JORDAN-NOVOICE-FRONTDOOR: `onDismissed`, and why it is here ────────────
   * OPTIONAL and additive, exactly like `onQualified` (#109). A host that does not
   * pass it gets byte-identical behaviour, which is how `js/page/perch-shell.js`
   * (the `/perch` rollback target) and the layer's unwired `mountShellConcierge()`
   * stay untouched.
   *
   * It fires ONLY when the card is dismissed WITHOUT a submit, and it carries the
   * partial answers.
   *
   * ── JORDAN-SITE-UX-FIXES-R1: WHAT A DISMISS NOW MEANS ──────────────────────
   * #158 wrote that "closing the card would strand them on the page they started
   * from — a worse outcome than the plain link they had before", and the host
   * therefore carried a dismissed card onto the calendar. In production that read
   * the wrong way round: a visitor who taps the dark area outside a dialog is
   * saying "not this", and they were being answered with a navigation to /book and
   * a 30-minute booking unlock — reaching Paul's calendar having answered nothing,
   * which is the one thing the card exists to prevent.
   *
   * A dismiss is now a NO-OP CLOSE: the card hides, the visitor stays exactly where
   * they were, nothing is written and nothing navigates. The visitor is not
   * stranded, because the destination they were owed is now a control they can
   * actually see and press — `declineQualifier` below. `onDismissed` still fires
   * (the host uses it to forget the book intent); what changed is what the host
   * does with it, in js/perch-layer.js.
   */
  function closeQualifier() {
    const wasOpen = qual.classList.contains('show');
    qual.classList.remove('show');
    if (!wasOpen || submitted || declined) return;
    try {
      if (ctx && typeof ctx.onDismissed === 'function') ctx.onDismissed({ ...qualAns, language: qualLang, source: qualSource || undefined });
    } catch (e) {
      console.error('[perch] qualifier onDismissed failed', e);
    }
  }

  /**
   * The visitor pressed the decline control: skip intake, open the calendar anyway.
   *
   * JORDAN-SITE-UX-FIXES-R1. This is the ONE non-completing route to the calendar,
   * and the whole point of it is that it is deliberate — a labelled button inside
   * the card, not a consequence of closing it. The host's handler is the behaviour
   * the abandon path used to have, moved here unchanged: whatever they DID tap
   * rides onto the booking form as the note, and the tab claims no qualifier
   * record, because nothing was POSTed.
   *
   * `onDeclined` is OPTIONAL and additive, exactly like `onQualified` and
   * `onDismissed` before it — a host that does not pass it (js/page/perch-shell.js,
   * the layer's unwired `mountShellConcierge()`) sees the card simply close.
   */
  function declineQualifier() {
    // 2026-09-04: pressing the phone control records the decline and lets the
    // tel: link do its work. The card stays open -- the visitor is still in the
    // protocol, and on a desktop (where tel: may do nothing) the number they need
    // is the text of the control they just pressed. Nothing navigates, nothing
    // unlocks; a completed card remains the only key to the calendar.
    if (!qual.classList.contains('show') || submitted) return;
    try {
      if (ctx && typeof ctx.onDeclined === 'function') ctx.onDeclined({ ...qualAns, language: qualLang, source: qualSource || undefined });
    } catch (e) {
      console.error('[perch] qualifier onDeclined failed', e);
    }
  }

  // ── The three ways out that are not a decision (JORDAN-SITE-UX-FIXES-R1) ────
  //
  // All three land on `closeQualifier`, which is now a no-op close, so none of them
  // can reach the calendar. They are listed together because the ticket is about
  // them agreeing: the defect was ONE of them (the backdrop) meaning something the
  // other two did not.
  //
  //   • BACKDROP — `e.target === qual` only, so a click that lands on the card
  //     itself is not a dismiss. Unchanged from A21 except for what it now costs.
  //   • Esc — a dialog with `aria-modal="true"` and no visible close control has to
  //     answer Esc or there is no keyboard way out of it at all. Bound on the
  //     DOCUMENT and gated on `.show`, because focus may be anywhere on the page:
  //     the card is opened by a delegated click on an anchor, which does not move
  //     focus into it.
  //   • BACK — the layer holds the card OUTSIDE the swap container precisely so a
  //     navigation does not tear it down, which means a soft Back would otherwise
  //     leave it hanging over the previous page. Closing it here is what makes
  //     "press Back" ordinary browser behaviour instead of a fourth code path.
  // 2026-09-04: a click on the backdrop is NOT a dismiss. It used to be, and a
  // visitor who clicked anywhere outside the card lost the questionnaire. The
  // routes out are now the header ×, Esc, Back, the decline control and the
  // done-state Continue -- all deliberate.
  doc.addEventListener('keydown', (e) => {
    if (!qual.classList.contains('show')) return;
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    closeQualifier();
  });
  try {
    if (doc.defaultView) doc.defaultView.addEventListener('popstate', () => { closeQualifier(); });
  } catch (e) { /* no window — nothing can go Back either */ }

  // ── DR-INSANE-A33 (#58): read-only, and no longer a control surface ────────
  //
  // This line used to be:
  //
  //     window.__perch = Object.assign(window.__perch || {}, { openQualifier, closeQualifier });
  //
  // `openQualifier` is the card the caller taps their residency, income and net
  // worth into during a recorded call. Published as a writable window property it
  // was replaceable — a script could swap it and receive the answers instead of
  // this closure, or call it to raise the card over the page at a moment Paula
  // never asked for. Nothing in this repo ever read either function: the real
  // wiring is the object returned below, handed to `createCall` as a closure by
  // js/perch-layer.js and js/page/perch-shell.js. So the exposure bought a debug
  // affordance and cost a hijack path.
  //
  // What replaces it is the `Perch.router.probe()` shape: one read-only method,
  // no arguments, no writes, on a property that is non-writable and
  // non-configurable. `lockGlobal` refuses to adopt an existing `window.__perch`
  // rather than assigning into it. The `?qualifier=` affordance below still opens
  // the card for a human debugging the flow — from the closure, in-page, where it
  // cannot be intercepted.
  //
  // `doc.defaultView` rather than a bare `window`: the module already derives
  // `doc` from the parent it is mounting into, and taking the window from the
  // same place means the surface lands on the document that owns the card. It is
  // also what lets CI mount the real qualifier into a real jsdom document and
  // drive open/close for effect instead of grepping this file.
  lockGlobal(doc.defaultView, '__perch', {
    probe: () => ({
      mounted: true,
      open: qual.classList.contains('show'),
      lang: qualLang,
      step: qIdx,
      answered: Object.keys(qualAns).length,
      callId: (() => { try { return ctx.callId() ? 'set' : null; } catch (e) { return 'error'; } })(),
    }),
  });

  // TEST AFFORDANCE: ?qualifier=1 (RE) or ?qualifier=tax auto-opens the card;
  // add &lang=es for the Spanish render. Answers won't link to a call in this
  // mode. Harmless in production.
  try {
    const sp = new URLSearchParams(location.search);
    if (sp.get('qualifier')) setTimeout(() => openQualifier(sp.get('lang'), sp.get('src')), 500);
  } catch (e) { /* no URLSearchParams */ }

  return { openQualifier, closeQualifier, root: qual };
}
