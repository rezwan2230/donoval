/* =============================================================================
   ENTITY FORMATION ASSEMBLY TOOL  —  Donovan Reserve
   =============================================================================
   Phase 1: Single-Member LLC formation for FL, DE, and WY.
   Generates draft Operating Agreement, Initial Resolutions, Articles of
   Organization Information Sheet, and SS-4 (EIN) Worksheet.
   All documents marked DRAFT pending attorney review and final issuance.
   ============================================================================= */

// =============================================================================
// PAGE INITIALIZATION
// Access is controlled at the server level by Apache Basic Auth via cPanel
// Directory Privacy on the /reserve/ folder. No client-side gate needed.
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Default formation date to today
  const fd = document.getElementById('formation_date');
  if (fd) fd.valueAsDate = new Date();
});

// =============================================================================
// WIZARD NAVIGATION
// =============================================================================
document.querySelectorAll('.btn-ef-next, .btn-ef-back').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = parseInt(btn.dataset.target);
    showStep(target);
    if (target === 6) renderReviewSummary();
  });
});

function showStep(n) {
  document.querySelectorAll('.ef-step').forEach(s => s.classList.remove('ef-step-active'));
  document.querySelector(`.ef-step[data-step="${n}"]`).classList.add('ef-step-active');
  document.querySelectorAll('.ef-progress-step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.toggle('ef-active', stepNum === n);
    s.classList.toggle('ef-complete', stepNum < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Management structure visibility
document.getElementById('management_structure').addEventListener('change', e => {
  document.getElementById('manager_field').style.display =
    e.target.value === 'manager_managed' ? 'block' : 'none';
});

// Jurisdiction help text
const JURIS_HELP = {
  FL: '<strong>Florida:</strong> Default jurisdiction for FL-resident principals and Florida properties. Annual report required by May 1; no state income tax. <em>Note: charging-order protection is weaker for single-member LLCs in Florida after</em> Olmstead v. FTC, 44 So.3d 76 (Fla. 2010); <em>consider Wyoming or Delaware if asset protection is a primary concern.</em>',
  DE: '<strong>Delaware:</strong> Most prestigious U.S. business jurisdiction. Strong corporate law, well-developed case law, business-friendly courts. Used for fund structures, holding companies, and entities where institutional credibility matters. Franchise tax $300 minimum annually. Commercial registered agent required.',
  WY: '<strong>Wyoming:</strong> Strong charging-order protection (sole remedy under Wyo. Stat. § 17-29-503), no state income tax, low filing fees, strong member privacy. Increasingly used for asset-protection holding structures. Commercial registered agent typically required for non-resident members.'
};
document.getElementById('jurisdiction').addEventListener('change', e => {
  document.getElementById('juris_help').innerHTML = JURIS_HELP[e.target.value];
});

// =============================================================================
// COLLECT FORM DATA
// =============================================================================
function collectData() {
  return {
    entityType: document.getElementById('entity_type').value,
    jurisdiction: document.getElementById('jurisdiction').value,
    companyName: document.getElementById('company_name').value.trim(),
    principalStreet: document.getElementById('principal_street').value.trim(),
    principalCSZ: document.getElementById('principal_city_state_zip').value.trim(),
    mailingStreet: document.getElementById('mailing_street').value.trim(),
    mailingCSZ: document.getElementById('mailing_city_state_zip').value.trim(),
    raName: document.getElementById('ra_name').value.trim(),
    raStreet: document.getElementById('ra_street').value.trim(),
    raCSZ: document.getElementById('ra_city_state_zip').value.trim(),
    formationDate: document.getElementById('formation_date').value,
    memberName: document.getElementById('member_name').value.trim(),
    memberType: document.getElementById('member_type').value,
    memberStreet: document.getElementById('member_street').value.trim(),
    memberCSZ: document.getElementById('member_city_state_zip').value.trim(),
    capitalContribution: document.getElementById('capital_contribution').value.trim(),
    managementStructure: document.getElementById('management_structure').value,
    managerName: document.getElementById('manager_name').value.trim(),
    taxClassification: document.getElementById('tax_classification').value,
    businessPurpose: document.getElementById('business_purpose').value,
    speProvisions: document.getElementById('spe_provisions').checked,
    assetProtection: document.getElementById('asset_protection').checked,
    seriesDesignation: document.getElementById('series_designation').checked,
    transferRestrictions: document.getElementById('transfer_restrictions').checked,
    attorneyNotes: document.getElementById('attorney_notes').value.trim(),
  };
}

// =============================================================================
// REVIEW SUMMARY
// =============================================================================
const JURIS_NAMES = { FL: 'Florida', DE: 'Delaware', WY: 'Wyoming' };
const MGMT_NAMES = { member_managed: 'Member-Managed', manager_managed: 'Manager-Managed' };
const TAX_NAMES = {
  disregarded: 'Disregarded Entity (default for SMLLC)',
  s_corp: 'S-Corporation (Form 2553 required)',
  c_corp: 'Association Taxable as Corporation (Form 8832 required)',
};
const PURPOSE_NAMES = {
  real_estate_holding: 'Real Estate Holding',
  real_estate_development: 'Real Estate Development',
  real_estate_operating: 'Real Estate Operating (STR / hospitality)',
  investment_holding: 'Investment Holding',
  general: 'General Business Purpose',
};

function renderReviewSummary() {
  const d = collectData();
  const formationDateDisplay = d.formationDate
    ? new Date(d.formationDate + 'T00:00:00').toLocaleDateString('en-US',
        { year: 'numeric', month: 'long', day: 'numeric' })
    : '(not specified)';
  let specials = [];
  if (d.speProvisions) specials.push('Single-Purpose Entity provisions');
  if (d.assetProtection) specials.push('Charging-order protection language');
  if (d.seriesDesignation) specials.push('Series LLC reservation');
  if (d.transferRestrictions) specials.push('Strict transfer restrictions');
  const specialsText = specials.length ? specials.join('; ') : 'None selected';

  const html = `
    <div class="ef-review-card">
      <h3>Review Your Inputs</h3>
      <table class="ef-review-table">
        <tr><td>Entity Type</td><td>Single-Member LLC</td></tr>
        <tr><td>Jurisdiction</td><td>${JURIS_NAMES[d.jurisdiction]}</td></tr>
        <tr><td>Company Name</td><td>${escapeHtml(d.companyName) || '<em class="ef-missing">Required</em>'}</td></tr>
        <tr><td>Principal Office</td><td>${escapeHtml(d.principalStreet)}, ${escapeHtml(d.principalCSZ)}</td></tr>
        <tr><td>Registered Agent</td><td>${escapeHtml(d.raName)} &mdash; ${escapeHtml(d.raStreet)}, ${escapeHtml(d.raCSZ)}</td></tr>
        <tr><td>Formation Date</td><td>${formationDateDisplay}</td></tr>
        <tr><td>Member</td><td>${escapeHtml(d.memberName) || '<em class="ef-missing">Required</em>'}</td></tr>
        <tr><td>Capital Contribution</td><td>${escapeHtml(d.capitalContribution)}</td></tr>
        <tr><td>Management</td><td>${MGMT_NAMES[d.managementStructure]}${d.managementStructure === 'manager_managed' ? ' &mdash; Manager: ' + escapeHtml(d.managerName) : ''}</td></tr>
        <tr><td>Tax Classification</td><td>${TAX_NAMES[d.taxClassification]}</td></tr>
        <tr><td>Business Purpose</td><td>${PURPOSE_NAMES[d.businessPurpose]}</td></tr>
        <tr><td>Special Provisions</td><td>${specialsText}</td></tr>
        ${d.attorneyNotes ? `<tr><td>Attorney Notes</td><td>${escapeHtml(d.attorneyNotes)}</td></tr>` : ''}
      </table>
    </div>
  `;
  document.getElementById('review_summary').innerHTML = html;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// =============================================================================
// DOCUMENT GENERATION
// =============================================================================
let currentDocs = {};

document.getElementById('generate_docs').addEventListener('click', () => {
  const d = collectData();
  if (!d.companyName || !d.memberName) {
    alert('Please complete required fields: Company Name and Member Name.');
    return;
  }
  currentDocs = {
    op_agreement: buildOperatingAgreement(d),
    resolutions: buildInitialResolutions(d),
    articles_info: buildArticlesInfo(d),
    ss4: buildSS4Worksheet(d),
  };
  document.getElementById('generated_docs').style.display = 'block';
  showDoc('op_agreement');
});

document.querySelectorAll('.ef-doc-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ef-doc-tab').forEach(t => t.classList.remove('ef-doc-tab-active'));
    tab.classList.add('ef-doc-tab-active');
    showDoc(tab.dataset.doc);
  });
});

function showDoc(key) {
  const wrapper = document.getElementById('doc_preview');
  wrapper.dataset.currentDoc = key;
  wrapper.innerHTML = currentDocs[key];
}

document.getElementById('print_doc').addEventListener('click', () => {
  const key = document.getElementById('doc_preview').dataset.currentDoc;
  const content = currentDocs[key];
  const win = window.open('', '_blank');
  win.document.write(`
    <!doctype html><html><head><meta charset="utf-8"><title>Draft Document</title>
    <style>
      @page { margin: 1in; }
      body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.5; color: #000; }
      .draft-banner { background: #ffe4b3; border: 2px solid #b8860b; padding: 0.5rem 1rem; margin-bottom: 1rem; font-family: 'Open Sans', sans-serif; font-size: 10pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #6b4d0e; text-align: center; }
      h1 { font-size: 14pt; text-align: center; text-transform: uppercase; letter-spacing: 1.5px; margin: 1.5rem 0 1rem; }
      h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 1.5rem; margin-bottom: 0.5rem; }
      .article { margin-top: 1.5rem; }
      .article-heading { font-weight: bold; text-decoration: underline; }
      .section { margin-top: 0.75rem; text-align: justify; }
      .signature-block { margin-top: 2rem; }
      .signature-line { border-top: 1px solid #000; width: 60%; margin-top: 2rem; padding-top: 0.25rem; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      td, th { padding: 0.4rem 0.6rem; border: 1px solid #000; text-align: left; vertical-align: top; }
      @media print { .draft-banner { background: #ffe4b3 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
    </head><body>${content}<script>window.onload=function(){window.print();}<\/script></body></html>
  `);
  win.document.close();
});

document.getElementById('copy_doc').addEventListener('click', () => {
  const key = document.getElementById('doc_preview').dataset.currentDoc;
  const tmp = document.createElement('div');
  tmp.innerHTML = currentDocs[key];
  const text = tmp.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy_doc');
    const orig = btn.innerText;
    btn.innerText = 'Copied!';
    setTimeout(() => btn.innerText = orig, 1500);
  });
});

// =============================================================================
// DOCUMENT TEMPLATES
// =============================================================================

const DRAFT_BANNER = '<div class="draft-banner">DRAFT &mdash; Subject to Attorney Review and Final Issuance by Donovan Legal PLLC. Not effective until reviewed, finalized, and signed pursuant to the firm&rsquo;s engagement letter.</div>';

const JURIS_FULL = {
  FL: { name: 'Florida', actName: 'Florida Revised Limited Liability Company Act', actCite: 'Chapter 605, Florida Statutes' },
  DE: { name: 'Delaware', actName: 'Delaware Limited Liability Company Act', actCite: '6 Del. C. § 18-101 et seq.' },
  WY: { name: 'Wyoming', actName: 'Wyoming Limited Liability Company Act', actCite: 'Wyo. Stat. § 17-29-101 et seq.' },
};

const PURPOSE_LANG = {
  real_estate_holding: 'to acquire, own, hold, lease, manage, finance, refinance, mortgage, sell, exchange, and otherwise deal with real property and interests therein, and to engage in any and all activities incidental thereto',
  real_estate_development: 'to acquire, develop, improve, construct upon, lease, finance, and sell real property; to enter into contracts with architects, contractors, lenders, and other parties necessary to such development; and to engage in any and all activities incidental thereto',
  real_estate_operating: 'to acquire, own, hold, operate, lease, license, and dispose of real property used for short-term rental, hospitality, or similar guest accommodation purposes, including all activities incidental to the operation of such properties',
  investment_holding: 'to acquire, hold, manage, vote, and dispose of equity and debt interests in other entities, securities, and other investment assets, and to engage in any and all activities incidental thereto',
  general: 'to engage in any lawful act or activity for which limited liability companies may be organized under the laws of the State of formation',
};

// -----------------------------------------------------------------------------
// OPERATING AGREEMENT
// -----------------------------------------------------------------------------
function buildOperatingAgreement(d) {
  const J = JURIS_FULL[d.jurisdiction];
  const fdate = d.formationDate
    ? new Date(d.formationDate + 'T00:00:00').toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : '_______________';
  const purpose = PURPOSE_LANG[d.businessPurpose];
  const isManagerManaged = d.managementStructure === 'manager_managed';
  const managerName = isManagerManaged ? (d.managerName || '_______________') : d.memberName;
  const fullPrincipal = [d.principalStreet, d.principalCSZ].filter(Boolean).join(', ');
  const fullRA = [d.raStreet, d.raCSZ].filter(Boolean).join(', ');
  const fullMember = [d.memberStreet, d.memberCSZ].filter(Boolean).join(', ');

  // Tax election language
  const taxLanguage = {
    disregarded: 'It is the intent of the Member that the Company be classified as a disregarded entity for federal income tax purposes pursuant to Treasury Regulation § 301.7701-3, and that the Company\'s activities be reported on the Member\'s federal income tax return. The Company shall not file Form 8832 or otherwise elect any classification inconsistent with disregarded-entity treatment.',
    s_corp: 'The Member intends that the Company be classified as an association taxable as a corporation for federal income tax purposes, with a further election to be treated as an S-corporation under Subchapter S of the Internal Revenue Code. The Company shall timely file Form 8832 (or Form 2553 if eligible for the deemed Form 8832 election) and Form 2553. Distributions and allocations shall be made consistent with such classification.',
    c_corp: 'The Member intends that the Company be classified as an association taxable as a corporation for federal income tax purposes. The Company shall timely file Form 8832 to elect such classification. Distributions and allocations shall be made consistent with such classification.',
  };

  // SPE language (optional)
  const speLanguage = d.speProvisions ? `

  <div class="article">
    <p class="article-heading">ARTICLE X &mdash; SINGLE-PURPOSE ENTITY COVENANTS</p>
    <div class="section"><strong>Section 10.1 &mdash; Purpose Limitation.</strong> The Company shall conduct only the business specified in Article III, and shall not engage in any other business or activity without the prior written consent of any lender holding indebtedness of the Company and the unanimous written consent of the Member.</div>
    <div class="section"><strong>Section 10.2 &mdash; Restrictions on Indebtedness.</strong> The Company shall not incur, create, assume, or guarantee any indebtedness other than (a) the indebtedness secured by the property owned by the Company; (b) unsecured trade payables incurred in the ordinary course of business and paid within sixty (60) days; and (c) such other indebtedness as may be specifically permitted by the loan documents governing the Company&rsquo;s primary financing.</div>
    <div class="section"><strong>Section 10.3 &mdash; Separateness Covenants.</strong> The Company shall: (a) maintain its books, records, accounts, and financial statements separate from any other person; (b) hold itself out as a separate entity to creditors and the public; (c) conduct its business in its own name; (d) maintain separate bank accounts; (e) not commingle its assets with those of any other person; (f) pay its own liabilities from its own funds; (g) observe all formalities required by its organizational documents and applicable law; (h) maintain an arm&rsquo;s-length relationship with the Member and any affiliates; (i) not pledge its assets for the benefit of any other person; and (j) correct any known misunderstanding regarding its separate identity.</div>
    <div class="section"><strong>Section 10.4 &mdash; No Dissolution Without Lender Consent.</strong> The Company shall not dissolve, liquidate, or wind up its business while any indebtedness secured by Company property remains outstanding without the prior written consent of the holder of such indebtedness.</div>
    <div class="section"><strong>Section 10.5 &mdash; Independent Manager (Reserved).</strong> If required by the Company&rsquo;s lender, the Member shall appoint an Independent Manager whose consent shall be required for any voluntary bankruptcy filing or consent to involuntary bankruptcy of the Company. The terms of such appointment and the qualifications of the Independent Manager shall be as required by the applicable loan documents.</div>
  </div>` : '';

  // Asset protection / charging order language (optional)
  const apLanguage = d.assetProtection ? `

  <div class="article">
    <p class="article-heading">ARTICLE XI &mdash; CHARGING ORDER PROTECTION</p>
    <div class="section"><strong>Section 11.1 &mdash; Exclusive Creditor Remedy.</strong> To the fullest extent permitted by the ${J.actName}, the exclusive remedy available to a creditor of the Member with respect to the Member&rsquo;s membership interest shall be a charging order against distributions, as provided under ${J.actCite}. No creditor shall have the right to (a) become a Member or Manager, (b) interfere in the management or operations of the Company, (c) cause the dissolution or wind-up of the Company, (d) compel any distribution from the Company, or (e) foreclose upon or seize the Member&rsquo;s membership interest.</div>
    <div class="section"><strong>Section 11.2 &mdash; No Right to Information.</strong> A holder of a charging order shall be entitled only to receive distributions actually made by the Company with respect to the charged interest and shall have no right to inspect the books, records, or financial information of the Company.</div>
    <div class="section"><strong>Section 11.3 &mdash; Governing Law.</strong> This Article shall be interpreted to provide the maximum available protection permitted by the ${J.actName}, and any judicial or administrative interpretation of charging-order protection under the laws of any other jurisdiction shall not control over this Article.</div>
  </div>` : '';

  // Series LLC reservation (optional)
  const seriesLanguage = d.seriesDesignation && (d.jurisdiction === 'DE' || d.jurisdiction === 'WY') ? `

  <div class="article">
    <p class="article-heading">ARTICLE XII &mdash; RESERVATION OF SERIES LLC AUTHORITY</p>
    <div class="section"><strong>Section 12.1 &mdash; Authority to Establish Series.</strong> The Company expressly reserves the right, pursuant to ${d.jurisdiction === 'DE' ? '6 Del. C. § 18-215' : 'Wyo. Stat. § 17-29-1101 et seq.'}, to establish one or more designated series of the Company, each of which may have separate rights, powers, and duties, separate property, and separate members and managers. The Company has not as of the date of this Agreement established any such series. Any future establishment of a series shall be effected by a written designation executed by the Member and shall comply with all requirements of applicable law for the segregation of assets and liabilities of each series.</div>
  </div>` : '';

  // Transfer restrictions (optional, more restrictive)
  const transferLanguage = d.transferRestrictions ? `

  <div class="article">
    <p class="article-heading">ARTICLE XIII &mdash; RESTRICTIONS ON TRANSFER</p>
    <div class="section"><strong>Section 13.1 &mdash; Prohibition on Transfer Without Consent.</strong> The Member may not sell, assign, transfer, pledge, encumber, or otherwise dispose of all or any portion of the Member&rsquo;s membership interest without the prior written consent of the Member, which consent the Member may grant or withhold in the Member&rsquo;s sole and absolute discretion. Any attempted transfer in violation of this Section shall be void <em>ab initio</em> and of no legal effect.</div>
    <div class="section"><strong>Section 13.2 &mdash; Permitted Transfers.</strong> Notwithstanding Section 13.1, the Member may transfer the Member&rsquo;s membership interest to (a) a revocable trust of which the Member is the grantor; (b) an irrevocable trust for the benefit of the Member&rsquo;s spouse or descendants; (c) the Member&rsquo;s estate upon the Member&rsquo;s death; and (d) such other transferees as may be necessary to maintain disregarded-entity status for federal tax purposes, provided that any such transferee shall execute a counterpart of this Agreement and shall be bound by all provisions hereof.</div>
    <div class="section"><strong>Section 13.3 &mdash; No Termination on Permitted Transfer.</strong> A permitted transfer under Section 13.2 shall not cause the dissolution or termination of the Company.</div>
  </div>` : '';

  return DRAFT_BANNER + `
<h1>Operating Agreement of<br/>${escapeHtml(d.companyName) || '_______________'}</h1>
<p style="text-align:center; font-style:italic; margin-bottom:1.5rem;">A ${J.name} Single-Member Limited Liability Company</p>

<div class="section">This Operating Agreement (the &ldquo;Agreement&rdquo;) is entered into and effective as of ${fdate} by ${escapeHtml(d.memberName) || '_______________'} (the &ldquo;Member&rdquo;), as the sole member of ${escapeHtml(d.companyName) || '_______________'}, a ${J.name} limited liability company (the &ldquo;Company&rdquo;).</div>

<div class="section"><strong>RECITALS</strong></div>
<div class="section"><strong>A.</strong> The Company has been or will be organized under the ${J.actName}, ${J.actCite}, by the filing of Articles of Organization (or Certificate of Formation) with the ${J.name} Secretary of State.</div>
<div class="section"><strong>B.</strong> The Member desires to set forth the governance, operating, and economic arrangements of the Company in this Agreement.</div>
<div class="section">NOW, THEREFORE, the Member, for the consideration herein set forth and intending to be legally bound, hereby agrees as follows:</div>

<div class="article">
  <p class="article-heading">ARTICLE I &mdash; FORMATION</p>
  <div class="section"><strong>Section 1.1 &mdash; Formation.</strong> The Company has been formed as a limited liability company pursuant to the ${J.actName}. The rights and obligations of the Member and the operation of the Company shall be governed by this Agreement and, to the extent not addressed herein, by the ${J.actName}.</div>
  <div class="section"><strong>Section 1.2 &mdash; Name.</strong> The name of the Company is <strong>${escapeHtml(d.companyName) || '_______________'}</strong>. The Company shall conduct business under such name, or under such other names as the Member may from time to time designate.</div>
  <div class="section"><strong>Section 1.3 &mdash; Principal Office.</strong> The principal office of the Company shall be located at ${escapeHtml(fullPrincipal) || '_______________'}, or at such other place as the Member may from time to time designate.</div>
  <div class="section"><strong>Section 1.4 &mdash; Registered Agent.</strong> The Company&rsquo;s registered agent in the State of ${J.name} is ${escapeHtml(d.raName) || '_______________'}, located at ${escapeHtml(fullRA) || '_______________'}. The registered agent and registered office may be changed by the Member from time to time in accordance with ${J.name} law.</div>
  <div class="section"><strong>Section 1.5 &mdash; Term.</strong> The Company commenced on the date its Articles of Organization (or Certificate of Formation) were filed with the ${J.name} Secretary of State and shall continue in perpetuity unless dissolved as provided herein or by operation of law.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE II &mdash; MEMBER</p>
  <div class="section"><strong>Section 2.1 &mdash; Sole Member.</strong> The sole member of the Company is ${escapeHtml(d.memberName) || '_______________'}, whose address is ${escapeHtml(fullMember) || '_______________'} (the &ldquo;Member&rdquo;). The Member owns one hundred percent (100%) of the Company&rsquo;s membership interests.</div>
  <div class="section"><strong>Section 2.2 &mdash; Limited Liability.</strong> The Member shall not be personally liable for any debts, obligations, or liabilities of the Company beyond the Member&rsquo;s capital contribution, except as expressly required by the ${J.actName} or other applicable law.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE III &mdash; PURPOSE</p>
  <div class="section"><strong>Section 3.1 &mdash; Purpose.</strong> The purpose of the Company is ${purpose}, and to engage in any other lawful act or activity for which limited liability companies may be organized under the ${J.actName}.</div>
  <div class="section"><strong>Section 3.2 &mdash; Powers.</strong> The Company shall have all powers necessary or convenient to carry out its purposes, including without limitation the power to: acquire, own, hold, lease, mortgage, finance, refinance, sell, exchange, and otherwise deal with real and personal property; to borrow and lend money; to make and perform contracts; to maintain bank and brokerage accounts; to engage employees, agents, contractors, and professional advisors; and to take any other action necessary or appropriate to the conduct of the Company&rsquo;s business.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE IV &mdash; CAPITAL CONTRIBUTIONS</p>
  <div class="section"><strong>Section 4.1 &mdash; Initial Contribution.</strong> The Member has contributed or shall contribute to the capital of the Company the following: ${escapeHtml(d.capitalContribution) || '_______________'}.</div>
  <div class="section"><strong>Section 4.2 &mdash; Additional Contributions.</strong> The Member may, but is not required to, make additional capital contributions to the Company from time to time. The Member&rsquo;s decision to make or decline additional contributions shall be in the Member&rsquo;s sole discretion.</div>
  <div class="section"><strong>Section 4.3 &mdash; No Interest on Capital.</strong> No interest shall be paid on capital contributions.</div>
  <div class="section"><strong>Section 4.4 &mdash; Capital Account.</strong> The Company shall maintain a capital account for the Member in accordance with general principles of accounting, adjusted for contributions, distributions, and the Member&rsquo;s share of the Company&rsquo;s profits and losses.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE V &mdash; DISTRIBUTIONS AND ALLOCATIONS</p>
  <div class="section"><strong>Section 5.1 &mdash; Distributions.</strong> Distributions of cash or other property shall be made to the Member at such times and in such amounts as the Member shall determine in the Member&rsquo;s sole discretion, subject only to the limitations imposed by the ${J.actName} and any applicable loan covenants.</div>
  <div class="section"><strong>Section 5.2 &mdash; Allocations.</strong> All items of Company income, gain, loss, deduction, and credit shall be allocated to the Member, who is the sole member of the Company.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE VI &mdash; MANAGEMENT</p>
  <div class="section"><strong>Section 6.1 &mdash; Management Structure.</strong> The Company shall be ${isManagerManaged ? '<strong>manager-managed</strong>' : '<strong>member-managed</strong>'}.</div>
  ${isManagerManaged ? `<div class="section"><strong>Section 6.2 &mdash; Manager.</strong> The Manager of the Company is ${escapeHtml(managerName)}. The Manager shall have full, exclusive, and complete authority, power, and discretion to manage and direct the business and affairs of the Company, subject only to such limitations as the Member may from time to time impose in writing. The Member may remove and replace the Manager at any time, with or without cause.</div>` : `<div class="section"><strong>Section 6.2 &mdash; Member Authority.</strong> The Member shall have full, exclusive, and complete authority, power, and discretion to manage and direct the business and affairs of the Company. All decisions shall be made by the Member in the Member&rsquo;s sole discretion.</div>`}
  <div class="section"><strong>Section 6.3 &mdash; Signing Authority.</strong> The ${isManagerManaged ? 'Manager' : 'Member'} is authorized to execute any and all documents, contracts, agreements, deeds, notes, mortgages, security agreements, leases, and other instruments on behalf of the Company. Third parties may rely on the signature of the ${isManagerManaged ? 'Manager' : 'Member'} as binding on the Company without further inquiry into the existence of authorization.</div>
  <div class="section"><strong>Section 6.4 &mdash; Officers (Optional).</strong> The ${isManagerManaged ? 'Manager' : 'Member'} may from time to time appoint and remove officers of the Company with such titles, authority, and duties as the ${isManagerManaged ? 'Manager' : 'Member'} may designate. Officers serve at the pleasure of the ${isManagerManaged ? 'Manager' : 'Member'}.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE VII &mdash; FEDERAL TAX CLASSIFICATION</p>
  <div class="section"><strong>Section 7.1 &mdash; Tax Classification.</strong> ${taxLanguage[d.taxClassification]}</div>
  <div class="section"><strong>Section 7.2 &mdash; Tax Filings.</strong> The Company shall timely prepare or cause to be prepared and shall timely file all federal, state, and local tax returns, information returns, and other tax filings required by applicable law. The Member shall cooperate in providing information necessary to prepare such filings.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE VIII &mdash; BOOKS, RECORDS, AND BANKING</p>
  <div class="section"><strong>Section 8.1 &mdash; Books and Records.</strong> The Company shall maintain complete and accurate books and records of its business, financial condition, and operations. Books and records shall be kept at the principal office of the Company or at such other place as the Member shall designate.</div>
  <div class="section"><strong>Section 8.2 &mdash; Fiscal Year.</strong> The fiscal year of the Company shall be the calendar year unless the Member designates an alternative fiscal year permitted by applicable tax law.</div>
  <div class="section"><strong>Section 8.3 &mdash; Bank Accounts.</strong> The Company shall maintain such bank accounts as the ${isManagerManaged ? 'Manager' : 'Member'} shall designate. The ${isManagerManaged ? 'Manager' : 'Member'} is authorized to open such accounts on behalf of the Company and to execute all documents necessary therefor.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE IX &mdash; INDEMNIFICATION</p>
  <div class="section"><strong>Section 9.1 &mdash; Indemnification.</strong> To the fullest extent permitted by the ${J.actName}, the Company shall indemnify and hold harmless the Member${isManagerManaged ? ', the Manager,' : ''} and any officer, agent, or other authorized representative of the Company from and against any and all losses, claims, damages, liabilities, costs, and expenses (including reasonable attorneys&rsquo; fees) arising out of any act or omission performed or omitted by such person on behalf of the Company, except in the case of gross negligence, willful misconduct, or knowing violation of law.</div>
  <div class="section"><strong>Section 9.2 &mdash; Advancement of Expenses.</strong> The Company shall advance the reasonable expenses of any indemnified person in connection with any proceeding upon receipt of a written undertaking by such person to repay such advances if it is ultimately determined that such person is not entitled to indemnification.</div>
</div>
${speLanguage}
${apLanguage}
${seriesLanguage}
${transferLanguage}

<div class="article">
  <p class="article-heading">ARTICLE XIV &mdash; DISSOLUTION</p>
  <div class="section"><strong>Section 14.1 &mdash; Events of Dissolution.</strong> The Company shall be dissolved and its affairs wound up upon the first to occur of: (a) a written determination by the Member to dissolve the Company; (b) the entry of a judicial decree of dissolution under the ${J.actName}; or (c) any other event causing dissolution under mandatory provisions of the ${J.actName}.</div>
  <div class="section"><strong>Section 14.2 &mdash; Winding Up.</strong> Upon dissolution, the Company shall wind up its affairs in accordance with the ${J.actName}, satisfy or provide for its liabilities, and distribute remaining assets to the Member.</div>
  <div class="section"><strong>Section 14.3 &mdash; Continuation Notwithstanding Member Events.</strong> The death, disability, dissolution, bankruptcy, or other involuntary event affecting the Member shall not cause the Company to dissolve. The Member&rsquo;s successor (including but not limited to a personal representative, trustee, or assignee by operation of law) shall succeed to the Member&rsquo;s membership interest and may continue the Company in accordance with the ${J.actName} and applicable trust or estate law.</div>
</div>

<div class="article">
  <p class="article-heading">ARTICLE XV &mdash; GENERAL PROVISIONS</p>
  <div class="section"><strong>Section 15.1 &mdash; Governing Law.</strong> This Agreement shall be governed by, construed under, and enforced in accordance with the laws of the State of ${J.name}, without regard to its conflict-of-laws principles.</div>
  <div class="section"><strong>Section 15.2 &mdash; Entire Agreement.</strong> This Agreement constitutes the entire agreement of the Member with respect to the subject matter hereof and supersedes any prior agreements or understandings, whether written or oral.</div>
  <div class="section"><strong>Section 15.3 &mdash; Amendment.</strong> This Agreement may be amended only by a written instrument executed by the Member. So long as the Company has only one Member, no consent of any other person shall be required for amendment.</div>
  <div class="section"><strong>Section 15.4 &mdash; Severability.</strong> If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.</div>
  <div class="section"><strong>Section 15.5 &mdash; Counterparts.</strong> This Agreement may be executed in counterparts, including by electronic signature, each of which shall be deemed an original and all of which together shall constitute one and the same instrument.</div>
  <div class="section"><strong>Section 15.6 &mdash; Headings.</strong> Article and Section headings are for convenience only and shall not affect interpretation.</div>
  <div class="section"><strong>Section 15.7 &mdash; No Third-Party Beneficiaries.</strong> This Agreement is for the benefit of the Member only and shall not confer any rights upon any other person, except as expressly provided herein.</div>
</div>

<div class="signature-block">
  <p style="margin-top:2rem;">IN WITNESS WHEREOF, the Member has executed this Operating Agreement effective as of the date first written above.</p>
  <div class="signature-line">${escapeHtml(d.memberName) || '_______________'}, Sole Member</div>
  <p style="margin-top:1rem;">Date: __________________________</p>
</div>
`;
}

// -----------------------------------------------------------------------------
// INITIAL RESOLUTIONS (ACTION BY SOLE MEMBER)
// -----------------------------------------------------------------------------
function buildInitialResolutions(d) {
  const J = JURIS_FULL[d.jurisdiction];
  const fdate = d.formationDate
    ? new Date(d.formationDate + 'T00:00:00').toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : '_______________';

  const taxResolution = {
    disregarded: '<strong>Federal Tax Classification.</strong> The Company shall be treated as a disregarded entity for federal income tax purposes pursuant to Treasury Regulation § 301.7701-3. The Company shall not file Form 8832 or otherwise elect any inconsistent classification. The Member shall report the Company&rsquo;s activity on the Member&rsquo;s federal income tax return.',
    s_corp: '<strong>Federal Tax Classification.</strong> The Company shall elect to be classified as an association taxable as a corporation pursuant to Treasury Regulation § 301.7701-3 by filing IRS Form 8832 (or, if eligible, the deemed Form 8832 election upon filing Form 2553), and shall further elect S-corporation status under Subchapter S of the Internal Revenue Code by timely filing IRS Form 2553. The Member is authorized and directed to execute and file Forms 8832 and 2553 as necessary to effect such elections.',
    c_corp: '<strong>Federal Tax Classification.</strong> The Company shall elect to be classified as an association taxable as a corporation for federal income tax purposes by timely filing IRS Form 8832. The Member is authorized and directed to execute and file Form 8832.',
  };

  return DRAFT_BANNER + `
<h1>Action by Sole Member<br/>${escapeHtml(d.companyName) || '_______________'}</h1>
<p style="text-align:center; font-style:italic; margin-bottom:1.5rem;">In Lieu of Initial Meeting</p>

<div class="section">The undersigned, being the sole member of <strong>${escapeHtml(d.companyName) || '_______________'}</strong>, a ${J.name} limited liability company (the &ldquo;Company&rdquo;), hereby takes the following actions and adopts the following resolutions effective as of ${fdate}:</div>

<div class="section"><strong>1. Adoption of Operating Agreement.</strong> The Operating Agreement of the Company, in the form executed by the undersigned and dated as of the same date as this Action, is hereby adopted as the operating agreement of the Company.</div>

<div class="section"><strong>2. Confirmation of Formation Filings.</strong> The Member ratifies, confirms, and approves all actions taken by any organizer or other person in connection with the formation of the Company, including the filing of the Articles of Organization (or Certificate of Formation) with the ${J.name} Secretary of State, the appointment of the registered agent, and the establishment of the principal office.</div>

<div class="section"><strong>3. Capital Contribution.</strong> The Member acknowledges and confirms the initial capital contribution described in the Operating Agreement, consisting of ${escapeHtml(d.capitalContribution) || '_______________'}.</div>

<div class="section"><strong>4. Application for Employer Identification Number.</strong> The Member is authorized and directed to apply for a federal Employer Identification Number (EIN) for the Company by filing IRS Form SS-4. The Member shall serve as the responsible party for Form SS-4 purposes.</div>

<div class="section"><strong>5. ${taxResolution[d.taxClassification]}</strong></div>

<div class="section"><strong>6. Bank Accounts.</strong> The Member is authorized and directed to open and maintain such bank accounts, brokerage accounts, and other deposit or investment accounts as the Member deems appropriate in the name of the Company. Each financial institution at which the Company maintains an account is authorized to honor instructions, drafts, checks, and other orders signed or approved by the Member (or by any individual designated in writing by the Member to act on behalf of the Company), regardless of whether the funds withdrawn are payable to or for the benefit of the Member or such designated individual.</div>

<div class="section"><strong>7. Authorization of Property Acquisition.</strong> The Member is authorized to acquire, finance, encumber, lease, manage, sell, and otherwise deal with real and personal property on behalf of the Company, and to execute any and all documents necessary or appropriate to effect any such transaction, including without limitation purchase and sale agreements, deeds, notes, mortgages, security agreements, leases, assignments, and closing documents.</div>

<div class="section"><strong>8. Authorization of Professional Engagements.</strong> The Member is authorized to engage attorneys, accountants, tax preparers, property managers, brokers, lenders, title companies, insurers, and other professional service providers on behalf of the Company, and to execute engagement letters, retainers, and other contracts on terms the Member deems reasonable.</div>

<div class="section"><strong>9. Authorization of Insurance.</strong> The Member is authorized to procure and maintain such property, casualty, liability, professional, and other insurance coverage on behalf of the Company as the Member deems appropriate.</div>

<div class="section"><strong>10. General Authorization.</strong> The Member is authorized to take any and all further actions, and to execute and deliver any and all further documents, that may be necessary or appropriate to effectuate the foregoing resolutions or to conduct the business of the Company in accordance with its Operating Agreement and applicable law.</div>

<div class="section"><strong>11. Ratification.</strong> All actions previously taken by the Member, any organizer, or any other person on behalf of or with respect to the Company prior to the date of this Action are hereby ratified, confirmed, and approved in all respects.</div>

<div class="signature-block">
  <p style="margin-top:2rem;">IN WITNESS WHEREOF, the undersigned has executed this Action by Sole Member effective as of the date first written above.</p>
  <div class="signature-line">${escapeHtml(d.memberName) || '_______________'}, Sole Member</div>
  <p style="margin-top:1rem;">Date: __________________________</p>
</div>
`;
}

// -----------------------------------------------------------------------------
// ARTICLES OF ORGANIZATION INFORMATION SHEET
// -----------------------------------------------------------------------------
function buildArticlesInfo(d) {
  const J = JURIS_FULL[d.jurisdiction];
  const filingInfo = {
    FL: {
      formName: 'Articles of Organization',
      portal: 'Sunbiz.org (Florida Division of Corporations)',
      fee: '$125.00 (filing fee + registered agent designation)',
      annualReq: 'Annual Report due by May 1 each year ($138.75 fee).',
      filingNote: 'Florida permits online filing at https://efile.sunbiz.org/llc_efile.html or by mail to the Florida Department of State, Division of Corporations, P.O. Box 6327, Tallahassee, FL 32314.',
    },
    DE: {
      formName: 'Certificate of Formation',
      portal: 'Delaware Division of Corporations',
      fee: '$110.00 (filing fee for Certificate of Formation)',
      annualReq: 'Annual franchise tax of $300 due by June 1 each year. Annual report not required for LLCs.',
      filingNote: 'Delaware requires a commercial registered agent for entities whose members are not Delaware residents. Filing may be done by mail, by fax, or by hand-delivery to the Delaware Division of Corporations, 401 Federal Street, Suite 4, Dover, DE 19901. Most clients use a registered agent service that handles the filing.',
    },
    WY: {
      formName: 'Articles of Organization',
      portal: 'Wyoming Secretary of State',
      fee: '$100.00 (filing fee)',
      annualReq: 'Annual Report due on the first day of the LLC&rsquo;s anniversary month each year ($60 minimum fee, based on Wyoming assets).',
      filingNote: 'Wyoming requires a registered agent with a Wyoming street address. Online filing available at https://wyobiz.wyo.gov/Business/FilingSearch.aspx.',
    },
  }[d.jurisdiction];

  return DRAFT_BANNER + `
<h1>Articles of Organization &mdash; Information Sheet<br/>${escapeHtml(d.companyName) || '_______________'}</h1>
<p style="text-align:center; font-style:italic; margin-bottom:1.5rem;">${J.name} Single-Member Limited Liability Company</p>

<div class="section">This Information Sheet contains the information required to complete the State of ${J.name} <strong>${filingInfo.formName}</strong>. The actual filing must be submitted on the form prescribed by the ${J.name} Secretary of State.</div>

<table>
  <tr><th style="width:35%;">Field</th><th>Value</th></tr>
  <tr><td><strong>Entity Name</strong></td><td>${escapeHtml(d.companyName) || '_______________'}</td></tr>
  <tr><td><strong>State of Formation</strong></td><td>${J.name}</td></tr>
  <tr><td><strong>Entity Type</strong></td><td>Limited Liability Company</td></tr>
  <tr><td><strong>Principal Office Address</strong></td><td>${escapeHtml(d.principalStreet)}<br/>${escapeHtml(d.principalCSZ)}</td></tr>
  ${d.mailingStreet ? `<tr><td><strong>Mailing Address</strong></td><td>${escapeHtml(d.mailingStreet)}<br/>${escapeHtml(d.mailingCSZ)}</td></tr>` : ''}
  <tr><td><strong>Registered Agent Name</strong></td><td>${escapeHtml(d.raName) || '_______________'}</td></tr>
  <tr><td><strong>Registered Agent Address</strong></td><td>${escapeHtml(d.raStreet)}<br/>${escapeHtml(d.raCSZ)}</td></tr>
  <tr><td><strong>Management Structure</strong></td><td>${MGMT_NAMES[d.managementStructure]}</td></tr>
  ${d.managementStructure === 'manager_managed' ? `<tr><td><strong>Manager Name</strong></td><td>${escapeHtml(d.managerName)}</td></tr>` : ''}
  <tr><td><strong>Effective Date</strong></td><td>${d.formationDate ? new Date(d.formationDate+'T00:00:00').toLocaleDateString('en-US') : '_______________'}</td></tr>
  <tr><td><strong>Duration</strong></td><td>Perpetual</td></tr>
  <tr><td><strong>Purpose</strong></td><td>${PURPOSE_NAMES[d.businessPurpose]} (or any lawful activity)</td></tr>
  <tr><td><strong>Organizer / Authorized Signatory</strong></td><td>${escapeHtml(d.memberName) || '_______________'}</td></tr>
</table>

<div class="section" style="margin-top:1.5rem;"><strong>Filing Information</strong></div>
<table>
  <tr><th style="width:35%;">Item</th><th>Detail</th></tr>
  <tr><td>Filing Portal</td><td>${filingInfo.portal}</td></tr>
  <tr><td>Filing Fee</td><td>${filingInfo.fee}</td></tr>
  <tr><td>Annual Requirements</td><td>${filingInfo.annualReq}</td></tr>
  <tr><td>Filing Method</td><td>${filingInfo.filingNote}</td></tr>
</table>

<div class="section" style="margin-top:1.5rem;"><strong>Next Steps</strong></div>
<div class="section">1. Verify entity name availability through the ${J.name} Secretary of State business name database before filing.</div>
<div class="section">2. Confirm registered agent acceptance (commercial registered agents typically require a signed acceptance form and prepaid annual fee).</div>
<div class="section">3. Submit the ${filingInfo.formName} via the filing method indicated above, with the applicable fee.</div>
<div class="section">4. Upon receipt of the filed and stamped ${filingInfo.formName}, proceed to: (a) execute the Operating Agreement; (b) execute the Action by Sole Member; (c) apply for an EIN using Form SS-4; (d) open Company bank accounts; and (e) acquire required business licenses or local permits.</div>
<div class="section">5. Forward all filed documents to Donovan Legal PLLC for the firm&rsquo;s file.</div>
`;
}

// -----------------------------------------------------------------------------
// SS-4 (EIN APPLICATION) WORKSHEET
// -----------------------------------------------------------------------------
function buildSS4Worksheet(d) {
  const J = JURIS_FULL[d.jurisdiction];
  const reasonForApplying = {
    real_estate_holding: 'Started new business — real estate holding',
    real_estate_development: 'Started new business — real estate development',
    real_estate_operating: 'Started new business — short-term rental / hospitality',
    investment_holding: 'Started new business — investment holding',
    general: 'Started new business',
  }[d.businessPurpose];

  const naicsCode = {
    real_estate_holding: '531190 — Lessors of Other Real Estate Property',
    real_estate_development: '237210 — Land Subdivision (or 236220 for commercial / 236117 for residential development)',
    real_estate_operating: '721199 — Other Traveler Accommodation (or 721110 for hotels/motels)',
    investment_holding: '551112 — Offices of Other Holding Companies',
    general: '999999 — Verify appropriate NAICS code',
  }[d.businessPurpose];

  const taxClassNote = {
    disregarded: '<strong>Single-member LLC: report as disregarded entity.</strong> On Line 9a, check "Other" and write "Disregarded entity (sole proprietorship)" or use the Form SS-4 instructions for SMLLC reporting. The EIN may be obtained but the LLC files no separate federal income tax return; activity reports on the Member&rsquo;s individual return.',
    s_corp: '<strong>S-corporation election.</strong> On Line 9a, check "Other" and write "S-Corporation Election Pending." File Form 8832 (or rely on Form 2553 deemed Form 8832 election) and Form 2553 within prescribed timeframes (generally 75 days after formation or beginning of tax year).',
    c_corp: '<strong>C-corporation election.</strong> On Line 9a, check "Other" and write "Association Taxable as Corporation — Form 8832 Pending." File Form 8832 within prescribed timeframes.',
  }[d.taxClassification];

  return DRAFT_BANNER + `
<h1>IRS Form SS-4 &mdash; Application for Employer Identification Number<br/>Information Worksheet</h1>
<p style="text-align:center; font-style:italic; margin-bottom:1.5rem;">${escapeHtml(d.companyName) || '_______________'}</p>

<div class="section">This Worksheet provides the information needed to complete IRS Form SS-4 for the Company. The actual Form SS-4 must be filed with the Internal Revenue Service. Online application available at <em>irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online</em>; international applicants must apply by phone or fax.</div>

<table>
  <tr><th style="width:30%;">SS-4 Line</th><th>Information</th></tr>
  <tr><td>1. Legal name of entity</td><td>${escapeHtml(d.companyName) || '_______________'}</td></tr>
  <tr><td>2. Trade name (if different)</td><td>(none, unless DBA filed separately)</td></tr>
  <tr><td>3. Executor, trustee, &ldquo;care of&rdquo; name</td><td>${d.memberType === 'trust' ? escapeHtml(d.memberName) + ' (Trustee)' : '(N/A)'}</td></tr>
  <tr><td>4a. Mailing address (street)</td><td>${escapeHtml(d.mailingStreet || d.principalStreet)}</td></tr>
  <tr><td>4b. Mailing address (city/state/ZIP)</td><td>${escapeHtml(d.mailingCSZ || d.principalCSZ)}</td></tr>
  <tr><td>5a. Street address (physical, if different)</td><td>${d.mailingStreet ? escapeHtml(d.principalStreet) : '(same as mailing)'}</td></tr>
  <tr><td>5b. City/state/ZIP (physical)</td><td>${d.mailingCSZ ? escapeHtml(d.principalCSZ) : '(same as mailing)'}</td></tr>
  <tr><td>6. County and state where principal business is located</td><td>${escapeHtml(d.principalCSZ.split(',')[0] || '_______________')} &mdash; verify county</td></tr>
  <tr><td>7a. Responsible party name</td><td>${escapeHtml(d.memberName) || '_______________'}</td></tr>
  <tr><td>7b. Responsible party SSN, ITIN, or EIN</td><td>____ - ____ - ______ (Member&rsquo;s personal SSN/ITIN, or upper-tier entity EIN)</td></tr>
  <tr><td>8a. Is this a limited liability company?</td><td><strong>Yes</strong></td></tr>
  <tr><td>8b. Number of LLC members</td><td><strong>1</strong></td></tr>
  <tr><td>8c. Is the LLC organized in the United States?</td><td><strong>Yes</strong></td></tr>
  <tr><td>9a. Type of entity</td><td>${taxClassNote}</td></tr>
  <tr><td>9b. State or foreign country (where incorporated/organized)</td><td>${J.name}</td></tr>
  <tr><td>10. Reason for applying</td><td>${reasonForApplying}</td></tr>
  <tr><td>11. Date business started or acquired</td><td>${d.formationDate ? new Date(d.formationDate+'T00:00:00').toLocaleDateString('en-US') : '_______________'}</td></tr>
  <tr><td>12. Closing month of accounting year</td><td>December (calendar year)</td></tr>
  <tr><td>13. Highest number of employees expected in next 12 months</td><td>0 (verify; if any employees, indicate accurate number)</td></tr>
  <tr><td>14. Indicate filing of Form 944 vs Form 941</td><td>N/A (no employees)</td></tr>
  <tr><td>15. First date wages or annuities were paid</td><td>N/A</td></tr>
  <tr><td>16. Principal activity</td><td>${PURPOSE_NAMES[d.businessPurpose]}</td></tr>
  <tr><td>17. Principal line of merchandise sold, services performed, etc.</td><td>${PURPOSE_NAMES[d.businessPurpose]}; verify NAICS code <strong>${naicsCode}</strong></td></tr>
  <tr><td>18. Has the applicant previously applied for and received an EIN?</td><td>No (verify; if applicant has multiple entities, list any prior EIN)</td></tr>
  <tr><td>Third party designee</td><td>Donovan Legal PLLC (recommended &mdash; allows the firm to receive EIN confirmation directly)</td></tr>
</table>

<div class="section" style="margin-top:1.5rem;"><strong>Filing Notes</strong></div>
<div class="section">1. <strong>Online application is fastest</strong> for U.S.-based applicants with a responsible party who has a valid SSN or ITIN. The EIN is issued immediately upon submission.</div>
<div class="section">2. <strong>For foreign responsible parties</strong> (no SSN/ITIN), the application must be submitted by fax (no SSN needed if foreign) or mail; processing typically takes 4-6 weeks.</div>
<div class="section">3. <strong>Apply only after the Articles of Organization (or Certificate of Formation) have been filed</strong> with the State and the entity is officially formed.</div>
<div class="section">4. The Member should personally submit the EIN application as the responsible party, or designate Donovan Legal PLLC as Third Party Designee to receive the EIN confirmation on the Member&rsquo;s behalf.</div>
<div class="section">5. <strong>Retain the SS-4 confirmation letter (CP 575)</strong> in a permanent file. The IRS does not reissue lost CP 575 letters; any future verification request will receive a Letter 147C, which is acceptable but less authoritative.</div>
</div>
`;
}
