// The qualifier modal POSTs here when the caller taps "Done" (or hits the
// international handoff). Two side-effects:
//   1. Store the answers in the bridge DO under key `qual:<callId>` so Paula's
//      get_qualifier_result tool can read them (strongly consistent, read-once).
//   2. Forward the sensitive fields to Vantage /upsert-lead (fire-and-forget,
//      like save_lead.js — the caller's tap never waits on Cloud Run).
// NEVER log field VALUES — only validation outcomes. These are financial bands.
//
// `perchBridge` was imported here — this file was the WRITER of the caller-PII slot
// the bridge DO exposed. See step 1 below for why the write is gone.
import { setQualifierCookie, QUALIFIER_COOKIE_MAX_AGE } from '../_lib/qualifier-cookie.js';
// `sendVantageUpsert` was imported here — see the note at step 2 below for what it
// did and why the whole Vantage path is gone. DRINSANE-LEAD-FAILCLOSED (#151 R1)
// hardened that call against redirect-following because it carried the firm's write
// secret and this caller's income and net-worth bands off-origin; deleting the call
// retires the exposure the hardening was managing.
const J = (o, s = 200, extra) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(extra || {}) },
});

// Allowed enum values — anything else is dropped (never trust the client).
const ENUMS = {
  matter: ['real_estate', 'tax'],
  // real-estate qualifier
  residency_status: ['us_citizen_or_green_card', 'foreign_or_visa'],
  classification: ['domestic', 'international_inbound'],
  immersion_track: ['first_investment', 'portfolio_alongside_career', 'real_estate_is_business', 'unsure_escape_hatch'],
  income_band: ['under_500k', '500k_1_5m', '1_5m_3m', 'above_3m', 'declined'],
  net_worth_band: ['under_2m', '2m_5m', '5m_15m', 'above_15m', 'declined'],
  income_character: ['w2_dominant', 'business_dominant', 'mixed'],
  available_time: ['spouse_available', 'both_career_committed'],
  // tax-controversy gatekeeping
  tax_matter: ['audit_exam', 'notice_letter', 'lien_levy_collection', 'owe_or_unfiled', 'other_unsure'],
  tax_amount: ['under_250k', '250k_1m', '1m_5m', 'above_5m', 'undetermined'],
  tax_posture: ['ninety_day_notice', 'deadline_under_30', 'deadline_30_90', 'exam_no_date', 'not_sure_posture'],
  criminal_indicator: ['no', 'yes_or_unsure'],
  // unified profile block (everyone) + the two verbal answers Paula asks
  citizenship: ['us_citizen', 'green_card', 'visa', 'abroad'],
  for_whom: ['yourself', 'business', 'family', 'other_whom'],
  // 2026-09-06: who is in the chair (party / counsel / advisor / notice / deal)
  role: ['party', 'counsel', 'advisor', 'notice', 'deal', 'role_not_sure'],
  language: ['en', 'es'],
  matter_category: ['tax', 'real_estate', 'other', 'not_sure_matter'],
  matter_sub: ['planning', 'compliance', 'controversy', 'tax_not_sure', 'acquisition', 'ownership', 'disposition', 're_not_sure'],
};

// Human-readable labels so the booking summary (the Clio CONTACT NOTE + the Grow
// lead) reads in plain English for Paul/Wendy — never raw enum keys.
//
// NOT THE CALENDAR DESCRIPTION. This said "Clio calendar description" and stopped
// being true at SHELDON-CLIO-CONFIRM-EMAIL: the calendar entry now attaches the
// client as an ATTENDEE with send_email_notification, and Clio renders that entry's
// `description` verbatim into the confirmation email and the .ics it sends them. So
// the description is a CLIENT-FACING surface, and the summary these labels render —
// income_band and net_worth_band included — reaches the attorney-only Note on the
// contact and the Grow lead, and nothing that Clio emails. See
// booking/_lib/provider-clio.js: writeIntakeNote takes the summary;
// buildClientDescription has no parameter that could accept it.
const LABELS = {
  residency_status: { us_citizen_or_green_card: 'US citizen / green card', foreign_or_visa: 'Foreign national / visa' },
  classification: { domestic: 'Domestic', international_inbound: 'International (inbound)' },
  immersion_track: { first_investment: 'First investment', portfolio_alongside_career: 'Portfolio alongside career', real_estate_is_business: 'Real estate is the business', unsure_escape_hatch: 'Exploring / unsure' },
  income_band: { under_500k: 'Under $500K', '500k_1_5m': '$500K–$1.5M', '1_5m_3m': '$1.5M–$3M', above_3m: 'Above $3M', declined: 'Declined to say' },
  net_worth_band: { under_2m: 'Under $2M', '2m_5m': '$2M–$5M', '5m_15m': '$5M–$15M', above_15m: 'Above $15M', declined: 'Declined to say' },
  income_character: { w2_dominant: 'W-2 dominant', business_dominant: 'Business dominant', mixed: 'Mixed' },
  available_time: { spouse_available: 'Spouse available', both_career_committed: 'Both career-committed' },
  tax_matter: { audit_exam: 'Audit / examination', notice_letter: 'Notice or letter (IRS/state)', lien_levy_collection: 'Lien, levy, or collection', owe_or_unfiled: 'Owes or has unfiled returns', other_unsure: 'Other / not sure' },
  tax_amount: { under_250k: 'Under $250K', '250k_1m': '$250K–$1M', '1m_5m': '$1M–$5M', above_5m: 'Above $5M', undetermined: 'Undetermined (exam stage)' },
  tax_posture: { ninety_day_notice: '90-day notice (deadline running)', deadline_under_30: 'Deadline within 30 days', deadline_30_90: 'Deadline 30–90 days out', exam_no_date: 'Exam stage, no date yet', not_sure_posture: 'Not sure' },
  criminal_indicator: { no: 'No indicator', yes_or_unsure: 'Possible exposure / unsure — assess fit' },
  citizenship: { us_citizen: 'U.S. citizen', green_card: 'Green-card holder', visa: 'Visa holder', abroad: 'Investing/residing abroad' },
  for_whom: { yourself: 'Yourself (personal)', business: 'Business / company', family: 'Family member', other_whom: 'Other' },
  role: { party: 'A party (own matter)', counsel: 'Counsel for a party', advisor: 'CPA / advisor for a client', notice: 'Has an IRS or state notice', deal: 'Deal / structure / planning', role_not_sure: 'Not sure' },
  language: { en: 'English', es: 'Spanish' },
  matter_category: { tax: 'Tax', real_estate: 'Real estate', other: 'Other', not_sure_matter: 'Not sure yet' },
  matter_sub: { planning: 'Planning', compliance: 'Compliance', controversy: 'Controversy', tax_not_sure: 'Not sure', acquisition: 'Acquisition', ownership: 'Ownership', disposition: 'Disposition', re_not_sure: 'Not sure' },
};
const lbl = (k, v) => (LABELS[k] && LABELS[k][v]) || v;

// The seven answers that ride on the Clio CONTACT as custom fields
// (SHELDON-CLIO-CONTACT-MAPPING). Rendered here, not in the booking backend, so
// LABELS stays the single source of truth for how an enum reads in English — the
// booking side maps names to Clio field ids and never re-spells a value.
const CONTACT_INTAKE_KEYS = ['matter_category', 'matter_sub', 'for_whom', 'income_band', 'net_worth_band', 'language', 'source'];
function contactIntake(f) {
  const out = {};
  for (const k of CONTACT_INTAKE_KEYS) if (f[k]) out[k] = lbl(k, f[k]);
  return out;
}

// Render the stored answers as a plain-English block for the booking record.
//
// ATTORNEY-SIDE ONLY, AND THE OLD WORDING NAMED THE WRONG SURFACE. This read
// "BACK-OFFICE only (Clio calendar description + Grow lead)". The conclusion was
// right and the route was wrong, which is the dangerous combination: it is the one
// comment in this file that reads as though the income and net-worth bands ride on
// the client-facing surface, and a later reader taking it at face value would think
// the description was already an internal field.
//
// WHERE THIS STRING ACTUALLY GOES: the Clio Note attached to the CONTACT (the
// lawyer-only CRM record — provider-clio.js writeIntakeNote), the Grow lead, the
// Vantage lead and the KV booking record. The caller never sees it.
//
// WHERE IT DOES NOT GO, since SHELDON-CLIO-CONFIRM-EMAIL: the calendar entry's
// `description`. The entry now carries the client as an attendee with
// send_email_notification, and Clio renders the description verbatim INTO THE
// CONFIRMATION EMAIL and the .ics the client receives. The description is built by
// buildClientDescription from firm-configured constants only, and that function
// takes no caller text and has no parameter this summary could arrive through.
//
// Returns '' when there is nothing meaningful to show.
function formatQualSummary(f) {
  const lines = [];
  lines.push('— Perch intake —');
  if (f.matter_category) lines.push('Matter: ' + lbl('matter_category', f.matter_category) + (f.matter_sub ? ' → ' + lbl('matter_sub', f.matter_sub) : ''));
  if (f.role) lines.push('Booking as: ' + lbl('role', f.role));
  // legacy tax-gatekeeping block — no longer collected in the card, kept harmless
  if (f.tax_matter || f.tax_amount || f.tax_posture || f.criminal_indicator) {
    if (f.tax_matter) lines.push('Matter: ' + lbl('tax_matter', f.tax_matter));
    if (f.tax_amount) lines.push('Amount in dispute: ' + lbl('tax_amount', f.tax_amount));
    if (f.tax_posture) lines.push('Posture: ' + lbl('tax_posture', f.tax_posture));
    if (f.criminal_indicator) lines.push('Criminal screen: ' + lbl('criminal_indicator', f.criminal_indicator));
  }
  // Profile block (everyone)
  if (f.citizenship) lines.push('Citizenship: ' + lbl('citizenship', f.citizenship) + (f.classification === 'international_inbound' ? ' (international)' : ''));
  if (f.state) lines.push('State: ' + (f.state === 'outside_us' ? 'Outside the U.S.' : f.state));
  if (f.for_whom) lines.push('For: ' + lbl('for_whom', f.for_whom));
  if (f.income_band) lines.push('Income: ' + lbl('income_band', f.income_band));
  if (f.net_worth_band) lines.push('Net worth: ' + lbl('net_worth_band', f.net_worth_band));
  // The two verbal answers (Paula asked these aloud; still land here for Paul/Wendy)
  const meta = [];
  if (f.language) meta.push('Language: ' + lbl('language', f.language));
  if (f.source) meta.push('Source: ' + f.source);
  if (meta.length) lines.push(meta.join(' · '));
  if (lines.length <= 1) return ''; // only the header → nothing meaningful
  const flags = [];
  if (f.flag_urgent === 'yes') flags.push('URGENT — deadline running');
  if (f.flag_criminal === 'yes') flags.push('CRIMINAL FLAG — Paul to assess fit at orientation');
  if (f.flag_international === 'yes') flags.push('International — Spanish available');
  if (flags.length) lines.push('⚠ ' + flags.join(' | '));
  return lines.join('\n');
}

// tier follows directly from the situation answer (see QUALIFICATION-HANDOFF.md)
const TIER = {
  first_investment: 'Gold',
  portfolio_alongside_career: 'Platinum',
  real_estate_is_business: 'Reserve',
  unsure_escape_hatch: 'escape_hatch',
};

// Gold strategy path from income character × available spouse time
function strategyPath(ic, at) {
  if (ic === 'business_dominant' && at === 'spouse_available') return 'A';
  if (ic === 'w2_dominant' && at === 'spouse_available') return 'B';
  if (ic === 'w2_dominant' && at === 'both_career_committed') return 'C';
  if (ic && at) return 'unclear';
  return '';
}

function clean(args) {
  const out = {};
  for (const k of Object.keys(ENUMS)) {
    const v = args && args[k] != null ? String(args[k]) : '';
    if (ENUMS[k].includes(v)) out[k] = v;
  }
  // classification derivable from citizenship (visa/abroad = international) or legacy residency
  if (!out.classification && out.citizenship) {
    out.classification = (out.citizenship === 'visa' || out.citizenship === 'abroad') ? 'international_inbound' : 'domestic';
  }
  if (!out.classification && out.residency_status) {
    out.classification = out.residency_status === 'foreign_or_visa' ? 'international_inbound' : 'domestic';
  }
  // state (2-letter code or outside_us) + source (verbal, free text) — validated, not enums
  { const st = args && args.state ? String(args.state).trim().toUpperCase() : '';
    if (/^[A-Z]{2}$/.test(st)) out.state = st; else if (st === 'OUTSIDE_US') out.state = 'outside_us'; }
  { const src = args && args.source ? String(args.source).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 60) : '';
    if (src) out.source = src; }
  // derive tier + strategy_path so both Paula and Vantage get them
  if (out.immersion_track) out.tier = TIER[out.immersion_track];
  const sp = strategyPath(out.income_character, out.available_time);
  if (sp) out.strategy_path = sp;
  // if the matter is unambiguous from the field set, backfill it
  if (!out.matter) {
    if (out.matter_category === 'tax' || out.tax_matter || out.tax_amount) out.matter = 'tax';
    else if (out.matter_category === 'real_estate' || out.citizenship || out.for_whom || out.income_band || out.net_worth_band) out.matter = 'real_estate';
  }
  // flags Paula surfaces on the appointment note so Paul can prepare / route
  if (out.classification === 'international_inbound') out.flag_international = 'yes';
  if (out.criminal_indicator === 'yes_or_unsure') out.flag_criminal = 'yes';
  if (out.tax_posture === 'ninety_day_notice' || out.tax_posture === 'deadline_under_30') out.flag_urgent = 'yes';
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const args = (b && b.args) ? b.args : b; // tolerate {args:{...}} or flat
  // B2: no shared default bucket — see functions/fn/page-poll.js. The KV and
  // Vantage paths below already refused to use the literal 'default', but the DO
  // write did not: a submission with no call_id landed in `qual:default`, where
  // qualifier_result served it to whoever asked next. Rejecting the request
  // outright is what makes that unreachable, rather than special-casing 'default'
  // at each of the three call sites and hoping a fourth is never added.
  const callId = String((b.call && b.call.call_id) || b.call_id || (args && args.call_id) || '').trim();
  if (!callId) {
    console.warn('[qualifier_submit] MISSING_CALL_ID — refusing to store qualifier data');
    return J({ ok: false, reason: 'call_id_required' }, 400);
  }

  const fields = clean(args);
  // accept any completed profile (RE) OR a tax submission; drop empties
  if (!fields.matter_category && !fields.citizenship && !fields.for_whom && !fields.income_band && !fields.net_worth_band
      && !fields.residency_status && !fields.tax_matter) {
    return J({ ok: false, reason: 'no_valid_fields' }, 200);
  }

  // everyone books — status is 'complete'. Paula reads the flag_* fields for
  // her booking note (international / criminal / urgent), not status.
  const status = 'complete';
  const record = { status, ...fields, ts: 'now' };

  // ── Step 1 wrote the record into the bridge DO ─────────────────────────────
  // Slot `qual:<callId>`, read ONCE by Paula's get_qualifier_result mid-call so she
  // could speak to what the caller had just entered. Paula is gone, the DO binding
  // is off the Pages project, and nothing reads the slot — so the write is removed
  // rather than left to throw into a catch on every submission.
  //
  // Its catch comment said "non-fatal: Vantage still gets the data below", which
  // stopped being true when the Vantage forward went; step 1b below is what makes
  // it genuinely non-fatal, and always was the durable half.

  // 1b. durable back-office copy for the booking join (NOT read-once). When the
  // caller later books, /booking/create reads this by call_id and folds the
  // answers into the Clio CONTACT and the Grow lead — server-side, so the caller
  // never sees it. (Before SHELDON-CLIO-CONFIRM-EMAIL the summary went into the
  // calendar description, which Clio emails verbatim to the client; it does not
  // any more, and nothing in this record may go back there.) KV (not the read-once
  // DO) because Paula's get_qualifier_result consumes the DO slot mid-call. 6h TTL
  // bridges call→booking.
  //
  // TWO FORMS OF THE SAME ANSWERS, on purpose (SHELDON-CLIO-CONTACT-MAPPING).
  // `summary` is the human rollup that becomes the Clio contact Note; `intake` is
  // the structured half that becomes custom_field_values on the contact, and
  // `state` becomes the contact's address province. The booking backend cannot
  // recover structure by parsing the prose — that would be a regex measurement of
  // our own formatting, breaking the moment formatQualSummary is reworded — so the
  // structure is carried explicitly. Both halves live on the SAME 6h record and
  // are equally attorney-side; nothing here changes what is written to the DO slot,
  // to Vantage, or to any client-facing surface.
  //
  // THE RECORD IS ONLY HALF THE JOIN, AND THE OTHER HALF USED TO BE PAGE MEMORY.
  // #153: this record survives the call ending — 6h TTL, and booking/_lib/
  // qualifier-bind.js treats the KV copy alone as confirming precisely for that
  // case. What did NOT survive was the KEY. The booking form's only source of
  // `call_id` is `window.__perchCallId`, a JS global written by the live command
  // channel, so a caller who finished the qualifier and then booked from a page
  // that had been reloaded — or after the call ended in a document that had been
  // replaced — arrived with a fully valid record sitting in KV and no way to name
  // it. That is why a live booking wrote zero Intake fields with the Clio
  // integration working perfectly. `armed` below is the durable second carrier;
  // see functions/_lib/qualifier-cookie.js for why a cookie is the only join that
  // is genuinely server-side.
  let armed = '';
  if (env && env.PERCH_ACTIONS && callId && callId !== 'default') {
    try {
      const summary = formatQualSummary(fields);
      if (summary) {
        await env.PERCH_ACTIONS.put(
          'qualbk:' + callId,
          JSON.stringify({
            summary,
            intake: contactIntake(fields),
            state: fields.state || '',
            flag_criminal: fields.flag_criminal || '', flag_urgent: fields.flag_urgent || '', matter: fields.matter || '',
            // Carried so booking/create.js can value the conversion. `clean()` derives
            // both above but they stopped here, which meant the one place that knows
            // a caller is Reserve-tier could not tell the one place that reports the
            // conversion. Every booking was worth the same to Google as a result.
            // Not shown to the caller and not used for routing — reporting only.
            tier: fields.tier || '', strategy_path: fields.strategy_path || '',
          }),
          // The cookie's Max-Age is this same constant, imported rather than
          // re-typed: a cookie that outlives its record names nothing, and a record
          // that outlives its cookie is a join silently dropped inside its own
          // lifetime.
          { expirationTtl: QUALIFIER_COOKIE_MAX_AGE },
        );
        // ONLY after the record is actually stored. Arming the browser for a record
        // that does not exist would hand every later booking an id that resolves
        // `unverified` — the fail-closed outcome, but reached by our own doing, and
        // indistinguishable in the logs from a forged id.
        armed = setQualifierCookie(callId);
      }
    } catch (e) { /* non-fatal: booking still works without the enrichment */ }
  }

  // ── Step 2 used to forward the qualifier fields to Vantage ─────────────────
  // A fire-and-forget GET to `vantage.ticoai.net/upsert-lead` under `waitUntil`,
  // carrying this caller's income and net-worth bands. Removed with the Vantage
  // severance, along with the shared `sendVantageUpsert` and both vantage-*.js
  // libraries.
  //
  // This endpoint's OWN job is unchanged and is the one that mattered: step 1
  // above still writes the qualifier record to KV and still sets the server-side
  // cookie, which is what `functions/booking/create.js` joins on to enrich a
  // booking. That join is same-origin and never involved Vantage.
  //
  // Worth stating plainly because it is a security improvement, not just a
  // deletion: the removed call was the one that sent qualifier PII off-origin.
  // Nothing leaves the firm's own infrastructure from here any more.

  // echo status so the modal can show "handoff" vs "done" UI without re-deriving.
  // The Set-Cookie rides on this response. The modal fires this POST and never
  // reads the reply (js/perch/qualifier.js submitQual — fire-and-forget with a
  // swallowed catch), which is fine and is not an accident: the browser stores a
  // Set-Cookie off a same-origin fetch whether or not anything awaits the body, so
  // the join arms itself with no change to the client at all.
  return J({ ok: true, status }, 200, armed ? { 'set-cookie': armed } : undefined);
}
