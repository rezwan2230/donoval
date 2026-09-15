/* =============================================================================
   MULTI-MEMBER LLC OPERATING AGREEMENT GENERATOR — Donovan Reserve
   =============================================================================
   Phase 1 — Delaware (institutional canonical jurisdiction)
   Produces draft documents for attorney review:
     1. Operating Agreement (Articles I–XV + optionals + Schedules)
     2. Subscription Agreement (companion)
     3. Joinder Agreement (companion)
     4. Capital Call Notice (companion)
     5. Side Letter Template (companion)
   All output marked DRAFT pending attorney review and final issuance by
   Donovan Legal PLLC pursuant to engagement letter.
   ============================================================================= */

/* INITIALIZATION ============================================================
   Access gating is enforced by cPanel Apache Basic Auth on the /reserve/
   directory; no second-stage code prompt inside the tool.
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initializeTool();
});

/* DATA MODEL ================================================================= */
const oaState = {
  members: [],
  classes: [],
  assignments: [],
  promoteTiers: []
};
let _idCounter = 1;
function nextId(prefix) { return prefix + '_' + (_idCounter++); }

/* PANEL NAVIGATION =========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.oa-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showPanel(item.dataset.panel);
    });
  });
  document.addEventListener('click', e => {
    if (e.target.matches('[data-next]')) showPanel(e.target.dataset.next);
    if (e.target.matches('[data-prev]')) showPanel(e.target.dataset.prev);
  });
});

function showPanel(name) {
  document.querySelectorAll('.oa-nav-item').forEach(n => {
    n.classList.toggle('oa-nav-active', n.dataset.panel === name);
  });
  document.querySelectorAll('.oa-panel').forEach(p => {
    p.classList.toggle('oa-panel-active', p.dataset.panel === name);
  });
  if (name === 'generate') renderReviewSummary();
  if (name === 'classes') renderAssignments();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* CONDITIONAL FIELD DISPLAYS ================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const mgmt = document.getElementById('management_structure');
  if (mgmt) mgmt.addEventListener('change', updateManagementVisibility);
  const alloc = document.getElementById('allocation_method');
  if (alloc) alloc.addEventListener('change', updateAllocationVisibility);
  const addlCap = document.getElementById('additional_capital_mode');
  if (addlCap) addlCap.addEventListener('change', updateCapitalCallVisibility);
  const wf = document.getElementById('waterfall_type');
  if (wf) wf.addEventListener('change', updateWaterfallVisibility);
});

function updateManagementVisibility() {
  const v = document.getElementById('management_structure').value;
  document.getElementById('manager_name_block').style.display = (v === 'manager_managed') ? 'block' : 'none';
  document.getElementById('board_size_block').style.display = (v === 'board_managed') ? 'block' : 'none';
}
function updateAllocationVisibility() {
  const v = document.getElementById('allocation_method').value;
  document.getElementById('dro_block').style.display = (v === 'pipca') ? 'block' : 'none';
}
function updateCapitalCallVisibility() {
  const v = document.getElementById('additional_capital_mode').value;
  document.getElementById('capital_call_block').style.display = (v === 'none') ? 'none' : 'block';
}
function updateTaxRateVisibility() {
  const sel = document.getElementById('assumed_tax_rate');
  const inp = document.getElementById('assumed_tax_rate_custom');
  if (sel && inp) inp.style.display = sel.value === 'custom' ? '' : 'none';
}
function updateWaterfallVisibility() {
  const v = document.getElementById('waterfall_type').value;
  const show = (v === 'full_re_waterfall' || v === 'pref_then_split' ||
                v === 'european' || v === 'american_deal_by_deal' || v === 'custom');
  document.getElementById('full_waterfall_inputs').style.display = show ? 'grid' : 'none';
}

/* DEFAULTS =================================================================== */
function loadDefaults() {
  oaState.classes = [
    { id: 'class_A', name: 'Class A — Preferred', type: 'preferred',
      prefReturn: 0.08, prefCompounding: 'annual', prefCumulative: 'cumulative',
      votingRights: 'voting_pro_rata', liquidationPriority: 1,
      transferable: 'restricted', profitsInterest: false,
      description: '8% cumulative annual preferred return; capital priority' },
    { id: 'class_B', name: 'Class B — Common (Sponsor)', type: 'common',
      prefReturn: 0, prefCompounding: 'simple', prefCumulative: 'non_cumulative',
      votingRights: 'voting_pro_rata', liquidationPriority: 2,
      transferable: 'restricted', profitsInterest: false,
      description: 'Sponsor common interest; entitled to catch-up and promote' }
  ];
  oaState.members = [
    { id: 'member_1', name: '', type: 'individual', address: '', citizenship: 'U.S. citizen', taxId: '' },
    { id: 'member_2', name: '', type: 'entity', address: '', citizenship: 'Delaware LLC', taxId: '' }
  ];
  oaState.assignments = [
    { id: 'assign_1', memberId: 'member_1', classId: 'class_A', units: 900, capitalContribution: 900000 },
    { id: 'assign_2', memberId: 'member_2', classId: 'class_B', units: 100, capitalContribution: 100000 }
  ];
  oaState.promoteTiers = [
    { id: 'tier_1', lpShare: 0.80, gpShare: 0.20, irrHurdle: 0.12, description: '80/20 until 12% IRR' },
    { id: 'tier_2', lpShare: 0.70, gpShare: 0.30, irrHurdle: 0.18, description: '70/30 until 18% IRR' },
    { id: 'tier_3', lpShare: 0.60, gpShare: 0.40, irrHurdle: null, description: '60/40 thereafter' }
  ];
}

/* MEMBERS ==================================================================== */
function renderMembers() {
  const list = document.getElementById('members_list');
  list.innerHTML = '';
  oaState.members.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = 'oa-card';
    card.innerHTML = `
      <div class="oa-card-header">
        <span class="oa-card-title">Member ${idx + 1}</span>
        ${oaState.members.length > 1 ? `<button class="oa-card-remove" data-rm-member="${m.id}">Remove</button>` : ''}
      </div>
      <div class="oa-field-grid">
        <div class="oa-field">
          <label>Member Legal Name <span class="oa-req">*</span></label>
          <input type="text" data-bind="name" data-id="${m.id}" value="${escapeAttr(m.name)}" placeholder="Full legal name or entity name" />
        </div>
        <div class="oa-field">
          <label>Member Type</label>
          <select data-bind="type" data-id="${m.id}">
            <option value="individual" ${sel(m.type, 'individual')}>Individual</option>
            <option value="entity" ${sel(m.type, 'entity')}>Entity (LLC, Corp, LP)</option>
            <option value="trust" ${sel(m.type, 'trust')}>Trust</option>
            <option value="ira" ${sel(m.type, 'ira')}>Self-Directed IRA / Retirement Plan</option>
            <option value="partnership" ${sel(m.type, 'partnership')}>Partnership</option>
            <option value="dre" ${sel(m.type, 'dre')}>Disregarded Entity</option>
          </select>
        </div>
      </div>
      <div class="oa-field">
        <label>Notice Address</label>
        <input type="text" data-bind="addr_street" data-id="${m.id}" value="${escapeAttr(m.addr_street || '')}" placeholder="Street address" />
        <input type="text" data-bind="addr_street2" data-id="${m.id}" value="${escapeAttr(m.addr_street2 || '')}" placeholder="Suite, floor or unit (optional)" style="margin-top:0.5rem;" />
        <div style="display:grid; grid-template-columns: 2fr 1.4fr 1fr; gap:0.5rem; margin-top:0.5rem;">
          <input type="text" data-bind="addr_city" data-id="${m.id}" value="${escapeAttr(m.addr_city || '')}" placeholder="City" />
          <select data-bind="addr_state" data-id="${m.id}">${DL_STATE_OPTIONS.replace('value="' + escapeAttr(m.addr_state || '__none__') + '"', 'value="' + escapeAttr(m.addr_state || '__none__') + '" selected')}</select>
          <input type="text" data-bind="addr_zip" data-id="${m.id}" value="${escapeAttr(m.addr_zip || '')}" placeholder="ZIP" inputmode="numeric" maxlength="10" />
        </div>
      </div>
      <div class="oa-field-grid">
        <div class="oa-field">
          <label>Citizenship / Jurisdiction</label>
          <input type="text" data-bind="citizenship" data-id="${m.id}" value="${escapeAttr(m.citizenship)}" placeholder="e.g., U.S. citizen, Delaware LLC, Florida trust" />
        </div>
        <div class="oa-field">
          <label>Tax ID</label>
          <input type="text" data-bind="taxId" data-id="${m.id}" value="${escapeAttr(m.taxId)}" placeholder="Optional &mdash; last 4 digits only, or leave blank" />
        </div>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-bind]').forEach(el => {
    el.addEventListener('change', e => {
      const m = oaState.members.find(x => x.id === e.target.dataset.id);
      if (m) {
        m[e.target.dataset.bind] = e.target.value;
        if (/^addr_/.test(e.target.dataset.bind)) {
          // The documents read `address`; compose it from the structured parts.
          const cityLine = [m.addr_city, [m.addr_state, m.addr_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          m.address = [m.addr_street, m.addr_street2, cityLine].filter(Boolean).join(', ');
        }
      }
      renderAssignments();
      saveToLocalStorage();
    });
  });
  list.querySelectorAll('[data-rm-member]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rmMember;
      oaState.members = oaState.members.filter(x => x.id !== id);
      oaState.assignments = oaState.assignments.filter(a => a.memberId !== id);
      renderMembers(); renderAssignments(); saveToLocalStorage();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('btn_add_member');
  if (addBtn) addBtn.addEventListener('click', () => {
    oaState.members.push({
      id: nextId('member'), name: '', type: 'individual',
      address: '', citizenship: 'U.S. citizen', taxId: ''
    });
    renderMembers(); saveToLocalStorage();
  });
});

/* CLASSES ==================================================================== */
function renderClasses() {
  const list = document.getElementById('classes_list');
  list.innerHTML = '';
  oaState.classes.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'oa-card';
    card.innerHTML = `
      <div class="oa-card-header">
        <span class="oa-card-title">Class ${idx + 1}</span>
        ${oaState.classes.length > 1 ? `<button class="oa-card-remove" data-rm-class="${c.id}">Remove</button>` : ''}
      </div>
      <div class="oa-field-grid">
        <div class="oa-field"><label>Class Name</label>
          <input type="text" data-cbind="name" data-id="${c.id}" value="${escapeAttr(c.name)}" /></div>
        <div class="oa-field"><label>Class Type</label>
          <select data-cbind="type" data-id="${c.id}">
            <option value="preferred" ${sel(c.type, 'preferred')}>Preferred (capital priority + preferred return)</option>
            <option value="common" ${sel(c.type, 'common')}>Common (sponsor / residual)</option>
            <option value="profits_interest" ${sel(c.type, 'profits_interest')}>Profits Interest (carried; Rev. Proc. 93-27)</option>
          </select></div>
      </div>
      <div class="oa-field-grid">
        <div class="oa-field"><label>Preferred Return Rate</label>
          <select data-cbind="prefReturn" data-id="${c.id}">
            <option value="0" ${selN(c.prefReturn, 0)}>None</option>
            <option value="0.06" ${selN(c.prefReturn, 0.06)}>6%</option>
            <option value="0.07" ${selN(c.prefReturn, 0.07)}>7%</option>
            <option value="0.08" ${selN(c.prefReturn, 0.08)}>8% (institutional standard)</option>
            <option value="0.09" ${selN(c.prefReturn, 0.09)}>9%</option>
            <option value="0.10" ${selN(c.prefReturn, 0.10)}>10%</option>
            <option value="0.12" ${selN(c.prefReturn, 0.12)}>12%</option>
            <option value="0.15" ${selN(c.prefReturn, 0.15)}>15%</option>
          </select></div>
        <div class="oa-field"><label>Preferred Return Treatment</label>
          <select data-cbind="prefCumulative" data-id="${c.id}">
            <option value="cumulative" ${sel(c.prefCumulative, 'cumulative')}>Cumulative</option>
            <option value="non_cumulative" ${sel(c.prefCumulative, 'non_cumulative')}>Non-Cumulative</option>
          </select></div>
      </div>
      <div class="oa-field-grid">
        <div class="oa-field"><label>Preferred Return Compounding</label>
          <select data-cbind="prefCompounding" data-id="${c.id}">
            <option value="simple" ${sel(c.prefCompounding, 'simple')}>Simple</option>
            <option value="annual" ${sel(c.prefCompounding, 'annual')}>Annually</option>
            <option value="quarterly" ${sel(c.prefCompounding, 'quarterly')}>Quarterly</option>
            <option value="monthly" ${sel(c.prefCompounding, 'monthly')}>Monthly</option>
          </select></div>
        <div class="oa-field"><label>Voting Rights</label>
          <select data-cbind="votingRights" data-id="${c.id}">
            <option value="voting_pro_rata" ${sel(c.votingRights, 'voting_pro_rata')}>Voting pro rata to Units</option>
            <option value="voting_per_capita" ${sel(c.votingRights, 'voting_per_capita')}>One vote per Member</option>
            <option value="non_voting" ${sel(c.votingRights, 'non_voting')}>Non-Voting (economic only)</option>
            <option value="protective_only" ${sel(c.votingRights, 'protective_only')}>Protective Provisions Only</option>
          </select></div>
      </div>
      <div class="oa-field-grid">
        <div class="oa-field"><label>Liquidation Priority</label>
          <input type="number" data-cbind="liquidationPriority" data-id="${c.id}" value="${c.liquidationPriority}" min="1" step="1" />
          <p class="oa-help">Order in liquidation (1 = first).</p></div>
        <div class="oa-field"><label>Transferability</label>
          <select data-cbind="transferable" data-id="${c.id}">
            <option value="restricted" ${sel(c.transferable, 'restricted')}>Restricted per Article XI</option>
            <option value="freely_transferable" ${sel(c.transferable, 'freely_transferable')}>Freely transferable</option>
            <option value="locked" ${sel(c.transferable, 'locked')}>Locked (unanimous consent)</option>
          </select></div>
      </div>
      <div class="oa-field"><label>Class Description (Schedule A)</label>
        <input type="text" data-cbind="description" data-id="${c.id}" value="${escapeAttr(c.description)}" /></div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-cbind]').forEach(el => {
    el.addEventListener('change', e => {
      const c = oaState.classes.find(x => x.id === e.target.dataset.id);
      if (!c) return;
      const field = e.target.dataset.cbind;
      let v = e.target.value;
      if (field === 'prefReturn') v = parseFloat(v) || 0;
      else if (field === 'liquidationPriority') v = parseInt(v) || 1;
      c[field] = v;
      renderAssignments(); saveToLocalStorage();
    });
  });
  list.querySelectorAll('[data-rm-class]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (oaState.classes.length <= 1) { alert('At least one Class is required.'); return; }
      const id = btn.dataset.rmClass;
      oaState.classes = oaState.classes.filter(x => x.id !== id);
      oaState.assignments = oaState.assignments.filter(a => a.classId !== id);
      renderClasses(); renderAssignments(); saveToLocalStorage();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('btn_add_class');
  if (addBtn) addBtn.addEventListener('click', () => {
    const nextLetter = String.fromCharCode(65 + oaState.classes.length);
    oaState.classes.push({
      id: nextId('class'), name: `Class ${nextLetter}`, type: 'common',
      prefReturn: 0, prefCompounding: 'simple', prefCumulative: 'non_cumulative',
      votingRights: 'voting_pro_rata', liquidationPriority: oaState.classes.length + 1,
      transferable: 'restricted', profitsInterest: false, description: ''
    });
    renderClasses(); renderAssignments(); saveToLocalStorage();
  });
  const presetBtn = document.getElementById('btn_preset_classes');
  if (presetBtn) presetBtn.addEventListener('click', () => {
    if (!confirm('Replace current Classes with the standard 3-class preset (Pref A / Common B / Profits C)?')) return;
    oaState.classes = [
      { id: 'class_A', name: 'Class A — Preferred', type: 'preferred',
        prefReturn: 0.08, prefCompounding: 'annual', prefCumulative: 'cumulative',
        votingRights: 'voting_pro_rata', liquidationPriority: 1,
        transferable: 'restricted', profitsInterest: false,
        description: '8% cumulative annual preferred return; capital priority' },
      { id: 'class_B', name: 'Class B — Common (Sponsor)', type: 'common',
        prefReturn: 0, prefCompounding: 'simple', prefCumulative: 'non_cumulative',
        votingRights: 'voting_pro_rata', liquidationPriority: 2,
        transferable: 'restricted', profitsInterest: false,
        description: 'Sponsor common; entitled to catch-up and promote' },
      { id: 'class_C', name: 'Class C — Profits Interest', type: 'profits_interest',
        prefReturn: 0, prefCompounding: 'simple', prefCumulative: 'non_cumulative',
        votingRights: 'non_voting', liquidationPriority: 3,
        transferable: 'locked', profitsInterest: true,
        description: 'Profits interest for management; Rev. Proc. 93-27 safe harbor; no liquidation value at grant' }
    ];
    renderClasses(); renderAssignments(); saveToLocalStorage();
  });
});

/* ASSIGNMENTS (Member ↔ Class) =============================================== */
function renderAssignments() {
  const list = document.getElementById('assignments_list');
  if (!list) return;
  list.innerHTML = '';
  oaState.members.forEach(m => {
    if (!oaState.assignments.find(a => a.memberId === m.id) && oaState.classes.length) {
      oaState.assignments.push({
        id: nextId('assign'), memberId: m.id, classId: oaState.classes[0].id,
        units: 0, capitalContribution: 0
      });
    }
  });
  oaState.assignments.forEach(a => {
    const row = document.createElement('div');
    row.className = 'oa-card oa-card-compact';
    row.innerHTML = `
      <div class="oa-field-grid oa-field-grid-4">
        <div class="oa-field"><label>Member</label>
          <select data-abind="memberId" data-id="${escapeAttr(a.id)}">
            ${oaState.members.map(m => `<option value="${escapeAttr(m.id)}" ${sel(a.memberId, m.id)}>${escapeHtml(m.name || 'Unnamed')}</option>`).join('')}
          </select></div>
        <div class="oa-field"><label>Class</label>
          <select data-abind="classId" data-id="${escapeAttr(a.id)}">
            ${oaState.classes.map(c => `<option value="${escapeAttr(c.id)}" ${sel(a.classId, c.id)}>${escapeHtml(c.name)}</option>`).join('')}
          </select></div>
        <div class="oa-field"><label>Units</label>
          <input type="number" data-abind="units" data-id="${escapeAttr(a.id)}" value="${oaNum(a.units)}" min="0" step="1" /></div>
        <div class="oa-field"><label>Capital Contribution ($)</label>
          <input type="number" data-abind="capitalContribution" data-id="${escapeAttr(a.id)}" value="${oaNum(a.capitalContribution)}" min="0" step="1000" /></div>
      </div>
      <button class="oa-card-remove oa-card-remove-inline" data-rm-assign="${escapeAttr(a.id)}">Remove Assignment</button>`;
    list.appendChild(row);
  });
  const addRow = document.createElement('div');
  addRow.className = 'oa-list-actions';
  addRow.innerHTML = `<button class="oa-btn-ghost" id="btn_add_assignment">+ Add Member-Class Assignment</button>`;
  list.appendChild(addRow);
  list.querySelectorAll('[data-abind]').forEach(el => {
    el.addEventListener('change', e => {
      const a = oaState.assignments.find(x => x.id === e.target.dataset.id);
      if (!a) return;
      const field = e.target.dataset.abind;
      let v = e.target.value;
      if (field === 'units' || field === 'capitalContribution') v = parseFloat(v) || 0;
      a[field] = v; saveToLocalStorage();
    });
  });
  list.querySelectorAll('[data-rm-assign]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rmAssign;
      oaState.assignments = oaState.assignments.filter(x => x.id !== id);
      renderAssignments(); saveToLocalStorage();
    });
  });
  const addBtn = document.getElementById('btn_add_assignment');
  if (addBtn) addBtn.addEventListener('click', () => {
    if (!oaState.members.length || !oaState.classes.length) {
      alert('Define at least one Member and one Class first.'); return;
    }
    oaState.assignments.push({
      id: nextId('assign'), memberId: oaState.members[0].id,
      classId: oaState.classes[0].id, units: 0, capitalContribution: 0
    });
    renderAssignments(); saveToLocalStorage();
  });
}

/* PROMOTE TIERS ============================================================== */
function renderPromoteTiers() {
  const list = document.getElementById('promote_tiers_list');
  if (!list) return;
  list.innerHTML = '';
  oaState.promoteTiers.forEach((t, idx) => {
    const card = document.createElement('div');
    card.className = 'oa-card oa-card-compact';
    card.innerHTML = `
      <div class="oa-card-header">
        <span class="oa-card-title">Tier ${idx + 1}</span>
        <button class="oa-card-remove" data-rm-tier="${t.id}">Remove</button>
      </div>
      <div class="oa-field-grid oa-field-grid-4">
        <div class="oa-field"><label>LP Share</label>
          <select data-tbind="lpShare" data-id="${t.id}">
            <option value="0.90" ${selN(t.lpShare, 0.90)}>90%</option>
            <option value="0.85" ${selN(t.lpShare, 0.85)}>85%</option>
            <option value="0.80" ${selN(t.lpShare, 0.80)}>80%</option>
            <option value="0.75" ${selN(t.lpShare, 0.75)}>75%</option>
            <option value="0.70" ${selN(t.lpShare, 0.70)}>70%</option>
            <option value="0.65" ${selN(t.lpShare, 0.65)}>65%</option>
            <option value="0.60" ${selN(t.lpShare, 0.60)}>60%</option>
            <option value="0.50" ${selN(t.lpShare, 0.50)}>50%</option>
          </select></div>
        <div class="oa-field"><label>GP Share</label>
          <select data-tbind="gpShare" data-id="${t.id}">
            <option value="0.10" ${selN(t.gpShare, 0.10)}>10%</option>
            <option value="0.15" ${selN(t.gpShare, 0.15)}>15%</option>
            <option value="0.20" ${selN(t.gpShare, 0.20)}>20%</option>
            <option value="0.25" ${selN(t.gpShare, 0.25)}>25%</option>
            <option value="0.30" ${selN(t.gpShare, 0.30)}>30%</option>
            <option value="0.35" ${selN(t.gpShare, 0.35)}>35%</option>
            <option value="0.40" ${selN(t.gpShare, 0.40)}>40%</option>
            <option value="0.50" ${selN(t.gpShare, 0.50)}>50%</option>
          </select></div>
        <div class="oa-field"><label>IRR Hurdle</label>
          <select data-tbind="irrHurdle" data-id="${t.id}">
            <option value="" ${t.irrHurdle === null ? 'selected' : ''}>None (residual)</option>
            <option value="0.10" ${selN(t.irrHurdle, 0.10)}>10%</option>
            <option value="0.12" ${selN(t.irrHurdle, 0.12)}>12%</option>
            <option value="0.15" ${selN(t.irrHurdle, 0.15)}>15%</option>
            <option value="0.18" ${selN(t.irrHurdle, 0.18)}>18%</option>
            <option value="0.20" ${selN(t.irrHurdle, 0.20)}>20%</option>
            <option value="0.25" ${selN(t.irrHurdle, 0.25)}>25%</option>
          </select></div>
        <div class="oa-field"><label>Description</label>
          <input type="text" data-tbind="description" data-id="${t.id}" value="${escapeAttr(t.description)}" /></div>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-tbind]').forEach(el => {
    el.addEventListener('change', e => {
      const t = oaState.promoteTiers.find(x => x.id === e.target.dataset.id);
      if (!t) return;
      const field = e.target.dataset.tbind;
      let v = e.target.value;
      if (field === 'lpShare' || field === 'gpShare') v = parseFloat(v) || 0;
      else if (field === 'irrHurdle') v = (v === '' ? null : parseFloat(v));
      t[field] = v; saveToLocalStorage();
    });
  });
  list.querySelectorAll('[data-rm-tier]').forEach(btn => {
    btn.addEventListener('click', () => {
      oaState.promoteTiers = oaState.promoteTiers.filter(x => x.id !== btn.dataset.rmTier);
      renderPromoteTiers(); saveToLocalStorage();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('btn_add_promote_tier');
  if (addBtn) addBtn.addEventListener('click', () => {
    oaState.promoteTiers.push({
      id: nextId('tier'), lpShare: 0.70, gpShare: 0.30, irrHurdle: 0.18,
      description: 'New tier'
    });
    renderPromoteTiers(); saveToLocalStorage();
  });
  const stdBtn = document.getElementById('btn_load_standard_waterfall');
  if (stdBtn) stdBtn.addEventListener('click', () => {
    if (!confirm('Replace current promote tiers with the standard 4-tier institutional waterfall?')) return;
    oaState.promoteTiers = [
      { id: nextId('tier'), lpShare: 0.80, gpShare: 0.20, irrHurdle: 0.12, description: '80/20 until 12% IRR' },
      { id: nextId('tier'), lpShare: 0.70, gpShare: 0.30, irrHurdle: 0.18, description: '70/30 until 18% IRR' },
      { id: nextId('tier'), lpShare: 0.60, gpShare: 0.40, irrHurdle: 0.25, description: '60/40 until 25% IRR' },
      { id: nextId('tier'), lpShare: 0.50, gpShare: 0.50, irrHurdle: null, description: '50/50 thereafter' }
    ];
    renderPromoteTiers(); saveToLocalStorage();
  });
});

/* COLLECT DATA =============================================================== */
function collectData() {
  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const chk = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  return {
    jurisdiction: val('jurisdiction') || 'DE',
    // Phase 3b — entity structure
    entityStructure: val('entity_structure') || 'single',
    opCoName: val('opco_name'),
    opCoJurisdiction: val('opco_jurisdiction'),
    opCoBusinessPurpose: val('opco_business_purpose'),
    opCoTaxClassification: val('opco_tax_classification'),
    companyName: val('company_name') || '_______________',
    effectiveDate: val('effective_date'),
    principalStreet: val('principal_street'),
    principalCsz: val('principal_csz'),
    raName: val('ra_name'),
    raStreet: val('ra_street'),
    raCsz: val('ra_csz'),
    businessPurpose: val('business_purpose'),
    members: JSON.parse(JSON.stringify(oaState.members)),
    classes: JSON.parse(JSON.stringify(oaState.classes)),
    assignments: JSON.parse(JSON.stringify(oaState.assignments)),
    promoteTiers: JSON.parse(JSON.stringify(oaState.promoteTiers)),
    additionalCapitalMode: val('additional_capital_mode'),
    capitalCallMechanism: val('capital_call_mechanism'),
    capitalCallNotice: val('capital_call_notice'),
    defaultDilution: chk('default_dilution'),
    defaultLoan: chk('default_loan'),
    defaultForfeiture: chk('default_forfeiture'),
    defaultForcedSale: chk('default_forced_sale'),
    defaultLossVoting: chk('default_loss_voting'),
    dilutionMultiplier: val('dilution_multiplier'),
    defaultLoanRate: val('default_loan_rate'),
    curePeriod: val('cure_period'),
    withdrawal: val('withdrawal'),
    managementStructure: val('management_structure'),
    managerName: val('manager_name'),
    boardSize: val('board_size'),
    fiduciaryDuties: val('fiduciary_duties'),
    majorDecisions: {
      sale_assets: chk('md_sale_assets'), merger: chk('md_merger'),
      dissolution: chk('md_dissolution'), indebtedness: chk('md_indebtedness'),
      amend_oa: chk('md_amend_oa'), admit_member: chk('md_admit_member'),
      tax_election: chk('md_tax_election'), affiliate_tx: chk('md_affiliate_tx'),
      capital_call_threshold: chk('md_capital_call_threshold'),
      change_business: chk('md_change_business')
    },
    majorDecisionThreshold: val('major_decision_threshold'),
    managerRemoval: val('manager_removal'),
    // Phase 3a — Manager Entity & Management Services Agreement
    managerEntityGenerate: val('manager_entity_generate'),
    managerEntityJurisdiction: val('manager_entity_jurisdiction'),
    managerEntityTax: val('manager_entity_tax'),
    managerEntityPrincipals: val('manager_entity_principals'),
    msaAmfBasis: val('msa_amf_basis'), msaAmfRate: val('msa_amf_rate'),
    msaAcqBasis: val('msa_acq_basis'), msaAcqRate: val('msa_acq_rate'),
    msaDispBasis: val('msa_disp_basis'), msaDispRate: val('msa_disp_rate'),
    msaCmBasis: val('msa_cm_basis'), msaCmRate: val('msa_cm_rate'),
    msaRefiBasis: val('msa_refi_basis'), msaRefiRate: val('msa_refi_rate'),
    msaPmBasis: val('msa_pm_basis'), msaPmRate: val('msa_pm_rate'),
    msaTerm: val('msa_term'), msaExpenseReimb: val('msa_expense_reimb'),
    msaTermination: val('msa_termination'), msaTermFee: val('msa_term_fee'),
    // Phase 3a.1 — sophistication options
    managerScope: val('manager_scope'),
    pmApproach: val('pm_approach'),
    feeSophistication: val('fee_sophistication'),
    feeIllustrationInclude: val('fee_illustration_include'),
    fiTotalCost: parseFloat((val('fi_total_cost') || '').replace(/[,$]/g, '')) || 0,
    fiEquity: parseFloat((val('fi_equity') || '').replace(/[,$]/g, '')) || 0,
    fiHoldYears: parseFloat(val('fi_hold_years')) || 0,
    fiExitValue: parseFloat((val('fi_exit_value') || '').replace(/[,$]/g, '')) || 0,
    // Phase 4 — Reg D / Securities Compliance
    regDLevel: val('reg_d_level') || 'none',
    regDOfferingAmount: parseFloat((val('reg_d_offering_amount') || '').replace(/[,$]/g, '')) || 0,
    regDMinSubscription: parseFloat((val('reg_d_min_subscription') || '').replace(/[,$]/g, '')) || 0,
    regDInvestorCount: parseInt(val('reg_d_investor_count')) || 0,
    regDNonAccredited: val('reg_d_non_accredited') || 'no',
    regDSaleStates: val('reg_d_sale_states') || '',
    regDUseOfProceeds: val('reg_d_use_of_proceeds') || '',
    waterfallType: val('waterfall_type'),
    prefReturnRate: parseFloat(val('pref_return_rate')) || 0.08,
    prefReturnCompounding: val('pref_return_compounding'),
    prefReturnCumulative: val('pref_return_cumulative'),
    catchupPercent: parseFloat(val('catchup_percent')) || 0,
    irrBasis: val('irr_basis'),
    distributionTiming: val('distribution_timing'),
    liquidationMethod: val('liquidation_method'),
    allocationMethod: val('allocation_method'),
    droTreatment: val('dro_treatment'),
    regQio: chk('reg_qio'),
    regMinGainChargeback: chk('reg_min_gain_chargeback'),
    regPartnerMinGain: chk('reg_partner_min_gain'),
    regPartnerNonrecourseDed: chk('reg_partner_nonrecourse_ded'),
    regNonrecourseDeductions: chk('reg_nonrecourse_deductions'),
    regGrossIncome: chk('reg_gross_income'),
    regCurative: chk('reg_curative'),
    nonrecourseAllocationMethod: val('nonrecourse_allocation_method'),
    taxClassification: val('tax_classification'),
    section704cMethod: val('section_704c_method'),
    revaluationEvents: val('revaluation_events'),
    section754Election: val('section_754_election'),
    section752Method: val('section_752_method'),
    qualifiedNonrecourseMethod: val('qualified_nonrecourse_method'),
    bbaPrDesignation: val('bba_pr_designation'),
    bbaDesignatedIndividual: val('bba_designated_individual'),
    pushOutElection: val('push_out_election'),
    taxYear: val('tax_year'),
    accountingMethod: val('accounting_method'),
    taxDistributionsEnabled: val('tax_distributions_enabled'),
    assumedTaxRate: val('assumed_tax_rate'),
    assumedTaxRateCustom: val('assumed_tax_rate_custom'),
    taxDistributionTreatment: val('tax_distribution_treatment'),
    transferGeneral: val('transfer_general'),
    permittedTransferees: {
      family: chk('pt_family'), wholly_owned: chk('pt_wholly_owned'),
      affiliates: chk('pt_affiliates'), at_death: chk('pt_at_death'),
      charitable: chk('pt_charitable'), employee_benefit: chk('pt_employee_benefit')
    },
    rofo: val('rofo'), rofr: val('rofr'),
    dragAlong: val('drag_along'), dragAlongThreshold: val('drag_along_threshold'),
    tagAlong: val('tag_along'), tagAlongTrigger: val('tag_along_trigger'),
    buySell: val('buy_sell'),
    speProvisions: val('spe_provisions'),
    chargingOrder: val('charging_order'),
    indemnification: val('indemnification'),
    confidentiality: val('confidentiality'),
    restrictiveCovenants: val('restrictive_covenants'),
    disputeResolution: val('dispute_resolution'),
    feeShifting: val('fee_shifting'),
    seriesReservation: val('series_reservation'),
    attorneyNotes: val('attorney_notes')
  };
}

/* REVIEW SUMMARY ============================================================= */
function renderReviewSummary() {
  const d = collectData();
  const sect = (label, rows) => `<div class="oa-review-section"><h3>${label}</h3><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
  const totalCapital = d.assignments.reduce((s, a) => s + (a.capitalContribution || 0), 0);
  const html = [
    sect('Company', [
      ['Name', escapeHtml(d.companyName)],
      ['Jurisdiction', escapeHtml((JURIS_FULL[d.jurisdiction] && JURIS_FULL[d.jurisdiction].name) || d.jurisdiction || 'Delaware')],
      ['Effective Date', escapeHtml(fmtDate(d.effectiveDate))],
      ['Principal Office', escapeHtml([d.principalStreet, d.principalCsz].filter(Boolean).join(', ') || '—')],
      ['Registered Agent', escapeHtml(d.raName || '—')],
      ['Business Purpose', escapeHtml(d.businessPurpose || '—')]
    ]),
    sect(`Members (${d.members.length})`, d.members.map((m, i) => [`${i + 1}. ${escapeHtml(m.name || 'Unnamed')}`, `${escapeHtml(m.type)} — ${escapeHtml(m.citizenship)}`])),
    sect(`Classes (${d.classes.length})`, d.classes.map(c => [escapeHtml(c.name), `${escapeHtml(c.type)}` + (c.prefReturn > 0 ? ` — ${(c.prefReturn * 100).toFixed(2)}% ${escapeHtml(c.prefCumulative)} ${escapeHtml(c.prefCompounding)}` : '') + ` — ${escapeHtml(c.votingRights)}`])),
    sect('Total Capital', [['Aggregate', fmtMoney(totalCapital)], ...d.assignments.map(a => {
      const m = d.members.find(x => x.id === a.memberId); const c = d.classes.find(x => x.id === a.classId);
      return [escapeHtml((m && m.name) || 'Unnamed') + ' / ' + escapeHtml((c && c.name) || ''), `${oaNum(a.units)} Units, ${fmtMoney(a.capitalContribution)}`];
    })]),
    sect('Waterfall', [
      ['Type', escapeHtml(d.waterfallType)],
      ['Preferred Return', `${(d.prefReturnRate * 100).toFixed(2)}%, ${escapeHtml(d.prefReturnCompounding)}, ${escapeHtml(d.prefReturnCumulative)}`],
      ['GP Catch-Up', `${(d.catchupPercent * 100).toFixed(0)}%`],
      ['Promote Tiers', d.promoteTiers.length + ' tier(s)']
    ]),
    sect('Allocations', [
      ['Regime', escapeHtml(d.allocationMethod)],
      ['DRO', escapeHtml(d.droTreatment || '—')],
      ['Nonrecourse Method', escapeHtml(d.nonrecourseAllocationMethod)]
    ]),
    sect('Tax', [
      ['Classification', escapeHtml(d.taxClassification)],
      ['§ 704(c) Method', escapeHtml(d.section704cMethod)],
      ['§ 754 Election', escapeHtml(d.section754Election)],
      ['§ 752 Method', escapeHtml(d.section752Method)],
      ['BBA Partnership Rep', escapeHtml(d.bbaPrDesignation)],
      ['Push-Out', escapeHtml(d.pushOutElection)],
      ['Tax Distributions', `${escapeHtml(d.taxDistributionsEnabled)} @ ${d.assumedTaxRate === 'highest_marginal' ? 'highest marginal' : (d.assumedTaxRate === 'custom' ? (Number(d.assumedTaxRateCustom) || 0) + '%' : ((parseFloat(d.assumedTaxRate) * 100).toFixed(0) + '%'))}`]
    ]),
    sect('Governance & Transfers', [
      ['Management', escapeHtml(d.managementStructure)],
      ['Fiduciary Duties', escapeHtml(d.fiduciaryDuties)],
      ['Major Decision Threshold', escapeHtml(d.majorDecisionThreshold)],
      ['Transfer Restriction', escapeHtml(d.transferGeneral)],
      ['ROFO / ROFR', `${escapeHtml(d.rofo)} / ${escapeHtml(d.rofr)}`],
      ['Drag / Tag', `${escapeHtml(d.dragAlong)} / ${escapeHtml(d.tagAlong)}`],
      ['Buy-Sell', escapeHtml(d.buySell)]
    ]),
    sect('Special Provisions', [
      ['SPE', escapeHtml(d.speProvisions)], ['Charging Order', escapeHtml(d.chargingOrder)],
      ['Indemnification', escapeHtml(d.indemnification)], ['Confidentiality', escapeHtml(d.confidentiality)],
      ['Dispute Resolution', escapeHtml(d.disputeResolution)]
    ])
  ].join('');
  document.getElementById('review_summary').innerHTML = html;
}

/* GENERATE / DOC TABS / PRINT / COPY ========================================= */
const DOC_BUILDERS = {
  op_agreement: buildOperatingAgreement,
  opco_oa: buildOpCoOperatingAgreement,
  subscription: buildSubscriptionAgreement,
  joinder: buildJoinderAgreement,
  capital_call: buildCapitalCallNotice,
  side_letter: buildSideLetter,
  manager_oa: buildManagerEntityOA,
  msa: buildManagementServicesAgreement,
  // Phase 4 — Reg D / Securities Compliance Package
  jv_securities_memo: buildJvSecuritiesMemo,
  risk_disclosure: buildRiskDisclosureLetter,
  ppm: buildPrivatePlacementMemorandum,
  aiq: buildAccreditedInvestorQuestionnaire,
  form_d: buildFormDWorksheet,
  blue_sky: buildBlueSkyNoticeSummary,
  // Phase 4 — Level 3 (Rule 506(c)) supplemental deliverables
  verif_standard: buildVerificationStandard,
  gen_solic_memo: buildGenSolicComplianceMemo,
  bad_actor: buildBadActorQuestionnaire
};
let _generatedData = null;
let _currentDocKey = 'op_agreement';

document.addEventListener('DOMContentLoaded', () => {
  // Entity structure visibility (Phase 3b) — show OpCo fields and tab when HoldCo+OpCo selected
  const entStrSel = document.getElementById('entity_structure');
  const opCoFields = document.getElementById('opco_fields');
  const tabOpCo = document.getElementById('tab_opco_oa');
  const tabOpAgreement = document.getElementById('tab_op_agreement_initial');
  const cnLabel = document.getElementById('company_name_label');
  const cnHelp = document.getElementById('company_name_help');
  const jLabel = document.getElementById('jurisdiction_label_qualifier');
  function updateEntStrVis() {
    const isHc = entStrSel && entStrSel.value === 'holdco_opco';
    if (opCoFields) opCoFields.style.display = isHc ? '' : 'none';
    if (tabOpCo) tabOpCo.style.display = isHc ? '' : 'none';
    // Update label text to reflect HoldCo when in dual-entity mode
    if (cnLabel) cnLabel.innerHTML = isHc ? 'HoldCo Name (Investor-Facing Entity) <span class="oa-req">*</span>' : 'Company Name <span class="oa-req">*</span>';
    if (cnHelp) cnHelp.textContent = isHc ?
      'This is the investor-facing HoldCo that wraps the OpCo. Members hold direct interests in this entity. Include the entity designator.' :
      'Include the entity designator. Verify name availability with the relevant Secretary of State before filing.';
    if (jLabel) jLabel.textContent = isHc ? '(applies to HoldCo)' : '';
    if (tabOpAgreement) tabOpAgreement.textContent = isHc ? 'HoldCo Operating Agreement' : 'Operating Agreement';
  }
  if (entStrSel) {
    entStrSel.addEventListener('change', updateEntStrVis);
    updateEntStrVis();
  }

  // Show/hide manager-entity sub-fields based on dropdown
  const mgrEntSel = document.getElementById('manager_entity_generate');
  const mgrEntFields = document.getElementById('manager_entity_fields');
  const mgrEntPrinc = document.getElementById('manager_entity_principals_block');
  const msaFees = document.getElementById('msa_fees_block');
  const msaTerms = document.getElementById('msa_terms_block');
  const tabMgrOa = document.getElementById('tab_manager_oa');
  const tabMsa = document.getElementById('tab_msa');
  function updateMgrEntityVis() {
    const on = mgrEntSel && mgrEntSel.value === 'full';
    [mgrEntFields, mgrEntPrinc, msaFees, msaTerms].forEach(el => { if (el) el.style.display = on ? '' : 'none'; });
    [tabMgrOa, tabMsa].forEach(el => { if (el) el.style.display = on ? '' : 'none'; });
  }
  if (mgrEntSel) {
    mgrEntSel.addEventListener('change', updateMgrEntityVis);
    updateMgrEntityVis();
  }

  // Fee illustration assumptions visibility (depends on both manager-entity ON and appendix opt-in)
  const fiSel = document.getElementById('fee_illustration_include');
  const fiBlock = document.getElementById('fee_illustration_assumptions_block');
  function updateFiVis() {
    const mgrOn = mgrEntSel && mgrEntSel.value === 'full';
    const fiOn = fiSel && fiSel.value === 'yes';
    if (fiBlock) fiBlock.style.display = (mgrOn && fiOn) ? '' : 'none';
  }
  if (fiSel) {
    fiSel.addEventListener('change', updateFiVis);
    if (mgrEntSel) mgrEntSel.addEventListener('change', updateFiVis);
    updateFiVis();
  }

  // Phase 4 — Reg D level drives visibility of the disclosure-package tabs and the assumptions fields
  const regDSel = document.getElementById('reg_d_level');
  const regDFields = document.getElementById('reg_d_fields');
  const tabJvMemo = document.getElementById('tab_jv_memo');
  const tabRiskDisc = document.getElementById('tab_risk_disclosure');
  const tabPpm = document.getElementById('tab_ppm');
  const tabAiq = document.getElementById('tab_aiq');
  const tabFormD = document.getElementById('tab_form_d');
  const tabBlueSky = document.getElementById('tab_blue_sky');
  const tabVerifStd = document.getElementById('tab_verif_standard');
  const tabGenSolic = document.getElementById('tab_gen_solic_memo');
  const tabBadActor = document.getElementById('tab_bad_actor');
  function updateRegDVis() {
    const lvl = regDSel ? regDSel.value : 'none';
    const isLvl0 = lvl === 'none';
    const isLvl1 = lvl === '506b_ff';
    const isLvl2 = lvl === '506b_soph';
    const isLvl3 = lvl === '506c';
    // Assumptions fields visible for any Reg D level (Levels 1-3)
    if (regDFields) regDFields.style.display = (!isLvl0) ? '' : 'none';
    // Tabs visible based on level
    if (tabJvMemo) tabJvMemo.style.display = isLvl0 ? '' : 'none';
    if (tabRiskDisc) tabRiskDisc.style.display = isLvl1 ? '' : 'none';
    if (tabPpm) tabPpm.style.display = (isLvl2 || isLvl3) ? '' : 'none';
    if (tabAiq) tabAiq.style.display = (isLvl1 || isLvl2 || isLvl3) ? '' : 'none';
    if (tabFormD) tabFormD.style.display = (isLvl1 || isLvl2 || isLvl3) ? '' : 'none';
    if (tabBlueSky) tabBlueSky.style.display = (isLvl1 || isLvl2 || isLvl3) ? '' : 'none';
    // Level 3 only — verification standard, general solicitation memo, bad-actor questionnaire
    if (tabVerifStd) tabVerifStd.style.display = isLvl3 ? '' : 'none';
    if (tabGenSolic) tabGenSolic.style.display = isLvl3 ? '' : 'none';
    if (tabBadActor) tabBadActor.style.display = isLvl3 ? '' : 'none';
  }
  if (regDSel) {
    regDSel.addEventListener('change', updateRegDVis);
    updateRegDVis();
  }

  const genBtn = document.getElementById('btn_generate');
  if (genBtn) genBtn.addEventListener('click', () => {
    _generatedData = collectData();
    showDoc(_currentDocKey);
    document.getElementById('generated_docs').style.display = 'block';
    document.getElementById('generated_docs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelectorAll('.oa-doc-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.oa-doc-tab').forEach(x => x.classList.remove('oa-doc-tab-active'));
      t.classList.add('oa-doc-tab-active');
      _currentDocKey = t.dataset.doc;
      showDoc(_currentDocKey);
    });
  });
  const printBtn = document.getElementById('btn_print_doc');
  if (printBtn) printBtn.addEventListener('click', printCurrentDoc);
  const copyBtn = document.getElementById('btn_copy_doc');
  if (copyBtn) copyBtn.addEventListener('click', copyCurrentDoc);
});

function showDoc(key) {
  if (!_generatedData) return;
  const builder = DOC_BUILDERS[key];
  if (!builder) return;
  document.getElementById('doc_preview').innerHTML = builder(_generatedData);
}

function printCurrentDoc() {
  const w = window.open('', 'doc-print');
  const content = document.getElementById('doc_preview').innerHTML;
  const css = `<style>
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.55; margin: 1in 0.85in; color: #1a1a1a; }
    h1 { font-size: 14pt; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 1.5rem 0; }
    h2 { font-size: 12pt; text-align: center; text-transform: uppercase; margin: 1.5rem 0 1rem 0; }
    .article-heading { font-weight: bold; text-align: center; text-transform: uppercase; margin: 1.5rem 0 1rem 0; letter-spacing: 0.5px; page-break-after: avoid; }
    .section { margin-bottom: 0.85rem; text-align: justify; }
    .article { margin-bottom: 1.5rem; }
    .schedule-heading { text-align: center; font-weight: bold; text-transform: uppercase; margin: 2rem 0 1rem 0; page-break-before: always; }
    table.schedule-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    table.schedule-table th, table.schedule-table td { border: 1px solid #1a1a1a; padding: 0.4rem 0.6rem; text-align: left; font-size: 10pt; }
    table.schedule-table th { background: #f0f0eb; font-weight: bold; }
    .signature-block { margin-top: 2rem; page-break-inside: avoid; }
    .signature-line { border-bottom: 1px solid #1a1a1a; height: 1px; margin-bottom: 0.25rem; display: inline-block; width: 320px; }
    .draft-banner { background: rgba(176, 31, 36, 0.06); border: 1.5px solid #B01F24; color: #B01F24; padding: 0.65rem 0.85rem; text-align: center; font-weight: bold; font-size: 10pt; letter-spacing: 1px; margin-bottom: 1rem; }
    .defined-term { font-weight: bold; font-variant: small-caps; }
    @page { margin: 1in 0.85in; }
      .dl-print-bar { position: sticky; top: 0; background: #0a5a37; color: #F5F5F0; padding: 0.6rem 1rem; font-family: 'Open Sans', Arial, sans-serif; font-size: 10.5pt; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
      .dl-print-bar button { background: #C9A961; color: #084B2E; border: 0; border-radius: 4px; padding: 0.45rem 0.9rem; font-weight: 800; cursor: pointer; }
      @media print { .dl-print-bar { display: none !important; } }

      /* Forced watermark on every printed page (2026-09-04): the draft is educational and is not to be signed. */
      body::before { content: 'DRAFT \\2014 EDUCATIONAL \\2014 NOT FOR SIGNATURE'; position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-family: 'Open Sans', Arial, sans-serif; font-size: 22pt; font-weight: 800; letter-spacing: 2px; color: rgba(176, 31, 36, 0.14); white-space: nowrap; z-index: 9999; pointer-events: none; }
      body::after { content: 'Donovan Legal PLLC \\2014 educational drafting tool. Not legal advice, not reviewed by counsel, not for filing or signature. donovan.law/book'; position: fixed; bottom: 0.25in; left: 0; right: 0; text-align: center; font-family: 'Open Sans', Arial, sans-serif; font-size: 8pt; color: #B01F24; }
  </style>`;
  w.document.write('<!DOCTYPE html><html><head><title>Operating Agreement Draft</title>' + css + '</head><body>' + '<div class="dl-print-bar"><button id="dl_print_now" type="button">Print / Save as PDF</button><span>In the dialog, choose <strong>&ldquo;Save as PDF&rdquo;</strong> as the printer or destination to keep a copy. The watermark prints on every page.</span></div>' + content + '</body></html>');
  w.document.close();
  dlWirePrintWindow(w);
}

function copyCurrentDoc() {
  // 2026-09-04: the copied text carries the same watermark header the printed
  // draft carries -- the draft is educational and not for signature.
  const pane = document.getElementById('doc_preview');
  const header = 'DRAFT — EDUCATIONAL — NOT FOR SIGNATURE\nPrepared with an educational drafting tool published by Donovan Legal PLLC. Not legal advice. Not reviewed by counsel. Not for filing or signature. Review with counsel before use: donovan.law/book\n\n';
  const text = header + (pane ? (pane.innerText || pane.textContent || '') : '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function () { alert('Document text copied to clipboard.'); },
      function () { alert('Copy failed — please select and copy manually.'); }
    );
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); alert('Document text copied to clipboard.'); }
  catch (e) { alert('Copy failed — please select and copy manually.'); }
  document.body.removeChild(ta);
}

/* SAVE / LOAD / RESET ======================================================== */
const STORAGE_KEY = 'donovan_oa_generator_v1';
const PERSISTED_FIELD_IDS = [
  'jurisdiction','company_name','effective_date','principal_street','principal_csz',
  'principal_street2','principal_city','principal_state','principal_zip',
  'ra_name','ra_street','ra_csz','ra_city','ra_state','ra_zip','business_purpose',
  'additional_capital_mode','capital_call_mechanism','capital_call_notice',
  'dilution_multiplier','default_loan_rate','cure_period','withdrawal',
  'management_structure','manager_name','board_size','fiduciary_duties',
  'major_decision_threshold','manager_removal',
  'waterfall_type','pref_return_rate','pref_return_compounding','pref_return_cumulative',
  'catchup_percent','irr_basis','distribution_timing','liquidation_method',
  'allocation_method','dro_treatment','nonrecourse_allocation_method',
  'tax_classification','section_704c_method','revaluation_events','section_754_election',
  'section_752_method','qualified_nonrecourse_method','bba_pr_designation',
  'bba_designated_individual','push_out_election','tax_year','accounting_method',
  'tax_distributions_enabled','assumed_tax_rate','assumed_tax_rate_custom','tax_distribution_treatment',
  'transfer_general','rofo','rofr','drag_along','drag_along_threshold',
  'tag_along','tag_along_trigger','buy_sell',
  'spe_provisions','charging_order','indemnification','confidentiality',
  'restrictive_covenants','dispute_resolution','fee_shifting','series_reservation',
  'attorney_notes'
];
const PERSISTED_CHECKBOX_IDS = [
  'default_dilution','default_loan','default_forfeiture','default_forced_sale','default_loss_voting',
  'md_sale_assets','md_merger','md_dissolution','md_indebtedness','md_amend_oa',
  'md_admit_member','md_tax_election','md_affiliate_tx','md_capital_call_threshold','md_change_business',
  'reg_qio','reg_min_gain_chargeback','reg_partner_min_gain','reg_partner_nonrecourse_ded',
  'reg_nonrecourse_deductions','reg_gross_income','reg_curative',
  'pt_family','pt_wholly_owned','pt_affiliates','pt_at_death','pt_charitable','pt_employee_benefit'
];

function saveToLocalStorage() {
  try {
    const data = {
      members: oaState.members, classes: oaState.classes,
      assignments: oaState.assignments, promoteTiers: oaState.promoteTiers,
      _idCounter, entityFields: {}, checkboxes: {}
    };
    PERSISTED_FIELD_IDS.forEach(id => { const el = document.getElementById(id); if (el) data.entityFields[id] = el.value; });
    PERSISTED_CHECKBOX_IDS.forEach(id => { const el = document.getElementById(id); if (el) data.checkboxes[id] = el.checked; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* silent */ }
}

/* Everything restoreFromLocalStorage() hands back is whatever the storage held —
   JSON.parse is just as happy to return an attacker-controlled value as a saved
   one — and four of the restored fields reach HTML with no barrier on them:

     renderReviewSummary  the ROFO / ROFR row              CodeQL 27
                          the Drag / Tag row
                          the Effective Date row, via fmtDate
                          the "N Units" cell of Total Capital
     renderAssignments    the units value attribute        attribute sink

   (Spelled out rather than quoted, so the regression guard in
   test/tool-xss-restore-sweep.test.mjs cannot match this comment instead of the
   code it is meant to be checking.)

   The renderAssignments one is the sharp shape: it lands inside a double-quoted
   attribute, so a persisted units of `0" onmouseover="alert(1)` breaks out of the
   attribute without needing a single `<`. Three guards go in on the read path:

   - units and capitalContribution are numbers, so they are coerced through
     Number(). buildScheduleA also calls a.units.toLocaleString(), which a string
     would break outright, so the coercion is load-bearing beyond the escaping.
   - a <select>'s value is one of its options and nothing else. Refusing a value
     that is not an option is exactly what a browser already does on assignment,
     so this changes no behaviour while keeping an arbitrary string out of the
     field that collectData() later reads back.
   - the id set is an allowlist: saveToLocalStorage only ever writes
     PERSISTED_FIELD_IDS / PERSISTED_CHECKBOX_IDS, so a key outside those lists
     did not come from this tool and has no business addressing an element. */
const PERSISTED_FIELD_SET = new Set(PERSISTED_FIELD_IDS);
const PERSISTED_CHECKBOX_SET = new Set(PERSISTED_CHECKBOX_IDS);

/* A count or a dollar figure — 0 when absent or unreadable. Assignments start
   life at units: 0, so 0 is a legitimate value and is not refused. */
function oaNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function oaRestorableValue(el, v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v);
  if (el.tagName === 'SELECT') {
    return Array.prototype.some.call(el.options, o => o.value === s) ? s : null;
  }
  return s;
}

function sanitizeAssignments(list) {
  return (Array.isArray(list) ? list : [])
    .filter(a => a && typeof a === 'object')
    .map(a => {
      a.units = oaNum(a.units);
      a.capitalContribution = oaNum(a.capitalContribution);
      return a;
    });
}

function restoreFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.members) oaState.members = data.members;
    if (data.classes) oaState.classes = data.classes;
    if (data.assignments) oaState.assignments = sanitizeAssignments(data.assignments);
    if (data.promoteTiers) oaState.promoteTiers = data.promoteTiers;
    if (data._idCounter) _idCounter = data._idCounter;
    if (data.entityFields) Object.entries(data.entityFields).forEach(([id, v]) => {
      if (!PERSISTED_FIELD_SET.has(id)) return;
      const el = document.getElementById(id); if (!el) return;
      const restorable = oaRestorableValue(el, v);
      if (restorable !== null) el.value = restorable;
    });
    if (data.checkboxes) Object.entries(data.checkboxes).forEach(([id, v]) => {
      if (!PERSISTED_CHECKBOX_SET.has(id)) return;
      const el = document.getElementById(id); if (el) el.checked = !!v;
    });
    return true;
  } catch (e) { return false; }
}

document.addEventListener('DOMContentLoaded', () => {
  const save = document.getElementById('btn_save_state');
  if (save) save.addEventListener('click', () => { saveToLocalStorage(); alert('Draft saved.'); });
  const load = document.getElementById('btn_load_state');
  if (load) load.addEventListener('click', () => {
    if (restoreFromLocalStorage()) {
      renderMembers(); renderClasses(); renderAssignments(); renderPromoteTiers();
      updateManagementVisibility(); updateAllocationVisibility();
      updateCapitalCallVisibility(); updateWaterfallVisibility();
      alert('Draft loaded.');
    } else alert('No saved draft found.');
  });
  const reset = document.getElementById('btn_clear_state');
  if (reset) reset.addEventListener('click', () => {
    if (!confirm('Reset all fields to defaults? Saved draft will be erased.')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
});

/* INITIALIZE ================================================================= */
function initializeTool() {
  const restored = restoreFromLocalStorage();
  if (!restored) {
    loadDefaults();
    const dateEl = document.getElementById('effective_date');
    if (dateEl) dateEl.valueAsDate = new Date();
  }
  renderMembers(); renderClasses(); renderAssignments(); renderPromoteTiers();
  updateManagementVisibility(); updateAllocationVisibility();
  updateCapitalCallVisibility(); updateWaterfallVisibility(); updateTaxRateVisibility();
  const rateSel = document.getElementById('assumed_tax_rate');
  if (rateSel) rateSel.addEventListener('change', updateTaxRateVisibility);
  dlBindAddressBlocks(document);
  document.querySelectorAll('.oa-panel input, .oa-panel select, .oa-panel textarea').forEach(el => {
    el.addEventListener('change', saveToLocalStorage);
  });
}

/* UTILITIES ================================================================== */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function sel(v, target) { return v === target ? 'selected' : ''; }
function selN(v, target) { return Math.abs((Number(v) || 0) - target) < 0.0001 ? 'selected' : ''; }
function fmtMoney(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtPercent(n, decimals = 2) { return (Number(n) * 100).toFixed(decimals) + '%'; }
function fmtDate(s) {
  if (!s) return '_______________';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }); }
  // Every fmtDate result is interpolated into a document that is assigned to
  // doc_preview.innerHTML, and this branch is the one that hands back the raw
  // field value, so it is the only one that needs a barrier. Escaping it here
  // rather than at the fifteen call sites closes the path once. In practice
  // the branch is unreachable — toLocaleDateString on an invalid date returns
  // 'Invalid Date' rather than throwing — which is why nothing visible changes.
  catch (e) { return escapeHtml(s); }
}
function ordinal(n) {
  const s = ['th','st','nd','rd']; const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function romanNumeral(n) {
  const m = ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
  return m[n] || String(n);
}

/* CONSTANTS USED IN TEMPLATES ================================================ */
const DRAFT_BANNER = '<div class="draft-banner">DRAFT &mdash; EDUCATIONAL ILLUSTRATION &mdash; NOT FOR SIGNATURE. Generated by a self-service drafting tool published by Donovan Legal PLLC. Not legal advice, not reviewed by counsel, not effective for any purpose. Have formation documents prepared or reviewed by counsel admitted in the formation state before anything is filed or signed. donovan.law/book</div>';

const PURPOSE_LANG = {
  real_estate_holding: 'to acquire, own, hold, lease, manage, improve, develop, finance, refinance, mortgage, encumber, sell, exchange, and otherwise deal with real property and interests therein, and to engage in any and all activities incidental thereto',
  real_estate_development: 'to acquire, develop, improve, construct upon, lease, finance, mortgage, sell, and otherwise deal with real property; to enter into contracts with architects, contractors, lenders, and other parties necessary or advisable in connection with such development; and to engage in any and all activities incidental thereto',
  real_estate_operating: 'to acquire, own, hold, operate, lease, license, and dispose of real property used for short-term rental, hospitality, or similar guest-accommodation purposes',
  investment_fund: 'to act as a pooled investment vehicle for the acquisition, holding, and management of investments on behalf of its Members',
  operating_business: 'to conduct a lawful operating business as further described in the Company\u2019s books and records',
  general: 'to engage in any lawful act or activity for which limited liability companies may be organized under the Act'
};

/* JURISDICTION DATA TABLE ====================================================
   Comprehensive metadata for each supported jurisdiction. Used by the article
   builders to parameterize statutory citations, fiduciary-duty drafting,
   series-LLC availability, charging-order language, and forum/venue.
   ============================================================================

   Field reference:
   - actName / actCite: full and short cite to the LLC act
   - citePrefix: format string used in inline citations ("6 Del. C. §", "Fla. Stat. §", etc.)
   - certName: name of the formation certificate ("Certificate of Formation" or "Articles of Organization")
   - certCancelName: name of the cancellation/dissolution certificate
   - secOfStateOffice: office where formation documents are filed
   - venueCity / venueCounty: typical court venue for disputes
   - sections: object of statutory section numbers by topic
   - canEliminateFiduciaryDuty: 'full' (DE-style), 'broad' (TX/NV/WY), 'modified' (FL/CO/GA/MD/NC/SD), 'restricted' (MA/NY/NJ/CA/SC)
   - seriesPermitted: boolean — can the OA reserve Series LLC rights
   - nonCompeteEnforceable: 'yes', 'limited' (state-specific limits), 'no' (CA prohibits)
   - chancery: boolean — does state have a specialized business court (DE Chancery only here)

   IMPORTANT: Specific section numbers reflect drafter's best understanding. Firm
   should verify each citation against the current statutory text before issuance.
   ============================================================================ */
const JURIS_FULL = {
  DE: {
    name: 'Delaware', nameAbbrev: 'DE',
    actName: 'Delaware Limited Liability Company Act',
    actCite: '6 Del. C. § 18-101 et seq.',
    citePrefix: '6 Del. C. §',
    certName: 'Certificate of Formation',
    certCancelName: 'Certificate of Cancellation',
    secOfStateOffice: 'Office of the Secretary of State of the State of Delaware',
    venueCity: 'Wilmington', venueCounty: 'New Castle County',
    sections: {
      distLimit: '18-607', dissolPriority: '18-804', judDissol: '18-802',
      certCancel: '18-203', recordsInspect: '18-305', transferStatus: '18-702',
      memberMgrAuth: '18-402', doInsurance: '18-108', chargingOrder: '18-703',
      seriesCite: '18-215', fiduciaryDuty: '18-1101', exculpation: '18-1101(e)',
      fidElimSpecific: '18-1101(c)'
    },
    canEliminateFiduciaryDuty: 'full', seriesPermitted: true,
    nonCompeteEnforceable: 'yes', chancery: true
  },
  FL: {
    name: 'Florida', nameAbbrev: 'FL',
    actName: 'Florida Revised Limited Liability Company Act',
    actCite: 'Chapter 605, Florida Statutes',
    citePrefix: 'Fla. Stat. §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'Florida Department of State, Division of Corporations',
    venueCity: 'Tallahassee', venueCounty: 'Leon County',
    sections: {
      distLimit: '605.0405', dissolPriority: '605.0709', judDissol: '605.0702',
      certCancel: '605.0707', recordsInspect: '605.0410', transferStatus: '605.0502',
      memberMgrAuth: '605.0301', doInsurance: '605.0408', chargingOrder: '605.0503',
      seriesCite: null, fiduciaryDuty: '605.04091', exculpation: '605.04093',
      fidElimSpecific: '605.0105(4)(c)'
    },
    canEliminateFiduciaryDuty: 'modified', seriesPermitted: false,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  MA: {
    name: 'Massachusetts', nameAbbrev: 'MA',
    actName: 'Massachusetts Limited Liability Company Act',
    actCite: 'M.G.L. c. 156C',
    citePrefix: 'M.G.L. c. 156C, §',
    certName: 'Certificate of Organization',
    certCancelName: 'Certificate of Cancellation',
    secOfStateOffice: 'Office of the Secretary of the Commonwealth of Massachusetts, Corporations Division',
    venueCity: 'Boston', venueCounty: 'Suffolk County',
    sections: {
      distLimit: '34', dissolPriority: '45', judDissol: '44',
      certCancel: '14', recordsInspect: '9', transferStatus: '39',
      memberMgrAuth: '24', doInsurance: '8', chargingOrder: '40',
      seriesCite: null, fiduciaryDuty: '63', exculpation: null,
      fidElimSpecific: null
    },
    canEliminateFiduciaryDuty: 'restricted', seriesPermitted: false,
    nonCompeteEnforceable: 'limited', chancery: false
  },
  NY: {
    name: 'New York', nameAbbrev: 'NY',
    actName: 'New York Limited Liability Company Law',
    actCite: 'NY LLC Law § 101 et seq.',
    citePrefix: 'NY LLC Law §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'New York Department of State, Division of Corporations',
    venueCity: 'New York', venueCounty: 'New York County',
    sections: {
      distLimit: '508', dissolPriority: '704', judDissol: '702',
      certCancel: '705', recordsInspect: '1102', transferStatus: '603',
      memberMgrAuth: '412', doInsurance: '420', chargingOrder: '607',
      seriesCite: null, fiduciaryDuty: '409', exculpation: '417',
      fidElimSpecific: null
    },
    canEliminateFiduciaryDuty: 'restricted', seriesPermitted: false,
    nonCompeteEnforceable: 'limited', chancery: false
  },
  NJ: {
    name: 'New Jersey', nameAbbrev: 'NJ',
    actName: 'New Jersey Revised Uniform Limited Liability Company Act',
    actCite: 'N.J.S.A. 42:2C-1 et seq.',
    citePrefix: 'N.J.S.A. §',
    certName: 'Certificate of Formation',
    certCancelName: 'Certificate of Dissolution',
    secOfStateOffice: 'New Jersey Department of the Treasury, Division of Revenue and Enterprise Services',
    venueCity: 'Trenton', venueCounty: 'Mercer County',
    sections: {
      distLimit: '42:2C-37', dissolPriority: '42:2C-50', judDissol: '42:2C-49',
      certCancel: '42:2C-51', recordsInspect: '42:2C-40', transferStatus: '42:2C-43',
      memberMgrAuth: '42:2C-30', doInsurance: '42:2C-39', chargingOrder: '42:2C-44',
      seriesCite: null, fiduciaryDuty: '42:2C-39', exculpation: null,
      fidElimSpecific: '42:2C-11(c)'
    },
    canEliminateFiduciaryDuty: 'restricted', seriesPermitted: false,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  CA: {
    name: 'California', nameAbbrev: 'CA',
    actName: 'California Revised Uniform Limited Liability Company Act',
    actCite: 'Cal. Corp. Code § 17701.01 et seq.',
    citePrefix: 'Cal. Corp. Code §',
    certName: 'Articles of Organization',
    certCancelName: 'Certificate of Cancellation',
    secOfStateOffice: 'California Secretary of State',
    venueCity: 'Sacramento', venueCounty: 'Sacramento County',
    sections: {
      distLimit: '17704.05', dissolPriority: '17707.05', judDissol: '17707.03',
      certCancel: '17707.08', recordsInspect: '17704.10', transferStatus: '17705.02',
      memberMgrAuth: '17703.01', doInsurance: '17704.08', chargingOrder: '17705.03',
      seriesCite: null, fiduciaryDuty: '17704.09', exculpation: null,
      fidElimSpecific: '17701.10(c)'
    },
    canEliminateFiduciaryDuty: 'restricted', seriesPermitted: false,
    nonCompeteEnforceable: 'no', chancery: false
  },
  TX: {
    name: 'Texas', nameAbbrev: 'TX',
    actName: 'Texas Business Organizations Code (LLC provisions)',
    actCite: 'Tex. Bus. Org. Code, Title 3, Chapter 101',
    citePrefix: 'Tex. Bus. Org. Code §',
    certName: 'Certificate of Formation',
    certCancelName: 'Certificate of Termination',
    secOfStateOffice: 'Texas Secretary of State',
    venueCity: 'Austin', venueCounty: 'Travis County',
    sections: {
      distLimit: '101.206', dissolPriority: '101.552', judDissol: '11.314',
      certCancel: '11.101', recordsInspect: '101.501', transferStatus: '101.108',
      memberMgrAuth: '101.254', doInsurance: '101.402', chargingOrder: '101.112',
      seriesCite: '101.601', fiduciaryDuty: '101.401', exculpation: '101.401',
      fidElimSpecific: '101.401'
    },
    canEliminateFiduciaryDuty: 'broad', seriesPermitted: true,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  CO: {
    name: 'Colorado', nameAbbrev: 'CO',
    actName: 'Colorado Limited Liability Company Act',
    actCite: 'C.R.S. § 7-80-101 et seq.',
    citePrefix: 'C.R.S. §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'Colorado Secretary of State',
    venueCity: 'Denver', venueCounty: 'Denver County',
    sections: {
      distLimit: '7-80-606', dissolPriority: '7-80-803', judDissol: '7-80-810',
      certCancel: '7-80-803', recordsInspect: '7-80-411', transferStatus: '7-80-702',
      memberMgrAuth: '7-80-405', doInsurance: '7-80-407', chargingOrder: '7-80-703',
      seriesCite: null, fiduciaryDuty: '7-80-404', exculpation: null,
      fidElimSpecific: '7-80-108'
    },
    canEliminateFiduciaryDuty: 'modified', seriesPermitted: false,
    nonCompeteEnforceable: 'limited', chancery: false
  },
  GA: {
    name: 'Georgia', nameAbbrev: 'GA',
    actName: 'Georgia Limited Liability Company Act',
    actCite: 'O.C.G.A. § 14-11-100 et seq.',
    citePrefix: 'O.C.G.A. §',
    certName: 'Articles of Organization',
    certCancelName: 'Certificate of Termination',
    secOfStateOffice: 'Georgia Secretary of State, Corporations Division',
    venueCity: 'Atlanta', venueCounty: 'Fulton County',
    sections: {
      distLimit: '14-11-407', dissolPriority: '14-11-606', judDissol: '14-11-603',
      certCancel: '14-11-610', recordsInspect: '14-11-313', transferStatus: '14-11-502',
      memberMgrAuth: '14-11-301', doInsurance: '14-11-308', chargingOrder: '14-11-504',
      seriesCite: null, fiduciaryDuty: '14-11-305', exculpation: null,
      fidElimSpecific: '14-11-1107(d)'
    },
    canEliminateFiduciaryDuty: 'modified', seriesPermitted: false,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  MD: {
    name: 'Maryland', nameAbbrev: 'MD',
    actName: 'Maryland Limited Liability Company Act',
    actCite: 'Md. Code, Corps. & Ass\u2019ns § 4A-101 et seq.',
    citePrefix: 'Md. Code, Corps. & Ass\u2019ns §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Cancellation',
    secOfStateOffice: 'Maryland State Department of Assessments and Taxation',
    venueCity: 'Baltimore', venueCounty: 'Baltimore City',
    sections: {
      distLimit: '4A-504', dissolPriority: '4A-906', judDissol: '4A-903',
      certCancel: '4A-906', recordsInspect: '4A-406', transferStatus: '4A-603',
      memberMgrAuth: '4A-401', doInsurance: '4A-403', chargingOrder: '4A-607',
      seriesCite: null, fiduciaryDuty: '4A-405', exculpation: null,
      fidElimSpecific: '4A-103'
    },
    canEliminateFiduciaryDuty: 'modified', seriesPermitted: false,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  NC: {
    name: 'North Carolina', nameAbbrev: 'NC',
    actName: 'North Carolina Limited Liability Company Act',
    actCite: 'N.C.G.S. § 57D-1-01 et seq.',
    citePrefix: 'N.C.G.S. §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'North Carolina Secretary of State',
    venueCity: 'Raleigh', venueCounty: 'Wake County',
    sections: {
      distLimit: '57D-4-05', dissolPriority: '57D-6-08', judDissol: '57D-6-02',
      certCancel: '57D-6-09', recordsInspect: '57D-3-04', transferStatus: '57D-5-02',
      memberMgrAuth: '57D-3-21', doInsurance: '57D-3-31', chargingOrder: '57D-5-03',
      seriesCite: null, fiduciaryDuty: '57D-3-21', exculpation: null,
      fidElimSpecific: '57D-2-31'
    },
    canEliminateFiduciaryDuty: 'modified', seriesPermitted: false,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  SC: {
    name: 'South Carolina', nameAbbrev: 'SC',
    actName: 'South Carolina Uniform Limited Liability Company Act of 1996',
    actCite: 'S.C. Code § 33-44-101 et seq.',
    citePrefix: 'S.C. Code §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'South Carolina Secretary of State',
    venueCity: 'Columbia', venueCounty: 'Richland County',
    sections: {
      distLimit: '33-44-406', dissolPriority: '33-44-806', judDissol: '33-44-801',
      certCancel: '33-44-805', recordsInspect: '33-44-408', transferStatus: '33-44-502',
      memberMgrAuth: '33-44-301', doInsurance: '33-44-403', chargingOrder: '33-44-504',
      seriesCite: null, fiduciaryDuty: '33-44-409', exculpation: null,
      fidElimSpecific: '33-44-103'
    },
    canEliminateFiduciaryDuty: 'restricted', seriesPermitted: false,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  NV: {
    name: 'Nevada', nameAbbrev: 'NV',
    actName: 'Nevada Limited-Liability Companies Act',
    actCite: 'NRS Chapter 86',
    citePrefix: 'NRS §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'Nevada Secretary of State',
    venueCity: 'Carson City', venueCounty: 'Carson City',
    sections: {
      distLimit: '86.343', dissolPriority: '86.521', judDissol: '86.491',
      certCancel: '86.541', recordsInspect: '86.241', transferStatus: '86.351',
      memberMgrAuth: '86.291', doInsurance: '86.411', chargingOrder: '86.401',
      seriesCite: '86.296', fiduciaryDuty: '86.286', exculpation: '86.286',
      fidElimSpecific: '86.286(2)'
    },
    canEliminateFiduciaryDuty: 'broad', seriesPermitted: true,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  SD: {
    name: 'South Dakota', nameAbbrev: 'SD',
    actName: 'South Dakota Limited Liability Company Act',
    actCite: 'SDCL Chapter 47-34A',
    citePrefix: 'SDCL §',
    certName: 'Articles of Organization',
    certCancelName: 'Statement of Dissolution',
    secOfStateOffice: 'South Dakota Secretary of State',
    venueCity: 'Pierre', venueCounty: 'Hughes County',
    sections: {
      distLimit: '47-34A-406', dissolPriority: '47-34A-806', judDissol: '47-34A-801',
      certCancel: '47-34A-805', recordsInspect: '47-34A-408', transferStatus: '47-34A-502',
      memberMgrAuth: '47-34A-301', doInsurance: '47-34A-403', chargingOrder: '47-34A-504',
      seriesCite: '47-34A-901', fiduciaryDuty: '47-34A-409', exculpation: null,
      fidElimSpecific: '47-34A-103'
    },
    canEliminateFiduciaryDuty: 'modified', seriesPermitted: true,
    nonCompeteEnforceable: 'yes', chancery: false
  },
  WY: {
    name: 'Wyoming', nameAbbrev: 'WY',
    actName: 'Wyoming Limited Liability Company Act',
    actCite: 'Wyo. Stat. § 17-29-101 et seq.',
    citePrefix: 'Wyo. Stat. §',
    certName: 'Articles of Organization',
    certCancelName: 'Articles of Dissolution',
    secOfStateOffice: 'Wyoming Secretary of State',
    venueCity: 'Cheyenne', venueCounty: 'Laramie County',
    sections: {
      distLimit: '17-29-405', dissolPriority: '17-29-708', judDissol: '17-29-701',
      certCancel: '17-29-707', recordsInspect: '17-29-410', transferStatus: '17-29-502',
      memberMgrAuth: '17-29-301', doInsurance: '17-29-408', chargingOrder: '17-29-503',
      seriesCite: '17-29-1801', fiduciaryDuty: '17-29-409', exculpation: '17-29-110',
      fidElimSpecific: '17-29-110(d)'
    },
    canEliminateFiduciaryDuty: 'broad', seriesPermitted: true,
    nonCompeteEnforceable: 'yes', chancery: false
  }
};

// Helper: get jurisdiction record with fallback to Delaware
function getJurisdiction(code) {
  return JURIS_FULL[code] || JURIS_FULL.DE;
}

// Helper: format a statutory citation for a given jurisdiction and section
function cite(J, sectionKey) {
  const section = J.sections[sectionKey];
  if (!section) return '[Section]';
  return `${J.citePrefix}&nbsp;${section}`;
}

/* OPERATING AGREEMENT — TOP-LEVEL ASSEMBLY =================================== */
function buildOperatingAgreement(d) {
  const J = getJurisdiction(d.jurisdiction);
  let articleNum = 16;
  const optional = [];
  // The optional builders label their sections with a placeholder prefix
  // (SPE. / Series. / RC. / Conf.); renumber to the article's arabic number so
  // an agreement reads "Section 16.1", never "Section Conf.1" (2026-09-04 audit).
  const numbered = (html, n) => html.replace(/Section(&nbsp;| )(?:SPE|Series|RC|Conf)\./g, 'Section$1' + n + '.');
  if (d.speProvisions && d.speProvisions !== 'none') { const n = articleNum++; optional.push(numbered(buildSPEArticle(d, romanNumeral(n)), n)); }
  if (d.seriesReservation === 'reserve' && J.seriesPermitted) { const n = articleNum++; optional.push(numbered(buildSeriesArticle(d, romanNumeral(n), J), n)); }
  if (d.restrictiveCovenants && d.restrictiveCovenants !== 'none') { const n = articleNum++; optional.push(numbered(buildRestrictiveCovenantsArticle(d, romanNumeral(n), J), n)); }
  if (d.confidentiality && d.confidentiality !== 'none') { const n = articleNum++; optional.push(numbered(buildConfidentialityArticle(d, romanNumeral(n)), n)); }

  return DRAFT_BANNER +
    buildPreamble(d, J) +
    buildArticleI_Definitions(d, J) +
    buildArticleII_Formation(d, J) +
    buildArticleIII_PurposeAndPowers(d, J) +
    buildArticleIV_Members(d, J) +
    buildArticleV_CapitalContributions(d, J) +
    buildArticleVI_Allocations(d, J) +
    buildArticleVII_Distributions(d, J) +
    buildArticleVIII_TaxMatters(d, J) +
    buildArticleIX_Management(d, J) +
    buildArticleX_BooksAndRecords(d, J) +
    buildArticleXI_Transfers(d, J) +
    buildArticleXII_TagDrag(d, J) +
    buildArticleXIII_Dissolution(d, J) +
    buildArticleXIV_Indemnification(d, J) +
    buildArticleXV_Miscellaneous(d, J) +
    optional.join('') +
    buildSignatureBlock(d, J) +
    buildScheduleA(d, J) +
    buildScheduleB(d, J);
}

function buildPreamble(d, J) {
  return `<h1>Limited Liability Company<br/>Operating Agreement<br/>of<br/>${escapeHtml(d.companyName)}</h1>
<h2>A ${J.name} Limited Liability Company</h2>
<div class="section">This Limited Liability Company Operating Agreement (this &ldquo;<strong>Agreement</strong>&rdquo;) is entered into and made effective as of ${fmtDate(d.effectiveDate)} (the &ldquo;<strong>Effective Date</strong>&rdquo;), by and among ${escapeHtml(d.companyName)}, a ${J.name} limited liability company (the &ldquo;<strong>Company</strong>&rdquo;), and the Persons identified on <strong>Schedule&nbsp;A</strong> hereto as the initial Members of the Company (each, together with such Person&rsquo;s successors and permitted assigns, a &ldquo;<strong>Member</strong>&rdquo; and collectively, the &ldquo;<strong>Members</strong>&rdquo;).</div>
<div class="section" style="font-weight:bold; text-transform:uppercase; text-align:center;">Recitals</div>
<div class="section"><strong>A.</strong> The Company has been or will be formed as a limited liability company under and pursuant to the ${J.actName}, ${J.actCite}, as amended from time to time (the &ldquo;<strong>Act</strong>&rdquo;), by the filing of a ${J.certName} with the ${J.secOfStateOffice}.</div>
<div class="section"><strong>B.</strong> Each Member has agreed to make the Capital Contributions to the Company set forth on Schedule&nbsp;A and to receive in exchange therefor the Membership Interests in the Company described on Schedule&nbsp;A.</div>
<div class="section"><strong>C.</strong> The Members desire to set forth in this Agreement the governance, economic, allocation, distribution, transfer, and other arrangements governing the Company and the rights and obligations of the Members <em>inter se</em>.</div>
<div class="section">NOW, THEREFORE, in consideration of the foregoing premises, the mutual covenants and agreements herein contained, and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties, intending to be legally bound, agree as follows:</div>`;
}

/* ARTICLE STUBS — Each filled in by subsequent str_replace edits ============= */
function buildArticleI_Definitions(d, J) {
  // Helper to render a defined term row
  const term = (name, body) => `<div class="section"><span class="defined-term">${name}</span> ${body}</div>`;
  return `<div class="article"><p class="article-heading">ARTICLE I &mdash; DEFINITIONS</p>
<div class="section">For purposes of this Agreement, capitalized terms used herein and not otherwise defined have the meanings set forth in this Article I or as otherwise specifically defined in the body of this Agreement. References to &ldquo;Sections&rdquo; and &ldquo;Articles&rdquo; are references to Sections and Articles of this Agreement, unless otherwise specified. References to a statute or regulation include all amendments and successor provisions. References to &ldquo;include,&rdquo; &ldquo;including,&rdquo; and similar terms shall be deemed to be followed by &ldquo;without limitation.&rdquo; Words denoting gender or number include all genders and the plural and singular as the context requires.</div>
${term('"Act"', `means the ${J.actName}, ${J.actCite}, as amended from time to time, and any successor statute.`)}
${term('"Additional Capital Contribution"', 'means any Capital Contribution made by a Member after such Member\u2019s Initial Capital Contribution, whether voluntary, mandatory, or otherwise.')}
${term('"Adjusted Capital Account"', 'means, with respect to any Member, the balance, if any, in such Member\u2019s Capital Account as of the end of the relevant Fiscal Year (or other relevant period), after giving effect to the following adjustments: (a) crediting to such Capital Account any amounts that such Member is deemed obligated to restore pursuant to Regulations Sections 1.704-1(b)(2)(ii)(c), 1.704-2(g)(1), and 1.704-2(i)(5); and (b) debiting from such Capital Account the items described in Regulations Sections 1.704-1(b)(2)(ii)(d)(4), (5), and (6).')}
${term('"Adjusted Capital Account Deficit"', 'means, with respect to any Member, the deficit balance, if any, in such Member\u2019s Adjusted Capital Account.')}
${term('"Affiliate"', 'means, with respect to any Person, any other Person directly or indirectly Controlling, Controlled by, or under common Control with such Person.')}
${term('"Agreement"', 'means this Limited Liability Company Operating Agreement, as amended, modified, supplemented, or restated from time to time in accordance with the terms hereof.')}
${term('"Available Cash"', 'means, as of any date of determination, all cash and cash equivalents of the Company on hand, less (a) all expenses, charges, fees, costs, and other liabilities of the Company then due and payable; (b) reserves established by the Manager in good faith for working capital needs, anticipated expenses, anticipated capital expenditures, contingent obligations, debt service, taxes, and any other foreseeable obligations of the Company; and (c) any amounts required to be retained pursuant to any agreement with a lender or other third party.')}
${term('"BBA"', 'means the Bipartisan Budget Act of 2015, Pub. L. No. 114-74, as amended, and the centralized partnership audit regime enacted thereunder, including Code Sections 6221 through 6241 and the Regulations promulgated thereunder.')}
${term('"Book Value"', 'means, with respect to any Company asset, the Company\u2019s adjusted basis for federal income tax purposes, adjusted as follows: (a) the initial Book Value of any asset contributed by a Member to the Company shall be the Gross Asset Value of such asset, as agreed by the contributing Member and the Manager; (b) the Book Value of all Company assets shall be adjusted to equal their respective Gross Asset Values upon the occurrence of any Revaluation Event; (c) the Book Value of any Company asset distributed to any Member shall be adjusted to equal the gross fair market value of such asset on the date of distribution; and (d) the Book Value of any Company asset shall be adjusted by the Depreciation taken into account with respect to such asset for purposes of computing Profits and Losses.')}
${term('"Capital Account"', 'means the capital account established and maintained for each Member in accordance with the principles of Code Section 704(b) and Regulations Section 1.704-1(b)(2)(iv), as set forth in Article VI.')}
${term('"Capital Call"', 'means a written notice from the Manager to the Members requiring an Additional Capital Contribution in accordance with Article V.')}
${term('"Capital Contribution"', 'means, with respect to any Member, the aggregate amount of cash and the Gross Asset Value of any property (net of liabilities to which such property is subject or which are assumed by the Company) contributed to the Company by such Member, including Initial Capital Contributions and Additional Capital Contributions, as set forth on Schedule A as updated from time to time.')}
${term('"Cause"', 'means, with respect to any Person, the occurrence of any of the following: (a) fraud, embezzlement, willful misconduct, or gross negligence in the performance of such Person\u2019s duties; (b) conviction of, or entry of a plea of nolo contendere with respect to, a felony or any crime involving moral turpitude; (c) material breach of this Agreement that is not cured within thirty (30) days following written notice thereof from the non-breaching party; or (d) any act or omission that materially and adversely affects the Company.')}
${term(`"${J.certName}"`, `means the ${J.certName} of the Company filed with the ${J.secOfStateOffice}, as amended or restated from time to time.`)}
${term('"Class"', 'means a class of Membership Interests as established under this Agreement and described on Schedule A, including any subclass or series thereof.')}
${term('"Code"', 'means the Internal Revenue Code of 1986, as amended, and any successor statute, together with the Regulations promulgated thereunder.')}
${term('"Common Member"', 'means each Member holding Common Units (or other Common Class interests).')}
${term('"Company"', `means ${escapeHtml(d.companyName)}, a ${J.name} limited liability company.`)}
${term('"Control" (and the correlative terms "Controlled by," "Controlling," and "under common Control with")', 'means, with respect to any Person, the possession, directly or indirectly, of the power to direct or cause the direction of the management and policies of such Person, whether through the ownership of voting securities, by contract, or otherwise.')}
${term('"Depreciation"', 'means, for each Fiscal Year, an amount equal to the depreciation, amortization, or other cost recovery deduction allowable for federal income tax purposes with respect to an asset for such Fiscal Year, except that if the Book Value of an asset differs from its adjusted basis for federal income tax purposes at the beginning of such Fiscal Year, Depreciation shall be an amount that bears the same ratio to such beginning Book Value as the federal income tax depreciation, amortization, or other cost recovery deduction for such Fiscal Year bears to such beginning adjusted tax basis; provided, however, that if the federal income tax depreciation, amortization, or other cost recovery deduction for such Fiscal Year is zero, Depreciation shall be determined with reference to such beginning Book Value using any reasonable method selected by the Manager.')}
${term('"Designated Individual"', 'has the meaning set forth in Regulations Section 301.6223-1, as designated pursuant to Article VIII.')}
${term('"Distribution"', 'means a transfer of cash or other property by the Company to a Member on account of such Member\u2019s Membership Interest, but shall not include any payment of compensation, reimbursement, or other consideration to a Member or its Affiliate for goods or services provided to the Company.')}
${term('"Effective Date"', `means ${fmtDate(d.effectiveDate)}.`)}
${term('"Fair Market Value"', 'means, with respect to any asset, the price at which the asset would change hands between a willing buyer and a willing seller, neither being under any compulsion to buy or sell and both having reasonable knowledge of the relevant facts, as determined in good faith by the Manager (or, in a liquidation, the Liquidator).')}
${term('"Fiscal Year"', 'means the Company\u2019s taxable year, which shall be the calendar year unless otherwise required by Code Section 706 or as determined by the Manager in accordance with the Code.')}
${term('"GAAP"', 'means United States generally accepted accounting principles, consistently applied.')}
${term('"GP" or "General Partner"', 'means, as the context requires, the Class B Common Member (or the holder of Common Units), serving as the sponsor and promoting Member.')}
${term('"Gross Asset Value"', 'means, with respect to any asset, the asset\u2019s adjusted basis for federal income tax purposes, except as adjusted in accordance with the definition of "Book Value" above.')}
${term('"Imputed Underpayment"', 'has the meaning set forth in Code Section 6225(b).')}
${term('"Indemnified Party"', 'has the meaning set forth in Article XIV.')}
${term('"Initial Capital Contribution"', 'means, with respect to each Member, the Capital Contribution made by such Member on or about the Effective Date, as set forth on Schedule A.')}
${term('"Internal Rate of Return" or "IRR"', 'means, with respect to any Member and as of any date of determination, the annualized internal rate of return realized by such Member from the Effective Date through such date of determination, calculated on a cash-on-cash basis using the actual dated amounts and times of all Capital Contributions made by such Member (as outflows) and all Distributions made to such Member (as inflows), determined using the XIRR function or equivalent good-faith methodology selected by the Manager. The Manager\u2019s determination of IRR shall be binding on all Members absent manifest error.')}
${term('"Liquidation Event"', 'means (a) the dissolution and winding up of the Company; (b) a sale, exchange, or other disposition of all or substantially all of the Company\u2019s assets; (c) a merger, consolidation, or conversion of the Company in which the Company is not the surviving entity; or (d) a Sale of the Company.')}
${term('"Liquidation Proceeds"', 'means the cash and other property available for distribution upon a Liquidation Event after payment of, or provision for, the Company\u2019s debts, liabilities, and obligations and the establishment of reasonable reserves.')}
${term('"Liquidator"', 'has the meaning set forth in Article XIII.')}
${term('"LP" or "Limited Partner"', 'means, as the context requires, a Member holding a Class A Preferred interest (or other Preferred Class interest), in its capacity as a passive economic Member.')}
${term('"Major Decision"', 'means any action listed on Schedule B requiring approval of the Required Members.')}
${term('"Majority in Interest"', 'means Members holding more than fifty percent (50%) of the Percentage Interests then held by all Members entitled to vote on the matter in question.')}
${term('"Manager"', 'means the Person designated as Manager pursuant to Article IX, including any successor or replacement Manager appointed in accordance with the terms of this Agreement.')}
${term('"Member"', 'means each Person identified as a Member on Schedule A, together with any Person admitted as an additional or substitute Member pursuant to this Agreement, in each case for so long as such Person remains a Member.')}
${term('"Member Nonrecourse Debt"', 'has the meaning set forth in Regulations Section 1.704-2(b)(4).')}
${term('"Member Nonrecourse Debt Minimum Gain"', 'has the meaning set forth in Regulations Section 1.704-2(i)(2).')}
${term('"Member Nonrecourse Deductions"', 'has the meaning set forth in Regulations Sections 1.704-2(i)(1) and (i)(2).')}
${term('"Membership Interest"', 'means a Member\u2019s entire economic and other rights in the Company, including such Member\u2019s right to share in Profits, Losses, and Distributions, voting and consent rights, and any other rights and obligations conferred under this Agreement and the Act.')}
${term('"Minimum Gain"', 'means "partnership minimum gain" as defined in Regulations Section 1.704-2(d).')}
${term('"Nonrecourse Deductions"', 'has the meaning set forth in Regulations Section 1.704-2(b)(1).')}
${term('"Nonrecourse Liability"', 'has the meaning set forth in Regulations Section 1.704-2(b)(3).')}
${term('"Partnership Representative"', 'means the Person designated as the Company\u2019s "partnership representative" pursuant to Code Section 6223 and Regulations Section 301.6223-1, as identified in Article VIII.')}
${term('"Percentage Interest"', 'means, with respect to each Member and as of any date of determination, the ratio (expressed as a percentage) of (a) the aggregate Capital Contributions made by such Member, divided by (b) the aggregate Capital Contributions made by all Members, in each case as set forth on Schedule A (as updated from time to time), or such other percentage as may be set forth on Schedule A.')}
${term('"Permitted Transferee"', 'means any Person to whom a Member is permitted to Transfer all or any portion of its Membership Interest in accordance with Article XI without the consent of the Manager or the other Members.')}
${term('"Person"', 'means any individual, corporation, partnership, limited liability company, joint venture, trust, estate, unincorporated organization, governmental authority, or other entity.')}
${term('"Preferred Member"', 'means each Member holding Preferred Units (or other Preferred Class interest).')}
${term('"Preferred Return"', 'means, with respect to any Preferred Class, an amount accruing on the Unrecovered Capital Contributions of such Class at the rate, with the compounding frequency, and on the cumulative/non-cumulative basis specified for such Class on Schedule A.')}
${term('"Profits" and "Losses"', 'mean, for each Fiscal Year or other period, an amount equal to the Company\u2019s taxable income or loss for such Fiscal Year or other period, determined in accordance with Code Section 703(a) (for this purpose, all items of income, gain, loss, or deduction required to be stated separately pursuant to Code Section 703(a)(1) shall be included in taxable income or loss), with the following adjustments: (a) any income of the Company exempt from federal income tax not otherwise taken into account shall be added to such taxable income or loss; (b) any expenditures of the Company described in Code Section 705(a)(2)(B) (or treated as such pursuant to Regulations Section 1.704-1(b)(2)(iv)(i)) not otherwise taken into account shall be subtracted; (c) gain or loss resulting from any disposition of Company property with respect to which gain or loss is recognized for federal income tax purposes shall be computed with reference to the Book Value of the property disposed of (and not its adjusted tax basis); (d) Depreciation shall be substituted for federal income tax depreciation, amortization, and other cost recovery; and (e) any items specially allocated pursuant to Sections 6.4 and 6.5 of this Agreement shall not be taken into account in computing Profits or Losses.')}
${term('"Regulations"', 'means the Treasury Regulations promulgated under the Code, as amended from time to time, and any successor regulations.')}
${term('"Required Members"', 'means the holders of Membership Interests sufficient to constitute the threshold specified for a particular action, as set forth on Schedule B or otherwise in this Agreement.')}
${term('"Revaluation Event"', 'means each event upon which the Capital Accounts and the Book Value of Company assets are required or permitted to be adjusted pursuant to Regulations Section 1.704-1(b)(2)(iv)(f), including: (a) the contribution of money or other property to the Company by a new or existing Member; (b) the distribution by the Company of money or other property to a retiring or continuing Member; (c) the liquidation of the Company within the meaning of Regulations Section 1.704-1(b)(2)(ii)(g); (d) the grant of an interest in the Company as consideration for the provision of services; and (e) any other event for which a revaluation is permitted pursuant to the Regulations.')}
${term('"Sale of the Company"', 'means any transaction or series of related transactions resulting in (a) the sale, exchange, or other disposition of all or substantially all of the Company\u2019s assets followed by the distribution of the proceeds to the Members; (b) a merger or consolidation of the Company in which the Members immediately before such transaction hold, immediately after such transaction, less than fifty percent (50%) of the equity of the surviving entity; or (c) the sale or transfer of Membership Interests representing more than fifty percent (50%) of the Percentage Interests to a Person that is not, immediately before such transaction, a Member or an Affiliate of a Member.')}
${term('"Schedule A"', 'means Schedule A to this Agreement, setting forth, with respect to each Member, the name, Class, Units, Capital Contribution, and Percentage Interest of such Member, as the same may be amended from time to time by the Manager to reflect admissions, withdrawals, additional Capital Contributions, Transfers, redemptions, and other changes as permitted by this Agreement.')}
${term('"Supermajority"', 'means Members holding at least sixty-six and two-thirds percent (66 2/3%) of the Percentage Interests then held by all Members entitled to vote on the matter in question, unless a different threshold is specified for the matter on Schedule B.')}
${term('"Tax Distribution"', 'means a Distribution made to a Member pursuant to Section 7.5 to fund such Member\u2019s tax liability on income allocated to such Member.')}
${term('"Tax Distribution Amount"', 'means, with respect to any Member for any taxable year (or portion thereof), the product of (a) the Assumed Tax Rate, multiplied by (b) the net taxable income allocated to such Member with respect to such period (taking into account, in the Manager\u2019s discretion, prior cumulative tax losses allocated to such Member that have not been previously utilized).')}
${term('"Assumed Tax Rate"', 'means the rate specified in Section 7.5, intended to approximate the highest combined federal, state, and local marginal income tax rate applicable to any Member.')}
${term('"Transfer"', 'means, with respect to a Membership Interest, any direct or indirect sale, exchange, assignment, gift, pledge, hypothecation, encumbrance, mortgage, or other transfer or disposition of such Membership Interest, whether voluntary or involuntary, by operation of law or otherwise; provided that a pledge or grant of a security interest in a Membership Interest to a lender pursuant to a bona fide arm\u2019s-length financing transaction (without transfer of voting rights) shall not be deemed a Transfer for purposes of this Agreement unless and until the foreclosure of such pledge or security interest.')}
${term('"Units"', 'means the units of Membership Interest of each Class issued by the Company, as set forth on Schedule A.')}
${term('"Unrecovered Capital Contributions"', 'means, with respect to any Member and as of any date of determination, the excess, if any, of (a) the aggregate Capital Contributions made by such Member as of such date, over (b) the aggregate Distributions made to such Member through such date under the return-of-capital tiers of Section 7.2 and the corresponding tiers of Section 7.4 (that is, Distributions designated as a return of capital under the waterfall, and not Distributions of Preferred Return, Tax Distributions, or promote).')}
</div>`;
}
function buildArticleII_Formation(d, J) {
  return `<div class="article"><p class="article-heading">ARTICLE II &mdash; FORMATION</p>
<div class="section"><strong>Section&nbsp;2.1 Formation.</strong> The Company has been (or, where the ${J.certName} is to be filed contemporaneously herewith, will be) formed as a limited liability company under and pursuant to the Act by the filing of the ${J.certName} with the ${J.secOfStateOffice}. The rights, duties, and obligations of the Members and the Manager shall be as set forth in the Act, except as otherwise modified by this Agreement to the extent permitted by the Act. The Members and the Manager intend that, to the maximum extent permitted by the Act, the terms of this Agreement shall govern the affairs of the Company and the rights and obligations of the parties hereto, and that the default provisions of the Act shall apply only to the extent that this Agreement does not provide otherwise.</div>
<div class="section"><strong>Section&nbsp;2.2 Name.</strong> The name of the Company is ${escapeHtml(d.companyName)}. The Manager may change the name of the Company at any time and from time to time upon notice to the Members and the filing of an amendment to the ${J.certName} as required by the Act.</div>
<div class="section"><strong>Section&nbsp;2.3 Principal Office.</strong> The principal office of the Company shall be located at ${escapeHtml(d.principalStreet || '[Street Address]')}, ${escapeHtml(d.principalCsz || '[City, State ZIP]')}, or at such other location as the Manager may from time to time designate. The Manager may establish such other offices of the Company within or without the State of ${J.name} as the business of the Company may require.</div>
<div class="section"><strong>Section&nbsp;2.4 Registered Agent and Registered Office.</strong> The registered agent of the Company in the State of ${J.name} shall be ${escapeHtml(d.raName || '[Registered Agent Name]')}, whose registered office is located at ${escapeHtml(d.raStreet || '[Street Address]')}, ${escapeHtml(d.raCsz || `[City, ${J.nameAbbrev} ZIP]`)}. The Manager may change the registered agent or registered office of the Company at any time and from time to time upon the filing of an amendment to the ${J.certName} as required by the Act.</div>
<div class="section"><strong>Section&nbsp;2.5 Term.</strong> The Company commenced upon the filing of the ${J.certName} and shall continue in existence in perpetuity unless and until dissolved and its affairs wound up pursuant to Article XIII or as otherwise provided by the Act.</div>
<div class="section"><strong>Section&nbsp;2.6 Fiscal Year.</strong> The Fiscal Year of the Company shall be the calendar year, unless otherwise required by Code Section 706 or otherwise determined by the Manager pursuant to a duly adopted election under the Code.</div>
</div>`;
}
function buildArticleIII_PurposeAndPowers(d, J) {
  const purposeLang = PURPOSE_LANG[d.businessPurpose] || PURPOSE_LANG.general;
  const isHc = d.entityStructure === 'holdco_opco';
  const opCoName = d.opCoName || '[OpCo Name] LLC';
  const Jo = getJurisdiction(d.opCoJurisdiction || d.jurisdiction);

  const holdCoPurposeBlock = isHc ?
    `<div class="section"><strong>Section&nbsp;3.1 Purpose.</strong> The Company is the investor-facing holding entity in a two-tier structure. The purpose of the Company is (a) to acquire, hold, own, and dispose of one hundred percent (100%) of the issued and outstanding membership interests in ${escapeHtml(opCoName)}, a ${Jo.name} limited liability company (the &ldquo;<strong>OpCo</strong>&rdquo;), which OpCo shall, in turn, ${purposeLang}; (b) to cause the OpCo to comply with the OpCo\u2019s operating agreement of even date herewith (the &ldquo;<strong>OpCo Operating Agreement</strong>&rdquo;); (c) to provide capital to the OpCo, by means of capital contributions, member loans, or otherwise; (d) to receive and distribute the cash flow generated by the OpCo, including operating distributions and proceeds of capital events, in accordance with Article VII of this Agreement; (e) to participate, in its capacity as sole member of the OpCo, in the management of the OpCo through the OpCo\u2019s designated Authorized Representative; and (f) to engage in any and all other activities reasonably incidental to the foregoing. The Company shall not directly hold any real property, operating assets, or any other material assets other than the Membership Interest in the OpCo and ancillary working-capital cash balances and reserves.</div>` :
    `<div class="section"><strong>Section&nbsp;3.1 Purpose.</strong> The purpose of the Company is ${purposeLang}, and to engage in any and all other lawful acts or activities for which limited liability companies may be organized under the Act, and to do any and all things necessary or incidental to or in connection with the foregoing.</div>`;

  const holdCoPowersBlock = isHc ?
    `<div class="section"><strong>Section&nbsp;3.2 Powers.</strong> The Company shall have all powers necessary, suitable, or convenient for the accomplishment of its purposes as set forth in Section&nbsp;3.1, including: (a) to acquire, hold, vote, and dispose of the Membership Interest in the OpCo; (b) to provide capital to the OpCo by means of capital contribution or member loan; (c) to receive and distribute proceeds from the OpCo; (d) to enter into, perform, and carry out contracts of any kind related to its holding function (subject to the requirements of Section&nbsp;9.5 and the other terms of this Agreement); (e) to maintain insurance for the protection of the Company, the Members, the Manager, and Indemnified Parties; (f) to invest working-capital funds of the Company not required for immediate use in cash equivalents and similar investments; and (g) to take all actions necessary or appropriate to cause the OpCo to comply with the OpCo Operating Agreement, applicable loan documents, and applicable law. The Company\u2019s operating powers with respect to the Property (as defined in the OpCo Operating Agreement) are exercised through its position as sole member of the OpCo and not directly.</div>` :
    `<div class="section"><strong>Section&nbsp;3.2 Powers.</strong> The Company shall have all powers necessary, suitable, or convenient for the accomplishment of its purposes as set forth in Section&nbsp;3.1, alone or with others, as principal or agent, including the following: (a) to acquire, own, hold, manage, lease, finance, refinance, mortgage, encumber, sell, exchange, transfer, or otherwise dispose of real and personal property of every kind and description; (b) to borrow money and to issue evidences of indebtedness, and to secure the same by mortgage, pledge, security interest, or other lien; (c) to enter into, perform, and carry out contracts of any kind, including contracts with any Member, the Manager, or any Affiliate of any Member or the Manager (subject to the requirements of Section&nbsp;9.5 and the other terms of this Agreement); (d) to engage employees, agents, contractors, attorneys, accountants, brokers, consultants, and other Persons as the Manager may deem necessary or appropriate; (e) to invest funds of the Company not required for immediate use in cash equivalents, money market funds, marketable securities, and similar investments; (f) to maintain insurance for the protection of the Company, the Members, the Manager, and Indemnified Parties; and (g) to take or cause to be taken all actions and to do or cause to be done all things necessary, appropriate, or advisable in connection with the conduct of the business and affairs of the Company.</div>`;

  return `<div class="article"><p class="article-heading">ARTICLE III &mdash; PURPOSE AND POWERS</p>
${holdCoPurposeBlock}
${holdCoPowersBlock}
<div class="section"><strong>Section&nbsp;3.3 Limitation on Activities.</strong> Notwithstanding anything herein to the contrary, the Company shall not engage in any business or activity that would (a) cause the Company to be classified as anything other than a partnership for U.S. federal income tax purposes (other than a permitted election under Section&nbsp;8.1), (b) result in the Company being treated as a publicly traded partnership within the meaning of Code Section&nbsp;7704, or (c) violate any covenant or restriction set forth in any loan, financing, or other material agreement to which the Company is a party.</div>
${isHc ? '<div class="section"><strong>Section&nbsp;3.4 Acknowledgement of Two-Tier Structure.</strong> Each Member acknowledges that (i) the Company is the investor-facing holding entity and does not directly own the underlying Property; (ii) the OpCo is the direct owner of the Property, is the borrower under any loan documents secured by the Property, and is the primary counterparty in any operating contracts relating to the Property; (iii) the OpCo Operating Agreement governs the internal affairs of the OpCo, and certain protections and restrictions set forth therein (including Single-Purpose Entity covenants if elected) are imposed for the benefit of, and may be enforced by, the OpCo&rsquo;s lender(s); (iv) substantially all economic risk and return associated with the Property accrues to the Company by virtue of its sole-member position in the OpCo; and (v) the Manager of this Company shall also serve as, or shall designate, the Authorized Representative of the Company in its capacity as sole member of the OpCo.</div>' : ''}
</div>`;
}
function buildArticleIV_Members(d, J) {
  // Build the Classes description loop
  const classBlocks = d.classes.map((c, i) => {
    const prefText = (c.type === 'preferred' || c.prefReturn > 0) ?
      ` The ${escapeHtml(c.name)} Members shall be entitled to a Preferred Return on their Unrecovered Capital Contributions at the rate of ${(c.prefReturn * 100).toFixed(2)}% per annum, ${escapeHtml(c.prefCompounding === 'simple' ? 'computed on a simple-interest basis' : `compounded ${({annual: 'annually', quarterly: 'quarterly', monthly: 'monthly'})[c.prefCompounding] || c.prefCompounding}`)} and on a ${escapeHtml(c.prefCumulative === 'cumulative' ? 'cumulative' : 'non-cumulative')} basis.` : '';
    const votingText = ({
      voting_pro_rata: 'shall vote together as a single class on a pro rata basis according to their Units',
      voting_per_capita: 'shall be entitled to one vote per Member, regardless of Units held',
      non_voting: 'shall be non-voting, except to the extent voting rights are required as a matter of non-waivable law',
      protective_only: 'shall be non-voting except for protective provisions specifically reserved to the Class, including class-specific amendments and class-affecting actions'
    })[c.votingRights] || 'shall vote together as a single class on a pro rata basis according to their Units';
    const profitsInterestText = c.profitsInterest ?
      ` The ${escapeHtml(c.name)} interests are intended to qualify as "profits interests" within the meaning of Rev. Proc. 93-27, 1993-2 C.B. 343 and Rev. Proc. 2001-43, 2001-2 C.B. 191. Each holder of a ${escapeHtml(c.name)} interest shall, for U.S. federal income tax purposes, be treated as having received such interest at a value of zero on the date of issuance and shall make any election under Code Section 83(b) that the Manager reasonably determines to be necessary or advisable.` : '';
    return `<div class="section"><strong>Section&nbsp;4.2(${String.fromCharCode(97 + i)}) ${escapeHtml(c.name)}.</strong> The ${escapeHtml(c.name)} consists of ${({ preferred: 'preferred', common: 'common', profits_interest: 'profits' })[c.type] || 'common'} Membership Interests with a liquidation priority of ${escapeHtml(c.liquidationPriority)}.${prefText} ${escapeHtml(c.name)} Members ${votingText}.${profitsInterestText} The ${escapeHtml(c.name)} ${({ restricted: 'is subject to the transfer restrictions of Article XI', freely_transferable: 'is freely transferable subject to compliance with applicable securities laws and Article XI', locked: 'may not be Transferred without the unanimous written consent of the Members' })[c.transferable] || 'is subject to the transfer restrictions of Article XI'}.</div>`;
  }).join('');

  return `<div class="article"><p class="article-heading">ARTICLE IV &mdash; MEMBERS; MEMBERSHIP INTERESTS; CLASSES</p>
<div class="section"><strong>Section&nbsp;4.1 Members.</strong> The Members of the Company are the Persons identified on Schedule A as Members, who have been admitted as Members upon execution of this Agreement (or a joinder hereto). Each Member\u2019s Capital Contribution, Class and number of Units, and Percentage Interest are set forth opposite such Member\u2019s name on Schedule A, as the same may be amended from time to time by the Manager to reflect admissions, withdrawals, additional Capital Contributions, Transfers, redemptions, and other changes as permitted by this Agreement. No Person shall be deemed a Member unless and until such Person has been duly admitted as a Member in accordance with this Agreement and is reflected as such on Schedule A.</div>
<div class="section"><strong>Section&nbsp;4.2 Classes of Membership Interests.</strong> The Membership Interests in the Company are divided into the Classes set forth on Schedule A. The relative rights, preferences, privileges, restrictions, and obligations of each Class are as set forth on Schedule A, in this Article IV, and elsewhere in this Agreement.</div>
${classBlocks}
<div class="section"><strong>Section&nbsp;4.3 Additional Classes; Issuances.</strong> The Manager may, with the consent of the Required Members pursuant to Schedule B, (a) create additional Classes of Membership Interests, with such rights, preferences, privileges, restrictions, and obligations as the Manager and the Required Members shall determine, and (b) issue additional Units of any Class to existing Members or to new Members admitted in accordance with Section&nbsp;4.4. Any creation of a new Class or issuance of additional Units that would dilute the economic or governance rights of any existing Class shall require the additional consent of the Members of such adversely affected Class voting separately by a Majority in Interest of such Class.</div>
<div class="section"><strong>Section&nbsp;4.4 Admission of New Members.</strong> No Person shall be admitted to the Company as a Member except (a) by Transfer of an existing Membership Interest in accordance with Article XI, (b) by issuance of a new Membership Interest pursuant to Section&nbsp;4.3, or (c) as otherwise provided in this Agreement. A Person admitted to the Company as a Member shall execute a joinder agreement substantially in the form attached as <em>Exhibit&nbsp;B</em> hereto (or as otherwise approved by the Manager), agreeing to be bound by this Agreement.</div>
<div class="section"><strong>Section&nbsp;4.5 No Right to Property in Kind.</strong> No Member shall have the right to demand or receive any property in kind from the Company, whether on Distribution or upon liquidation, except as may be specifically provided in this Agreement or unanimously agreed by the Members.</div>
<div class="section"><strong>Section&nbsp;4.6 Limited Liability of Members.</strong> Except as expressly provided by the Act or by this Agreement, no Member shall be personally liable for any of the debts, obligations, or liabilities of the Company, whether arising in contract, tort, or otherwise, solely by reason of being a Member.</div>
<div class="section"><strong>Section&nbsp;4.7 No Withdrawal.</strong> ${({
  prohibited: 'No Member shall have the right to withdraw, resign, or otherwise terminate such Member\u2019s membership in the Company prior to the dissolution and winding up of the Company. Any purported voluntary withdrawal in violation of this Section&nbsp;4.7 shall be ineffective, and the purported withdrawing Member shall remain a Member of the Company for all purposes.',
  restricted: 'A Member may withdraw from the Company only with the unanimous written consent of all other Members. Any purported voluntary withdrawal without such consent shall be ineffective.',
  permitted_with_notice: 'A Member may voluntarily withdraw from the Company upon ninety (90) days\u2019 prior written notice to the Manager and the other Members, subject to the redemption procedures separately agreed by the Members and the Manager.'
})[d.withdrawal] || 'No Member shall have the right to withdraw from the Company prior to its dissolution and winding up.'}</div>
<div class="section"><strong>Section&nbsp;4.8 Spousal Consent.</strong> Each Member who is an individual residing in a community-property state or whose Membership Interest may otherwise be subject to a spousal or marital-property interest shall, upon execution of this Agreement, cause his or her spouse (if any) to execute and deliver a Spousal Consent substantially in the form attached as <em>Exhibit&nbsp;C</em> hereto, acknowledging the terms of this Agreement and the restrictions on Transfer set forth in Article XI.</div>
</div>`;
}
function buildArticleV_CapitalContributions(d, J) {
  // Build the additional capital section
  const addlCapText = ({
    none: 'No Member shall be required or permitted to make any Additional Capital Contribution to the Company. The Company\u2019s capital needs in excess of the Initial Capital Contributions shall be funded exclusively by Company-level borrowing or such other means as the Manager may determine in its sole discretion, but without requiring or permitting any Additional Capital Contribution by any Member.',
    permissive: 'No Member shall be required to make any Additional Capital Contribution to the Company. The Manager may from time to time request, but not require, Additional Capital Contributions from one or more Members on such terms as the Manager and such Members may agree. Any Additional Capital Contribution shall be made on a pro rata basis among willing Members or as the Manager may otherwise determine in good faith. The unanimous written consent of the Members shall be required before the Company may issue any new Units or Membership Interests in connection with any Additional Capital Contribution that would dilute existing Members.',
    mandatory_pro_rata: 'Subject to the procedures of this Article V, the Manager may, in the Manager\u2019s discretion, from time to time issue a Capital Call requiring the Members to make Additional Capital Contributions to the Company on a pro rata basis in proportion to the Members\u2019 respective Percentage Interests (or as among the Members of any affected Class, in proportion to the Members\u2019 respective Percentage Interests within such Class).',
    conditional: 'No Member shall be required to make any Additional Capital Contribution except upon the occurrence of a specified contingency, including (a) a cash shortfall in the operations of the Company that the Manager reasonably determines cannot be funded out of Available Cash, third-party financing, or reserves; (b) a requirement imposed by a senior lender of the Company under the terms of a loan or credit agreement; or (c) a tax or regulatory obligation of the Company that the Manager reasonably determines cannot be funded out of available means. Upon the occurrence of any such contingency, the Manager may issue a Capital Call as set forth in this Article V.'
  })[d.additionalCapitalMode] || 'No Member shall be required to make any Additional Capital Contribution except as expressly provided in this Article V.';

  const capCallMechText = ({
    manager_discretion: 'The Manager shall determine, in the Manager\u2019s sole and reasonable discretion, the amount and timing of any Capital Call, subject to compliance with Section&nbsp;5.4.',
    majority_consent: 'No Capital Call may be issued without the prior written consent of a Majority in Interest of the Members.',
    supermajority_consent: 'No Capital Call may be issued without the prior written consent of Members holding at least 66 2/3% of the Percentage Interests.',
    lender_required: 'Capital Calls shall be limited to those amounts the Manager determines are required to be funded by capital contribution under the terms of any loan or credit agreement of the Company with a senior lender.'
  })[d.capitalCallMechanism] || '';

  // Default remedies
  const dilutionText = d.defaultDilution ? `<div class="section"><strong>(__L__) Punitive Dilution.</strong> The Manager may reduce the Defaulting Member\u2019s Percentage Interest by an amount equal to (i) the unfunded portion of the Capital Call attributable to the Defaulting Member, multiplied by (ii) ${escapeHtml(d.dilutionMultiplier || '2.0')}, expressed as a percentage of the aggregate Capital Contributions of all Members (after giving effect to the Capital Call). The dilution effected pursuant to this clause shall be reallocated pro rata among the Non-Defaulting Members in proportion to their Percentage Interests.</div>` : '';

  const loanText = d.defaultLoan ? (() => {
    const rateText = ({
      prime_plus_5: 'Prime Rate plus five percent (5%) per annum',
      prime_plus_8: 'Prime Rate plus eight percent (8%) per annum',
      '20': 'twenty percent (20%) per annum',
      '25': 'twenty-five percent (25%) per annum',
      max_legal: 'the maximum rate permitted by applicable law'
    })[d.defaultLoanRate] || 'twenty-five percent (25%) per annum';
    return `<div class="section"><strong>(__L__) Default Loan with Priority Return.</strong> The Manager may permit one or more Non-Defaulting Members to advance to the Company the unfunded portion of the Capital Call (the &ldquo;<strong>Default Loan</strong>&rdquo;). Any Default Loan shall (i) bear interest at the rate of ${rateText}, compounded monthly; (ii) be evidenced by a promissory note in form and substance reasonably satisfactory to the lending Member; and (iii) be repaid by the Company, together with all accrued and unpaid interest, in priority to any Distributions to any Member under Article VII (other than mandatory Tax Distributions). The lending Member may, in its sole discretion, elect at any time to convert the unpaid balance of a Default Loan into additional Units of the same Class as held by the lending Member, in which case the conversion shall be effected at an amount per Unit equal to (x) the aggregate Capital Contributions of such Class divided by (y) the number of Units of such Class then outstanding.</div>`;
  })() : '';

  const forfeitureText = d.defaultForfeiture ? `<div class="section"><strong>(__L__) Forfeiture of Profits Interests.</strong> Any unvested or unsold profits interest held by the Defaulting Member (including any Class C interest or other class designated as a profits interest) shall, at the election of the Manager, be forfeited in whole or in part by the Defaulting Member and reallocated pro rata to the Non-Defaulting Members or to such other Persons as the Manager may designate.</div>` : '';

  const forcedSaleText = d.defaultForcedSale ? `<div class="section"><strong>(__L__) Forced Sale.</strong> The Manager may, on behalf of the Company and the Non-Defaulting Members, compel a forced sale of the Defaulting Member\u2019s Membership Interest. The forced-sale price shall equal seventy-five percent (75%) of the Fair Market Value of the Defaulting Member\u2019s Membership Interest as of the date of the original Capital Call, as determined by the Manager in good faith. The Non-Defaulting Members shall have the right, but not the obligation, to purchase the Defaulting Member\u2019s Membership Interest at such forced-sale price, pro rata in accordance with their Percentage Interests. If the Non-Defaulting Members decline in whole or in part, the Manager may sell the unsold portion to any third party at a price not less than the forced-sale price.</div>` : '';

  const lossVotingText = d.defaultLossVoting ? `<div class="section"><strong>(__L__) Loss of Consent and Voting Rights.</strong> During the continuance of any uncured default by the Defaulting Member, the Defaulting Member shall have no right to vote, consent, approve, or participate in any decision-making of the Company, and the Defaulting Member\u2019s Membership Interest shall be disregarded for purposes of calculating the Percentage Interests required for any vote, consent, or approval.</div>` : '';

  // Remedies are lettered in the order they appear (a), (b), ... regardless of
  // which ones are on. Capital-call machinery (5.3-5.6) applies only where the
  // Members can actually be called; under "none" or "permissive" those sections
  // are reserved so the agreement does not describe a default that cannot occur.
  let remL = 0;
  const remedies = [dilutionText, loanText, forfeitureText, forcedSaleText, lossVotingText].filter(Boolean)
    .map((h) => h.replace('(__L__)', '(' + String.fromCharCode(97 + (remL++)) + ')')).join('');
  const callsAuthorized = d.additionalCapitalMode === 'mandatory_pro_rata' || d.additionalCapitalMode === 'conditional';
  const reservedCalls = `<div class="section"><strong>Section&nbsp;5.3 Capital Calls.</strong> No Capital Call may be made under this Agreement. Additional Capital Contributions, if any, are governed exclusively by Section&nbsp;5.2, and no Member shall be in default for declining to make one.</div>
<div class="section"><strong>Section&nbsp;5.4 [Reserved].</strong></div>
<div class="section"><strong>Section&nbsp;5.5 [Reserved].</strong></div>
<div class="section"><strong>Section&nbsp;5.6 [Reserved].</strong></div>`;
  return `<div class="article"><p class="article-heading">ARTICLE V &mdash; CAPITAL CONTRIBUTIONS</p>
<div class="section"><strong>Section&nbsp;5.1 Initial Capital Contributions.</strong> Each Member shall make the Initial Capital Contribution set forth opposite such Member\u2019s name on Schedule A, on or about the Effective Date. Initial Capital Contributions may consist of cash, securities, real property, personal property, services rendered, or such other consideration as the Manager and the contributing Member may agree, valued at Gross Asset Value as of the date of contribution. The Gross Asset Value of any non-cash Initial Capital Contribution shall be determined by mutual agreement of the contributing Member and the Manager, and shall be reflected on Schedule A.</div>
<div class="section"><strong>Section&nbsp;5.2 Additional Capital Contributions.</strong> ${addlCapText}</div>
${callsAuthorized ? `<div class="section"><strong>Section&nbsp;5.3 Capital Call Mechanism.</strong> ${capCallMechText}</div>
<div class="section"><strong>Section&nbsp;5.4 Notice of Capital Call.</strong> Any Capital Call shall be delivered in writing to each Member required (or permitted) to participate in such Capital Call, and shall set forth: (a) the aggregate amount of the Capital Call; (b) the amount attributable to each Member; (c) the funding date, which shall be not less than ${escapeHtml(d.capitalCallNotice || '15')} days after the date the notice is delivered; (d) the wire instructions or other payment method for funding; and (e) a description of the purpose and intended use of the Capital Call. A form of Capital Call Notice is attached as <em>Exhibit&nbsp;D</em>.</div>
<div class="section"><strong>Section&nbsp;5.5 Default; Cure Period.</strong> If any Member fails to fund all or any portion of such Member\u2019s required Additional Capital Contribution by the funding date specified in the Capital Call Notice (a &ldquo;<strong>Default</strong>&rdquo;), such Member (the &ldquo;<strong>Defaulting Member</strong>&rdquo;) shall have a cure period of ${escapeHtml(d.curePeriod || '10')} days from the original funding date within which to cure such Default by full payment of the unfunded amount together with interest accrued thereon at the rate of fifteen percent (15%) per annum from the original funding date. If the Default is not so cured within the cure period, the Manager may, on behalf of the Company and the Non-Defaulting Members, invoke any combination of the remedies set forth in Section&nbsp;5.6 in the Manager\u2019s sole discretion.</div>
<div class="section"><strong>Section&nbsp;5.6 Remedies for Default.</strong> Subject to Section&nbsp;5.5 and notwithstanding any other provision of this Agreement, upon any uncured Default the Manager may, in the Manager\u2019s sole discretion, on behalf of the Company and the Non-Defaulting Members, invoke any one or more of the following remedies, which remedies shall be cumulative and not exclusive of any other rights or remedies available under this Agreement, at law, or in equity:</div>
${remedies}` : reservedCalls}
<div class="section"><strong>Section&nbsp;5.7 No Interest; No Right to Return.</strong> No Member shall be entitled to interest on or return of any Capital Contribution except as expressly provided in this Agreement. A Member\u2019s Capital Account shall not be deemed an obligation of the Company or any other Member to make any payment to such Member.</div>
<div class="section"><strong>Section&nbsp;5.8 No Personal Liability.</strong> No Member shall be personally liable for the return of any Capital Contributions of any Member, it being expressly agreed that any such return shall be made solely from the assets of the Company.</div>
<div class="section"><strong>Section&nbsp;5.9 Withdrawal.</strong> Except as expressly provided in Section&nbsp;4.7, no Member shall be entitled to withdraw any portion of its Capital Contribution or its Capital Account from the Company prior to the dissolution and winding up of the Company.</div>
</div>`;
}
function buildArticleVI_Allocations(d, J) {
  // Targeted vs PIPCA alternative drafting
  const isTargeted = d.allocationMethod === 'targeted';
  const isPIPCA = d.allocationMethod === 'pipca' || d.allocationMethod === 'pipca_qio_only';

  // Targeted allocation block
  const targetedBlock = `<div class="section"><strong>Section&nbsp;6.3 Allocations of Profits and Losses (Targeted Capital Account Method).</strong> After giving effect to the special allocations of Section&nbsp;6.4 and the regulatory allocations of Section&nbsp;6.5, all Profits and Losses for each Fiscal Year (and each item of income, gain, loss, and deduction taken into account in computing Profits and Losses) shall be allocated among the Members in such manner that, as of the end of such Fiscal Year, the Capital Account balance of each Member, increased by such Member\u2019s share of Minimum Gain and Member Nonrecourse Debt Minimum Gain, is, as closely as possible, equal to the amount that would be distributed to such Member if (a) the Company sold all of its assets for an amount equal to their respective Book Values; (b) all Company liabilities were satisfied (limited, with respect to each Nonrecourse Liability, to the Book Value of the assets securing such Nonrecourse Liability); and (c) the resulting net proceeds were distributed to the Members in accordance with the priorities and amounts that would apply under Article VII (a &ldquo;<strong>Hypothetical Liquidation</strong>&rdquo;). The Manager shall make such allocations of items of income, gain, loss, and deduction (including, if necessary, items of gross income and gross deduction) as the Manager determines in good faith are necessary or appropriate to achieve the target Capital Account balances described in this Section&nbsp;6.3. The allocations of Profits and Losses under this Section&nbsp;6.3 are intended to comply with the principles of Code Section&nbsp;704(b) and the Regulations thereunder under the "targeted capital accounts" method and to reflect the economic deal among the Members as set forth in Article VII.</div>`;

  // PIPCA allocation block
  const droLang = (() => {
    if (d.droTreatment === 'full_dro') return 'Each Member is unconditionally obligated to restore any deficit balance in such Member\u2019s Capital Account upon liquidation of such Member\u2019s Membership Interest or upon liquidation of the Company, in accordance with Regulations Section&nbsp;1.704-1(b)(2)(ii)(b)(3) (a &ldquo;<strong>Deficit Restoration Obligation</strong>&rdquo;).';
    if (d.droTreatment === 'partial_dro') return 'Each Member is obligated to restore any deficit balance in such Member\u2019s Capital Account upon liquidation of such Member\u2019s Membership Interest or upon liquidation of the Company, but only up to a specified dollar amount per Member as separately agreed by such Member and the Manager in writing (the &ldquo;<strong>Limited DRO Amount</strong>&rdquo;), in accordance with Regulations Section&nbsp;1.704-1(b)(2)(ii)(b)(3). The agreement of any Member to a Limited DRO Amount shall be set forth on Schedule A (or an amendment thereto) and shall be communicated to the Company\u2019s lenders and tax preparers.';
    return 'No Member has any obligation to restore any deficit balance in such Member\u2019s Capital Account, and the alternate test for economic effect set forth in Regulations Section&nbsp;1.704-1(b)(2)(ii)(d) (the &ldquo;<strong>Alternate Test</strong>&rdquo;) shall apply, requiring the inclusion of a Qualified Income Offset as set forth in Section&nbsp;6.5(a).';
  })();
  const pipcaBlock = `<div class="section"><strong>Section&nbsp;6.3 Allocations of Profits and Losses (PIPCA).</strong> Subject to Section&nbsp;6.4 and Section&nbsp;6.5, all Profits and Losses for each Fiscal Year (and each item of income, gain, loss, and deduction taken into account in computing Profits and Losses) shall be allocated among the Members in accordance with their respective Percentage Interests (or, in the case of any item allocated to a particular Class, in accordance with the holders\u2019 respective Percentage Interests in such Class), as the Manager determines is necessary or appropriate to produce the economic results set forth in Article VII. The Company\u2019s allocations are intended to comply with Code Section&nbsp;704(b) and the Regulations thereunder, including the "substantial economic effect" safe harbor and the "partners\u2019 interests in the partnership" backstop test, with liquidation distributions to be made in accordance with positive Capital Account balances pursuant to Article XIII. ${droLang}</div>`;

  // Regulatory allocations (Section 6.5), in the order the Regulations require
  // them to be applied: minimum gain chargebacks first (Reg. 1.704-2(f) and (i)(4)
  // apply "before any other allocation"), then the offset and gross-income
  // allocations, then nonrecourse deductions, then the curative allocation.
  // Lettered in the order they appear.
  const regAllocs = [];
  if (d.regMinGainChargeback) regAllocs.push(`<div class="section"><strong>(__L__) Minimum Gain Chargeback.</strong> Except as provided in Regulations Section&nbsp;1.704-2(f)(2)–(5), if there is a net decrease in Minimum Gain during any Fiscal Year, each Member shall be specially allocated items of Company income and gain for such Fiscal Year (and, if necessary, subsequent Fiscal Years) in an amount equal to such Member\u2019s share of the net decrease in Minimum Gain, as determined in accordance with Regulations Section&nbsp;1.704-2(g).</div>`);
  if (d.regPartnerMinGain) regAllocs.push(`<div class="section"><strong>(__L__) Member Nonrecourse Debt Minimum Gain Chargeback.</strong> Except as provided in Regulations Section&nbsp;1.704-2(i)(4), if there is a net decrease in Member Nonrecourse Debt Minimum Gain attributable to a Member Nonrecourse Debt during any Fiscal Year, each Member with a share of the Member Nonrecourse Debt Minimum Gain attributable to such Member Nonrecourse Debt as of the beginning of the Fiscal Year shall be specially allocated items of Company income and gain for such Fiscal Year (and, if necessary, subsequent Fiscal Years) in an amount equal to such Member\u2019s share of the net decrease, as determined in accordance with Regulations Section&nbsp;1.704-2(i)(4).</div>`);
  if (d.regQio) regAllocs.push(`<div class="section"><strong>(__L__) Qualified Income Offset.</strong> In the event any Member unexpectedly receives any adjustments, allocations, or distributions described in Regulations Section&nbsp;1.704-1(b)(2)(ii)(d)(4), (5), or (6), items of Company income and gain shall be specially allocated to such Member in an amount and manner sufficient to eliminate, as quickly as possible, any Adjusted Capital Account Deficit of such Member, as required by Regulations Section&nbsp;1.704-1(b)(2)(ii)(d), in accordance with the "qualified income offset" safe harbor.</div>`);
  if (d.regGrossIncome) regAllocs.push(`<div class="section"><strong>(__L__) Gross Income Allocation.</strong> If any Member has an Adjusted Capital Account Deficit at the end of any Fiscal Year that is in excess of the amount such Member is deemed obligated to restore pursuant to the penultimate sentences of Regulations Sections&nbsp;1.704-2(g)(1) and 1.704-2(i)(5), each such Member shall be specially allocated items of Company income and gain in the amount of such excess as quickly as possible, provided that the allocation pursuant to this Section&nbsp;6.5(f) shall be made only if and to the extent that such Member would have an Adjusted Capital Account Deficit after all other allocations provided for in this Article VI have been tentatively made as if Section&nbsp;6.5(a) and this Section&nbsp;6.5(f) were not in this Agreement.</div>`);
  if (d.regNonrecourseDeductions) regAllocs.push(`<div class="section"><strong>(__L__) Nonrecourse Deductions.</strong> Nonrecourse Deductions for any Fiscal Year shall be allocated among the Members ${({
    pro_rata_percentage_interests: 'pro rata in accordance with their Percentage Interests',
    profit_sharing_ratios: 'in accordance with their respective Profit Sharing Ratios as established by the Manager in good faith',
    custom: 'in accordance with such method as the Manager shall reasonably determine, which method shall satisfy Regulations Section&nbsp;1.704-2(b)(1)'
  })[d.nonrecourseAllocationMethod] || 'pro rata in accordance with their Percentage Interests'}.</div>`);
  if (d.regPartnerNonrecourseDed) regAllocs.push(`<div class="section"><strong>(__L__) Member Nonrecourse Deductions.</strong> Any Member Nonrecourse Deductions for any Fiscal Year shall be specially allocated to the Member(s) who bear the economic risk of loss with respect to the Member Nonrecourse Debt to which such Member Nonrecourse Deductions are attributable, in accordance with Regulations Section&nbsp;1.704-2(i)(1).</div>`);
  if (d.regCurative) regAllocs.push(`<div class="section"><strong>(__L__) Curative Allocations.</strong> The allocations set forth in the preceding clauses of this Section&nbsp;6.5 (the &ldquo;<strong>Regulatory Allocations</strong>&rdquo;) are intended to comply with certain requirements of Regulations Section&nbsp;1.704-1(b) and 1.704-2. Notwithstanding any other provision of this Article VI (other than the Regulatory Allocations), the Regulatory Allocations shall be taken into account in allocating other Profits, Losses, and items of income, gain, loss, and deduction among the Members so that, to the extent possible, the net amount of such allocations of other Profits, Losses, and other items and the Regulatory Allocations to each Member shall be equal to the net amount that would have been allocated to each such Member if the Regulatory Allocations had not occurred, all subject to the limitations of Regulations Sections&nbsp;1.704-2 and 1.704-1(b).</div>`);

  // Section 704(c) method
  const sec704cText = ({
    traditional: 'In accordance with Code Section&nbsp;704(c) and the Regulations thereunder, income, gain, loss, and deduction with respect to any property contributed to the capital of the Company shall, solely for federal income tax purposes, be allocated among the Members so as to take account of any variation between the adjusted basis of such property to the Company for federal income tax purposes and its initial Gross Asset Value, using the <em>traditional method</em> described in Regulations Section&nbsp;1.704-3(b).',
    curative: 'In accordance with Code Section&nbsp;704(c) and the Regulations thereunder, income, gain, loss, and deduction with respect to any property contributed to the capital of the Company shall, solely for federal income tax purposes, be allocated among the Members so as to take account of any variation between the adjusted basis of such property to the Company for federal income tax purposes and its initial Gross Asset Value, using the <em>traditional method with curative allocations</em> described in Regulations Section&nbsp;1.704-3(c). Curative allocations shall be made on a property-by-property basis as the Manager determines in good faith is necessary to offset the effect of the ceiling rule with respect to the affected property.',
    remedial: 'In accordance with Code Section&nbsp;704(c) and the Regulations thereunder, income, gain, loss, and deduction with respect to any property contributed to the capital of the Company shall, solely for federal income tax purposes, be allocated among the Members so as to take account of any variation between the adjusted basis of such property to the Company for federal income tax purposes and its initial Gross Asset Value, using the <em>remedial allocation method</em> described in Regulations Section&nbsp;1.704-3(d).',
    manager_election: 'In accordance with Code Section&nbsp;704(c) and the Regulations thereunder, income, gain, loss, and deduction with respect to any property contributed to the capital of the Company shall, solely for federal income tax purposes, be allocated among the Members so as to take account of any variation between the adjusted basis of such property to the Company for federal income tax purposes and its initial Gross Asset Value, using such method (traditional, traditional with curative allocations, or remedial) as the Manager shall reasonably determine on a property-by-property basis pursuant to Regulations Section&nbsp;1.704-3.'
  })[d.section704cMethod] || '';

  // Revaluation events
  const revalText = ({
    standard: 'Upon the occurrence of any event described in Regulations Section&nbsp;1.704-1(b)(2)(iv)(f), including (i) the contribution of money or other property to the Company by a new or existing Member as consideration for an interest in the Company; (ii) the distribution of money or other property by the Company to a retiring or continuing Member as consideration for an interest in the Company; (iii) the liquidation of the Company within the meaning of Regulations Section&nbsp;1.704-1(b)(2)(ii)(g); or (iv) the grant of an interest in the Company (other than a <em>de minimis</em> interest) as consideration for the provision of services to or for the benefit of the Company by an existing Member or new Member, the Capital Accounts of the Members and the Book Value of the Company\u2019s assets shall be adjusted (a "Revaluation").',
    expanded: 'In addition to the events described in Regulations Section&nbsp;1.704-1(b)(2)(iv)(f), the Manager may, in the Manager\u2019s reasonable discretion, cause the Capital Accounts of the Members and the Book Value of the Company\u2019s assets to be adjusted upon the occurrence of any other event for which the Manager determines, in good faith, that a Revaluation is necessary or appropriate to reflect the relative economic interests of the Members.',
    manager_discretion: 'The Manager shall determine, in the Manager\u2019s reasonable discretion, when to effect a Revaluation, in accordance with the principles of Regulations Section&nbsp;1.704-1(b)(2)(iv)(f).'
  })[d.revaluationEvents] || '';

  return `<div class="article"><p class="article-heading">ARTICLE VI &mdash; CAPITAL ACCOUNTS; ALLOCATIONS</p>
<div class="section"><strong>Section&nbsp;6.1 Capital Accounts.</strong> A separate Capital Account shall be maintained for each Member in accordance with Code Section&nbsp;704(b) and Regulations Section&nbsp;1.704-1(b)(2)(iv). Each Member\u2019s Capital Account shall be increased by (a) the amount of cash and the Gross Asset Value of any property contributed by such Member to the Company; (b) such Member\u2019s allocable share of Profits and any items of income or gain specially allocated under Sections&nbsp;6.4 and 6.5; and (c) the amount of any Company liabilities assumed by such Member or secured by property distributed to such Member by the Company. Each Member\u2019s Capital Account shall be decreased by (i) the amount of cash and the Gross Asset Value of any property distributed by the Company to such Member; (ii) such Member\u2019s allocable share of Losses and any items of expense or loss specially allocated under Sections&nbsp;6.4 and 6.5; and (iii) the amount of any liabilities of such Member assumed by the Company or secured by property contributed by such Member.</div>
<div class="section"><strong>Section&nbsp;6.2 Revaluations of Capital Accounts.</strong> ${revalText}</div>
${isTargeted ? targetedBlock : ''}
${isPIPCA ? pipcaBlock : ''}
<div class="section"><strong>Section&nbsp;6.4 Special Allocations.</strong> No special allocations of items of income, gain, loss, or deduction are provided for under this Agreement other than the Regulatory Allocations under Section&nbsp;6.5 and the tax allocations under Sections&nbsp;6.6 and 6.7. [Drafting note: any deal-specific special allocation &mdash; for example, of depreciation to a particular Class &mdash; must be added here by counsel and tested against Regulations Section&nbsp;1.704-1(b)(2)(iii) for substantiality.]</div>
<div class="section"><strong>Section&nbsp;6.5 Regulatory Allocations.</strong>${regAllocs.length ? ' Notwithstanding Section&nbsp;6.3, the following allocations shall be made in the following order before any other allocation under this Article VI:' : ' [None elected. Drafting note: an agreement that allocates other than strictly pro rata generally requires at least a minimum gain chargeback and qualified income offset to have allocations respected under Regulations Section&nbsp;1.704-1(b); counsel should confirm.]'}</div>
${(() => { let L = 0; return regAllocs.map((h) => h.replace('(__L__)', '(' + String.fromCharCode(97 + (L++)) + ')')).join(''); })()}
<div class="section"><strong>Section&nbsp;6.6 Section&nbsp;704(c) Allocations.</strong> ${sec704cText}</div>
<div class="section"><strong>Section&nbsp;6.7 Allocations for Tax Purposes.</strong> Except as provided in Section&nbsp;6.6, allocations of Company income, gain, loss, and deduction for federal, state, and local income tax purposes shall be allocated among the Members in the same manner as the corresponding allocations of Profits and Losses pursuant to Sections&nbsp;6.3, 6.4, and 6.5.</div>
<div class="section"><strong>Section&nbsp;6.8 Allocations in Respect of Transferred Interests.</strong> If any Membership Interest is Transferred during any Fiscal Year, then for purposes of allocating Profits and Losses (and items thereof) under this Article VI for such Fiscal Year, the Members\u2019 respective Percentage Interests, and the items of income, gain, loss, deduction, and credit attributable to the Transferred Interest, shall be determined under any reasonable method selected by the Manager in accordance with Code Section&nbsp;706 and the Regulations thereunder (including, as the Manager may elect, the interim closing of the books method or the proration method).</div>
<div class="section"><strong>Section&nbsp;6.9 Compliance.</strong> The provisions of this Article VI are intended to comply with Code Section&nbsp;704(b) and the Regulations thereunder and shall be interpreted and applied in a manner consistent therewith. If the Manager determines that any provision of this Article VI does not comply with such Regulations, or that any other provision of this Article VI should be modified to comply with such Regulations, the Manager may amend this Article VI to effect such compliance, provided that no such amendment shall materially affect the economic deal among the Members reflected in Article VII without the consent of the Required Members under Schedule B.</div>
</div>`;
}
function buildArticleVII_Distributions(d, J) {
  // Build the distribution timing language
  const timingText = ({
    quarterly: 'within forty-five (45) days after the end of each calendar quarter',
    semi_annual: 'within forty-five (45) days after the end of each semi-annual period',
    annual: 'within ninety (90) days after the end of each Fiscal Year',
    manager_discretion: 'at such times and in such amounts as the Manager may determine in the Manager\u2019s reasonable discretion'
  })[d.distributionTiming] || 'at such times and in such amounts as the Manager may determine in the Manager\u2019s reasonable discretion';

  // Build the pref return text
  const prefCompoundText = ({
    simple: 'computed on a simple-interest basis',
    annual: 'compounded annually',
    quarterly: 'compounded quarterly',
    monthly: 'compounded monthly'
  })[d.prefReturnCompounding] || 'compounded annually';

  const prefCumText = d.prefReturnCumulative === 'cumulative' ?
    'on a cumulative basis (any unpaid amounts shall accrue and be paid in priority in subsequent periods)' :
    'on a non-cumulative basis (any amounts unpaid in a given period shall be permanently forfeited)';

  // Build the waterfall block based on type
  let waterfallSections = '';

  if (d.waterfallType === 'pro_rata') {
    waterfallSections = `
<div class="section"><strong>Section&nbsp;7.2 Pro Rata Distributions.</strong> All Distributions of Available Cash (other than Tax Distributions and Liquidating Distributions) shall be made to the Members pro rata in proportion to their respective Percentage Interests, without any preferred return, catch-up, or promote tier.</div>`;
  } else if (d.waterfallType === 'pref_then_split') {
    waterfallSections = `
<div class="section"><strong>Section&nbsp;7.2 Distribution Waterfall.</strong> Subject to Section&nbsp;7.5, all Distributions of Available Cash (other than Tax Distributions and Liquidating Distributions) shall be made in the following order of priority:</div>
<div class="section"><strong>(a) Tier 1 &mdash; Preferred Return.</strong> First, one hundred percent (100%) to the Preferred Members, pro rata in accordance with their respective accrued and unpaid Preferred Return, until the Preferred Members have received cumulative Distributions under this Tier 1 equal to the Preferred Return at a rate of ${(d.prefReturnRate * 100).toFixed(2)}% per annum on their respective Unrecovered Capital Contributions, ${prefCompoundText} and ${prefCumText}.</div>
<div class="section"><strong>(b) Tier 2 &mdash; Return of Capital.</strong> Second, one hundred percent (100%) to the Preferred Members, pro rata in accordance with their respective Unrecovered Capital Contributions, until the Unrecovered Capital Contributions of the Preferred Members have been reduced to zero.</div>
<div class="section"><strong>(c) Tier 3 &mdash; Pro Rata Split.</strong> Thereafter, to the Members pro rata in accordance with their Percentage Interests (without further preferred return).</div>`;
  } else if (d.waterfallType === 'full_re_waterfall' || d.waterfallType === 'european' || d.waterfallType === 'american_deal_by_deal' || d.waterfallType === 'custom') {
    // Build the promote tier ladder
    const tierBlocks = d.promoteTiers.map((t, i) => {
      const tierLabel = String.fromCharCode(101 + i); // (e), (f), (g)...
      const hurdleText = t.irrHurdle !== null && t.irrHurdle !== undefined ?
        `, until the Preferred Members have achieved an Internal Rate of Return on their Capital Contributions of ${(t.irrHurdle * 100).toFixed(2)}%` :
        ' (residual tier, no further hurdle)';
      return `<div class="section"><strong>(${tierLabel}) Promote Tier ${i + 1}.</strong> ${(t.lpShare * 100).toFixed(0)}% to the Preferred Members (pro rata in accordance with their Percentage Interests within the Preferred Class) and ${(t.gpShare * 100).toFixed(0)}% to the Common Members (or other Sponsor/Promote Class), pro rata in accordance with their Percentage Interests within such Class${hurdleText}.</div>`;
    }).join('');

    const catchupBlock = d.catchupPercent > 0 ?
      `<div class="section"><strong>(d) Tier 4 &mdash; GP Catch-Up.</strong> Fourth, ${(d.catchupPercent * 100).toFixed(0)}% to the Common Members (or other Sponsor/Promote Class) and the remainder (${((1 - d.catchupPercent) * 100).toFixed(0)}%) to the Preferred Members, pro rata within each Class, until the Common Members have received cumulative Distributions under this Tier 4 equal to the Common Members\u2019 target share of total promote (computed in accordance with the first Promote Tier\u2019s split below) of all Distributions made under Tier 1 (Preferred Return) and this Tier 4 (Catch-Up) combined.</div>` : '';

    const arch = d.waterfallType === 'european' ?
      '<div class="section"><em>Whole-Fund (European) Computation.</em> All Distributions under this Section&nbsp;7.2 shall be computed on a whole-fund basis: the order of priority and tier hurdles shall be tested with reference to aggregate Capital Contributions of and Distributions to all Members from the inception of the Company through the date of determination, without crediting amounts attributable to particular assets or transactions.</div>' :
      d.waterfallType === 'american_deal_by_deal' ?
      '<div class="section"><em>Deal-by-Deal (American) Computation.</em> Distributions under this Section&nbsp;7.2 shall, in the Manager\u2019s reasonable discretion, be computed on a deal-by-deal basis, with the priority tiers applied separately to the proceeds attributable to each individual investment or asset, subject to such clawback or other true-up mechanism as the Manager and Required Members may agree.</div>' : '';

    waterfallSections = `
<div class="section"><strong>Section&nbsp;7.2 Distribution Waterfall.</strong> Subject to Section&nbsp;7.5, all Distributions of Available Cash (other than Tax Distributions and Liquidating Distributions) shall be made in the following order of priority:</div>
<div class="section"><strong>(a) Tier 1 &mdash; Preferred Return.</strong> First, one hundred percent (100%) to the Preferred Members, pro rata in accordance with their Unrecovered Preferred Return Balances, until the Preferred Members have received cumulative Distributions under this Tier 1 equal to the Preferred Return at a rate of ${(d.prefReturnRate * 100).toFixed(2)}% per annum on their respective Unrecovered Capital Contributions, ${prefCompoundText} and ${prefCumText}.</div>
<div class="section"><strong>(b) Tier 2 &mdash; Return of Capital.</strong> Second, one hundred percent (100%) to the Preferred Members, pro rata in accordance with their respective Unrecovered Capital Contributions, until the Unrecovered Capital Contributions of the Preferred Members have been reduced to zero.</div>
<div class="section"><strong>(c) Tier 3 &mdash; Return of Common Capital.</strong> Third, one hundred percent (100%) to the Common Members, pro rata in accordance with their respective Unrecovered Capital Contributions, until the Unrecovered Capital Contributions of the Common Members have been reduced to zero.</div>
${catchupBlock}
${tierBlocks}
${arch}`;
  }

  // Liquidation method language
  const liqText = ({
    per_waterfall: 'Liquidating Distributions shall be made to the Members in the same order of priority and in the same manner as Distributions of Available Cash under Section&nbsp;7.2 (consistent with the operating distribution waterfall), without regard to the relative Capital Account balances of the Members.',
    per_capital_accounts: 'Liquidating Distributions shall be made to the Members in proportion to, and to the extent of, the positive balances of their respective Capital Accounts, after giving effect to all allocations of Profits, Losses, and special items under Article VI for the Fiscal Year ending on the date of liquidation. Allocations of Profits, Losses, and special items shall be drafted and applied so as to cause Capital Account balances at liquidation to mirror the priorities and amounts that would otherwise be distributable under the operating waterfall in Section&nbsp;7.2 (the "forcing" approach).'
  })[d.liquidationMethod] || '';
  // Allocation method and liquidation method have to agree. PIPCA (substantial
  // economic effect) requires liquidation per positive Capital Accounts; targeted
  // allocations are built to make the two converge, so either works there.
  const isPipcaAlloc = d.allocationMethod === 'pipca' || d.allocationMethod === 'pipca_qio_only';
  const liqNote = (isPipcaAlloc && d.liquidationMethod === 'per_waterfall')
    ? ' <em>[Drafting note: Article VI uses the PIPCA method, whose economic-effect safe harbor under Regulations Section&nbsp;1.704-1(b)(2)(ii)(b) requires liquidation in accordance with positive Capital Account balances. Liquidating per the waterfall is inconsistent with that election; counsel should select one.]</em>'
    : '';

  // Tax distribution provisions
  const taxDistText = (() => {
    if (d.taxDistributionsEnabled === 'none') {
      return '<div class="section"><strong>Section&nbsp;7.5 Tax Distributions.</strong> No Tax Distributions shall be required to be made under this Agreement.</div>';
    }
    const taxRate = ({
      '0.30': '30%', '0.40': '40%', '0.45': '45%', '0.50': '50%', '0.54': '54%', '0.55': '55%',
      custom: ((Number(d.assumedTaxRateCustom) || 0).toFixed(1).replace(/\.0$/, '') + '%'),
      highest_marginal: 'the highest combined marginal federal, state, and local income tax rate applicable to any Member (as determined by the Manager in good faith, taking into account the character of the relevant income and the application of any deduction for state and local taxes)'
    })[d.assumedTaxRate] || '50%';
    const mandatory = d.taxDistributionsEnabled === 'mandatory';
    const advanceText = d.taxDistributionTreatment === 'advance' ?
      'Each Tax Distribution to a Member shall be treated as an advance against, and shall reduce on a dollar-for-dollar basis, the next succeeding Distributions otherwise payable to such Member under Section&nbsp;7.2 and Section&nbsp;7.4 (so that the cumulative Distributions to such Member under this Agreement, taking into account Tax Distributions, equal the amounts otherwise payable under the waterfall).' :
      'Tax Distributions shall be in addition to, and shall not be credited against, any other Distributions payable to a Member under Section&nbsp;7.2 or Section&nbsp;7.4.';
    return `<div class="section"><strong>Section&nbsp;7.5 Tax Distributions.</strong> ${mandatory ? 'The Manager shall' : 'The Manager may, in the Manager\u2019s reasonable discretion,'} cause the Company to distribute to each Member, within forty-five (45) days following the end of each calendar quarter, an amount in cash equal to such Member\u2019s Tax Distribution Amount for such quarter. For purposes of this Agreement, the &ldquo;<strong>Tax Distribution Amount</strong>&rdquo; means, with respect to any Member for any period, the product of (a) the Assumed Tax Rate, multiplied by (b) the net taxable income allocated to such Member for such period (taking into account, in the Manager\u2019s reasonable discretion, prior cumulative tax losses allocated to such Member that have not been previously absorbed). The &ldquo;<strong>Assumed Tax Rate</strong>&rdquo; shall be ${taxRate}. ${advanceText} Tax Distributions shall be made on a pro rata basis among the Members (in proportion to their respective Tax Distribution Amounts) to the extent of Available Cash. To the extent the Company does not have sufficient Available Cash to make Tax Distributions in full, the unfunded amount shall be deferred to the next succeeding period and paid in priority over any non-Tax Distributions under Section&nbsp;7.2.</div>`;
  })();

  return `<div class="article"><p class="article-heading">ARTICLE VII &mdash; DISTRIBUTIONS</p>
<div class="section"><strong>Section&nbsp;7.1 Available Cash; Timing.</strong> Distributions of Available Cash shall be made to the Members ${timingText}, in such amounts as the Manager shall determine in the Manager\u2019s reasonable discretion, subject to compliance with ${cite(J, 'distLimit')} of the Act and any restrictions imposed by any agreement to which the Company is a party (including any loan, credit, or other financing agreement). The Manager shall determine in good faith the amount of Available Cash for any period, taking into account anticipated Company expenses, capital expenditures, debt service, taxes, reserves, and other foreseeable obligations of the Company. Nothing in this Agreement shall be construed to require the Company to maintain any particular reserve or to limit the Manager\u2019s discretion to retain or distribute Available Cash, except as expressly provided in this Article VII.</div>
${waterfallSections}
<div class="section"><strong>Section&nbsp;7.3 IRR Computation.</strong> For purposes of determining whether any IRR hurdle in Section&nbsp;7.2 has been achieved, IRR shall be computed in accordance with the definition set forth in Article I, on a ${({ cash_on_cash: 'cash-on-cash', time_weighted: 'time-weighted', moic_only: 'multiple-of-invested-capital' })[d.irrBasis] || 'cash-on-cash'} basis, using the Manager\u2019s good-faith determination, which shall be binding on all Members absent manifest error. ${d.irrBasis === 'moic_only' ? '(Notwithstanding any other provision of this Article VII, the parties have elected an MOIC-only test in lieu of IRR-based hurdles; the hurdle in each promote tier shall be interpreted as a multiple of invested capital rather than an internal rate of return as specifically calibrated by the Manager.)' : ''}</div>
<div class="section"><strong>Section&nbsp;7.4 Liquidating Distributions.</strong> Upon the dissolution and winding up of the Company pursuant to Article XIII, after payment of, or provision for, the debts and liabilities of the Company in accordance with ${cite(J, 'dissolPriority')} of the Act, the Liquidator shall distribute the remaining assets of the Company as follows: ${liqText}${liqNote}</div>
${taxDistText}
<div class="section"><strong>Section&nbsp;7.6 Withholding.</strong> The Company is authorized to withhold from any Distribution or allocation to any Member any amount required to be withheld under the Code or any other applicable federal, state, local, or foreign tax law (including, without limitation, Code Sections&nbsp;1441, 1442, 1445, 1446, and 1471 through 1474), and any amount so withheld shall be treated as a Distribution to such Member for all purposes of this Agreement. The Manager may, in the Manager\u2019s discretion, require any Member to provide such certifications, documentation, or other evidence as the Manager may reasonably request to establish such Member\u2019s status for withholding-tax purposes.</div>
<div class="section"><strong>Section&nbsp;7.7 Limitation on Distributions.</strong> Notwithstanding any other provision of this Agreement, no Distribution shall be made to any Member if such Distribution would (a) violate ${cite(J, 'distLimit')} of the Act, (b) cause the Company to be insolvent (in either an equity or balance-sheet sense), or (c) violate any covenant or restriction in any loan, credit, or other financing agreement to which the Company is a party.</div>
<div class="section"><strong>Section&nbsp;7.8 Distributions in Kind.</strong> No Member shall be entitled to demand any Distribution in kind. The Manager may, in the Manager\u2019s reasonable discretion, distribute property other than cash in connection with a Liquidation Event, in which case (i) the Fair Market Value of such property shall be determined by the Manager in good faith; (ii) the property shall be deemed to have been sold by the Company for its Fair Market Value immediately prior to such distribution, and the resulting Profit or Loss shall be allocated among the Members pursuant to Article VI; and (iii) the property shall be distributed to the Members entitled thereto under Section&nbsp;7.2 or Section&nbsp;7.4 as though such Fair Market Value had been distributed in cash.</div>
</div>`;
}
function buildArticleVIII_TaxMatters(d, J) {
  // Tax classification
  const taxClassText = ({
    partnership: 'The Company shall be classified as a partnership for U.S. federal income tax purposes under Subchapter K of the Code, and the Members and the Manager shall not take any action to cause the Company to be treated as anything other than a partnership for such purposes (including, without limitation, by filing an entity-classification election on Form 8832).',
    s_corp: 'The Company shall make a timely election to be classified as an S corporation for U.S. federal income tax purposes by filing Form 2553. Each Member represents and warrants that such Member is eligible to be a shareholder of an S corporation, and each Member shall take such actions as are reasonably necessary to maintain the Company\u2019s S corporation status.',
    c_corp: 'The Company shall file Form 8832 to elect to be classified as an association taxable as a C corporation for U.S. federal income tax purposes.'
  })[d.taxClassification] || '';

  // §754 election
  const sec754Text = ({
    mandatory_make: 'The Company shall make a valid and timely election under Code Section&nbsp;754 effective for the first taxable year of the Company. Once made, such election shall remain in effect in accordance with Code Section&nbsp;754.',
    manager_discretion: 'The Manager may, in the Manager\u2019s reasonable discretion, cause the Company to make an election under Code Section&nbsp;754, taking into account the benefits and burdens of such election for the Members.',
    member_request: 'Upon the written request of any Member who acquires a Membership Interest by purchase, transfer, or upon the death of another Member, the Manager shall cause the Company to make a valid and timely election under Code Section&nbsp;754 effective for the taxable year in which the relevant event occurs. The cost of preparing the basis-adjustment computations under Code Sections&nbsp;743 and 734 shall be borne by the requesting Member, except as the Manager may otherwise reasonably determine.',
    no_election: 'The Company shall not make a discretionary election under Code Section&nbsp;754, except that the Company shall comply with the mandatory basis-adjustment provisions of Code Section&nbsp;743(b) (regarding substantial built-in losses) and Code Section&nbsp;734(b) as in effect from time to time.'
  })[d.section754Election] || '';

  // §752 method
  const sec752Text = ({
    profit_sharing_ratios: 'For purposes of Regulations Section&nbsp;1.752-3(a)(3), excess nonrecourse liabilities of the Company shall be allocated among the Members in accordance with their respective shares of Company profits and gains, as determined by the Manager in good faith.',
    significant_item: 'For purposes of Regulations Section&nbsp;1.752-3(a)(3), excess nonrecourse liabilities of the Company shall be allocated among the Members in a manner that reflects the Members\u2019 shares of one or more significant items of partnership income or gain, as determined by the Manager in good faith.',
    alternative: 'For purposes of Regulations Section&nbsp;1.752-3(a)(3), excess nonrecourse liabilities of the Company shall be allocated among the Members using the alternative method permitted by such Regulation.',
    additional_method: 'For purposes of Regulations Section&nbsp;1.752-3(a)(3), excess nonrecourse liabilities of the Company shall be allocated among the Members using the additional method permitted by such Regulation as in effect from time to time.'
  })[d.section752Method] || '';

  // §465 qualified nonrecourse
  const qnText = d.qualifiedNonrecourseMethod === 'real_estate_special_rule' ?
    'For purposes of Code Section&nbsp;465 and the at-risk rules thereunder, qualified nonrecourse financing of the Company (as defined in Code Section&nbsp;465(b)(6)) shall be treated as financing with respect to which Members are personally at risk, in accordance with the special rule applicable to real estate activities.' :
    'For purposes of Code Section&nbsp;465 and the at-risk rules thereunder, a Member shall be considered at risk only to the extent of such Member\u2019s personal liability with respect to Company debt, in accordance with the general rule of Code Section&nbsp;465.';

  // BBA Partnership Representative
  const prText = ({
    manager: 'The Manager (or such other Person as the Manager may designate from time to time) is hereby designated as the &ldquo;<strong>Partnership Representative</strong>&rdquo; of the Company for purposes of Code Section&nbsp;6223 and Regulations Section&nbsp;301.6223-1.',
    specific_member: `${escapeHtml(d.members[0] && d.members[0].name || '[Named Member]')} is hereby designated as the &ldquo;<strong>Partnership Representative</strong>&rdquo; of the Company for purposes of Code Section&nbsp;6223 and Regulations Section&nbsp;301.6223-1.`,
    third_party: 'An independent third party designated by the Manager (which, as of the Effective Date, shall be [Name of Outside CPA or Counsel]) is hereby designated as the &ldquo;<strong>Partnership Representative</strong>&rdquo; of the Company for purposes of Code Section&nbsp;6223 and Regulations Section&nbsp;301.6223-1. The Manager may replace the third-party Partnership Representative at any time and from time to time.',
    rotating: 'The Members shall serve in rotation as the &ldquo;<strong>Partnership Representative</strong>&rdquo; of the Company for purposes of Code Section&nbsp;6223 and Regulations Section&nbsp;301.6223-1, with each Member serving for a period of two consecutive Fiscal Years in the order set forth on Schedule A. The Manager shall coordinate the rotation in good faith.'
  })[d.bbaPrDesignation] || '';

  const diText = (d.bbaDesignatedIndividual && d.bbaPrDesignation !== 'specific_member') ?
    `<div class="section">If the Partnership Representative is an entity, the Designated Individual for such Partnership Representative shall be ${escapeHtml(d.bbaDesignatedIndividual)}, as required by Regulations Section&nbsp;301.6223-1. The Manager may, at any time, replace the Designated Individual upon written notice to the Members.</div>` : '';

  // Push-out election
  const pushOutText = ({
    mandatory_for_audits: 'For each audit adjustment under the BBA, the Partnership Representative shall make a timely "push-out" election under Code Section&nbsp;6226 (or any successor provision), passing the audit-year tax liability to the reviewed-year Members on a Member-by-Member basis, in accordance with Regulations Section&nbsp;301.6226-1.',
    manager_discretion: 'For each audit adjustment under the BBA, the Partnership Representative may, in the Partnership Representative\u2019s reasonable discretion, make a "push-out" election under Code Section&nbsp;6226, taking into account the relative benefits and burdens of such election for the Company and the Members.',
    no_election: 'The Partnership Representative shall not make a "push-out" election under Code Section&nbsp;6226 with respect to any audit adjustment, and the Company shall pay any imputed underpayment under Code Section&nbsp;6225 at the Company level.'
  })[d.pushOutElection] || '';

  // Tax year
  const tyText = ({
    calendar: 'The Company shall have a Fiscal Year ending December 31 (the calendar year).',
    fiscal_required: 'The Company\u2019s Fiscal Year shall be the required taxable year under Code Section&nbsp;706 (which may be the calendar year or such other period as Code Section&nbsp;706 requires).',
    majority_member: 'The Company shall have a Fiscal Year corresponding to the taxable year of the Member or Members holding a Majority in Interest, in accordance with Code Section&nbsp;706, unless and until the Manager determines otherwise.'
  })[d.taxYear] || '';

  // Accounting method
  const acctText = ({
    accrual: 'The Company shall use the accrual method of accounting for federal income tax purposes.',
    cash: 'The Company shall use the cash method of accounting for federal income tax purposes, to the extent eligible under Code Section&nbsp;448 and the Regulations thereunder.',
    manager_election: 'The Manager shall elect the method of accounting (cash, accrual, or other permitted method) for federal income tax purposes that the Manager determines, in the Manager\u2019s reasonable discretion, to be most appropriate.'
  })[d.accountingMethod] || '';

  return `<div class="article"><p class="article-heading">ARTICLE VIII &mdash; TAX MATTERS</p>
<div class="section"><strong>Section&nbsp;8.1 Federal Tax Classification.</strong> ${taxClassText}</div>
<div class="section"><strong>Section&nbsp;8.2 Tax Year and Accounting Method.</strong> ${tyText} ${acctText} All federal, state, local, and foreign tax returns and reports of the Company shall be prepared and filed by the Company at the Company\u2019s expense by such accountants or tax preparers as the Manager may select.</div>
<div class="section"><strong>Section&nbsp;8.3 Section&nbsp;704(c) Method.</strong> Cross-reference is made to Section&nbsp;6.6, which sets forth the Company\u2019s elected method for allocations under Code Section&nbsp;704(c).</div>
<div class="section"><strong>Section&nbsp;8.4 Section&nbsp;754 Election.</strong> ${sec754Text}</div>
<div class="section"><strong>Section&nbsp;8.5 Section&nbsp;752 Allocation of Liabilities.</strong> ${sec752Text}</div>
<div class="section"><strong>Section&nbsp;8.6 Section&nbsp;465 At-Risk Rule.</strong> ${qnText}</div>
<div class="section"><strong>Section&nbsp;8.7 Partnership Representative.</strong> ${prText} The Partnership Representative shall have the sole and exclusive authority to act on behalf of the Company in connection with any administrative or judicial proceeding under the BBA, and to bind the Company and all Members to any settlement, agreement, or decision in connection therewith. The Partnership Representative shall act in good faith and in the best interests of the Company and the Members in performing its duties under this Section&nbsp;8.7.</div>
${diText}
<div class="section"><strong>Section&nbsp;8.8 Push-Out Election under Code Section&nbsp;6226.</strong> ${pushOutText}</div>
<div class="section"><strong>Section&nbsp;8.9 Cooperation; Indemnification; Survival.</strong> Each Member shall cooperate with the Partnership Representative in connection with any audit or proceeding under the BBA, including by furnishing all information requested by the Partnership Representative concerning such Member\u2019s tax status and items of income, gain, loss, deduction, and credit. Each Member shall indemnify and hold harmless the Company, the Manager, and the Partnership Representative from any liability arising out of such Member\u2019s failure to comply with this Section&nbsp;8.9. The obligations of the Members under this Article VIII (including without limitation any payment, indemnification, or withholding obligations) shall survive the dissolution and winding up of the Company and the Transfer of any Membership Interest.</div>
<div class="section"><strong>Section&nbsp;8.10 Reporting.</strong> The Manager shall use commercially reasonable efforts to cause the Company to furnish each Member with such Schedule K-1s, K-3s (as applicable), and other tax-reporting documents as are necessary or appropriate to enable each Member to prepare its federal, state, local, and foreign income tax returns, within ninety (90) days after the close of each Fiscal Year (subject to extension as may be necessary in connection with the Company\u2019s tax-return preparation).</div>
<div class="section"><strong>Section&nbsp;8.11 Tax Elections.</strong> The Manager shall make, on behalf of the Company, all tax elections required or permitted to be made by the Company under the Code or any state, local, or foreign tax law, in such manner as the Manager determines, in the Manager\u2019s reasonable discretion, to be most beneficial to the Members in the aggregate. Notwithstanding the foregoing, any material tax election (other than annual elections in the ordinary course) shall be subject to the consent of the Required Members pursuant to Schedule B.</div>
</div>`;
}
function buildArticleIX_Management(d, J) {
  // Management structure
  const structureBlock = (() => {
    if (d.managementStructure === 'member_managed') {
      return `<div class="section"><strong>Section&nbsp;9.1 Member Management.</strong> The business and affairs of the Company shall be managed by the Members. Except as otherwise expressly provided in this Agreement, all decisions of the Members under this Agreement shall be made by Members holding a Majority in Interest. Each Member shall be deemed to have actual and apparent authority to bind the Company as an agent thereof, in accordance with ${cite(J, 'memberMgrAuth')} of the Act, except as restricted by this Agreement.</div>`;
    } else if (d.managementStructure === 'manager_managed') {
      return `<div class="section"><strong>Section&nbsp;9.1 Manager-Managed Company.</strong> The business and affairs of the Company shall be managed by the Manager, who shall have the sole and exclusive authority to conduct, direct, and manage the business and affairs of the Company, subject only to the limitations expressly set forth in this Agreement, including the consent rights of the Required Members for Major Decisions pursuant to Section&nbsp;9.5 and Schedule B. The initial Manager is ${escapeHtml(d.managerName || '[Manager Name]')}.</div>
<div class="section"><strong>Section&nbsp;9.2 Authority of Manager.</strong> Without limiting the generality of Section&nbsp;9.1, and subject to Section&nbsp;9.5 and Schedule B, the Manager shall have full power and authority to: (a) acquire, lease, finance, mortgage, refinance, sell, exchange, or otherwise dispose of property of the Company; (b) borrow money and incur indebtedness on behalf of the Company; (c) employ, retain, and terminate officers, employees, agents, contractors, and consultants of the Company; (d) enter into contracts and agreements on behalf of the Company; (e) institute, prosecute, defend, settle, compromise, or abandon legal proceedings on behalf of the Company; (f) maintain or close bank, brokerage, or other financial accounts on behalf of the Company; (g) cause the Company to make any tax election or filing under Article VIII (subject to Section&nbsp;9.5 and Schedule B for material elections); (h) cause the Company to organize or invest in subsidiaries or joint ventures; and (i) take all other actions reasonably necessary or appropriate to carry out the purposes of the Company.</div>`;
    } else if (d.managementStructure === 'board_managed') {
      const boardSz = d.boardSize || '5';
      return `<div class="section"><strong>Section&nbsp;9.1 Board of Managers.</strong> The business and affairs of the Company shall be managed by a Board of Managers (the &ldquo;<strong>Board</strong>&rdquo;), consisting of ${escapeHtml(boardSz)} individual Managers. The composition of the Board shall be as set forth on Schedule B; in the absence of specified designation, each Member holding at least ten percent (10%) of the Percentage Interests shall be entitled to designate one Manager, with any remaining Manager positions filled by Members holding a Majority in Interest acting collectively.</div>
<div class="section"><strong>Section&nbsp;9.2 Authority of the Board.</strong> The Board shall act by majority of the Managers present at any duly noticed and convened meeting at which a quorum (consisting of a majority of all Managers then in office) is present. The Board may also act by unanimous written consent in lieu of a meeting. The Board shall have the full powers of management set forth in Sections&nbsp;9.1 and 9.2 above with respect to a Manager-Managed Company, exercised collectively rather than individually. Individual Managers, except as expressly authorized by Board action, shall not have authority to bind the Company.</div>`;
    }
    return '';
  })();

  // Fiduciary duty modification — state-aware (DE/TX/NV/WY most permissive; FL/CO/GA/MD/NC/SD modified; MA/NY/NJ/CA/SC restrictive)
  const fidElimWarning = (() => {
    if (J.canEliminateFiduciaryDuty === 'full') return ''; // DE — no warning
    if (J.canEliminateFiduciaryDuty === 'broad') {
      return ` <em>NOTE:</em> ${J.name} law permits broad modification of fiduciary duties through the operating agreement; counsel should verify that the scope of waiver intended is enforceable under ${cite(J, 'fidElimSpecific')}.`;
    }
    if (J.canEliminateFiduciaryDuty === 'modified') {
      return ` <em>NOTE:</em> ${J.name} law permits modification of fiduciary duties but does <strong>not</strong> permit their elimination; the duty of loyalty (subject to specified safe-harbor activities), the duty of care, the implied covenant of good faith and fair dealing, and the obligation not to engage in willful misconduct or knowing violations of law cannot be eliminated. Counsel should reduce the elimination language to a "modified" standard pursuant to ${cite(J, 'fidElimSpecific')}.`;
    }
    // restricted: MA/NY/NJ/CA/SC
    return ` <em>WARNING:</em> ${J.name} does <strong>not</strong> permit elimination of fiduciary duties through the operating agreement. The duty of loyalty, the duty of care, the implied covenant of good faith and fair dealing, and any obligation to avoid willful misconduct cannot be waived. This elimination provision is <strong>likely unenforceable under ${J.name} law</strong> and should be removed or substantially modified by the firm before issuance.`;
  })();

  const fiduciaryText = ({
    default: `Each Manager (and, in the case of a Member-Managed Company, each Member acting in a management capacity) shall owe to the Company and to the other Members the fiduciary duties of loyalty and care to the extent provided by, and as the same may be modified by, this Agreement and the Act, including by reference to the principles set forth in ${cite(J, 'fiduciaryDuty')} of the Act. In all cases, the duty of good faith and fair dealing implied by the Act shall apply.`,
    eliminated_per_18_1101: `In accordance with ${cite(J, 'fidElimSpecific')} of the Act and to the maximum extent permitted by ${J.name} law, the Manager (and, in the case of a Member-Managed Company, each Member acting in a management capacity) shall not owe to the Company or to any Member any fiduciary or other duty (including the duty of loyalty and the duty of care), it being expressly intended that all such duties be eliminated, replaced, and superseded by the express provisions of this Agreement and the implied covenant of good faith and fair dealing (which the parties acknowledge cannot be waived under the Act). Without limiting the generality of the foregoing: (a) the Manager (and any Member or Affiliate thereof) may engage in any business, activity, or investment, including any business, activity, or investment that competes with or is similar to that of the Company, without any duty to offer or refer such opportunity to the Company or to any Member; (b) any conflict of interest arising in connection with the Manager\u2019s management of the Company shall be resolved by the Manager in good faith in accordance with this Agreement; and (c) no transaction between the Manager (or any Affiliate thereof) and the Company shall be voidable solely because the Manager has a financial interest therein, provided that the material terms of such transaction shall have been disclosed in writing to the Members.${fidElimWarning}`,
    modified_business_judgment: 'Each Manager (and, in the case of a Member-Managed Company, each Member acting in a management capacity) shall owe to the Company and to the other Members the duty to act in good faith and in a manner reasonably believed to be in the best interests of the Company, subject to a "business judgment rule" standard of review. No Manager shall be liable to the Company or any Member for any action taken or omitted in good-faith reliance on the business judgment rule, except for liability arising from intentional misconduct, fraud, or a knowing violation of law.',
    retained: 'Each Manager (and, in the case of a Member-Managed Company, each Member acting in a management capacity) shall owe to the Company and to the other Members the full fiduciary duties of loyalty and care at common-law levels, including the duty to act with the care of a person of ordinary prudence in similar circumstances and the duty to act in the best interests of the Company without regard to personal advantage.'
  })[d.fiduciaryDuties] || 'Each Manager (and, in the case of a Member-Managed Company, each Member acting in a management capacity) shall owe to the Company and to the other Members the fiduciary duties of loyalty and care provided by the Act, as modified by this Agreement to the extent the Act permits. In all cases, the implied contractual covenant of good faith and fair dealing shall apply.';

  // Major Decisions Schedule B
  const majorDecisionsList = [];
  if (d.majorDecisions.sale_assets) majorDecisionsList.push('Sale, exchange, or other disposition of all or substantially all of the Company\u2019s assets');
  if (d.majorDecisions.merger) majorDecisionsList.push('Merger, consolidation, or conversion of the Company');
  if (d.majorDecisions.dissolution) majorDecisionsList.push('Voluntary dissolution or winding up of the Company');
  if (d.majorDecisions.indebtedness) majorDecisionsList.push('Incurrence of indebtedness by the Company above a threshold to be specified in good faith by the Manager');
  if (d.majorDecisions.amend_oa) majorDecisionsList.push('Amendment of this Agreement, including any change to the rights, preferences, or privileges of any Class');
  if (d.majorDecisions.admit_member) majorDecisionsList.push('Admission of a new Member (other than a Permitted Transferee)');
  if (d.majorDecisions.tax_election) majorDecisionsList.push('Any material tax election or change in tax classification (other than annual elections in the ordinary course)');
  if (d.majorDecisions.affiliate_tx) majorDecisionsList.push('Any transaction between the Company and the Manager or any Affiliate thereof on terms other than arm\u2019s-length and disclosed in writing');
  if (d.majorDecisions.capital_call_threshold) majorDecisionsList.push('Any Capital Call above a threshold to be specified in good faith by the Manager');
  if (d.majorDecisions.change_business) majorDecisionsList.push('Change in the principal business purpose of the Company');

  const threshold = ({
    majority: 'Majority in Interest (more than fifty percent (50%) of Percentage Interests)',
    supermajority_66: 'Supermajority (at least 66 2/3% of Percentage Interests)',
    supermajority_75: 'Supermajority (at least 75% of Percentage Interests)',
    unanimous: 'Unanimous (100% of Percentage Interests)'
  })[d.majorDecisionThreshold] || 'Supermajority (at least 66 2/3% of Percentage Interests)';

  // Manager removal
  const removalText = ({
    cause_only: 'The Manager may be removed only for Cause, and only after written notice from the Required Members specifying the alleged Cause and a thirty (30) day cure period during which the Manager may dispute or cure the alleged Cause. Following the cure period, removal shall require the affirmative vote of Members holding a Majority in Interest.',
    cause_or_majority: 'The Manager may be removed (a) for Cause as described above, or (b) upon the affirmative vote of Members holding a Majority in Interest at any time, with or without Cause.',
    supermajority: 'The Manager may be removed upon the affirmative vote of Members holding at least 66 2/3% of the Percentage Interests held by Members other than the Manager and its Affiliates, at any time, with or without Cause.'
  })[d.managerRemoval] || '';

  return `<div class="article"><p class="article-heading">ARTICLE IX &mdash; MANAGEMENT</p>
${structureBlock}
<div class="section"><strong>Section&nbsp;9.3 Fiduciary Duties.</strong> ${fiduciaryText}</div>
<div class="section"><strong>Section&nbsp;9.4 Standard of Conduct.</strong> Subject to Section&nbsp;9.3, the Manager (and any Member acting in a management capacity, in a Member-Managed Company) shall (a) act in good faith and with the care a reasonably prudent person would exercise under like circumstances; (b) conduct the affairs of the Company in accordance with this Agreement, the Act, and applicable law; and (c) refrain from engaging in any willful misconduct or knowing violation of law in the conduct of the Company\u2019s affairs.</div>
<div class="section"><strong>Section&nbsp;9.5 Major Decisions.</strong> Notwithstanding any other provision of this Article IX, the Manager shall not take or cause the Company to take any of the actions listed on Schedule B (each a &ldquo;<strong>Major Decision</strong>&rdquo;) without the prior written consent of the Required Members at the threshold of a ${threshold}. Any action taken in violation of this Section&nbsp;9.5 shall be voidable at the election of any Required Member.</div>
<div class="section"><strong>Section&nbsp;9.6 Removal of Manager.</strong> ${removalText}</div>
<div class="section"><strong>Section&nbsp;9.7 Resignation of Manager.</strong> The Manager may resign upon thirty (30) days\u2019 prior written notice to the Members, provided that no such resignation shall be effective until a successor Manager has been duly designated by the Required Members at the threshold of a ${threshold} (or, if no successor has been designated within sixty (60) days following the notice of resignation, by a Majority in Interest of the Members).</div>
<div class="section"><strong>Section&nbsp;9.8 Compensation; Reimbursement.</strong> The Manager shall be entitled to reimbursement from the Company for all reasonable out-of-pocket expenses incurred in connection with the management of the Company. The Manager shall not be entitled to additional compensation for serving as Manager, except as may be expressly authorized by separate agreement between the Manager and the Company approved by the Required Members.</div>
<div class="section"><strong>Section&nbsp;9.9 Officers.</strong> The Manager may, from time to time, designate one or more individuals as officers of the Company (with such titles, authority, and duties as the Manager may specify), each of whom shall serve at the pleasure of the Manager and may be removed by the Manager at any time with or without cause. The designation of any officer of the Company shall not, in and of itself, confer any management authority on such officer other than as expressly delegated by the Manager.</div>
<div class="section"><strong>Section&nbsp;9.10 Reliance on Records, Reports, and Opinions.</strong> The Manager shall be entitled to rely in good faith upon the records of the Company and upon the reports, statements, and opinions of officers, employees, agents, attorneys, accountants, and other professionals selected with reasonable care, and shall not be liable to the Company or any Member for any action taken in good-faith reliance on such records, reports, statements, or opinions.</div>
</div>`;
}
function buildArticleX_BooksAndRecords(d, J) {
  return `<div class="article"><p class="article-heading">ARTICLE X &mdash; BOOKS, RECORDS, REPORTING, AND INSPECTION RIGHTS</p>
<div class="section"><strong>Section&nbsp;10.1 Books and Records.</strong> The Manager shall cause the Company to maintain complete and accurate books and records of the business and affairs of the Company at the principal office of the Company, including the records required to be maintained by ${cite(J, 'recordsInspect')} of the Act. The Company\u2019s books and records shall be maintained in accordance with the accounting method specified in Section&nbsp;8.2 of this Agreement and otherwise in accordance with sound accounting practices, consistently applied.</div>
<div class="section"><strong>Section&nbsp;10.2 Annual Reporting.</strong> Within one hundred twenty (120) days following the end of each Fiscal Year, the Manager shall cause the Company to furnish each Member with (a) annual financial statements of the Company (which need not be audited unless the Required Members so direct, the cost of which audit shall be borne by the Company); and (b) such Schedule K-1s and other tax-reporting documents as required by Article VIII.</div>
<div class="section"><strong>Section&nbsp;10.3 Interim Reporting.</strong> Upon the written request of any Member, the Manager shall promptly furnish such Member with (a) the most recent financial statements of the Company prepared in the ordinary course; (b) a current list of the Members and their respective Capital Contributions; and (c) such other information regarding the Company\u2019s affairs as is reasonably available and would not be unreasonably burdensome or competitively sensitive to produce.</div>
<div class="section"><strong>Section&nbsp;10.4 Inspection Rights.</strong> Each Member shall have the right to inspect and copy the books and records of the Company, at such Member\u2019s expense and during normal business hours, for any purpose reasonably related to such Member\u2019s interest as a Member, in accordance with ${cite(J, 'recordsInspect')} of the Act. The Manager may, in the Manager\u2019s reasonable discretion, require any inspecting Member to enter into a confidentiality agreement protecting the confidentiality of any information made available to such Member.</div>
<div class="section"><strong>Section&nbsp;10.5 Bank Accounts; Custody of Funds.</strong> The Manager shall maintain one or more bank, brokerage, or other depositary accounts in the name of the Company at financial institutions selected by the Manager. All funds of the Company shall be deposited in such accounts and shall not be commingled with the funds of any other Person.</div>
<div class="section"><strong>Section&nbsp;10.6 Tax Returns.</strong> The Manager shall cause the Company to prepare and file all federal, state, local, and foreign tax returns and reports required to be filed by the Company on a timely basis, by such accountants or tax preparers as the Manager may select. Each Member shall furnish the Manager with all information reasonably requested in connection with the preparation of such returns.</div>
</div>`;
}
function buildArticleXI_Transfers(d, J) {
  // General transfer restriction
  const generalText = ({
    strict_consent: 'No Member may Transfer all or any portion of its Membership Interest without the prior written consent of the Manager and the Required Members at the threshold of a Majority in Interest (excluding the proposed Transferor and its Affiliates), which consent may be granted, withheld, or conditioned in their respective sole discretion. Any purported Transfer in violation of this Article XI shall be null and void <em>ab initio</em> and of no force or effect.',
    consent_with_permitted: 'No Member may Transfer all or any portion of its Membership Interest, except (a) to a Permitted Transferee as set forth in Section&nbsp;11.2, or (b) with the prior written consent of the Manager and the Required Members at the threshold of a Majority in Interest (excluding the proposed Transferor and its Affiliates). Any purported Transfer in violation of this Article XI shall be null and void <em>ab initio</em>.',
    restricted_class: 'Transfers of Membership Interests shall be subject to class-specific restrictions: (a) Common Membership Interests may be Transferred at any time, subject only to compliance with applicable securities laws and the procedural requirements of this Article XI; (b) Preferred Membership Interests may be Transferred only with the prior written consent of the Manager and the Required Members at the threshold of a Majority in Interest, except to a Permitted Transferee; and (c) Profits Interests may not be Transferred except by operation of law or with the prior written consent of the Manager.',
    open_with_compliance: 'A Member may Transfer all or any portion of its Membership Interest at any time, subject to (a) compliance with the procedures set forth in this Article XI (including the right-of-first-offer and right-of-first-refusal provisions, if any); (b) delivery of customary representations, warranties, and certifications as to the proposed Transferee\u2019s investor status under applicable securities laws; and (c) prior written notice to the Manager.'
  })[d.transferGeneral] || '';

  // Permitted Transferees
  const ptList = [];
  if (d.permittedTransferees.family) ptList.push('a revocable trust for the benefit of the Transferor or the Transferor\u2019s spouse or descendants, an irrevocable trust for the benefit of the Transferor\u2019s spouse or descendants, a grantor retained annuity trust (GRAT), an intentionally defective grantor trust (IDGT), or a family limited partnership (FLP) or family limited liability company (FLLC) of which the Transferor or the Transferor\u2019s spouse or descendants are the principal beneficiaries or owners');
  if (d.permittedTransferees.wholly_owned) ptList.push('a wholly-owned subsidiary or wholly-owned affiliate of the Transferor (e.g., a single-member LLC, S corporation, or trust of which the Transferor is the sole beneficial owner)');
  if (d.permittedTransferees.affiliates) ptList.push('an Affiliate of the Transferor (i.e., an entity that Controls, is Controlled by, or is under common Control with the Transferor)');
  if (d.permittedTransferees.at_death) ptList.push('upon the death of an individual Member, to the beneficiaries of such Member\u2019s estate by will, intestacy, or operation of law');
  if (d.permittedTransferees.charitable) ptList.push('an organization described in Code Section&nbsp;501(c)(3) or a donor-advised fund maintained by such an organization');
  if (d.permittedTransferees.employee_benefit) ptList.push('an employee benefit trust of the Transferor or any of its Affiliates');

  const ptText = ptList.length ?
    'Each of the following Transfers shall be a "Permitted Transfer" and may be effected without the consent of the Manager or any Member, provided that the Transferee shall execute a joinder to this Agreement in form satisfactory to the Manager and shall acknowledge in writing that the Transferee is subject to the obligations of the Transferor under this Agreement: ' + ptList.map((s, i) => `(${String.fromCharCode(97 + i)}) ` + s).join('; ') + '.' :
    'No Transfers shall be permitted without the consent of the Manager and the Required Members.';

  // ROFO
  const rofoText = d.rofo === 'enabled' ? `<div class="section"><strong>Section&nbsp;11.__ROFO__ Right of First Offer.</strong> If any Member (the &ldquo;<strong>Selling Member</strong>&rdquo;) desires to Transfer all or any portion of its Membership Interest to any Person other than a Permitted Transferee (the &ldquo;<strong>Offered Interest</strong>&rdquo;), the Selling Member shall first deliver to the Company and to each non-Selling Member a written offer notice (the &ldquo;<strong>ROFO Notice</strong>&rdquo;) setting forth (a) a description of the Offered Interest; (b) the proposed cash purchase price for the Offered Interest; and (c) the other material terms of the proposed sale (the &ldquo;<strong>ROFO Terms</strong>&rdquo;). Each non-Selling Member shall have thirty (30) days following delivery of the ROFO Notice to elect to purchase all (but not less than all) of the Offered Interest on the ROFO Terms, pro rata in proportion to such non-Selling Member\u2019s share of the Percentage Interests held by all non-Selling Members. If the Offered Interest is not fully subscribed by non-Selling Members within such 30-day period, then the Selling Member shall have ninety (90) days following the expiration of such period to sell the Offered Interest to any third party at a price not less than, and on terms not materially more favorable to the buyer than, the ROFO Terms.</div>` : '';

  // ROFR
  const rofrText = d.rofr === 'enabled' ? `<div class="section"><strong>Section&nbsp;11.__ROFR__ Right of First Refusal.</strong> If any Member (the &ldquo;<strong>Selling Member</strong>&rdquo;) receives a bona fide written offer from a third party to purchase all or any portion of such Member\u2019s Membership Interest (a &ldquo;<strong>Third-Party Offer</strong>&rdquo;), the Selling Member shall, prior to accepting such offer, deliver to the Company and to each non-Selling Member a copy of the Third-Party Offer (the &ldquo;<strong>ROFR Notice</strong>&rdquo;). Each non-Selling Member shall have thirty (30) days following delivery of the ROFR Notice to elect to purchase all (but not less than all) of the Membership Interest covered by the Third-Party Offer, on the same terms as the Third-Party Offer, pro rata in proportion to such non-Selling Member\u2019s share of the Percentage Interests held by all non-Selling Members. If the Membership Interest is not fully subscribed by non-Selling Members within such 30-day period, the Selling Member may sell the Membership Interest to the third party on the terms set forth in the Third-Party Offer within ninety (90) days following the expiration of such period.</div>` : '';

  // Sequential numbering: 11.4 onward depends on which optional rights are on.
  let xiN = 3;
  const xiNum = { ROFO: d.rofo === 'enabled' ? ++xiN : 0, ROFR: d.rofr === 'enabled' ? ++xiN : 0 };
  xiNum.COND = ++xiN; xiNum.EFF = ++xiN; xiNum.WD = ++xiN;
  const xiFix = (html) => html.replace(/11\.__(ROFO|ROFR|COND|EFF|WD)__/g, (mm, k) => '11.' + xiNum[k]);
  return xiFix(`<div class="article"><p class="article-heading">ARTICLE XI &mdash; TRANSFER RESTRICTIONS</p>
<div class="section"><strong>Section&nbsp;11.1 General Restriction on Transfer.</strong> ${generalText}</div>
<div class="section"><strong>Section&nbsp;11.2 Permitted Transferees.</strong> ${ptText}</div>
<div class="section"><strong>Section&nbsp;11.3 Securities-Law Compliance.</strong> As a condition to any Transfer (including any Permitted Transfer), the Transferor and Transferee shall deliver to the Company customary representations, warranties, and certifications as to the Transferee\u2019s status under the Securities Act of 1933 (as an accredited investor or otherwise) and applicable state securities laws, and an opinion of counsel (or such other evidence as the Manager may reasonably require) that the Transfer does not violate the Securities Act of 1933, any applicable state securities law, or any registration or qualification requirement thereunder.</div>
${rofoText}
${rofrText}
<div class="section"><strong>Section&nbsp;11.__COND__ Conditions to Effectiveness.</strong> No Transfer shall be effective unless and until: (a) the Transferee has executed and delivered to the Company a joinder agreement substantially in the form of Exhibit&nbsp;B (or in such other form as the Manager may reasonably approve), agreeing to be bound by the terms of this Agreement; (b) the Transferor has paid to the Company all reasonable costs and expenses incurred by the Company in connection with the Transfer (including legal fees); (c) the Manager has updated Schedule A to reflect the Transfer; and (d) the Manager has reasonably concluded that the Transfer does not (i) cause the Company to be treated as anything other than a partnership for U.S. federal income tax purposes (other than as expressly elected), (ii) cause the Company to be treated as a publicly traded partnership within the meaning of Code Section&nbsp;7704, or (iii) violate any covenant or restriction in any loan, credit, or other financing agreement to which the Company is a party.</div>
<div class="section"><strong>Section&nbsp;11.__EFF__ Effect of Transfer Without Admission.</strong> A Person to whom a Membership Interest is purportedly Transferred but who has not been admitted as a Member in accordance with this Article XI shall be deemed an assignee only, with the right to receive Distributions and allocations of Profits and Losses attributable to the Transferred Interest, but without any other rights of a Member (including voting, consent, inspection, or information rights), in accordance with ${cite(J, 'transferStatus')} of the Act.</div>
<div class="section"><strong>Section&nbsp;11.__WD__ Withdrawal Upon Transfer.</strong> Following a Transfer of all (but not less than all) of a Member\u2019s Membership Interest in accordance with this Article XI, the Transferor shall cease to be a Member of the Company.</div>
</div>`);
}
function buildArticleXII_TagDrag(d, J) {
  // Drag-along
  const dragText = d.dragAlong === 'enabled' ? (() => {
    const threshText = ({
      majority: 'Members holding a Majority in Interest',
      supermajority_66: 'Members holding at least 66 2/3% of the Percentage Interests',
      supermajority_75: 'Members holding at least 75% of the Percentage Interests',
      manager_only: 'the Manager (in a Manager-Managed Company)'
    })[d.dragAlongThreshold] || 'Members holding at least 66 2/3% of the Percentage Interests';
    return `<div class="section"><strong>Section&nbsp;12.__D1__ Drag-Along Right.</strong> If ${threshText} (collectively, the &ldquo;<strong>Dragging Members</strong>&rdquo;) elect to consummate a bona fide Sale of the Company to a third party, the Dragging Members shall have the right (the &ldquo;<strong>Drag-Along Right</strong>&rdquo;) to require each other Member (each, a &ldquo;<strong>Dragged Member</strong>&rdquo;) to (a) sell all (but not less than all) of such Dragged Member\u2019s Membership Interest to the third-party purchaser on substantially the same per-Unit terms as the Dragging Members are selling (subject to the relative class and tier priorities under Article VII), (b) vote in favor of the proposed transaction, (c) execute and deliver such documents and instruments as the Dragging Members reasonably request to effect the transaction, (d) provide such customary representations and warranties as the Dragging Members are providing (limited, in the case of any Dragged Member, to such Dragged Member\u2019s individual capacity, authority, ownership, and absence of liens, and not as to the Company\u2019s business or assets), and (e) bear such Dragged Member\u2019s pro rata share of transaction expenses and indemnification obligations (in proportion to the consideration received by such Member, and subject to customary caps and limitations on individual liability).</div>
<div class="section"><strong>Section&nbsp;12.__D2__ Drag-Along Procedures.</strong> The Dragging Members shall exercise the Drag-Along Right by delivering written notice (the &ldquo;<strong>Drag-Along Notice</strong>&rdquo;) to each Dragged Member at least twenty (20) days prior to the proposed closing date of the Sale of the Company. The Drag-Along Notice shall set forth the material terms of the proposed transaction, including the identity of the third-party purchaser, the consideration to be paid, and the proposed closing date.</div>`;
  })() : '';

  // Tag-along
  const tagText = d.tagAlong === 'enabled' ? (() => {
    const triggerText = ({
      any_transfer: 'any proposed third-party Transfer of a Membership Interest by any Member',
      change_of_control: 'any proposed third-party Transfer of Membership Interests representing more than 25% of the Percentage Interests of any Member, in one or a series of related transactions, to any Person that is not a Permitted Transferee or an Affiliate of the Transferring Member',
      majority_transfer: 'any proposed third-party Transfer of a Majority in Interest of the Percentage Interests'
    })[d.tagAlongTrigger] || 'any proposed third-party Transfer of Membership Interests';
    return `<div class="section"><strong>Section&nbsp;12.__T1__ Tag-Along Right.</strong> Upon ${triggerText} (the proposed Transferor, the &ldquo;<strong>Tag Transferor</strong>&rdquo;; the proposed transferee, the &ldquo;<strong>Tag Buyer</strong>&rdquo;), the Tag Transferor shall, prior to consummating the proposed Transfer, deliver to each other Member (each, a &ldquo;<strong>Tagging Member</strong>&rdquo;) written notice (the &ldquo;<strong>Tag-Along Notice</strong>&rdquo;) setting forth (a) the identity of the Tag Buyer; (b) the number of Units proposed to be Transferred; (c) the proposed per-Unit purchase price and other material terms of the proposed Transfer; and (d) the proposed closing date (which shall be at least thirty (30) days following delivery of the Tag-Along Notice).</div>
<div class="section"><strong>Section&nbsp;12.__T2__ Tag-Along Procedures.</strong> Each Tagging Member shall have fifteen (15) days following delivery of the Tag-Along Notice to elect, by written notice to the Tag Transferor, to participate in the proposed Transfer on a pro rata basis (in proportion to such Tagging Member\u2019s Percentage Interest relative to the aggregate Percentage Interests of the Tag Transferor and all participating Tagging Members), at the same per-Unit purchase price and on the same terms as the Tag Transferor. If the Tag Buyer is unwilling to purchase the additional Units proposed to be Transferred by the Tagging Members, the Tag Transferor shall either (a) reduce its own Transfer pro rata or (b) cancel the proposed Transfer.</div>`;
  })() : '';

  // Buy-sell
  const buySellText = (() => {
    if (d.buySell === 'none') return '';
    if (d.buySell === 'texas_shootout') {
      return `<div class="section"><strong>Section&nbsp;12.__BS__ Buy-Sell (Texas Shootout).</strong> In the event of a Deadlock between or among the Members (a "Deadlock" being any disagreement among Members holding a Majority in Interest, persisting for at least sixty (60) days following good-faith negotiation and mediation, regarding any material decision of the Company), any Member (the &ldquo;<strong>Initiating Member</strong>&rdquo;) may deliver to one or more of the other Members (the &ldquo;<strong>Responding Member(s)</strong>&rdquo;) a written notice (the &ldquo;<strong>Shootout Notice</strong>&rdquo;) setting forth a per-Unit price (the &ldquo;<strong>Shootout Price</strong>&rdquo;). The Responding Member(s) shall have thirty (30) days following delivery of the Shootout Notice to elect, in writing, either to (a) sell its (or their) entire Membership Interest to the Initiating Member at the Shootout Price, or (b) purchase the Initiating Member\u2019s entire Membership Interest at the Shootout Price. Failure to make a timely election shall be deemed an election to sell to the Initiating Member at the Shootout Price.</div>`;
    }
    if (d.buySell === 'dutch_auction') {
      return `<div class="section"><strong>Section&nbsp;12.__BS__ Buy-Sell (Dutch Auction).</strong> In the event of a Deadlock between or among the Members, any Member (the &ldquo;<strong>Initiating Member</strong>&rdquo;) may deliver to one or more of the other Members (the &ldquo;<strong>Responding Member(s)</strong>&rdquo;) a written notice setting forth a per-Unit price at which the Initiating Member is willing to either purchase or sell the entire Membership Interest of the Initiating Member or the Responding Member(s) (the &ldquo;<strong>Dutch Auction Price</strong>&rdquo;). The Responding Member(s) shall have thirty (30) days to elect either to (a) sell its (or their) Membership Interest to the Initiating Member at the Dutch Auction Price, or (b) purchase the Initiating Member\u2019s Membership Interest at the Dutch Auction Price. Failure to make a timely election shall be deemed an election to sell at the Dutch Auction Price.</div>`;
    }
    if (d.buySell === 'put_call') {
      return `<div class="section"><strong>Section&nbsp;12.__BS__ Buy-Sell (Put/Call).</strong> Each Member shall have the right, at any time after the third (3rd) anniversary of the Effective Date, to deliver to any other Member (the &ldquo;<strong>Counterparty</strong>&rdquo;) (a) a "Put Notice" specifying a per-Unit price at which the noticing Member offers to sell all of its Membership Interest to the Counterparty, or (b) a "Call Notice" specifying a per-Unit price at which the noticing Member offers to purchase all of the Counterparty\u2019s Membership Interest. The Counterparty shall have thirty (30) days to accept or reject the Put Notice or Call Notice, as applicable. Acceptance shall trigger a closing within thirty (30) days at the specified price; rejection shall be without effect, but the noticing Member may not deliver a further Put Notice or Call Notice to the same Counterparty for a period of twelve (12) months.</div>`;
    }
    if (d.buySell === 'appraisal') {
      return `<div class="section"><strong>Section&nbsp;12.__BS__ Buy-Sell (Mandatory Appraisal).</strong> In the event of a Deadlock between or among the Members, any Member may demand a mandatory appraisal-based buy-sell. Within thirty (30) days of such demand, the demanding Member and the responding Member(s) shall each appoint a qualified appraiser (each, an &ldquo;<strong>Initial Appraiser</strong>&rdquo;) experienced in valuing comparable Membership Interests. The two Initial Appraisers shall jointly appoint a third qualified appraiser (the &ldquo;<strong>Third Appraiser</strong>&rdquo;). The three appraisers shall, within sixty (60) days, determine the fair market value of the affected Membership Interest, and the per-Unit price for the buy-sell shall be the average of the three appraisals (or, if any appraisal differs from the median appraisal by more than 20%, the median appraisal alone). The demanding Member shall then have thirty (30) days to elect either to buy the responding Member(s)\u2019 Membership Interest at the appraised price, or to sell its own Membership Interest at the appraised price.</div>`;
    }
    return '';
  })();

  let xiiN = 0;
  const xiiNum = {};
  if (d.dragAlong === 'enabled') { xiiNum.D1 = ++xiiN; xiiNum.D2 = ++xiiN; }
  if (d.tagAlong === 'enabled') { xiiNum.T1 = ++xiiN; xiiNum.T2 = ++xiiN; }
  xiiNum.BS = ++xiiN;
  const xiiFix = (html) => html.replace(/12\.__(D1|D2|T1|T2|BS)__/g, (mm, k) => '12.' + xiiNum[k]);
  return xiiFix(`<div class="article"><p class="article-heading">ARTICLE XII &mdash; TAG-ALONG; DRAG-ALONG; BUY-SELL</p>
${dragText}
${tagText}
${buySellText}
${(!dragText && !tagText && !buySellText) ? '<div class="section">No tag-along, drag-along, or buy-sell rights are provided in this Agreement.</div>' : ''}
</div>`);
}
function buildArticleXIII_Dissolution(d, J) {
  return `<div class="article"><p class="article-heading">ARTICLE XIII &mdash; DISSOLUTION AND WINDING UP</p>
<div class="section"><strong>Section&nbsp;13.1 Events of Dissolution.</strong> The Company shall be dissolved and its affairs shall be wound up upon the first to occur of the following: (a) the written consent of the Required Members at the threshold required for a Major Decision under Schedule B (or, if no such threshold is otherwise specified, at the threshold of Members holding a Majority in Interest); (b) the sale, exchange, or other disposition of all or substantially all of the assets of the Company, followed by the distribution of the proceeds; (c) the entry of a decree of judicial dissolution under ${cite(J, 'judDissol')} of the Act; or (d) any other event causing dissolution of the Company under the Act that is not cured (or the effects of which are not waived) within ninety (90) days following such event.</div>
<div class="section"><strong>Section&nbsp;13.2 Liquidator.</strong> Upon the dissolution of the Company, the Manager shall act as the liquidating trustee of the Company (the &ldquo;<strong>Liquidator</strong>&rdquo;) unless the Manager declines to so act, in which case the Required Members shall appoint a Liquidator (which may be a Person other than a Member or the Manager). The Liquidator shall have all the powers and authority of the Manager in winding up the affairs of the Company, including the power to sell or dispose of the assets of the Company, to compromise or settle claims by or against the Company, and to take all other actions reasonably necessary or appropriate in connection with the winding up.</div>
<div class="section"><strong>Section&nbsp;13.3 Winding Up.</strong> Upon dissolution, the Liquidator shall wind up the affairs of the Company in an orderly manner, consistent with the requirements of the Act. The Liquidator shall pay or provide for the payment of, in the order of priority required by Section&nbsp;18-804 of the Act: (a) all of the debts and liabilities of the Company to creditors (including creditors who are Members, other than for distributions); (b) the establishment of reasonable reserves for contingent or unmatured liabilities of the Company; and (c) thereafter, Liquidating Distributions to the Members in accordance with Section&nbsp;7.4 of this Agreement.</div>
<div class="section"><strong>Section&nbsp;13.4 Distribution in Kind.</strong> The Liquidator may, in the Liquidator\u2019s reasonable discretion, distribute property of the Company other than cash, in which case the procedures of Section&nbsp;7.8 shall apply.</div>
<div class="section"><strong>Section&nbsp;13.5 Final Accounting and Termination.</strong> Promptly upon completion of the winding up of the Company, the Liquidator shall prepare and deliver to each Member a final accounting of the Company\u2019s assets, liabilities, allocations, and Distributions. Upon completion of the winding up and the distribution of all assets of the Company, the Company shall be terminated, and the Manager shall cause a ${J.certCancelName} to be filed with the ${J.secOfStateOffice} in accordance with ${cite(J, 'certCancel')} of the Act.</div>
<div class="section"><strong>Section&nbsp;13.6 No Recourse to Other Members for Negative Capital Account Balances.</strong> Except to the extent a deficit restoration obligation is expressly provided for in Section&nbsp;6.3, no Member shall be obligated to restore any negative or deficit balance in such Member\u2019s Capital Account upon dissolution or otherwise, and no Member shall have recourse to any other Member for any such deficit balance.</div>
</div>`;
}
function buildArticleXIV_Indemnification(d, J) {
  // Indemnification level
  const indemText = ({
    standard: `The Company shall indemnify, defend, and hold harmless the Manager and each Member (and each of their respective Affiliates, officers, directors, managers, employees, and agents) (each, an &ldquo;<strong>Indemnified Party</strong>&rdquo;) from and against any and all losses, claims, damages, liabilities, judgments, fines, settlements, costs, and expenses (including reasonable attorneys\u2019 fees and disbursements) arising out of or in connection with such Indemnified Party\u2019s service to, or actions taken in good faith on behalf of, the Company, except to the extent that any such loss, claim, damage, liability, judgment, fine, settlement, cost, or expense results from such Indemnified Party\u2019s fraud, willful misconduct, gross negligence, knowing violation of law, or material breach of this Agreement. The Company shall advance expenses to any Indemnified Party in connection with the defense or settlement of any matter for which indemnification is potentially available under this Article XIV, upon receipt of a written undertaking by such Indemnified Party to repay such advances if it is ultimately determined that such Indemnified Party is not entitled to indemnification. Indemnification under this Article XIV shall be mandatory in the case of any matter in which the Indemnified Party is wholly successful (on the merits or otherwise) in its defense.`,
    enhanced: `The Company shall indemnify, defend, and hold harmless the Manager and each Member (and each of their respective Affiliates, officers, directors, managers, employees, and agents) (each, an &ldquo;<strong>Indemnified Party</strong>&rdquo;) to the maximum extent permitted by law from and against any and all losses, claims, damages, liabilities, judgments, fines, settlements, costs, and expenses (including reasonable attorneys\u2019 fees and disbursements) arising out of or in connection with such Indemnified Party\u2019s service to the Company, except to the extent that any such loss results from such Indemnified Party\u2019s fraud or willful misconduct adjudicated by a final, non-appealable order of a court of competent jurisdiction. The Company shall advance expenses to any Indemnified Party on the terms set forth in Section&nbsp;14.2. Indemnification shall be mandatory in any matter in which the Indemnified Party is wholly successful in its defense. The Company shall, at its expense, maintain customary directors\u2019-and-officers\u2019 (D&O) and management-liability insurance covering the Indemnified Parties on terms approved by the Manager pursuant to ${cite(J, 'doInsurance')} of the Act.`,
    basic: `The Company shall indemnify, defend, and hold harmless the Manager and each Member (each, an &ldquo;<strong>Indemnified Party</strong>&rdquo;) from and against any and all losses, claims, damages, liabilities, judgments, fines, settlements, costs, and expenses (including reasonable attorneys\u2019 fees) arising out of or in connection with the Indemnified Party\u2019s service to the Company, but only to the extent that the action or omission giving rise to such loss did not constitute gross negligence, willful misconduct, fraud, or a knowing violation of law. The Company\u2019s obligation to advance expenses shall be subject to Section&nbsp;14.2.`
  })[d.indemnification] || '';

  // Fiduciary duty modification (cross-references Article IX)
  let exculpationText = '';
  if (d.fiduciaryDuties === 'eliminated_per_18_1101') {
    exculpationText = `<div class="section"><strong>Section&nbsp;14.4 Exculpation under ${cite(J, 'exculpation')}.</strong> Pursuant to ${cite(J, 'exculpation')} of the Act and to the maximum extent permitted by ${J.name} law, no Indemnified Party shall be liable to the Company, the Members, or any other Person for any loss, damage, or claim arising from any act or omission by such Indemnified Party in the performance of its duties (whether under this Agreement, the Act, or otherwise), except to the extent such loss, damage, or claim arises from such Indemnified Party\u2019s bad-faith violation of the implied covenant of good faith and fair dealing. The parties hereto acknowledge that the elimination of fiduciary duties under Section&nbsp;9.3 and the maximum exculpation under this Section&nbsp;14.4 are integral to the bargained-for terms of this Agreement, are reasonable, and are intended to be enforced as written. Each Member acknowledges that, in the absence of this provision, the Manager would not have agreed to serve as Manager on the terms set forth in this Agreement.${J.sections.exculpation === null ? ' <em>NOTE:</em> ' + J.name + ' may not recognize a specific statutory analog to 6 Del. C. § 18-1101(e); counsel should confirm enforceability of this exculpation provision under ' + J.name + ' law.' : ''}</div>`;
  }

  return `<div class="article"><p class="article-heading">ARTICLE XIV &mdash; INDEMNIFICATION; EXCULPATION; FIDUCIARY DUTIES</p>
<div class="section"><strong>Section&nbsp;14.1 Indemnification of Indemnified Parties.</strong> ${indemText}</div>
<div class="section"><strong>Section&nbsp;14.2 Advancement of Expenses.</strong> Subject to receipt of an undertaking by the Indemnified Party (or its representative) to repay any advances if it shall ultimately be determined that such Indemnified Party is not entitled to indemnification under this Article XIV, the Company shall advance to any Indemnified Party reasonable costs and expenses (including attorneys\u2019 fees and disbursements) incurred in connection with the defense or settlement of any matter for which indemnification is or may be available under Section&nbsp;14.1. The undertaking to repay advances shall not require any collateral or security and shall be enforceable on a strict-liability basis.</div>
<div class="section"><strong>Section&nbsp;14.3 Non-Exclusivity; Survival.</strong> The indemnification and advancement of expenses provided by this Article XIV shall not be deemed exclusive of any other rights to which any Indemnified Party may be entitled under any other agreement, vote of Members, or otherwise. The provisions of this Article XIV shall survive the dissolution and winding up of the Company, the Transfer of any Membership Interest, and the termination of this Agreement.</div>
${exculpationText}
<div class="section"><strong>Section&nbsp;14.${exculpationText ? '5' : '4'} Insurance.</strong> The Manager may, in the Manager\u2019s reasonable discretion, cause the Company to purchase and maintain at the Company\u2019s expense insurance on behalf of the Indemnified Parties against any liability asserted against, and incurred by, such Persons in their capacity as an Indemnified Party.</div>
<div class="section"><strong>Section&nbsp;14.${exculpationText ? '6' : '5'} Procedures.</strong> Promptly after receipt by an Indemnified Party of notice of any claim for which indemnification may be sought, the Indemnified Party shall notify the Manager in writing. The Manager shall have the right, but not the obligation, to assume the defense of any such claim with counsel of its choosing (reasonably acceptable to the Indemnified Party); provided that the Indemnified Party may participate in such defense at its own expense. No settlement of any indemnifiable claim shall be effected without the prior written consent of the Indemnified Party (which consent shall not be unreasonably withheld) unless the settlement (a) includes a full release of the Indemnified Party from all liability arising from the claim and (b) does not impose any non-monetary obligation on the Indemnified Party.</div>
</div>`;
}
function buildArticleXV_Miscellaneous(d, J) {
  // Dispute resolution — state-aware. Delaware Chancery option is only viable in DE.
  const disputeText = ({
    delaware_chancery: J.chancery ?
      'The parties hereto hereby submit to the exclusive jurisdiction of the Court of Chancery of the State of Delaware (or, if such court lacks subject-matter jurisdiction, to the United States District Court for the District of Delaware, or any other court of the State of Delaware sitting in New Castle County, Delaware), for all disputes arising out of or relating to this Agreement. Each party hereby waives any objection to such venue and any defense of inconvenient forum.' :
      `The parties hereto hereby submit to the exclusive jurisdiction of the state courts of the State of ${J.name} sitting in ${J.venueCounty} (or the business or commercial division of such courts, if one exists), for all disputes arising out of or relating to this Agreement. <em>[Drafting note: the Delaware Court of Chancery is available only to a Delaware company; this clause substitutes the formation state's courts. Counsel should confirm the venue.]</em>`,

    mediation_then_aaa: `Before commencing any arbitration, the parties shall first attempt in good faith to resolve any dispute arising out of or relating to this Agreement through confidential mediation administered by the American Arbitration Association (AAA) under its Commercial Mediation Procedures. If mediation does not resolve the dispute within sixty (60) days following commencement, the dispute shall be finally resolved by binding arbitration administered by the AAA under its Commercial Arbitration Rules, seated in ${J.venueCity}, ${J.name}, before a panel of three arbitrators. Judgment on the award may be entered in any court of competent jurisdiction.`,
    aaa_arbitration: `Any dispute arising out of or relating to this Agreement shall be finally resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules, seated in ${J.venueCity}, ${J.name}, before a panel of three arbitrators. Judgment on the award may be entered in any court of competent jurisdiction.`,
    jams_arbitration: `Any dispute arising out of or relating to this Agreement shall be finally resolved by binding arbitration administered by JAMS under its Comprehensive Arbitration Rules and Procedures, seated in ${J.venueCity}, ${J.name}, before a panel of three arbitrators. Judgment on the award may be entered in any court of competent jurisdiction.`,
    state_court_only: `The parties hereto hereby submit to the jurisdiction of the state courts of the State of ${J.name} sitting in ${J.venueCounty}, for all disputes arising out of or relating to this Agreement.`
  })[d.disputeResolution] || '';

  // Fee shifting
  const feeText = ({
    prevailing_party: 'In any action, proceeding, or arbitration arising out of or relating to this Agreement, the prevailing party shall be entitled to recover from the non-prevailing party its reasonable attorneys\u2019 fees and costs incurred in connection with such action, proceeding, or arbitration.',
    each_pays_own: 'In any action, proceeding, or arbitration arising out of or relating to this Agreement, each party shall bear its own attorneys\u2019 fees and costs.',
    english: 'In any action, proceeding, or arbitration arising out of or relating to this Agreement, the losing party shall pay all reasonable attorneys\u2019 fees and costs of the prevailing party (the "English rule").'
  })[d.feeShifting] || '';

  // Charging order
  const chargingText = ({
    standard: `In accordance with ${cite(J, 'chargingOrder')} of the Act, the entry of a charging order against a Membership Interest shall be the sole and exclusive remedy by which a judgment creditor of a Member may satisfy a judgment out of the judgment debtor\u2019s Membership Interest, and the creditor shall have no right to obtain possession of, or otherwise exercise legal or equitable remedies with respect to, the Company\u2019s property. The creditor of a Member to whom a charging order has issued shall have no right to participate in the management or affairs of the Company, no right to inspect the Company\u2019s books and records, and no right to receive any Distribution in kind or to compel the dissolution of the Company.`,
    enhanced: `In accordance with ${cite(J, 'chargingOrder')} of the Act, the entry of a charging order against a Membership Interest shall be the sole and exclusive remedy by which a judgment creditor of a Member may satisfy a judgment out of the judgment debtor\u2019s Membership Interest. Without limiting the generality of the foregoing: (a) the creditor shall have no right to obtain possession of, or otherwise exercise legal or equitable remedies with respect to, the Company\u2019s property; (b) the creditor shall have no right to participate in management, no right to inspect books and records, no right to receive in-kind distributions, and no right to compel dissolution; (c) judicial foreclosure or other liquidation of the charging order shall not be available; and (d) the rights of the Member whose Membership Interest is subject to the charging order shall remain unimpaired except to the extent of the Distributions actually paid pursuant to the charging order.`,
    none: ''
  })[d.chargingOrder] || '';

  const chargingBlock = chargingText ? `<div class="section"><strong>Section&nbsp;15.${d.chargingOrder ? '4' : '4'} Charging Order.</strong> ${chargingText}</div>` : '';

  return `<div class="article"><p class="article-heading">ARTICLE XV &mdash; MISCELLANEOUS</p>
<div class="section"><strong>Section&nbsp;15.1 Notices.</strong> All notices, demands, requests, consents, approvals, and other communications required or permitted to be given under this Agreement shall be in writing and shall be deemed duly given (a) when delivered personally; (b) on the third (3rd) business day after deposit in the U.S. mail, registered or certified, postage prepaid; (c) when sent by overnight courier with proof of delivery; or (d) when sent by email, with confirmation of delivery, in each case to the addresses set forth on Schedule A (or such other addresses as a Member may specify by like notice).</div>
<div class="section"><strong>Section&nbsp;15.2 Amendment.</strong> This Agreement may be amended only by a written instrument executed by the Required Members at the threshold required for a Major Decision under Schedule B, except that (a) any amendment that would adversely affect the rights, preferences, or privileges of any Class shall require the additional written consent of a Majority in Interest of the affected Class, voting separately; (b) any amendment that would impose any additional capital contribution obligation, materially alter the basis on which any Member is allocated Profits or Losses, or impose any non-pro-rata economic burden on any Member shall require the additional written consent of each adversely affected Member; and (c) the Manager may, without the consent of any Member, amend Schedule A from time to time to reflect admissions, withdrawals, additional Capital Contributions, Transfers, redemptions, and other changes as permitted by this Agreement.</div>
<div class="section"><strong>Section&nbsp;15.3 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${J.name}, without regard to any choice-of-law principles that would require the application of the laws of another jurisdiction. The parties acknowledge and agree that the rights and obligations under this Agreement are intended to be governed by the Act and applicable ${J.name} law, including the broad freedom of contract recognized in ${cite(J, 'fiduciaryDuty')} of the Act.</div>
${chargingBlock}
<div class="section"><strong>Section&nbsp;15.${chargingText ? '5' : '4'} Dispute Resolution; Forum.</strong> ${disputeText}</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '6' : '5'} Fee Shifting.</strong> ${feeText}</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '7' : '6'} Severability.</strong> If any provision of this Agreement is held to be invalid, illegal, or unenforceable in any jurisdiction, the validity, legality, and enforceability of the remaining provisions shall not in any way be affected or impaired thereby. The parties shall negotiate in good faith to replace any invalid, illegal, or unenforceable provision with a valid, legal, and enforceable provision that achieves, to the maximum extent possible, the economic, business, and other purposes of the invalid, illegal, or unenforceable provision.</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '8' : '7'} Counterparts; Electronic Signatures.</strong> This Agreement may be executed in one or more counterparts (including by facsimile, scanned image, or electronic signature via DocuSign or similar service), each of which shall be deemed an original, and all of which together shall constitute one and the same instrument.</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '9' : '8'} Entire Agreement.</strong> This Agreement, including the Schedules and Exhibits hereto, constitutes the entire agreement of the parties hereto with respect to the subject matter hereof and supersedes all prior agreements, understandings, negotiations, and discussions, whether oral or written, with respect to such subject matter. No representation, warranty, promise, inducement, or statement of intention has been made by any party that is not embodied in this Agreement, and no party shall be bound by, or be liable for, any alleged representation, warranty, promise, inducement, or statement of intention not embodied herein.</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '10' : '9'} Waiver of Jury Trial.</strong> EACH PARTY TO THIS AGREEMENT HEREBY IRREVOCABLY WAIVES ANY AND ALL RIGHT TO TRIAL BY JURY IN ANY LEGAL PROCEEDING ARISING OUT OF OR RELATING TO THIS AGREEMENT OR THE TRANSACTIONS CONTEMPLATED HEREBY.</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '11' : '10'} Successors and Assigns.</strong> This Agreement shall be binding upon, and shall inure to the benefit of, the parties hereto and their respective heirs, executors, administrators, successors, and permitted assigns.</div>
<div class="section"><strong>Section&nbsp;15.${chargingText ? '12' : '11'} Construction.</strong> This Agreement shall be construed without regard to any presumption or rule requiring construction against the party causing this Agreement to be drafted. Headings used in this Agreement are for convenience of reference only and shall not affect the construction or interpretation hereof.</div>
</div>`;
}
function buildSPEArticle(d, num) {
  const independentManager = d.speProvisions === 'standard_plus_independent';
  const indMgrText = independentManager ?
    `<div class="section"><strong>Section&nbsp;SPE.6 Independent Manager.</strong> The Company shall at all times maintain at least one (1) Independent Manager who satisfies the qualifications set forth below and is engaged for the purpose of acting as Independent Manager. An &ldquo;<strong>Independent Manager</strong>&rdquo; means a natural person who (a) is not at the time of initial appointment or at any time while serving (i) a Member, (ii) an Affiliate of any Member, (iii) an officer, director, employee, or partner of any Member or Affiliate thereof, (iv) a customer or supplier of any Member or any Affiliate, (v) a person controlling any of the foregoing, or (vi) a member of the immediate family of any of the foregoing; (b) has prior experience as an independent director, independent manager, or similar capacity for at least three (3) other special-purpose entities affiliated with national institutional commercial real-estate lenders; and (c) is paid for such service in an amount commercially reasonable and customary for an independent manager of a special-purpose entity of similar size and character. Notwithstanding any other provision of this Agreement, the consent of the Independent Manager (in addition to the consent otherwise required hereunder) shall be required for any of the following actions: (i) the filing of a voluntary petition by the Company under any chapter of the U.S. Bankruptcy Code; (ii) the consent by the Company to the filing of an involuntary petition; (iii) the consent by the Company to the appointment of a receiver, conservator, or trustee; (iv) the making by the Company of any general assignment for the benefit of creditors; or (v) the admission in writing by the Company of its inability to pay debts generally as they become due.</div>` : '';

  return `<div class="article"><p class="article-heading">ARTICLE ${num} &mdash; SINGLE-PURPOSE ENTITY COVENANTS</p>
<div class="section"><strong>Section&nbsp;SPE.1 Single Purpose.</strong> The Company shall conduct no business or activity, and shall not own any assets, other than as expressly required to carry out the purposes set forth in Section&nbsp;3.1. Without limiting the generality of the foregoing, the Company shall not (a) engage in any activity other than the ownership, financing, operation, and disposition of the property identified to its lender from time to time as the "Property"; (b) form, acquire, or hold any interest in any subsidiary or joint venture; or (c) commingle its assets with those of any other Person.</div>
<div class="section"><strong>Section&nbsp;SPE.2 Separateness Covenants.</strong> The Company shall at all times: (a) maintain its own books, records, accounts, financial statements, and bank accounts separate from those of any other Person; (b) hold itself out to the public as a separate legal entity from any other Person; (c) observe all corporate, partnership, or limited liability company formalities required by its organizational documents and the law of its jurisdiction of formation; (d) not commingle its assets with those of any other Person; (e) maintain an arm\u2019s-length relationship with its Affiliates; (f) pay its own liabilities and expenses out of its own funds and assets; (g) not assume, guarantee, or otherwise become obligated for the debts or liabilities of any other Person, except as expressly permitted by the loan documents to which the Company is a party; (h) not acquire obligations or securities of any Member or Affiliate; and (i) cause the directors, officers, agents, and other representatives of the Company to act at all times with respect to the Company solely in the interest of the Company and consistent with the Company\u2019s separate existence.</div>
<div class="section"><strong>Section&nbsp;SPE.3 No Other Indebtedness.</strong> The Company shall not incur, assume, or guarantee any indebtedness for borrowed money other than (a) the indebtedness owing to the Company\u2019s senior lender under the loan documents (the &ldquo;<strong>Permitted Indebtedness</strong>&rdquo;) and (b) ordinary-course trade payables incurred in the ordinary course of business that are payable within sixty (60) days.</div>
<div class="section"><strong>Section&nbsp;SPE.4 No Consolidation.</strong> The Company shall not consolidate or merge with any other Person, nor sell, transfer, or otherwise convey all or substantially all of its assets to any other Person, except as expressly permitted under the loan documents.</div>
<div class="section"><strong>Section&nbsp;SPE.5 No Modification Without Lender Consent.</strong> Notwithstanding any other provision of this Agreement, no amendment, modification, or waiver of this Article ${num} shall be effective without the prior written consent of the Company\u2019s senior lender, and any such amendment, modification, or waiver attempted without such consent shall be null and void.</div>
${indMgrText}
</div>`;
}
function buildSeriesArticle(d, num, J) {
  if (!J || !J.seriesPermitted) {
    return `<div class="article"><p class="article-heading">ARTICLE ${num} &mdash; SERIES LLC RESERVATION</p>
<div class="section"><em>NOTE:</em> ${J ? J.name : 'This state'} does not currently permit Series LLCs. The Series reservation has been suppressed. Re-evaluate if and when ${J ? J.name : 'the state'} amends its LLC act to authorize Series.</div></div>`;
  }
  return `<div class="article"><p class="article-heading">ARTICLE ${num} &mdash; SERIES LLC RESERVATION</p>
<div class="section"><strong>Section&nbsp;Series.1 Reservation of Right to Designate Series.</strong> In accordance with ${cite(J, 'seriesCite')} of the Act, the Company hereby expressly reserves the right, at any time and from time to time, to establish one or more designated series of Members, Membership Interests, or assets (each, a &ldquo;<strong>Series</strong>&rdquo;), each of which Series shall be associated with separate assets, profits, losses, and Distributions and shall, if so established and properly maintained, have liability and asset segregation as between Series.</div>
<div class="section"><strong>Section&nbsp;Series.2 Procedures for Establishing a Series.</strong> Each Series, if and when established, shall be established by a written designation executed by the Manager and consented to in writing by the Required Members at the threshold of a Major Decision under Schedule B. Each Series designation shall set forth: (a) the name of the Series; (b) the assets associated with the Series; (c) the Members associated with the Series and their respective Membership Interests in the Series; (d) the rights, preferences, privileges, restrictions, and obligations of such Members in the Series; and (e) such other matters as the Manager and the Members designating such Series may determine.</div>
<div class="section"><strong>Section&nbsp;Series.3 Asset and Liability Segregation.</strong> To the maximum extent permitted by ${cite(J, 'seriesCite')} of the Act, the debts, liabilities, obligations, and expenses incurred, contracted for, or otherwise existing with respect to a particular Series shall be enforceable against the assets of such Series only, and not against the assets of the Company generally or the assets of any other Series; and none of the debts, liabilities, obligations, and expenses incurred, contracted for, or otherwise existing with respect to the Company generally or any other Series shall be enforceable against the assets of such particular Series. The Manager shall maintain separate and distinct records for each Series, account for the assets of each Series separately from the assets of the Company generally and the assets of any other Series, and shall comply with the notice and recordkeeping requirements of the Act in respect of each Series.</div>
<div class="section"><strong>Section&nbsp;Series.4 Application of This Agreement to Series.</strong> Except as otherwise specifically provided in the designation establishing any Series, the provisions of this Agreement shall apply <em>mutatis mutandis</em> to each Series and to the Members associated with such Series.</div>
</div>`;
}
function buildRestrictiveCovenantsArticle(d, num, J) {
  const isFull = d.restrictiveCovenants === 'full';
  const ncWarning = J && (J.nonCompeteEnforceable === 'no' || J.nonCompeteEnforceable === 'limited') ?
    ` <em>WARNING:</em> ${J.name} ${J.nonCompeteEnforceable === 'no' ? 'broadly prohibits' : 'imposes substantial restrictions on'} non-competition covenants against natural persons${J.nameAbbrev === 'CA' ? ' (Cal. Bus. & Prof. Code § 16600 et seq.)' : J.nameAbbrev === 'MA' ? ' (M.G.L. c. 149, § 24L)' : ''}. The enforceability of this non-competition provision against any individual Member is doubtful. Counsel should re-evaluate scope and consider whether non-solicitation alone is sufficient for the intended business protection.` : '';
  const competeBlock = isFull ? `<div class="section"><strong>Section&nbsp;RC.1 Non-Competition.</strong> During the period commencing on the Effective Date and continuing for a period of two (2) years after the date on which a Member ceases to be a Member of the Company (the &ldquo;<strong>Restricted Period</strong>&rdquo;), no Member shall, directly or indirectly, anywhere within a fifty (50) mile radius of any property owned, operated, or under contract by the Company, engage in, own any interest in, manage, operate, control, or participate in any business that competes with the business of the Company. The parties agree that the foregoing scope of restriction (as to time, geography, and activity) is reasonable, necessary to protect the legitimate business interests of the Company, and consistent with applicable ${J ? J.name : 'governing'} law. Notwithstanding the foregoing, ownership of less than five percent (5%) of the publicly traded equity securities of any company shall not constitute a violation of this Section&nbsp;RC.1.${ncWarning}</div>` : '';

  return `<div class="article"><p class="article-heading">ARTICLE ${num} &mdash; RESTRICTIVE COVENANTS</p>
${competeBlock}
<div class="section"><strong>Section&nbsp;RC.${isFull ? '2' : '1'} Non-Solicitation of Employees and Contractors.</strong> During the Restricted Period, no Member shall, directly or indirectly, (a) solicit for employment or engagement any employee, independent contractor, consultant, or agent of the Company who is then employed or engaged by the Company or who was employed or engaged by the Company within six (6) months prior to such solicitation; or (b) induce or attempt to induce any such Person to terminate or modify in any manner adverse to the Company such Person\u2019s employment or engagement with the Company. General advertisements not specifically targeted at the Company\u2019s employees, contractors, consultants, or agents shall not constitute a violation of this Section.</div>
<div class="section"><strong>Section&nbsp;RC.${isFull ? '3' : '2'} Reasonableness; Reformation.</strong> Each Member acknowledges and agrees that the restrictive covenants set forth in this Article ${num} are reasonable in scope, duration, and geographic area, and are necessary to protect the legitimate business interests of the Company. If a court of competent jurisdiction shall determine that any provision of this Article ${num} is unenforceable as written, such provision shall be reformed (and not stricken) to the maximum extent of permissible enforceability under applicable law.</div>
<div class="section"><strong>Section&nbsp;RC.${isFull ? '4' : '3'} Remedies.</strong> Each Member acknowledges that breach of the covenants in this Article ${num} would cause irreparable harm to the Company for which monetary damages may not be a sufficient remedy. Accordingly, the Company shall be entitled, in addition to all other remedies available at law or in equity, to obtain specific performance, injunctive relief, or other equitable relief in any court of competent jurisdiction to enforce these covenants, without bond or other security.</div>
</div>`;
}
function buildConfidentialityArticle(d, num) {
  const isEnhanced = d.confidentiality === 'enhanced';
  const enhancedBlock = isEnhanced ? `<div class="section"><strong>Section&nbsp;Conf.${isEnhanced ? '4' : '3'} Liquidated Damages.</strong> Each Member acknowledges that any breach of this Article ${num} would cause substantial and irreparable harm to the Company for which monetary damages may be difficult to ascertain. Accordingly, the parties hereby agree that, in addition to all other remedies available at law or in equity, the Company shall be entitled to liquidated damages from a breaching Member in an amount equal to two (2) times the amount of all Distributions received by such breaching Member during the twelve (12) months preceding the breach; such amount is not intended to be, and shall not be deemed, a penalty.</div>
<div class="section"><strong>Section&nbsp;Conf.${isEnhanced ? '5' : '4'} Injunctive Relief.</strong> The Company shall be entitled to obtain injunctive and other equitable relief (without the need to post any bond or other security) to prevent or enjoin any breach or threatened breach of this Article ${num}, in any court of competent jurisdiction.</div>
<div class="section"><strong>Section&nbsp;Conf.${isEnhanced ? '6' : '5'} Survival.</strong> The obligations of each Member under this Article ${num} shall survive (a) the Transfer of such Member\u2019s Membership Interest; (b) the withdrawal of such Member from the Company; and (c) the dissolution and winding up of the Company, in each case for a period of three (3) years thereafter.</div>` : '';

  return `<div class="article"><p class="article-heading">ARTICLE ${num} &mdash; CONFIDENTIALITY</p>
<div class="section"><strong>Section&nbsp;Conf.1 Confidential Information.</strong> &ldquo;<strong>Confidential Information</strong>&rdquo; means all information of any kind concerning the Company, the Manager, the Members, the Company\u2019s investments, business plans, financial information, contracts, properties, tenants, lenders, intellectual property, trade secrets, and any other proprietary or confidential information, whether disclosed in writing, orally, electronically, or by observation, except for information that (a) is or becomes generally available to the public other than as a result of a disclosure in breach of this Agreement, (b) was known to the receiving party on a non-confidential basis prior to disclosure by the Company, or (c) was lawfully received from a third party not subject to any confidentiality obligation with respect to such information.</div>
<div class="section"><strong>Section&nbsp;Conf.2 Restriction on Disclosure and Use.</strong> Each Member shall (a) hold all Confidential Information in strict confidence; (b) use Confidential Information solely for the purpose of evaluating, monitoring, and benefiting from such Member\u2019s Membership Interest, and not for any other purpose; and (c) not disclose Confidential Information to any third party, except (i) to such Member\u2019s legal, tax, accounting, and financial advisors who have a need to know and are subject to written confidentiality obligations no less stringent than those set forth in this Article ${num}, (ii) as required by applicable law, regulation, judicial process, or governmental authority (in which case the disclosing Member shall provide prior written notice to the Manager to the extent legally permissible), or (iii) with the prior written consent of the Manager.</div>
<div class="section"><strong>Section&nbsp;Conf.3 Return of Information.</strong> Upon the request of the Manager (or upon the termination of such Member\u2019s membership in the Company), each Member shall return to the Company or destroy (and, upon request, certify in writing the destruction of) all Confidential Information then in such Member\u2019s possession, except for such information that such Member is required to retain pursuant to applicable law, regulation, or such Member\u2019s reasonable record-retention policies (which retained information shall continue to be subject to the obligations of confidentiality set forth in this Article ${num}).</div>
${enhancedBlock}
</div>`;
}
function buildSignatureBlock(d, J) {
  // Per-Member signature lines
  const memberSigs = d.members.map((m, i) => `
<div class="section" style="margin-top:2rem;">
  <strong>MEMBER ${i + 1}:</strong><br/>
  ${escapeHtml(m.name || `[Member ${i + 1} Name]`)}<br/><br/>
  By: <span class="signature-line"></span><br/>
  Name: ${m.type === 'entity' || m.type === 'trust' || m.type === 'partnership' ? '_______________' : escapeHtml(m.name || '_______________')}<br/>
  Title: ${m.type === 'entity' || m.type === 'trust' || m.type === 'partnership' ? '_______________' : 'Member'}<br/>
  Date: _______________
</div>`).join('');

  // Manager signature (if manager-managed)
  const mgrSig = (d.managementStructure === 'manager_managed' && d.managerName) ? `
<div class="section" style="margin-top:2rem;">
  <strong>MANAGER:</strong><br/>
  ${escapeHtml(d.managerName)}<br/><br/>
  By: <span class="signature-line"></span><br/>
  Name: _______________<br/>
  Title: Manager<br/>
  Date: _______________
</div>` : '';

  // Company signature
  const companySig = `
<div class="section" style="margin-top:2rem;">
  <strong>COMPANY:</strong><br/>
  ${escapeHtml(d.companyName)}<br/><br/>
  By: ${d.managementStructure === 'manager_managed' && d.managerName ? escapeHtml(d.managerName) + ', its Manager' : ''}<br/>
  By: <span class="signature-line"></span><br/>
  Name: _______________<br/>
  Title: ${d.managementStructure === 'manager_managed' ? 'Authorized Signatory of the Manager' : 'Authorized Member'}<br/>
  Date: _______________
</div>`;

  return `<div class="signature-block"><p class="article-heading" style="margin-top:2.5rem;">SIGNATURE PAGES</p>
<div class="section">IN WITNESS WHEREOF, the parties hereto have executed this Limited Liability Company Operating Agreement of ${escapeHtml(d.companyName)} as of the Effective Date first written above.</div>
${companySig}
${mgrSig}
${memberSigs}
</div>`;
}
function buildScheduleA(d, J) {
  const totalCapital = d.assignments.reduce((s, a) => s + (a.capitalContribution || 0), 0);
  const rows = d.assignments.map(a => {
    const m = d.members.find(x => x.id === a.memberId);
    const c = d.classes.find(x => x.id === a.classId);
    const pct = totalCapital > 0 ? ((a.capitalContribution / totalCapital) * 100).toFixed(4) : '0.0000';
    return `<tr>
      <td>${escapeHtml((m && m.name) || 'Unnamed Member')}<div style="font-size:8.5pt; color:#555;">${escapeHtml((m && m.address) || '[notice address]')}</div></td>
      <td>${escapeHtml((c && c.name) || '')}</td>
      <td style="text-align:right;">${a.units.toLocaleString()}</td>
      <td style="text-align:right;">${fmtMoney(a.capitalContribution)}</td>
      <td style="text-align:right;">${pct}%</td>
    </tr>`;
  }).join('');
  return `<div class="schedule-heading">SCHEDULE A &mdash; MEMBERS, CLASSES, CAPITAL CONTRIBUTIONS, AND PERCENTAGE INTERESTS</div>
<div class="section">As of the Effective Date, the Members of the Company, their respective Classes of Membership Interest, Units, Capital Contributions, and Percentage Interests are as set forth below. This Schedule A shall be updated by the Manager from time to time to reflect admissions, withdrawals, additional Capital Contributions, Transfers, and other changes as permitted by the Agreement; the Manager\u2019s good-faith update of this Schedule A shall not constitute an amendment of the Agreement requiring the consent of the Members.</div>
<table class="schedule-table">
  <thead>
    <tr>
      <th>Member / Notice Address</th>
      <th>Class</th>
      <th style="text-align:right;">Units</th>
      <th style="text-align:right;">Capital Contribution</th>
      <th style="text-align:right;">Percentage Interest</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr style="font-weight:bold; background:#f0f0eb;">
      <td colspan="3" style="text-align:right;">TOTAL</td>
      <td style="text-align:right;">${fmtMoney(totalCapital)}</td>
      <td style="text-align:right;">100.0000%</td>
    </tr>
  </tbody>
</table>
<div class="section" style="font-size:9pt; margin-top:1rem;"><em>Notice addresses are as shown above (see Section&nbsp;15.1). Taxpayer identification numbers and citizenship / jurisdiction of organization are maintained by the Manager in the Company&rsquo;s books and records and are incorporated herein by reference; the Manager shall update those records as Members&rsquo; information changes.</em></div>`;
}
function buildScheduleB(d, J) {
  const mdList = [];
  if (d.majorDecisions.sale_assets) mdList.push('Sale, exchange, or other disposition of all or substantially all of the Company\u2019s assets, in one transaction or a series of related transactions.');
  if (d.majorDecisions.merger) mdList.push('Merger, consolidation, conversion, or reorganization of the Company.');
  if (d.majorDecisions.dissolution) mdList.push('Voluntary dissolution or winding up of the Company.');
  if (d.majorDecisions.indebtedness) mdList.push('Incurrence by the Company of indebtedness for borrowed money above a threshold of $[INSERT THRESHOLD] in the aggregate at any time outstanding.');
  if (d.majorDecisions.amend_oa) mdList.push('Amendment of this Operating Agreement (other than amendments to Schedule A by the Manager pursuant to Section&nbsp;15.2).');
  if (d.majorDecisions.admit_member) mdList.push('Admission of a new Member (other than a Permitted Transferee).');
  if (d.majorDecisions.tax_election) mdList.push('Any material tax election or change in tax classification by the Company (other than annual elections in the ordinary course).');
  if (d.majorDecisions.affiliate_tx) mdList.push('Any transaction between the Company and the Manager or any Affiliate of the Manager on terms other than arm\u2019s-length and disclosed in writing to all Members.');
  if (d.majorDecisions.capital_call_threshold) mdList.push('Any Capital Call above a threshold of $[INSERT THRESHOLD] in the aggregate within any twelve (12) month period.');
  if (d.majorDecisions.change_business) mdList.push('Any material change in the principal business purpose of the Company as set forth in Section&nbsp;3.1.');

  const threshold = ({
    majority: 'Majority in Interest (more than fifty percent (50%) of Percentage Interests)',
    supermajority_66: 'Supermajority (at least 66 2/3% of Percentage Interests)',
    supermajority_75: 'Supermajority (at least 75% of Percentage Interests)',
    unanimous: 'Unanimous (100% of Percentage Interests)'
  })[d.majorDecisionThreshold] || 'Supermajority (at least 66 2/3% of Percentage Interests)';

  const rows = mdList.map((md, i) => `<tr>
    <td style="width:30px;">${i + 1}.</td>
    <td>${md}</td>
    <td style="width:200px;">${threshold}</td>
  </tr>`).join('');

  return `<div class="schedule-heading">SCHEDULE B &mdash; MAJOR DECISIONS REQUIRING MEMBER APPROVAL</div>
<div class="section">The following actions constitute Major Decisions for purposes of Section&nbsp;9.5 of the Agreement and shall require the prior written consent of the Required Members at the threshold specified in the third column:</div>
<table class="schedule-table">
  <thead>
    <tr>
      <th style="width:30px;">#</th>
      <th>Major Decision</th>
      <th style="width:200px;">Required Consent Threshold</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
<div class="section" style="font-size:9pt; margin-top:1rem;"><em>The Manager and Members may amend this Schedule B by written agreement in accordance with Section&nbsp;15.2 to add, remove, or modify Major Decisions or thresholds, as appropriate. For Major Decisions subject to specific dollar thresholds, the Manager and Members shall agree on such thresholds in good faith, taking into account the Company\u2019s capitalization, expected operating budget, and material business expectations.</em></div>`;
}

/* COMPANION DOCUMENT STUBS =================================================== */
function buildSubscriptionAgreement(d) {
  const J = getJurisdiction(d.jurisdiction);
  return DRAFT_BANNER + `<h1>Subscription Agreement<br/>for Membership Interests in<br/>${escapeHtml(d.companyName)}</h1>
<h2>A ${J.name} Limited Liability Company</h2>
<div class="section">This Subscription Agreement (this &ldquo;<strong>Subscription Agreement</strong>&rdquo;) is entered into and made effective as of ${fmtDate(d.effectiveDate)} by and between the undersigned subscriber (the &ldquo;<strong>Subscriber</strong>&rdquo;) and ${escapeHtml(d.companyName)}, a ${J.name} limited liability company (the &ldquo;<strong>Company</strong>&rdquo;). This Subscription Agreement is delivered in connection with the Subscriber\u2019s purchase of Membership Interests of the Company, as more fully described in the Company\u2019s Limited Liability Company Operating Agreement of even date herewith (the &ldquo;<strong>Operating Agreement</strong>&rdquo;). Capitalized terms used and not otherwise defined herein have the meanings given to them in the Operating Agreement.</div>

<div class="article"><p class="article-heading">ARTICLE 1 &mdash; SUBSCRIPTION</p>
<div class="section"><strong>1.1 Subscription.</strong> Subject to the terms and conditions hereof, the Subscriber hereby irrevocably subscribes for and agrees to purchase from the Company the number of Units of the Class indicated on the Subscriber\u2019s signature page hereto (the &ldquo;<strong>Subscribed Interests</strong>&rdquo;), at the per-Unit purchase price set forth on such signature page, for an aggregate Capital Contribution as set forth on such signature page (the &ldquo;<strong>Subscription Amount</strong>&rdquo;).</div>
<div class="section"><strong>1.2 Funding.</strong> The Subscriber shall fund the Subscription Amount by wire transfer of immediately available funds to the account of the Company, on or before the closing date specified by the Company. The Subscription Amount shall not be deemed received until the funds are credited to the Company\u2019s account in collected funds.</div>
<div class="section"><strong>1.3 Acceptance.</strong> This Subscription Agreement shall not be binding upon the Company unless and until accepted by the Company by execution and delivery of a counterpart hereof to the Subscriber. The Company may, in its sole discretion, accept or reject any subscription in whole or in part, for any reason or no reason.</div>
</div>

<div class="article"><p class="article-heading">ARTICLE 2 &mdash; SUBSCRIBER REPRESENTATIONS</p>
<div class="section"><strong>2.1 Authority; Authorization.</strong> The Subscriber has full power and authority (and, if an entity, has been duly authorized) to enter into this Subscription Agreement and the Operating Agreement, and to perform its obligations hereunder and thereunder. This Subscription Agreement and the Operating Agreement (when executed by the Subscriber) are valid, binding, and enforceable obligations of the Subscriber.</div>
<div class="section"><strong>2.2 Accredited Investor Status.</strong> The Subscriber is an &ldquo;accredited investor&rdquo; within the meaning of Rule 501(a) of Regulation D under the Securities Act of 1933, as amended (the &ldquo;<strong>Securities Act</strong>&rdquo;). The Subscriber\u2019s status as an accredited investor is supported by the documentation provided to the Company, including, as applicable, financial statements, tax returns, professional certifications, or a third-party verification letter.</div>
<div class="section"><strong>2.3 Investment Intent; No Distribution.</strong> The Subscriber is acquiring the Subscribed Interests solely for the Subscriber\u2019s own account, for investment, and not with a view to, or for resale in connection with, any distribution thereof in violation of the Securities Act or any applicable state securities law.</div>
<div class="section"><strong>2.4 Sophistication; Risk.</strong> The Subscriber has such knowledge and experience in financial and business matters that the Subscriber is capable of evaluating the merits and risks of an investment in the Company. The Subscriber understands that an investment in the Subscribed Interests involves substantial risk, including the risk of loss of all or substantially all of the Subscription Amount, and is willing and able to bear such risk. The Subscriber has been given the opportunity to ask questions of, and to receive answers from, the Manager regarding the Company, its business plan, financial information, terms of investment, and any other matters affecting the investment.</div>
<div class="section"><strong>2.5 No Reliance on Forecasts; No Guarantees.</strong> The Subscriber acknowledges and agrees that (a) no representation or warranty has been made by the Company, the Manager, or any other Person regarding the future financial performance or returns of the Company; (b) any projections, forecasts, or pro forma financials provided to the Subscriber are inherently uncertain and may not be realized; and (c) past performance is not a guarantee of future results.</div>
<div class="section"><strong>2.6 Restrictions on Transfer.</strong> The Subscriber understands that the Subscribed Interests have not been registered under the Securities Act or any state securities laws, and have been offered and sold in reliance on exemptions from registration. The Subscribed Interests may not be Transferred except in compliance with the Securities Act, applicable state securities laws, and the transfer restrictions set forth in Article XI of the Operating Agreement.</div>
<div class="section"><strong>2.7 No General Solicitation.</strong> The Subscriber represents that no Membership Interest of the Company was offered or sold to the Subscriber by means of general solicitation or general advertising within the meaning of Rule 502(c) of Regulation D.</div>
<div class="section"><strong>2.8 OFAC and Tax Compliance.</strong> The Subscriber represents that (a) the Subscriber is not, and is not controlled by, a Person identified on the U.S. Treasury Department\u2019s Office of Foreign Assets Control (OFAC) list of Specially Designated Nationals and Blocked Persons, or other prohibited list, and (b) the Subscription Amount is not derived from, and the investment does not violate, any U.S. anti-money-laundering or counter-terrorist-financing law. The Subscriber has provided the Company with a properly executed Form W-9 (or applicable Form W-8 for non-U.S. persons).</div>
</div>

<div class="article"><p class="article-heading">ARTICLE 3 &mdash; AGREEMENT TO BE BOUND BY OPERATING AGREEMENT</p>
<div class="section"><strong>3.1 Joinder.</strong> Upon acceptance of this Subscription Agreement and the funding of the Subscription Amount, the Subscriber shall be admitted as a Member of the Company. The Subscriber hereby acknowledges receipt of the Operating Agreement, agrees to be bound by all of its terms and conditions, and confirms that the Subscriber shall be a "Member" thereunder.</div>
<div class="section"><strong>3.2 Power of Attorney.</strong> The Subscriber hereby grants the Manager (and any successor Manager) a limited power of attorney to execute, deliver, and file, on the Subscriber\u2019s behalf, (a) any amendments to the Certificate of Formation, (b) any tax returns and elections of the Company, (c) any documents required to effect a Transfer or admission of a Member in accordance with the Operating Agreement, and (d) any other documents reasonably necessary or appropriate to give effect to the terms of the Operating Agreement; provided that this power of attorney shall not authorize any action that, by the terms of the Operating Agreement, requires the Subscriber\u2019s individual consent.</div>
</div>

<div class="article"><p class="article-heading">ARTICLE 4 &mdash; INDEMNIFICATION; MISCELLANEOUS</p>
<div class="section"><strong>4.1 Indemnification by Subscriber.</strong> The Subscriber shall indemnify and hold harmless the Company, the Manager, and the other Members from any loss, damage, or liability arising out of any breach by the Subscriber of any representation, warranty, covenant, or agreement made by the Subscriber in this Subscription Agreement or in the Operating Agreement.</div>
<div class="section"><strong>4.2 Survival.</strong> The representations, warranties, covenants, and agreements of the Subscriber set forth herein shall survive the closing of the subscription and the Subscriber\u2019s admission as a Member, and the Transfer or withdrawal of the Subscriber from the Company.</div>
<div class="section"><strong>4.3 Governing Law; Forum.</strong> This Subscription Agreement shall be governed by the laws of the State of ${J.name}, and disputes shall be resolved as provided in Article XV of the Operating Agreement.</div>
<div class="section"><strong>4.4 Counterparts; Electronic Signatures.</strong> This Subscription Agreement may be executed in counterparts (including by facsimile, scanned image, or electronic signature), each of which shall be deemed an original and all of which together shall constitute one instrument.</div>
</div>

<div class="signature-block">
<div class="section" style="margin-top:2rem;"><strong>SUBSCRIBER:</strong></div>
<div class="section">Subscriber Name (Print): _______________</div>
<div class="section">Subscription Amount: $_______________</div>
<div class="section">Class of Membership Interest: _______________</div>
<div class="section">Number of Units: _______________</div>
<div class="section">By: <span class="signature-line"></span><br/>Name: _______________<br/>Title (if entity): _______________<br/>Date: _______________</div>
<div class="section" style="margin-top:2rem;"><strong>ACCEPTED BY THE COMPANY:</strong><br/>${escapeHtml(d.companyName)}</div>
<div class="section">By: <span class="signature-line"></span><br/>Name: ${escapeHtml(d.managerName || '_______________')}<br/>Title: ${d.managementStructure === 'manager_managed' ? 'Manager' : 'Authorized Member'}<br/>Date: _______________</div>
</div>`;
}
function buildJoinderAgreement(d) {
  const J = getJurisdiction(d.jurisdiction);
  return DRAFT_BANNER + `<h1>Joinder Agreement<br/>to the Operating Agreement of<br/>${escapeHtml(d.companyName)}</h1>
<div class="section">This Joinder Agreement (this &ldquo;<strong>Joinder Agreement</strong>&rdquo;) is entered into as of ____________, 20___ by the undersigned (the &ldquo;<strong>Joining Member</strong>&rdquo;) for the benefit of ${escapeHtml(d.companyName)}, a ${J.name} limited liability company (the &ldquo;<strong>Company</strong>&rdquo;), and the other Members of the Company. Capitalized terms used and not defined herein have the meanings set forth in the Limited Liability Company Operating Agreement of the Company dated as of ${fmtDate(d.effectiveDate)} (as amended, modified, supplemented, or restated from time to time, the &ldquo;<strong>Operating Agreement</strong>&rdquo;).</div>

<div class="section" style="font-weight:bold; text-transform:uppercase; text-align:center; margin-top:1.5rem;">RECITALS</div>
<div class="section"><strong>A.</strong> The Joining Member desires to become a Member of the Company by reason of (check one): [_] a Permitted Transfer; [_] an issuance of new Membership Interests by the Company; [_] a Transfer approved pursuant to Article XI of the Operating Agreement; [_] other: _______________.</div>
<div class="section"><strong>B.</strong> Under the terms of the Operating Agreement, a Person may not become a Member of the Company without executing and delivering this Joinder Agreement.</div>
<div class="section">NOW, THEREFORE, in consideration of the foregoing and for other good and valuable consideration, the Joining Member, intending to be legally bound, agrees as follows:</div>

<p class="article-heading">1. JOINDER</p>
<div class="section"><strong>1.1 Agreement to Be Bound.</strong> The Joining Member hereby executes the Operating Agreement and agrees to be bound by, comply with, and perform all of the terms, conditions, covenants, obligations, and provisions of the Operating Agreement applicable to a Member of the Class identified in the Schedule attached hereto, with the same force and effect as if the Joining Member had been an original signatory to the Operating Agreement.</div>
<div class="section"><strong>1.2 Membership Interest Acquired.</strong> The Membership Interest acquired by the Joining Member is set forth on the Schedule attached hereto, which shall be added to, and become part of, Schedule&nbsp;A to the Operating Agreement upon execution of this Joinder Agreement.</div>

<p class="article-heading">2. REPRESENTATIONS AND WARRANTIES</p>
<div class="section">The Joining Member hereby makes, as of the date of this Joinder Agreement and as of the date the Joining Member is admitted as a Member, all of the representations and warranties set forth in the Subscription Agreement of the Company applicable to Members of the relevant Class, as if such representations and warranties were set forth in full herein.</div>

<p class="article-heading">3. SPOUSAL CONSENT</p>
<div class="section">If the Joining Member is an individual residing in a community-property state or whose Membership Interest may otherwise be subject to a spousal or marital-property interest, the Joining Member shall cause his or her spouse (if any) to execute the Spousal Consent attached hereto.</div>

<p class="article-heading">4. MISCELLANEOUS</p>
<div class="section"><strong>4.1 Governing Law.</strong> This Joinder Agreement shall be governed by and construed in accordance with the laws of the State of ${J.name}.</div>
<div class="section"><strong>4.2 Counterparts; Electronic Signatures.</strong> This Joinder Agreement may be executed in counterparts, including by electronic signature, each of which shall be deemed an original.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<div><strong>JOINING MEMBER:</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title (if applicable): ____________________________</div>
<div>Address: ____________________________</div>
<div>Date: ____________________________</div>
<div style="margin-top:1.5rem;"><strong>ACKNOWLEDGED:</strong></div>
<div>${escapeHtml(d.companyName)}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title: Manager</div>
</div>

<div class="schedule-heading" style="margin-top:2rem;">SCHEDULE TO JOINDER AGREEMENT &mdash; MEMBERSHIP INTEREST</div>
<table class="schedule-table">
  <thead><tr><th>Class</th><th style="text-align:right;">Units Acquired</th><th style="text-align:right;">Capital Contribution</th><th style="text-align:right;">Resulting Percentage Interest</th></tr></thead>
  <tbody><tr><td>____________________</td><td style="text-align:right;">____________</td><td style="text-align:right;">$____________</td><td style="text-align:right;">________%</td></tr></tbody>
</table>`;
}
function buildCapitalCallNotice(d) {
  return DRAFT_BANNER + `<h1>Notice of Capital Call<br/>${escapeHtml(d.companyName)}</h1>
<div class="section" style="text-align:right;">Date of Notice: ____________________________<br/>Capital Call No.: __________</div>

<div class="section" style="margin-top:1.5rem;"><strong>TO:</strong> Each Member of ${escapeHtml(d.companyName)} (the &ldquo;<strong>Company</strong>&rdquo;)</div>
<div class="section"><strong>FROM:</strong> ${escapeHtml(d.managerName || '[Manager]')}, as Manager of the Company</div>
<div class="section"><strong>RE:</strong> Notice of Capital Call pursuant to Article V of the Limited Liability Company Operating Agreement of the Company dated as of ${fmtDate(d.effectiveDate)} (the &ldquo;<strong>Operating Agreement</strong>&rdquo;)</div>

<div class="section" style="margin-top:1.5rem;">Capitalized terms used and not defined herein have the meanings set forth in the Operating Agreement.</div>

<p class="article-heading">1. CAPITAL CALL</p>
<div class="section"><strong>1.1 Aggregate Amount.</strong> The Manager hereby issues a Capital Call in the aggregate amount of $______________ (the &ldquo;<strong>Aggregate Capital Call Amount</strong>&rdquo;).</div>
<div class="section"><strong>1.2 Purpose.</strong> The proceeds of this Capital Call shall be used by the Company for the following purpose(s):</div>
<div class="section" style="padding-left:2rem;">_________________________________________________________<br/>_________________________________________________________<br/>_________________________________________________________</div>

<p class="article-heading">2. ALLOCATION AMONG MEMBERS</p>
<div class="section">The Aggregate Capital Call Amount is allocated among the Members in proportion to their respective [Class A Preferred Percentage Interests / pro rata Percentage Interests / other basis specified below], pursuant to Section&nbsp;5.3 of the Operating Agreement.</div>
<table class="schedule-table">
  <thead><tr><th>Member</th><th>Class</th><th style="text-align:right;">Percentage Interest</th><th style="text-align:right;">Capital Call Amount</th></tr></thead>
  <tbody><tr><td>____________________</td><td>__________</td><td style="text-align:right;">________%</td><td style="text-align:right;">$____________</td></tr>
  <tr><td>____________________</td><td>__________</td><td style="text-align:right;">________%</td><td style="text-align:right;">$____________</td></tr>
  <tr style="font-weight:bold; border-top:2px solid #1a1a1a;"><td colspan="3">Total</td><td style="text-align:right;">$____________</td></tr>
  </tbody>
</table>

<p class="article-heading">3. PAYMENT TERMS</p>
<div class="section"><strong>3.1 Funding Date.</strong> Payment of each Member\u2019s Capital Call Amount shall be due and payable in cash, in immediately available funds, on or before ____________, 20___ (the &ldquo;<strong>Funding Date</strong>&rdquo;), which is at least ${escapeHtml(d.capitalCallNotice || '15')} days following the date of this Notice as required by Section&nbsp;5.4 of the Operating Agreement.</div>
<div class="section"><strong>3.2 Payment Instructions.</strong> Wire transfers should be made to:</div>
<div class="section" style="padding-left:2rem;">Bank: _________________________________________<br/>ABA / Routing No.: _____________________________<br/>Account Name: _________________________________<br/>Account No.: ___________________________________<br/>Reference: ${escapeHtml(d.companyName)} &mdash; Capital Call No. __________</div>

<p class="article-heading">4. DEFAULT AND REMEDIES</p>
<div class="section">Each Member is reminded that failure to fund such Member\u2019s Capital Call Amount in full by the Funding Date shall constitute a Default under Section&nbsp;5.5 of the Operating Agreement, subject to the cure period and the remedies set forth in Section&nbsp;5.6 of the Operating Agreement (including, without limitation, punitive dilution, default-loan interest, forfeiture of profits interests, forced sale, and loss of voting rights, as elected by the Manager in the Manager\u2019s sole discretion).</div>

<p class="article-heading">5. QUESTIONS</p>
<div class="section">Any questions regarding this Notice may be directed to the Manager at the contact information set forth on Schedule&nbsp;A to the Operating Agreement.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<div><strong>ISSUED:</strong></div>
<div>${escapeHtml(d.companyName)}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager</div>
<div>Date: ____________________________</div>
</div>`;
}
function buildSideLetter(d) {
  const J = getJurisdiction(d.jurisdiction);
  return DRAFT_BANNER + `<h1>Side Letter<br/>(Template)<br/>${escapeHtml(d.companyName)}</h1>
<div class="section" style="text-align:right;">____________, 20___</div>

<div class="section" style="margin-top:1.5rem;"><strong>To:</strong> ____________________________ (the &ldquo;<strong>Investor</strong>&rdquo;)</div>
<div class="section"><strong>From:</strong> ${escapeHtml(d.companyName)} (the &ldquo;<strong>Company</strong>&rdquo;)</div>
<div class="section"><strong>Re:</strong> Side Letter regarding Investment in the Company</div>

<div class="section" style="margin-top:1.5rem;">Ladies and Gentlemen:</div>
<div class="section">Reference is made to the Limited Liability Company Operating Agreement of the Company dated as of ${fmtDate(d.effectiveDate)} (as amended, modified, supplemented, or restated from time to time, the &ldquo;<strong>Operating Agreement</strong>&rdquo;) and the Subscription Agreement of the Investor dated ____________, 20___ (the &ldquo;<strong>Subscription Agreement</strong>&rdquo;). Capitalized terms used and not defined in this letter (this &ldquo;<strong>Side Letter</strong>&rdquo;) have the meanings set forth in the Operating Agreement.</div>

<div class="section">In consideration of, and as a material inducement for, the Investor\u2019s commitment to invest in the Company, the Company and the Investor agree as follows. The provisions of this Side Letter modify the terms of the Operating Agreement as between the Company and the Investor only, and the most-favored-nation provision in Section&nbsp;7 below shall apply.</div>

<p class="article-heading">1. INFORMATION RIGHTS</p>
<div class="section">In addition to the reporting and inspection rights set forth in Article X of the Operating Agreement, the Investor shall be entitled to receive (a) quarterly unaudited financial statements of the Company within forty-five (45) days following the end of each calendar quarter; (b) annual audited financial statements within one hundred twenty (120) days following the end of each Fiscal Year; (c) annual management letters from the Manager describing the Company\u2019s performance, material developments, capital activity, and outlook; and (d) such additional information regarding the Company and its investments as the Investor may reasonably request from time to time.</div>

<p class="article-heading">2. ADVISORY BOARD / OBSERVER RIGHTS</p>
<div class="section">[<em>Optional:</em>] The Investor shall be entitled to designate one (1) representative to serve as a non-voting observer on any advisory committee or board established by the Company. The observer shall be entitled to attend all meetings of such committee or board and to receive all materials distributed to members thereof; provided, however, that the observer (a) shall not be entitled to vote; (b) shall be excluded from any session involving matters in which the Investor has a conflict of interest; and (c) shall be subject to the confidentiality provisions of Article [CONF] of the Operating Agreement.</div>

<p class="article-heading">3. CO-INVESTMENT RIGHTS</p>
<div class="section">[<em>Optional:</em>] If the Company or any Affiliate of the Manager pursues a co-investment opportunity in any transaction in which the Company is investing, the Investor shall be offered the right to participate in such co-investment opportunity pro rata with the Investor\u2019s relative size of commitment in the Company, on substantially the same terms as the Company\u2019s investment, subject to applicable securities-law restrictions.</div>

<p class="article-heading">4. EXCUSE PROVISIONS</p>
<div class="section">[<em>Optional:</em>] The Investor may, upon written notice to the Manager, elect to be excused from participating in any investment, capital call, or other transaction of the Company that the Investor reasonably determines would (a) cause the Investor to violate any law, regulation, or organizational document binding on the Investor; (b) cause the Investor to violate any policy or restriction applicable to the Investor (including ERISA, UBIT, foreign-investment-restriction, or anti-money-laundering policies); or (c) materially adversely affect the Investor\u2019s tax-exempt or governmental status.</div>

<p class="article-heading">5. TAX REPORTING</p>
<div class="section">The Company shall use commercially reasonable efforts to provide the Investor with (a) estimated tax information for each Fiscal Year within sixty (60) days following such Fiscal Year end, to facilitate the Investor\u2019s estimated tax payments; (b) the Investor\u2019s Schedule K-1 within ninety (90) days following such Fiscal Year end; and (c) such state, local, and foreign tax-reporting information as the Investor may reasonably request to facilitate the Investor\u2019s tax filings.</div>

<p class="article-heading">6. CONFIDENTIALITY EXCEPTION</p>
<div class="section">Notwithstanding the confidentiality provisions of the Operating Agreement, the Investor may, without consent, disclose information relating to the Company and the Investor\u2019s investment therein (a) to its direct and indirect investors, beneficial owners, partners, and other constituents on a need-to-know basis, subject to customary confidentiality protections; (b) to its attorneys, accountants, lenders, prospective transferees, and other professional advisors who are bound by professional or contractual duties of confidentiality; and (c) as required by applicable freedom-of-information, sunshine, or similar laws.</div>

<p class="article-heading">7. MOST-FAVORED-NATION</p>
<div class="section">If, after the date hereof, the Company enters into any side letter or other agreement with any other Member granting such other Member rights, privileges, or benefits that are materially more favorable, in the aggregate, than the rights, privileges, and benefits granted to the Investor under this Side Letter (taking into account the relative commitment size and other relevant factors), the Company shall promptly notify the Investor and shall offer the Investor the right to elect such more-favorable rights, privileges, and benefits.</div>

<p class="article-heading">8. MISCELLANEOUS</p>
<div class="section"><strong>8.1 Effect.</strong> The terms of this Side Letter shall be binding on the Company and the Investor as between such parties, and shall override any conflicting provision of the Operating Agreement. The terms of this Side Letter are personal to the Investor and shall not benefit any transferee of the Investor\u2019s Membership Interest except a Permitted Transferee that is a direct or indirect majority-owned vehicle of the Investor.</div>
<div class="section"><strong>8.2 Governing Law.</strong> This Side Letter shall be governed by and construed in accordance with the laws of the State of ${J.name}.</div>
<div class="section"><strong>8.3 Counterparts; Electronic Signatures.</strong> This Side Letter may be executed in counterparts, including by electronic signature, each of which shall be deemed an original.</div>
<div class="section"><strong>8.4 Survival.</strong> The provisions of this Side Letter shall survive the closing of the Investor\u2019s investment in the Company and the dissolution and winding up of the Company, in each case to the extent reasonably necessary to give effect to their terms.</div>

<div class="section" style="margin-top:1.5rem;">Please indicate the Investor\u2019s acceptance of the foregoing by executing this Side Letter in the space provided below.</div>

<div class="signature-block" style="margin-top:2rem;">
<div>Very truly yours,</div>
<div style="margin-top:1rem;">${escapeHtml(d.companyName)}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager</div>

<div style="margin-top:1.5rem;"><strong>ACKNOWLEDGED AND AGREED:</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name (Investor): ____________________________</div>
<div>Title (if applicable): ____________________________</div>
<div>Date: ____________________________</div>
</div>`;
}

/* ============================================================================
   PHASE 3a — MANAGER ENTITY OA + MANAGEMENT SERVICES AGREEMENT
   ============================================================================
   These two builders generate the companion documents for a sponsor-led
   structure where the Manager is a separate LLC (typical for institutional
   syndications). The Manager Entity OA governs the Manager LLC's internal
   affairs; the MSA governs the contractual relationship between the Manager
   LLC and the deal LLC, including all fees and expense reimbursement.

   Both documents respect the Manager Entity's own jurisdiction (which may
   differ from the deal LLC's jurisdiction — sponsors often domicile the
   Manager in Delaware regardless of where the deal LLC is formed).
   ============================================================================ */

function buildManagerEntityOA(d) {
  if (d.managerEntityGenerate !== 'full') {
    return DRAFT_BANNER + '<h1>Manager Entity Operating Agreement</h1><div class="section" style="font-style:italic;">No Manager Entity has been designated. To generate this document, select "Yes — Generate Manager Entity OA + Management Services Agreement" in the Management section.</div>';
  }
  // Resolve Manager Entity jurisdiction (defaults to deal LLC jurisdiction)
  const Jm = getJurisdiction(d.managerEntityJurisdiction || d.jurisdiction);
  const mgrEntityName = d.managerName || '[Manager Entity Name] LLC';

  // Parse principals — one per line, "Name, Percentage" format
  const rawPrincipals = (d.managerEntityPrincipals || '').split('\n').map(s => s.trim()).filter(Boolean);
  const principals = rawPrincipals.length ? rawPrincipals.map(line => {
    const m = line.match(/^(.+?),\s*(\d+(?:\.\d+)?)\s*%?$/);
    return m ? { name: m[1].trim(), pct: parseFloat(m[2]) } : { name: line, pct: null };
  }) : [{ name: '[Sole Member of Manager Entity]', pct: 100 }];

  const isSingleMember = principals.length === 1;
  const taxText = ({
    disregarded: 'The Manager Entity shall be classified as a disregarded entity for U.S. federal income tax purposes pursuant to Treasury Regulation Section 301.7701-3, and its activities shall be reflected on the federal income tax return of its sole owner.',
    partnership: 'The Manager Entity shall be classified as a partnership for U.S. federal income tax purposes under Subchapter K of the Code, and the Manager Entity\u2019s members and managers shall not take any action inconsistent with such classification.',
    s_corp: 'The Manager Entity shall make a timely election to be classified as an S corporation for U.S. federal income tax purposes by filing Form 2553. Each member of the Manager Entity represents and warrants that such member is an eligible S corporation shareholder, and the parties shall take such actions as are reasonably necessary to maintain such classification.'
  })[d.managerEntityTax || 'disregarded'] || '';

  const principalsTable = principals.map((p, i) => `<tr><td>${escapeHtml(p.name)}</td><td style="text-align:right;">${p.pct != null ? p.pct.toFixed(2) + '%' : '____%'}</td></tr>`).join('');
  const totalPct = principals.reduce((s, p) => s + (p.pct || 0), 0);

  return DRAFT_BANNER + `<h1>Limited Liability Company<br/>Operating Agreement<br/>of<br/>${escapeHtml(mgrEntityName)}</h1>
<h2>A ${Jm.name} Limited Liability Company</h2>
<div class="section">This Limited Liability Company Operating Agreement (this &ldquo;<strong>Agreement</strong>&rdquo;) is entered into and made effective as of ${fmtDate(d.effectiveDate)} (the &ldquo;<strong>Effective Date</strong>&rdquo;) by and among ${escapeHtml(mgrEntityName)}, a ${Jm.name} limited liability company (the &ldquo;<strong>Manager Entity</strong>&rdquo;), and the Persons identified on <em>Schedule&nbsp;A</em> hereto as the initial members of the Manager Entity (each, a &ldquo;<strong>Principal</strong>&rdquo; and collectively, the &ldquo;<strong>Principals</strong>&rdquo;).</div>

<div class="section" style="font-weight:bold; text-transform:uppercase; text-align:center;">Recitals</div>
<div class="section"><strong>A.</strong> The Manager Entity has been or will be formed as a limited liability company under and pursuant to the ${Jm.actName}, ${Jm.actCite}, as amended from time to time (the &ldquo;<strong>Act</strong>&rdquo;), by the filing of a ${Jm.certName} with the ${Jm.secOfStateOffice}.</div>
<div class="section"><strong>B.</strong> The Manager Entity has been formed for the purpose of serving as the manager of, and providing management services to, ${escapeHtml(d.companyName || '[Deal LLC]')}, a ${(JURIS_FULL[d.jurisdiction] || JURIS_FULL.DE).name} limited liability company (the &ldquo;<strong>Deal Entity</strong>&rdquo;), and may from time to time serve as the manager of, or provide management services to, other portfolio entities affiliated with the Principals.</div>
<div class="section"><strong>C.</strong> The Principals desire to enter into this Agreement to set forth their respective rights and obligations as members of the Manager Entity.</div>
<div class="section">NOW, THEREFORE, in consideration of the foregoing recitals and the mutual covenants set forth herein, the parties agree as follows:</div>

<p class="article-heading">ARTICLE I &mdash; FORMATION AND PURPOSE</p>
<div class="section"><strong>Section&nbsp;1.1 Formation.</strong> The Manager Entity has been (or will be) formed as a limited liability company under the Act by the filing of the ${Jm.certName} with the ${Jm.secOfStateOffice}.</div>
<div class="section"><strong>Section&nbsp;1.2 Name; Principal Office.</strong> The name of the Manager Entity is ${escapeHtml(mgrEntityName)}. The principal office of the Manager Entity is at such location as the Principals may from time to time designate.</div>
<div class="section"><strong>Section&nbsp;1.3 Purpose.</strong> ${d.managerScope === 'multi_deal' ?
`The purpose of the Manager Entity is to operate as a multi-deal sponsor platform for the Principals, including (a) serving as the manager of, and providing management services to, ${escapeHtml(d.companyName || '[Deal LLC]')} (the &ldquo;<strong>Deal Entity</strong>&rdquo;) and such other portfolio entities, joint ventures, funds, single-asset vehicles, and sponsor co-investment vehicles as the Principals may from time to time designate (each, a &ldquo;<strong>Portfolio Entity</strong>&rdquo;); (b) entering into and performing a Management Services Agreement or analogous engagement with each Portfolio Entity; (c) receiving, holding, and distributing fees and other compensation paid to it under each such engagement; (d) recruiting, employing, and supervising personnel; (e) maintaining the Manager Entity\u2019s books, records, insurance, regulatory registrations, and infrastructure; and (f) engaging in any and all activities incidental or related to the foregoing. The Principals acknowledge that the Manager Entity may, and likely will, manage Portfolio Entities whose interests are not aligned in all respects with those of the Deal Entity; allocation of investment opportunities, personnel time, and resources among Portfolio Entities shall be made by the Principals in good faith. The Manager Entity is not itself an investment vehicle for the Principals; the Principals\u2019 economic interests in the Deal Entity and any other Portfolio Entity (if any) are held directly and are governed by such Portfolio Entity\u2019s separate organizational documents.` :
`The purpose of the Manager Entity is (a) to serve as the manager of, and to provide management services to, ${escapeHtml(d.companyName || '[Deal LLC]')} (the &ldquo;<strong>Deal Entity</strong>&rdquo;); (b) to enter into and perform a Management Services Agreement with the Deal Entity; (c) to receive and distribute fees and other compensation paid to it under such Management Services Agreement; and (d) to engage in any and all activities incidental or related to the foregoing. The Manager Entity is purpose-built for the Deal Entity and is not intended to operate as a multi-deal sponsor platform; any expansion of the Manager Entity\u2019s scope to additional portfolio entities shall require an amendment to this Agreement under Section&nbsp;7.2. The Manager Entity is not itself an investment vehicle for the Principals; the Principals\u2019 investment interests in the Deal Entity (if any) are held directly and are governed by the Deal Entity\u2019s separate operating agreement.`
}</div>
<div class="section"><strong>Section&nbsp;1.4 Term.</strong> The Manager Entity commenced upon the filing of the ${Jm.certName} and shall continue in existence in perpetuity, unless and until dissolved and its affairs wound up pursuant to Article VI or as otherwise provided by the Act.</div>

<p class="article-heading">ARTICLE II &mdash; MEMBERS; CAPITAL; ECONOMIC INTERESTS</p>
<div class="section"><strong>Section&nbsp;2.1 Principals.</strong> The initial Principals and their respective Percentage Interests are set forth on <em>Schedule&nbsp;A</em> hereto. The Percentage Interests reflect the agreed-upon economic and voting interests of the Principals in the Manager Entity.</div>
<div class="section"><strong>Section&nbsp;2.2 No Mandatory Capital Contribution.</strong> No Principal shall be required to make any capital contribution to the Manager Entity. To the extent any Principal contributes capital, the contribution shall be reflected on the Manager Entity\u2019s books and shall not affect the Percentage Interests except by unanimous written consent of the Principals.</div>
<div class="section"><strong>Section&nbsp;2.3 Distributions of Fees.</strong> All fees received by the Manager Entity from the Deal Entity under the Management Services Agreement and from any other portfolio entity it manages, net of the Manager Entity\u2019s operating expenses, shall be distributed to the Principals in proportion to their respective Percentage Interests. Distributions shall be made at such times as the Principals may agree, and in any event no less frequently than quarterly.</div>
<div class="section"><strong>Section&nbsp;2.4 Allocations.</strong> Net income and net loss of the Manager Entity shall be allocated to the Principals in proportion to their respective Percentage Interests, in a manner consistent with Treasury Regulation Sections 1.704-1(b) and 1.704-2 (in the case of a partnership classification).</div>

<p class="article-heading">ARTICLE III &mdash; MANAGEMENT</p>
<div class="section"><strong>Section&nbsp;3.1 Management Structure.</strong> The Manager Entity shall be ${isSingleMember ? 'member-managed by the sole Principal' : 'managed by the Principals acting by Majority in Interest (or such higher threshold as is specified for particular actions herein), provided that day-to-day management may be delegated to one or more designated Principals or to officers appointed by the Principals'}.</div>
<div class="section"><strong>Section&nbsp;3.2 Authority to Bind the Deal Entity.</strong> In its capacity as Manager of the Deal Entity, the Manager Entity shall act through such of its Principals (or its duly authorized officers) as the Principals shall designate. ${isSingleMember ? 'The sole Principal is hereby designated as the authorized representative of the Manager Entity for all such purposes.' : 'Each act taken on behalf of the Deal Entity by a duly authorized representative of the Manager Entity shall bind the Manager Entity.'}</div>
${isSingleMember ? '' : `<div class="section"><strong>Section&nbsp;3.3 Major Decisions of the Manager Entity.</strong> The following actions of the Manager Entity shall require the affirmative vote or written consent of Principals holding at least seventy-five percent (75%) of the Percentage Interests: (a) dissolution of the Manager Entity; (b) any sale, assignment, or other disposition of the Manager Entity\u2019s rights under any Management Services Agreement; (c) entering into any Management Services Agreement with any new portfolio entity; (d) any material amendment to this Agreement; (e) admission of a new Principal; and (f) any indebtedness of the Manager Entity in excess of $100,000.</div>`}
<div class="section"><strong>Section&nbsp;3.${isSingleMember ? '3' : '4'} Compensation of Principals.</strong> No Principal shall be entitled to compensation for services performed for or on behalf of the Manager Entity in such Principal\u2019s capacity as a Principal, except that the Manager Entity may, with the consent of the Principals, pay reasonable salaries or guaranteed payments to one or more Principals who serve as officers or employees of the Manager Entity.</div>

<p class="article-heading">ARTICLE IV &mdash; TAX MATTERS</p>
<div class="section"><strong>Section&nbsp;4.1 Tax Classification.</strong> ${taxText}</div>
<div class="section"><strong>Section&nbsp;4.2 Tax Year; Accounting Method.</strong> The Manager Entity\u2019s taxable year shall be the calendar year unless otherwise required by Code Section 706. The Manager Entity shall keep its books and records on the cash or accrual method as the Principals may determine, consistent with applicable tax law.</div>
${d.managerEntityTax === 'partnership' ? '<div class="section"><strong>Section&nbsp;4.3 Partnership Representative.</strong> The Principal designated by the Principals (or, in the absence of such designation, the Principal holding the largest Percentage Interest) shall serve as the &ldquo;partnership representative&rdquo; of the Manager Entity under Code Section 6223 and the Bipartisan Budget Act of 2015, and is authorized to make all elections and take all actions on behalf of the Manager Entity that the partnership representative is authorized to make under the Code.</div>' : ''}

<p class="article-heading">ARTICLE V &mdash; TRANSFERS; ADMISSIONS</p>
<div class="section"><strong>Section&nbsp;5.1 Restrictions on Transfer.</strong> No Principal may Transfer all or any portion of its Percentage Interest in the Manager Entity without the prior written consent of the other Principals, which consent may be withheld in their sole and absolute discretion. Any purported Transfer in violation of this Section&nbsp;5.1 shall be null and void.</div>
<div class="section"><strong>Section&nbsp;5.2 Permitted Transfers.</strong> Notwithstanding Section&nbsp;5.1, a Principal may Transfer its Percentage Interest to (a) a revocable or irrevocable trust for the benefit of such Principal or such Principal\u2019s immediate family members; (b) a wholly-owned entity of such Principal; or (c) upon such Principal\u2019s death, to such Principal\u2019s estate or testamentary trust, in each case provided that the transferee executes a joinder to this Agreement.</div>
<div class="section"><strong>Section&nbsp;5.3 Admission of New Principals.</strong> A new Principal may be admitted to the Manager Entity only with the written consent of all then-existing Principals and upon execution by such new Principal of a joinder to this Agreement. Upon admission, the Percentage Interests shall be reallocated as agreed by all Principals.</div>

<p class="article-heading">ARTICLE VI &mdash; DISSOLUTION</p>
<div class="section"><strong>Section&nbsp;6.1 Events of Dissolution.</strong> The Manager Entity shall be dissolved upon the first to occur of: (a) the written consent of Principals holding at least seventy-five percent (75%) of the Percentage Interests; (b) the termination of all Management Services Agreements to which the Manager Entity is a party and the determination of the Principals not to engage in further management activities; or (c) the entry of a decree of judicial dissolution under ${cite(Jm, 'judDissol')} of the Act.</div>
<div class="section"><strong>Section&nbsp;6.2 Winding Up.</strong> Upon dissolution, the Manager Entity shall wind up its affairs in accordance with the Act. The Manager Entity\u2019s remaining assets shall be distributed (i) first, to creditors in the order of priority required by ${cite(Jm, 'dissolPriority')} of the Act; (ii) second, to the Principals in proportion to their respective Percentage Interests; and (iii) thereafter, the Manager Entity shall be terminated, and a ${Jm.certCancelName} shall be filed with the ${Jm.secOfStateOffice} in accordance with ${cite(Jm, 'certCancel')} of the Act.</div>

<p class="article-heading">ARTICLE VII &mdash; MISCELLANEOUS</p>
<div class="section"><strong>Section&nbsp;7.1 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${Jm.name}, without regard to its choice-of-law principles.</div>
<div class="section"><strong>Section&nbsp;7.2 Amendment.</strong> This Agreement may be amended only by a written instrument executed by ${isSingleMember ? 'the sole Principal' : 'Principals holding at least seventy-five percent (75%) of the Percentage Interests'}, except that any amendment that would adversely affect the rights of any Principal disproportionately shall require the written consent of such adversely affected Principal.</div>
<div class="section"><strong>Section&nbsp;7.3 Counterparts; Electronic Signatures.</strong> This Agreement may be executed in counterparts, including by electronic signature, each of which shall be deemed an original.</div>
<div class="section"><strong>Section&nbsp;7.4 Entire Agreement.</strong> This Agreement, together with the Schedules hereto and the Management Services Agreement(s) executed by the Manager Entity, constitutes the entire agreement of the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements.</div>
<div class="section"><strong>Section&nbsp;7.5 Indemnification.</strong> The Manager Entity shall indemnify each Principal (and each officer, employee, and agent of the Manager Entity) to the maximum extent permitted by the Act, against any loss, claim, damage, liability, judgment, fine, settlement, cost, or expense (including reasonable attorneys\u2019 fees) arising out of or in connection with such Person\u2019s service to the Manager Entity, except to the extent such loss results from such Person\u2019s fraud, willful misconduct, or knowing violation of law.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<p style="font-weight:bold; text-align:center;">IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the Effective Date first written above.</p>
<div style="margin-top:1.5rem;"><strong>${escapeHtml(mgrEntityName)}</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title: ____________________________</div>
${principals.map(p => `<div style="margin-top:1.5rem;"><strong>PRINCIPAL:</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(p.name)}</div>
<div>Percentage Interest: ${p.pct != null ? p.pct.toFixed(2) + '%' : '____%'}</div>`).join('')}
</div>

<div class="schedule-heading" style="margin-top:2rem;">SCHEDULE A &mdash; PRINCIPALS AND PERCENTAGE INTERESTS</div>
<table class="schedule-table">
  <thead><tr><th>Principal</th><th style="text-align:right;">Percentage Interest</th></tr></thead>
  <tbody>
    ${principalsTable}
    <tr style="font-weight:bold; border-top:2px solid #1a1a1a;"><td>Total</td><td style="text-align:right;">${totalPct.toFixed(2)}%</td></tr>
  </tbody>
</table>${Math.abs(totalPct - 100) > 0.01 ? '<div class="section" style="color:#8b3a3a; margin-top:0.5rem; font-size:0.9rem;"><em>NOTE:</em> Sum of Percentage Interests does not equal 100%. Please verify the principals list.</div>' : ''}`;
}

/* ============================================================================
   MANAGEMENT SERVICES AGREEMENT
   Bilateral contract between the Manager Entity and the Deal Entity.
   Sets forth services, fee waterfall, expense reimbursement, term, and
   termination. Designed to be referenced by Article IX of the Deal Entity's
   Operating Agreement.
   ============================================================================ */

function buildManagementServicesAgreement(d) {
  if (d.managerEntityGenerate !== 'full') {
    return DRAFT_BANNER + '<h1>Management Services Agreement</h1><div class="section" style="font-style:italic;">No Management Services Agreement has been configured. To generate this document, select "Yes — Generate Manager Entity OA + Management Services Agreement" in the Management section.</div>';
  }
  const J = getJurisdiction(d.jurisdiction);
  const mgrName = d.managerName || '[Manager Entity Name] LLC';
  const Jm = getJurisdiction(d.managerEntityJurisdiction || d.jurisdiction);

  // Fee renderers
  // Fee sophistication — modifies payment-trigger language
  const sophistication = d.feeSophistication || 'basic';
  const sophisticationModifier = ({
    basic: '',
    crystallized: ' Notwithstanding the foregoing payment cadence, the Asset Management Fee shall accrue without current payment and shall be paid only upon the earlier of (i) a Liquidation Event, (ii) the closing of any refinancing of the Company\u2019s portfolio assets that generates net cash proceeds available for distribution, or (iii) any other event designated by the Manager and consented to by the Required Members; upon such payment event, the aggregate accrued and unpaid Asset Management Fee shall be paid in full out of available proceeds, ahead of any distributions to Members other than tax distributions under Article VII of the Operating Agreement. All other Fees shall be paid when earned in accordance with the schedule above.',
    hurdle_conditional: ' Notwithstanding the foregoing payment cadence, no Fee shall be paid to the Manager with respect to any period in which the Class A Preferred Return (as defined in the Operating Agreement) is not current. Any Fee that would have been paid but for the foregoing limitation shall accrue and shall be paid as soon as the Class A Preferred Return is brought current, with interest at the same rate as the Class A Preferred Return.',
    fee_offset: ' For the avoidance of doubt, and notwithstanding the foregoing, the aggregate Fees paid to the Manager under this Agreement shall be credited dollar-for-dollar against, and shall reduce, the carried interest (or &ldquo;promote&rdquo;) otherwise payable to the Manager (or its Affiliates) under the distribution waterfall set forth in Article VII of the Operating Agreement. To the extent that aggregate Fees paid exceed the carried interest otherwise payable to the Manager, the excess shall be retained by the Manager (i.e., the offset shall not result in any clawback against the Manager).'
  })[sophistication] || '';

  const feeBasisLabels = {
    pct_gav: 'percent (%) per annum of the Gross Asset Value of the Company\u2019s real-property and other portfolio assets, measured as of the first day of each calendar quarter',
    pct_equity: 'percent (%) per annum of the aggregate Capital Contributions to the Company',
    pct_revenue: 'percent (%) per annum of the Company\u2019s gross effective revenue',
    pct_price: 'percent (%) of the gross purchase price of each acquisition completed by or for the Company',
    pct_gain: 'percent (%) of the gain (computed for federal income tax purposes) realized by the Company on each disposition',
    pct_hard_costs: 'percent (%) of hard construction costs for each construction project undertaken by or for the Company',
    pct_total_dev: 'percent (%) of total development cost (including hard costs, soft costs, and contingency) for each project',
    pct_loan: 'percent (%) of the gross principal amount of any new loan obtained by the Company',
    fixed: 'fixed dollar amount per annum (or per transaction, as applicable)'
  };
  function renderFee(label, basisKey, basisVal, rateVal, paymentTrigger) {
    if (!basisVal || basisVal === 'none') return '';
    const basisDesc = feeBasisLabels[basisVal] || 'as agreed by the parties';
    const rateDesc = rateVal ? `at the rate of ${escapeHtml(rateVal)} ${basisVal === 'fixed' ? '(fixed dollar amount)' : (basisVal.startsWith('pct_') ? '%' : '')}` : '[__]';
    return `<div class="section"><strong>${label}.</strong> The Company shall pay to the Manager a fee (the &ldquo;<strong>${label}</strong>&rdquo;) equal to ${rateDesc} of ${basisDesc}. The ${label} shall be ${paymentTrigger}.</div>`;
  }

  // Property Management Fee rendering — branches on pmApproach
  const pmApproach = d.pmApproach || 'direct';
  function renderPmFee() {
    if (pmApproach === 'outsourced_no_fee') {
      return `<div class="section"><strong>Property Management.</strong> Property management of the Company\u2019s portfolio assets shall be performed by one or more third-party property managers selected by the Manager and engaged by the Company under separate property management agreement(s). The Manager shall not be entitled to any Property Management Fee under this Agreement; the Company shall pay any such third-party property manager directly pursuant to the terms of its separate property management agreement.</div>`;
    }
    if (pmApproach === 'outsourced_oversight') {
      const rateDesc = d.msaPmRate ? `at the rate of ${escapeHtml(d.msaPmRate)}${(d.msaPmBasis || '').startsWith('pct_') ? '%' : ''}` : '[__]';
      const basisDesc = feeBasisLabels[d.msaPmBasis] || 'percent (%) per annum of the Company\u2019s gross effective revenue';
      return `<div class="section"><strong>Property Management Oversight Fee.</strong> Property management of the Company\u2019s portfolio assets shall be performed by one or more third-party property managers selected by the Manager and engaged by the Company under separate property management agreement(s). The Manager shall be responsible for oversight, selection, monitoring, performance review, and replacement of such third-party property manager(s), and for that oversight role, the Company shall pay to the Manager a fee (the &ldquo;<strong>PM Oversight Fee</strong>&rdquo;) equal to ${rateDesc} of ${basisDesc}, computed and paid in arrears on a monthly basis. The PM Oversight Fee is in addition to, and not in lieu of, any fee paid directly by the Company to the third-party property manager.</div>`;
    }
    // direct
    return renderFee('Property Management Fee', 'pm', d.msaPmBasis, d.msaPmRate, 'computed and paid in arrears on a monthly basis');
  }

  const fees = [
    renderFee('Asset Management Fee', 'amf', d.msaAmfBasis, d.msaAmfRate, 'computed and paid in arrears on a quarterly basis, no later than thirty (30) days following the end of each calendar quarter'),
    renderFee('Acquisition Fee', 'acq', d.msaAcqBasis, d.msaAcqRate, 'earned and payable upon the closing of each acquisition, out of the Company\u2019s sources of funds for such acquisition'),
    renderFee('Disposition Fee', 'disp', d.msaDispBasis, d.msaDispRate, 'earned and payable upon the closing of each disposition, out of the gross proceeds of such disposition'),
    renderFee('Construction Management Fee', 'cm', d.msaCmBasis, d.msaCmRate, 'earned and paid in installments as construction draws are funded'),
    renderFee('Refinancing Fee', 'refi', d.msaRefiBasis, d.msaRefiRate, 'earned and payable upon the closing of each refinancing, out of the gross proceeds of the new loan'),
    renderPmFee()
  ].filter(Boolean).join('');

  // Sophistication-trigger paragraph appended at the end of the Fees section
  const sophisticationBlock = sophisticationModifier ?
    `<div class="section"><strong>Fee Payment Mechanics.</strong>${sophisticationModifier}</div>` : '';

  const termText = ({
    deal_life: 'The Term of this Agreement shall commence on the Effective Date and shall continue until the dissolution and winding up of the Company.',
    five_year: 'The initial Term of this Agreement shall commence on the Effective Date and shall continue for an initial term of five (5) years. Following the initial Term, this Agreement shall automatically renew for successive one (1) year terms, unless either party gives written notice of non-renewal to the other party at least one hundred eighty (180) days prior to the end of the then-current Term.',
    three_year: 'The initial Term of this Agreement shall commence on the Effective Date and shall continue for an initial term of three (3) years. Following the initial Term, this Agreement shall automatically renew for successive one (1) year terms, unless either party gives written notice of non-renewal to the other party at least ninety (90) days prior to the end of the then-current Term.',
    annual: 'The initial Term of this Agreement shall commence on the Effective Date and shall continue for one (1) year. Following the initial Term, this Agreement shall automatically renew for successive one (1) year terms, unless either party gives written notice of non-renewal to the other party at least sixty (60) days prior to the end of the then-current Term.'
  })[d.msaTerm || 'deal_life'];

  const expText = ({
    standard: 'The Company shall reimburse the Manager for all out-of-pocket third-party expenses reasonably incurred by the Manager in the performance of the Services, including travel, due diligence, legal, accounting, tax, audit, and professional fees, but not including any allocation of the Manager\u2019s internal overhead, salaries, or general and administrative expenses, which shall be borne by the Manager out of the Fees.',
    broad: 'The Company shall reimburse the Manager for all reasonable expenses incurred by the Manager in the performance of the Services, including (i) third-party out-of-pocket expenses (travel, due diligence, legal, accounting, tax, audit, and professional fees) and (ii) reasonable allocations of the Manager\u2019s internal overhead (including salaries, benefits, rent, and general and administrative expenses) attributable to the Services, computed on a cost basis without markup.',
    none: 'All expenses incurred by the Manager in the performance of the Services shall be borne by the Manager out of the Fees, and the Company shall have no obligation to reimburse the Manager for any expense whatsoever.'
  })[d.msaExpenseReimb || 'standard'];

  const termTriggerText = ({
    cause_only: 'This Agreement may be terminated by the Company only for Cause (as defined below) and only upon the written consent of the Required Members of the Company at the threshold required for the removal of a Manager under the Operating Agreement of the Company.',
    cause_or_keyman: 'This Agreement may be terminated by the Company (i) for Cause (as defined below) at any time, upon the written consent of the Required Members of the Company at the threshold required for the removal of a Manager under the Operating Agreement; or (ii) upon the occurrence of a Key-Person Event (defined as the death, permanent disability, or voluntary withdrawal of [insert key principal name]).',
    cause_or_supermajority: 'This Agreement may be terminated by the Company (i) for Cause (as defined below) at any time, upon the written consent of the Required Members of the Company; or (ii) without Cause, upon the written consent of Members holding at least sixty-six and two-thirds percent (66 2/3%) of the Percentage Interests of the Company.'
  })[d.msaTermination || 'cause_only'];

  const termFeeText = ({
    none: 'Upon any termination of this Agreement, the Manager shall be entitled to receive Fees accrued and unpaid as of the date of termination and any reimbursable expenses incurred but not reimbursed as of such date, but shall not be entitled to any termination fee or other compensation.',
    prior_year: 'Upon any termination of this Agreement other than for Cause, the Manager shall be entitled to receive, in addition to accrued and unpaid Fees and reimbursable expenses, a termination fee equal to the aggregate Fees earned by the Manager during the twelve (12) months immediately preceding the effective date of termination.',
    two_year: 'Upon any termination of this Agreement other than for Cause, the Manager shall be entitled to receive, in addition to accrued and unpaid Fees and reimbursable expenses, a termination fee equal to two (2) times the aggregate Fees earned by the Manager during the twelve (12) months immediately preceding the effective date of termination.',
    present_value: 'Upon any termination of this Agreement other than for Cause, the Manager shall be entitled to receive, in addition to accrued and unpaid Fees and reimbursable expenses, a termination fee equal to the net present value of all Fees that would have been earned by the Manager during the remainder of the then-current Term, discounted at a rate equal to the prime rate as published in The Wall Street Journal on the date of termination plus two percent (2%).'
  })[d.msaTermFee || 'none'];

  return DRAFT_BANNER + `<h1>Management Services Agreement<br/>between<br/>${escapeHtml(mgrName)}<br/>and<br/>${escapeHtml(d.companyName || '[Company Name]')}</h1>
<div class="section">This Management Services Agreement (this &ldquo;<strong>Agreement</strong>&rdquo;) is entered into and made effective as of ${fmtDate(d.effectiveDate)} (the &ldquo;<strong>Effective Date</strong>&rdquo;) by and between ${escapeHtml(mgrName)}, a ${Jm.name} limited liability company (the &ldquo;<strong>Manager</strong>&rdquo;), and ${escapeHtml(d.companyName || '[Company Name]')}, a ${J.name} limited liability company (the &ldquo;<strong>Company</strong>&rdquo;). Capitalized terms used and not defined herein have the meanings set forth in the Limited Liability Company Operating Agreement of the Company dated as of the date hereof (as amended from time to time, the &ldquo;<strong>Operating Agreement</strong>&rdquo;).</div>

<div class="section" style="font-weight:bold; text-transform:uppercase; text-align:center; margin-top:1.5rem;">RECITALS</div>
<div class="section"><strong>A.</strong> Pursuant to the Operating Agreement, the Manager has been designated to serve as the Manager of the Company.</div>
<div class="section"><strong>B.</strong> The Company and the Manager desire to enter into this Agreement to set forth the terms and conditions on which the Manager shall provide management services to the Company in such capacity, including the compensation payable to the Manager.</div>
<div class="section">NOW, THEREFORE, in consideration of the foregoing recitals and the mutual covenants set forth herein, the parties agree as follows:</div>

<p class="article-heading">1. ENGAGEMENT; SERVICES</p>
<div class="section"><strong>1.1 Engagement.</strong> The Company hereby engages the Manager to provide the Services (as defined below), and the Manager hereby accepts such engagement, subject to the terms and conditions of this Agreement.</div>
<div class="section"><strong>1.2 Services.</strong> The Manager shall provide the following services to the Company (collectively, the &ldquo;<strong>Services</strong>&rdquo;): (a) overall management, supervision, and direction of the business and affairs of the Company; (b) identification, evaluation, negotiation, and consummation of investment and acquisition opportunities for the Company; (c) asset management of the Company\u2019s portfolio, including ongoing monitoring of operations, financial performance, and strategic alternatives; (d) oversight of property management and third-party service providers; (e) financing and refinancing of the Company\u2019s portfolio assets; (f) tax planning, accounting oversight, and coordination with the Company\u2019s tax preparers and auditors; (g) investor relations, including preparation and delivery of periodic reports, capital call notices, distribution notices, and Schedules K-1; and (h) such other services as are reasonably necessary or appropriate in connection with the operation of the Company\u2019s business.</div>
<div class="section"><strong>1.3 Standard of Care.</strong> In performing the Services, the Manager shall act in a manner consistent with the standards of care applicable to the Manager under the Operating Agreement, the Act, and applicable law. Without limiting the generality of the foregoing, the Manager shall perform the Services with reasonable diligence and in good faith.</div>
<div class="section"><strong>1.4 Authority.</strong> Subject to the limitations set forth in the Operating Agreement (including the Major Decisions requiring Member consent), the Manager shall have full authority to take all actions necessary or appropriate in connection with the performance of the Services on behalf of the Company.</div>

<p class="article-heading">2. FEES</p>
<div class="section">In consideration for the Services, the Company shall pay to the Manager the fees (collectively, the &ldquo;<strong>Fees</strong>&rdquo;) set forth below.</div>
${fees || '<div class="section"><em>No fees configured. Use the Manager Entity &amp; Services section of the form to populate the fee schedule.</em></div>'}
${sophisticationBlock}

<p class="article-heading">3. EXPENSE REIMBURSEMENT</p>
<div class="section"><strong>3.1 Reimbursement.</strong> ${expText}</div>
<div class="section"><strong>3.2 Documentation.</strong> The Manager shall submit to the Company, no less frequently than quarterly, an itemized statement of reimbursable expenses, together with supporting documentation reasonably requested by the Company. The Company shall reimburse such expenses within thirty (30) days following receipt of the statement and supporting documentation, unless disputed in good faith.</div>

<p class="article-heading">4. TERM</p>
<div class="section"><strong>4.1 Term.</strong> ${termText}</div>

<p class="article-heading">5. TERMINATION</p>
<div class="section"><strong>5.1 Termination Triggers.</strong> ${termTriggerText}</div>
<div class="section"><strong>5.2 Cause Defined.</strong> &ldquo;Cause&rdquo; means, with respect to the Manager, any of the following: (a) fraud, willful misconduct, gross negligence, or knowing violation of law by the Manager (or by any officer, director, or controlling Person of the Manager) in the performance of the Services; (b) a material breach by the Manager of this Agreement or the Operating Agreement that, if curable, is not cured within thirty (30) days following written notice from the Company specifying the breach; (c) the bankruptcy, insolvency, or dissolution of the Manager; or (d) a final, non-appealable judgment or settlement against the Manager involving fraud or moral turpitude.</div>
<div class="section"><strong>5.3 Effect of Termination.</strong> ${termFeeText}</div>
<div class="section"><strong>5.4 Wind-Down Cooperation.</strong> Following any termination of this Agreement, the Manager shall reasonably cooperate with the Company and any successor manager in the orderly transition of the Services, including delivering all books, records, files, contracts, and other information relating to the Company that is in the Manager\u2019s possession or control. The Company shall reimburse the Manager for reasonable out-of-pocket expenses incurred in connection with such wind-down cooperation.</div>

<p class="article-heading">6. INDEMNIFICATION</p>
<div class="section"><strong>6.1 Indemnification by Company.</strong> The Company shall indemnify, defend, and hold harmless the Manager (and its members, managers, officers, employees, and agents) (each, an &ldquo;<strong>Indemnified Person</strong>&rdquo;) from and against any and all losses, claims, damages, liabilities, judgments, fines, settlements, costs, and expenses (including reasonable attorneys\u2019 fees and disbursements) arising out of or in connection with the performance by the Manager of the Services, except to the extent such loss results from the Indemnified Person\u2019s fraud, willful misconduct, gross negligence, or knowing violation of law. This indemnification obligation is in addition to, and not in lieu of, the indemnification obligations set forth in the Operating Agreement.</div>

<p class="article-heading">7. CONFIDENTIALITY</p>
<div class="section"><strong>7.1 Confidentiality.</strong> The Manager shall hold in strict confidence all confidential and proprietary information of the Company that is provided to or developed by the Manager in connection with the Services, and shall not disclose such information except (a) to its directors, officers, employees, and professional advisors who have a need to know in connection with the Services; (b) as required by law, regulation, or legal process; or (c) with the prior written consent of the Company. The obligations of this Section&nbsp;7.1 shall survive any termination of this Agreement for a period of five (5) years.</div>

<p class="article-heading">8. MISCELLANEOUS</p>
<div class="section"><strong>8.1 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${J.name}, without regard to its choice-of-law principles.</div>
<div class="section"><strong>8.2 Dispute Resolution.</strong> Any dispute arising out of or relating to this Agreement shall be resolved in accordance with the dispute-resolution provisions of the Operating Agreement.</div>
<div class="section"><strong>8.3 Assignment.</strong> Neither party may assign this Agreement or any of its rights or obligations hereunder without the prior written consent of the other party, except that the Manager may assign this Agreement to an Affiliate of the Manager that is wholly-owned or controlled by the same Persons as the Manager, upon written notice to the Company.</div>
<div class="section"><strong>8.4 Independent Contractor.</strong> The Manager is an independent contractor of the Company. Nothing in this Agreement shall be construed to create a partnership, joint venture, agency relationship, or employer-employee relationship between the parties.</div>
<div class="section"><strong>8.5 Entire Agreement.</strong> This Agreement, together with the Operating Agreement, constitutes the entire agreement of the parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, whether oral or written.</div>
<div class="section"><strong>8.6 Amendment.</strong> This Agreement may be amended only by a written instrument executed by both parties.</div>
<div class="section"><strong>8.7 Counterparts; Electronic Signatures.</strong> This Agreement may be executed in counterparts, including by electronic signature, each of which shall be deemed an original.</div>
<div class="section"><strong>8.8 Survival.</strong> Sections 5.3 (Termination Fee), 5.4 (Wind-Down), 6 (Indemnification), 7 (Confidentiality), and 8 (Miscellaneous) shall survive the termination of this Agreement.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<p style="font-weight:bold; text-align:center;">IN WITNESS WHEREOF, the parties hereto have executed this Management Services Agreement as of the Effective Date first written above.</p>
<div style="margin-top:1.5rem;"><strong>MANAGER:</strong></div>
<div>${escapeHtml(mgrName)}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title: ____________________________</div>
<div style="margin-top:1.5rem;"><strong>COMPANY:</strong></div>
<div>${escapeHtml(d.companyName || '[Company Name]')}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title: Authorized Member</div>
</div>${d.feeIllustrationInclude === 'yes' ? buildFeeIllustrationAppendix(d) : ''}`;
}

/* ============================================================================
   FEE ILLUSTRATION APPENDIX — Schedule 1 to the MSA
   Year-by-year computation of fees in dollars under user-supplied deal
   assumptions. Disclaimed as illustrative only; not a guarantee.
   ============================================================================ */
function buildFeeIllustrationAppendix(d) {
  const totalCost = d.fiTotalCost || 0;
  const equity = d.fiEquity || 0;
  const holdYears = Math.max(1, Math.round(d.fiHoldYears || 5));
  const exitValue = d.fiExitValue || (totalCost * 1.5);
  const gain = Math.max(0, exitValue - totalCost);
  const acquisitionPrice = totalCost; // proxy: total cost ≈ acquisition price for simplicity

  // Approximate "gross asset value" trajectory: assume linear from totalCost to exitValue
  function gavAtYear(y) {
    if (holdYears <= 0) return totalCost;
    return totalCost + ((exitValue - totalCost) * (y / holdYears));
  }
  // Approximate annual gross revenue: assume 7% cap rate on GAV
  function revenueAtYear(y) {
    return gavAtYear(y) * 0.07;
  }

  // Fee computations for each year
  function feeForYear(y, basis, rate) {
    if (!basis || basis === 'none' || !rate) return 0;
    const r = parseFloat(String(rate).replace(/[,%]/g, '')) / 100;
    if (isNaN(r)) return 0;
    switch (basis) {
      case 'pct_gav': return gavAtYear(y) * r;
      case 'pct_equity': return equity * r;
      case 'pct_revenue': return revenueAtYear(y) * r;
      case 'fixed': return parseFloat(String(rate).replace(/[,$]/g, '')) || 0;
      default: return 0;
    }
  }

  // One-time fees
  function acqFee() {
    const basis = d.msaAcqBasis, rate = d.msaAcqRate;
    if (!basis || basis === 'none' || !rate) return 0;
    const r = parseFloat(String(rate).replace(/[,%]/g, '')) / 100;
    if (basis === 'pct_price') return acquisitionPrice * r;
    if (basis === 'pct_equity') return equity * r;
    if (basis === 'fixed') return parseFloat(String(rate).replace(/[,$]/g, '')) || 0;
    return 0;
  }
  function dispFee() {
    const basis = d.msaDispBasis, rate = d.msaDispRate;
    if (!basis || basis === 'none' || !rate) return 0;
    const r = parseFloat(String(rate).replace(/[,%]/g, '')) / 100;
    if (basis === 'pct_price') return exitValue * r;
    if (basis === 'pct_gain') return gain * r;
    if (basis === 'fixed') return parseFloat(String(rate).replace(/[,$]/g, '')) || 0;
    return 0;
  }

  let totalAmf = 0, totalPm = 0;
  const yearRows = [];
  const pmApproachForAppendix = d.pmApproach || 'direct';
  for (let y = 1; y <= holdYears; y++) {
    const amf = feeForYear(y, d.msaAmfBasis, d.msaAmfRate);
    const pm = (pmApproachForAppendix === 'direct' || pmApproachForAppendix === 'outsourced_oversight') ? feeForYear(y, d.msaPmBasis, d.msaPmRate) : 0;
    totalAmf += amf; totalPm += pm;
    yearRows.push(`<tr><td>Year ${y}</td><td style="text-align:right;">${fmtMoney(gavAtYear(y))}</td><td style="text-align:right;">${fmtMoney(revenueAtYear(y))}</td><td style="text-align:right;">${fmtMoney(amf)}</td><td style="text-align:right;">${fmtMoney(pm)}</td><td style="text-align:right;">${fmtMoney(amf + pm)}</td></tr>`);
  }

  const acq = acqFee();
  const disp = dispFee();
  const totalFees = acq + totalAmf + totalPm + disp;
  const feeLoadOnEquity = equity > 0 ? (totalFees / equity * 100) : 0;
  const feeLoadOnTotalCost = totalCost > 0 ? (totalFees / totalCost * 100) : 0;

  // Net IRR drag (approximate): treat fees as reducing equity return
  // Net to investor = exit value - debt at exit - total fees, where debt at exit ≈ total cost - equity (assume no amortization)
  const debt = Math.max(0, totalCost - equity);
  const netToEquity = Math.max(0, exitValue - debt - totalFees);
  const investorMOIC = equity > 0 ? netToEquity / equity : 0;
  const grossExitMOIC = equity > 0 ? Math.max(0, exitValue - debt) / equity : 0;
  // Approximate IRR via MOIC^(1/n) - 1 (treating as point-in-time)
  const investorIRR = investorMOIC > 0 && holdYears > 0 ? (Math.pow(investorMOIC, 1 / holdYears) - 1) * 100 : 0;
  const grossIRR = grossExitMOIC > 0 && holdYears > 0 ? (Math.pow(grossExitMOIC, 1 / holdYears) - 1) * 100 : 0;
  const irrDrag = grossIRR - investorIRR;

  return `<div class="schedule-heading" style="margin-top:2.5rem; page-break-before:always;">SCHEDULE 1 &mdash; FEE ILLUSTRATION (ILLUSTRATIVE ONLY)</div>
<div class="section" style="font-style:italic;">This Schedule&nbsp;1 is appended to the Management Services Agreement solely for illustrative purposes. The computations below reflect the fee schedule set forth in Section&nbsp;2 of the Agreement applied to hypothetical deal assumptions stated by the Manager. Actual fees earned by the Manager will depend on actual portfolio performance, hold period, transaction activity, and the application of the fee-payment mechanics set forth in the Agreement. <strong>Nothing in this Schedule&nbsp;1 constitutes a guarantee, projection, or representation of actual fees or returns.</strong></div>

<div class="section" style="margin-top:1rem;"><strong>Deal Assumptions Used in This Illustration:</strong></div>
<table class="schedule-table" style="margin-bottom:1.5rem;">
  <tbody>
    <tr><td>Total Project Cost</td><td style="text-align:right;">${fmtMoney(totalCost)}</td></tr>
    <tr><td>Equity Raised</td><td style="text-align:right;">${fmtMoney(equity)}</td></tr>
    <tr><td>Debt (implied)</td><td style="text-align:right;">${fmtMoney(debt)}</td></tr>
    <tr><td>Hold Period</td><td style="text-align:right;">${holdYears} years</td></tr>
    <tr><td>Target Gross Exit Value</td><td style="text-align:right;">${fmtMoney(exitValue)}</td></tr>
    <tr><td>Implied Gain at Exit</td><td style="text-align:right;">${fmtMoney(gain)}</td></tr>
  </tbody>
</table>

<div class="section"><strong>One-Time Transaction Fees:</strong></div>
<table class="schedule-table" style="margin-bottom:1.5rem;">
  <thead><tr><th>Fee</th><th>Basis</th><th style="text-align:right;">Computed Amount</th></tr></thead>
  <tbody>
    <tr><td>Acquisition Fee</td><td>${(d.msaAcqBasis === 'pct_price') ? `${escapeHtml(d.msaAcqRate)}% of acquisition price` : (d.msaAcqBasis === 'pct_equity') ? `${escapeHtml(d.msaAcqRate)}% of equity` : (d.msaAcqBasis === 'fixed') ? 'Fixed' : 'None'}</td><td style="text-align:right;">${fmtMoney(acq)}</td></tr>
    <tr><td>Disposition Fee</td><td>${(d.msaDispBasis === 'pct_price') ? `${escapeHtml(d.msaDispRate)}% of disposition price` : (d.msaDispBasis === 'pct_gain') ? `${escapeHtml(d.msaDispRate)}% of gain` : (d.msaDispBasis === 'fixed') ? 'Fixed' : 'None'}</td><td style="text-align:right;">${fmtMoney(disp)}</td></tr>
  </tbody>
</table>

<div class="section"><strong>Annual Recurring Fees by Year (Asset Management Fee + Property Management or Oversight Fee):</strong></div>
<table class="schedule-table" style="margin-bottom:1.5rem;">
  <thead><tr><th>Year</th><th style="text-align:right;">Assumed GAV</th><th style="text-align:right;">Assumed Revenue</th><th style="text-align:right;">Asset Mgmt Fee</th><th style="text-align:right;">PM / Oversight Fee</th><th style="text-align:right;">Year Total</th></tr></thead>
  <tbody>
    ${yearRows.join('')}
    <tr style="font-weight:bold; border-top:2px solid #1a1a1a;"><td colspan="3">Totals Over Hold Period</td><td style="text-align:right;">${fmtMoney(totalAmf)}</td><td style="text-align:right;">${fmtMoney(totalPm)}</td><td style="text-align:right;">${fmtMoney(totalAmf + totalPm)}</td></tr>
  </tbody>
</table>

<div class="section"><strong>Aggregate Fee Load:</strong></div>
<table class="schedule-table" style="margin-bottom:1.5rem;">
  <tbody>
    <tr><td>Total Fees Over Deal Life</td><td style="text-align:right;">${fmtMoney(totalFees)}</td></tr>
    <tr><td>Fee Load as % of Equity Raised</td><td style="text-align:right;">${feeLoadOnEquity.toFixed(2)}%</td></tr>
    <tr><td>Fee Load as % of Total Project Cost</td><td style="text-align:right;">${feeLoadOnTotalCost.toFixed(2)}%</td></tr>
  </tbody>
</table>

<div class="section"><strong>Approximate Investor IRR Impact (Fee Drag):</strong></div>
<table class="schedule-table" style="margin-bottom:1.5rem;">
  <tbody>
    <tr><td>Net Proceeds to Equity After Debt Repayment (No Fees)</td><td style="text-align:right;">${fmtMoney(Math.max(0, exitValue - debt))}</td></tr>
    <tr><td>Net Proceeds to Equity After Debt and Total Fees</td><td style="text-align:right;">${fmtMoney(netToEquity)}</td></tr>
    <tr><td>Gross MOIC (No Fees)</td><td style="text-align:right;">${grossExitMOIC.toFixed(2)}x</td></tr>
    <tr><td>MOIC Net of Total Fees</td><td style="text-align:right;">${investorMOIC.toFixed(2)}x</td></tr>
    <tr><td>Approximate Gross IRR (No Fees, MOIC^(1/n)-1)</td><td style="text-align:right;">${grossIRR.toFixed(2)}%</td></tr>
    <tr><td>Approximate Net IRR (After Fees)</td><td style="text-align:right;">${investorIRR.toFixed(2)}%</td></tr>
    <tr style="font-weight:bold;"><td>Estimated Fee Drag on IRR</td><td style="text-align:right;">${irrDrag.toFixed(2)} bps × 100 (i.e., ${irrDrag.toFixed(2)} percentage points)</td></tr>
  </tbody>
</table>

<div class="section" style="font-size:9.5pt; font-style:italic; margin-top:1rem;">Methodological notes: (i) Gross Asset Value is assumed to grow linearly from total project cost to exit value over the hold period; (ii) annual gross revenue is assumed to be 7.00% of Gross Asset Value as a placeholder; (iii) the IRR computation is approximated by MOIC&nbsp;raised&nbsp;to&nbsp;the&nbsp;power&nbsp;of&nbsp;(1/n), which assumes a single inflow at Year&nbsp;0 and a single outflow at Year&nbsp;n with no interim distributions; (iv) debt is assumed not to amortize over the hold period; (v) fee payments are assumed to be made when earned regardless of sophistication-trigger language elsewhere in this Agreement (so under "Crystallized" or "Hurdle-Conditional" or "Fee Offset" mechanics, actual cash timing or net economics may differ). For a deal-specific projection that respects the actual waterfall, sequencing, leverage amortization, and tax leakage, please refer to the firm\u2019s Deal Builder.</div>`;
}

/* ============================================================================
   PHASE 3b — OpCo OPERATING AGREEMENT
   ============================================================================
   Single-member subsidiary OA generated when entityStructure === 'holdco_opco'.
   The HoldCo (= the d.companyName entity) is the sole member; the OpCo holds
   the property and is the lender's collateral. Built with SPE covenants on by
   default (the OpCo IS the SPE). Lean structure: 7 articles, no waterfall, no
   transfer mechanics, no waterfall, no buy-sell. Tax classification typically
   disregarded for federal purposes; partnership election available if user
   anticipates additional OpCo members in the future.
   ============================================================================ */
function buildOpCoOperatingAgreement(d) {
  if (d.entityStructure !== 'holdco_opco') {
    return DRAFT_BANNER + '<h1>OpCo Operating Agreement</h1><div class="section" style="font-style:italic;">No OpCo has been designated. To generate this document, select "HoldCo + OpCo" as the Entity Structure in the Company &amp; Jurisdiction section.</div>';
  }
  const Jo = getJurisdiction(d.opCoJurisdiction || d.jurisdiction);
  const Jh = getJurisdiction(d.jurisdiction);  // HoldCo jurisdiction
  const opCoName = d.opCoName || '[OpCo Name] LLC';
  const holdCoName = d.companyName || '[HoldCo Name] LLC';
  const speOn = d.speProvisions && d.speProvisions !== 'none';
  const opCoPurposeMap = {
    real_estate_holding: 'to acquire, own, hold, lease, finance, refinance, mortgage, encumber, operate, and dispose of the real property described on Exhibit&nbsp;A hereto (the &ldquo;<strong>Property</strong>&rdquo;) and any improvements thereon, and to engage in such other activities as are reasonably incidental thereto',
    real_estate_development: 'to acquire, own, hold, develop, finance, refinance, mortgage, encumber, operate, lease, sell, and otherwise dispose of the real property described on Exhibit&nbsp;A hereto (the &ldquo;<strong>Property</strong>&rdquo;) and to engage in development activities with respect thereto, including planning, design, permitting, entitlement, construction, marketing, and disposition',
    real_estate_operating: 'to operate the real-estate-related operating business conducted on or at the real property described on Exhibit&nbsp;A hereto (the &ldquo;<strong>Property</strong>&rdquo;), including, without limitation, hospitality, short-term rental, conference, food-and-beverage, or other operating activities, together with the ownership, financing, and disposition of the Property',
    single_asset: 'to acquire, own, hold, lease, finance, refinance, mortgage, operate, and dispose of the single real-property asset described on Exhibit&nbsp;A hereto (the &ldquo;<strong>Property</strong>&rdquo;) and to engage in no other business or activity except as reasonably incidental thereto'
  };
  const opCoPurpose = opCoPurposeMap[d.opCoBusinessPurpose] || opCoPurposeMap.real_estate_holding;
  const taxText = d.opCoTaxClassification === 'partnership' ?
    'The OpCo shall be classified as a partnership for U.S. federal income tax purposes under Subchapter K of the Code, and the parties shall not take any action inconsistent with such classification.' :
    'The OpCo, having a single Member, shall be classified as a disregarded entity for U.S. federal income tax purposes pursuant to Treasury Regulation Section&nbsp;301.7701-3, and the OpCo\u2019s activities shall be reflected on the federal income tax return of the HoldCo, which is its sole Member.';

  // SPE article — if SPE provisions are elected, the OpCo carries them; otherwise inline a basic covenant
  const speArticle = speOn ? `
<p class="article-heading">ARTICLE V &mdash; SINGLE-PURPOSE ENTITY COVENANTS</p>
<div class="section"><strong>Section&nbsp;5.1 Single Purpose.</strong> The OpCo shall conduct no business or activity, and shall not own any assets, other than as expressly required to carry out the purposes set forth in Section&nbsp;2.1. Without limiting the generality of the foregoing, the OpCo shall not (a) engage in any activity other than the ownership, financing, operation, leasing, and disposition of the Property; (b) form, acquire, or hold any interest in any subsidiary or joint venture; or (c) commingle its assets with those of any other Person, including the HoldCo.</div>
<div class="section"><strong>Section&nbsp;5.2 Separateness Covenants.</strong> The OpCo shall at all times: (a) maintain its own books, records, accounts, financial statements, and bank accounts separate from those of the HoldCo and any other Person; (b) hold itself out to the public as a separate legal entity from the HoldCo and any other Person; (c) observe all limited liability company formalities required by its organizational documents and the Act; (d) not commingle its assets with those of the HoldCo or any other Person; (e) maintain an arm\u2019s-length relationship with the HoldCo, any affiliate of the HoldCo, and any other Person; (f) pay its own liabilities and expenses out of its own funds and assets; (g) not assume, guarantee, or otherwise become obligated for the debts or liabilities of any other Person, except as expressly permitted by the loan documents to which the OpCo is a party; and (h) cause the officers, agents, and other representatives of the OpCo to act at all times with respect to the OpCo solely in the OpCo\u2019s interest and consistent with its separate existence.</div>
<div class="section"><strong>Section&nbsp;5.3 No Other Indebtedness.</strong> The OpCo shall not incur, assume, or guarantee any indebtedness for borrowed money other than (a) the indebtedness owing to the OpCo\u2019s senior lender under the loan documents (the &ldquo;<strong>Permitted Indebtedness</strong>&rdquo;) and (b) ordinary-course trade payables incurred in the ordinary course of business that are payable within sixty (60) days.</div>
<div class="section"><strong>Section&nbsp;5.4 No Consolidation.</strong> The OpCo shall not consolidate or merge with any other Person, nor sell, transfer, or otherwise convey all or substantially all of its assets to any other Person (other than the disposition of the Property in the ordinary course), except as expressly permitted under the loan documents.</div>
<div class="section"><strong>Section&nbsp;5.5 No Modification Without Lender Consent.</strong> Notwithstanding any other provision of this Agreement, no amendment, modification, or waiver of this Article&nbsp;V shall be effective without the prior written consent of the OpCo\u2019s senior lender, and any such amendment, modification, or waiver attempted without such consent shall be null and void.</div>
${d.speProvisions === 'standard_plus_independent' ? `<div class="section"><strong>Section&nbsp;5.6 Independent Manager.</strong> The OpCo shall at all times maintain at least one (1) Independent Manager (as defined in the loan documents or, if not so defined, as the term is customarily defined in commercial-real-estate SPE structures). Notwithstanding any other provision of this Agreement, the consent of the Independent Manager (in addition to the consent of the HoldCo as sole Member) shall be required for any of the following actions: (i) the filing of a voluntary petition by the OpCo under any chapter of the U.S. Bankruptcy Code; (ii) the consent by the OpCo to the filing of an involuntary petition; (iii) the consent by the OpCo to the appointment of a receiver, conservator, or trustee; (iv) the making by the OpCo of any general assignment for the benefit of creditors; or (v) the admission in writing by the OpCo of its inability to pay debts generally as they become due.</div>` : ''}
` : '';

  return DRAFT_BANNER + `<h1>Limited Liability Company<br/>Operating Agreement<br/>of<br/>${escapeHtml(opCoName)}</h1>
<h2>A ${Jo.name} Limited Liability Company</h2>
<div class="section">This Limited Liability Company Operating Agreement (this &ldquo;<strong>Agreement</strong>&rdquo;) is entered into and made effective as of ${fmtDate(d.effectiveDate)} (the &ldquo;<strong>Effective Date</strong>&rdquo;) by ${escapeHtml(opCoName)}, a ${Jo.name} limited liability company (the &ldquo;<strong>OpCo</strong>&rdquo;), and ${escapeHtml(holdCoName)}, a ${Jh.name} limited liability company (the &ldquo;<strong>HoldCo</strong>&rdquo;), as the sole Member of the OpCo.</div>

<div class="section" style="font-weight:bold; text-transform:uppercase; text-align:center;">Recitals</div>
<div class="section"><strong>A.</strong> The OpCo has been or will be formed as a limited liability company under and pursuant to the ${Jo.actName}, ${Jo.actCite}, as amended from time to time (the &ldquo;<strong>Act</strong>&rdquo;), by the filing of a ${Jo.certName} with the ${Jo.secOfStateOffice}.</div>
<div class="section"><strong>B.</strong> The OpCo has been formed for the sole purpose of holding, financing, operating, and ultimately disposing of the Property (as defined below).</div>
<div class="section"><strong>C.</strong> The HoldCo is, or will become, the sole Member of the OpCo and intends to hold 100% of the issued and outstanding Membership Interests of the OpCo.</div>
<div class="section"><strong>D.</strong> The HoldCo\u2019s ownership of the OpCo is governed at the investor level by that certain Limited Liability Company Operating Agreement of ${escapeHtml(holdCoName)} of even date herewith (the &ldquo;<strong>HoldCo Operating Agreement</strong>&rdquo;); this Agreement governs the internal affairs of the OpCo and the relationship between the OpCo and the HoldCo in the HoldCo\u2019s capacity as sole Member of the OpCo.</div>
<div class="section">NOW, THEREFORE, in consideration of the foregoing and the mutual covenants set forth herein, the HoldCo and the OpCo agree as follows:</div>

<p class="article-heading">ARTICLE I &mdash; FORMATION; NAME; OFFICE; TERM</p>
<div class="section"><strong>Section&nbsp;1.1 Formation.</strong> The OpCo has been (or, where the ${Jo.certName} is to be filed contemporaneously herewith, will be) formed as a limited liability company under and pursuant to the Act by the filing of the ${Jo.certName} with the ${Jo.secOfStateOffice}. The OpCo\u2019s rights, duties, and obligations under this Agreement shall be governed by the Act, except as otherwise modified by this Agreement to the extent permitted by the Act.</div>
<div class="section"><strong>Section&nbsp;1.2 Name.</strong> The name of the OpCo is ${escapeHtml(opCoName)}. The HoldCo, in its capacity as sole Member, may change the name of the OpCo at any time upon the filing of an amendment to the ${Jo.certName} as required by the Act.</div>
<div class="section"><strong>Section&nbsp;1.3 Principal Office.</strong> The principal office of the OpCo shall be at the location designated by the HoldCo from time to time, or at such other location within or outside of the State of ${Jo.name} as the business of the OpCo may require.</div>
<div class="section"><strong>Section&nbsp;1.4 Term.</strong> The OpCo commenced upon the filing of the ${Jo.certName} and shall continue in existence in perpetuity, unless and until dissolved and its affairs wound up pursuant to Article VI or as otherwise provided by the Act.</div>

<p class="article-heading">ARTICLE II &mdash; PURPOSE AND POWERS</p>
<div class="section"><strong>Section&nbsp;2.1 Purpose.</strong> The purpose of the OpCo is ${opCoPurpose}. The OpCo shall not engage in any other business or activity except as reasonably incidental to its principal purpose, and shall be operated as a single-purpose entity. ${speOn ? 'The Single-Purpose Entity covenants set forth in Article&nbsp;V are integral to the OpCo&rsquo;s lender-grade structure and are imposed for the benefit of, and may be enforced by, the OpCo&rsquo;s senior lender.' : ''}</div>
<div class="section"><strong>Section&nbsp;2.2 Powers.</strong> The OpCo shall have all powers necessary, suitable, or convenient for the accomplishment of its purpose, including: (a) to acquire, own, hold, manage, lease, operate, finance, refinance, mortgage, encumber, sell, exchange, transfer, and otherwise dispose of the Property; (b) to borrow money and issue evidences of indebtedness, and to secure the same by mortgage, pledge, deed of trust, security interest, or other lien on the Property; (c) to enter into, perform, and carry out contracts of any kind related to the Property, including operating contracts, leases, service contracts, management agreements, and contracts with the HoldCo or affiliates of the HoldCo (subject to the requirements of any applicable loan documents); (d) to engage employees, agents, contractors, attorneys, accountants, brokers, and other Persons; (e) to maintain insurance; and (f) to take all other actions necessary or appropriate in connection with the conduct of the OpCo\u2019s business.</div>

<p class="article-heading">ARTICLE III &mdash; SOLE MEMBER</p>
<div class="section"><strong>Section&nbsp;3.1 Sole Member.</strong> The HoldCo is the sole Member of the OpCo and holds one hundred percent (100%) of the issued and outstanding Membership Interests of the OpCo. The OpCo shall not admit any additional Member, and the HoldCo shall not Transfer all or any portion of its Membership Interest in the OpCo, except (a) with the prior written consent of the OpCo\u2019s senior lender (if any) and (b) in accordance with the HoldCo Operating Agreement.</div>
<div class="section"><strong>Section&nbsp;3.2 Capital Contribution.</strong> The HoldCo has contributed (or shall contribute) to the OpCo such cash, property, or services as the HoldCo, in its capacity as sole Member, may determine from time to time. Additional capital contributions by the HoldCo to the OpCo shall be made at such times and in such amounts as the HoldCo determines is necessary or appropriate to support the OpCo\u2019s business, including funding acquisition costs, capital expenditures, debt service, and working capital.</div>
<div class="section"><strong>Section&nbsp;3.3 No Personal Liability.</strong> The HoldCo, in its capacity as sole Member of the OpCo, shall not be personally liable for any debts, obligations, or liabilities of the OpCo solely by reason of being a Member, except as expressly provided by the Act or by separate guaranty or agreement to which the HoldCo is a party.</div>

<p class="article-heading">ARTICLE IV &mdash; MANAGEMENT</p>
<div class="section"><strong>Section&nbsp;4.1 Management by Sole Member.</strong> The business and affairs of the OpCo shall be managed by and under the direction of the HoldCo, in its capacity as sole Member. The HoldCo shall act in such capacity through its designated &ldquo;<strong>Authorized Representative</strong>&rdquo;, who shall be the Manager of the HoldCo under the HoldCo Operating Agreement or such other Person as the Manager of the HoldCo may designate in writing from time to time.</div>
<div class="section"><strong>Section&nbsp;4.2 Authority of Authorized Representative.</strong> The Authorized Representative shall have full and exclusive authority to act on behalf of the OpCo in all matters, including (a) executing contracts, deeds, mortgages, leases, and all other documents on behalf of the OpCo; (b) signing checks, wire-transfer authorizations, and other financial instruments; (c) representing the OpCo in dealings with third parties; (d) making all decisions reasonably necessary or appropriate in connection with the OpCo\u2019s business; and (e) holding such titles (such as Manager, President, Authorized Officer, or otherwise) as may be required by counterparties or by applicable law. Third parties dealing with the OpCo shall be entitled to rely conclusively on the authority of the Authorized Representative.</div>
<div class="section"><strong>Section&nbsp;4.3 No Liability of Authorized Representative.</strong> The Authorized Representative shall not be liable to the OpCo, the HoldCo, or any other Person for any act or omission performed in good faith on behalf of the OpCo, except for acts or omissions constituting fraud, willful misconduct, gross negligence, or knowing violation of law.</div>
${speOn ? speArticle : ''}
<p class="article-heading">ARTICLE ${speOn ? 'VI' : 'V'} &mdash; TAX MATTERS</p>
<div class="section"><strong>Section&nbsp;${speOn ? '6' : '5'}.1 Tax Classification.</strong> ${taxText}</div>
<div class="section"><strong>Section&nbsp;${speOn ? '6' : '5'}.2 Tax Year; Accounting Method.</strong> The OpCo\u2019s taxable year and accounting method shall conform to those of the HoldCo, except as the HoldCo may otherwise determine.</div>

<p class="article-heading">ARTICLE ${speOn ? 'VII' : 'VI'} &mdash; DISSOLUTION</p>
<div class="section"><strong>Section&nbsp;${speOn ? '7' : '6'}.1 Events of Dissolution.</strong> The OpCo shall be dissolved upon the first to occur of: (a) the written direction of the HoldCo, in its capacity as sole Member; (b) the sale, exchange, or other disposition of all or substantially all of the Property followed by the distribution of the proceeds; (c) the entry of a decree of judicial dissolution under ${cite(Jo, 'judDissol')} of the Act; or (d) any other event causing dissolution under the Act that is not cured within ninety (90) days. ${speOn ? '<strong>For the avoidance of doubt:</strong> any dissolution of the OpCo prior to satisfaction of the loan documents shall require the consent of the senior lender, and the bankruptcy or insolvency of the OpCo is governed by Article&nbsp;V and the OpCo\u2019s loan documents.' : ''}</div>
<div class="section"><strong>Section&nbsp;${speOn ? '7' : '6'}.2 Winding Up.</strong> Upon dissolution, the OpCo shall wind up its affairs in accordance with the Act. The OpCo\u2019s remaining assets shall be distributed (i) first, to creditors in the order of priority required by ${cite(Jo, 'dissolPriority')} of the Act; and (ii) thereafter, to the HoldCo, as sole Member.</div>
<div class="section"><strong>Section&nbsp;${speOn ? '7' : '6'}.3 Certificate of Cancellation.</strong> Upon completion of the winding up, the Authorized Representative shall cause a ${Jo.certCancelName} to be filed with the ${Jo.secOfStateOffice} in accordance with ${cite(Jo, 'certCancel')} of the Act.</div>

<p class="article-heading">ARTICLE ${speOn ? 'VIII' : 'VII'} &mdash; MISCELLANEOUS</p>
<div class="section"><strong>Section&nbsp;${speOn ? '8' : '7'}.1 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${Jo.name}, without regard to its choice-of-law principles.</div>
<div class="section"><strong>Section&nbsp;${speOn ? '8' : '7'}.2 Amendment.</strong> This Agreement may be amended only by a written instrument executed by the HoldCo, in its capacity as sole Member of the OpCo. ${speOn ? '<strong>Notwithstanding the foregoing:</strong> no amendment, modification, or waiver of Article&nbsp;V shall be effective without the prior written consent of the OpCo\u2019s senior lender.' : ''}</div>
<div class="section"><strong>Section&nbsp;${speOn ? '8' : '7'}.3 Coordination with HoldCo Operating Agreement.</strong> In the event of any conflict or inconsistency between the provisions of this Agreement and the provisions of the HoldCo Operating Agreement, this Agreement shall govern the internal affairs of the OpCo and the OpCo\u2019s rights and obligations as to third parties, and the HoldCo Operating Agreement shall govern the internal affairs of the HoldCo and the rights of the members of the HoldCo <em>inter se</em>. The HoldCo\u2019s designation of the Manager (and, derivatively, the Authorized Representative for purposes of this Agreement) shall be governed by the HoldCo Operating Agreement.</div>
<div class="section"><strong>Section&nbsp;${speOn ? '8' : '7'}.4 Counterparts; Electronic Signatures.</strong> This Agreement may be executed in counterparts, including by electronic signature, each of which shall be deemed an original.</div>
<div class="section"><strong>Section&nbsp;${speOn ? '8' : '7'}.5 Indemnification.</strong> The OpCo shall indemnify the HoldCo, the Authorized Representative, the Manager of the HoldCo, and any officer, employee, or agent of the OpCo, to the maximum extent permitted by the Act, against any loss, claim, damage, liability, judgment, fine, settlement, cost, or expense (including reasonable attorneys\u2019 fees) arising out of or in connection with such Person\u2019s service to or actions taken on behalf of the OpCo, except to the extent such loss results from such Person\u2019s fraud, willful misconduct, or knowing violation of law.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<p style="font-weight:bold; text-align:center;">IN WITNESS WHEREOF, the parties have executed this Operating Agreement as of the Effective Date first written above.</p>
<div style="margin-top:1.5rem;"><strong>OpCo:</strong></div>
<div>${escapeHtml(opCoName)}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title: Authorized Representative</div>
<div style="margin-top:1.5rem;"><strong>SOLE MEMBER:</strong></div>
<div>${escapeHtml(holdCoName)}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager (acting on behalf of HoldCo)</div>
</div>

<div class="schedule-heading" style="margin-top:2rem; page-break-before:always;">EXHIBIT A &mdash; PROPERTY DESCRIPTION</div>
<div class="section" style="font-style:italic;">[Insert legal description, street address, parcel identifier, and any other identifying information of the Property. For multi-parcel acquisitions, list each parcel separately.]</div>
<div class="section">_____________________________________________________________________</div>
<div class="section">_____________________________________________________________________</div>
<div class="section">_____________________________________________________________________</div>`;
}

/* ============================================================================
   PHASE 4 — REGULATION D / SECURITIES COMPLIANCE DOCUMENT PACKAGE
   ============================================================================
   Six new document builders that produce a Reg D disclosure package matching
   the four-level taxonomy used in the firm's Deal Builder:
     Level 0 — JV Securities Analysis Memo (Howey + Williamson)
     Level 1 — Risk Disclosure Letter (F&F 506(b))
     Level 2 — PPM (Sophisticated 506(b))
     Level 3 — PPM with general-solicitation framework + AIQ verification
   Plus shared documents (AIQ, Form D Worksheet, Blue Sky Notice Summary) that
   are level-aware.

   These are SKELETON documents with extensive boilerplate where boilerplate
   is appropriate (risk factors, tax considerations, securities-law mechanics)
   and bracketed placeholders where deal-specific content must be inserted.
   ============================================================================ */

// -----------------------------------------------------------------------------
// LEVEL 0: JV Securities Analysis Memo (Howey + Williamson v. Tucker)
// -----------------------------------------------------------------------------
function buildJvSecuritiesMemo(d) {
  if (d.regDLevel !== 'none') {
    return DRAFT_BANNER + '<h1>JV Securities Analysis Memo</h1><div class="section" style="font-style:italic;">This memo is produced when Securities Compliance Level is set to Level 0 (No Reg D Filing). Other Reg D Levels do not require this analysis. Select Level 0 in the Members panel to generate this document.</div>';
  }
  const J = getJurisdiction(d.jurisdiction);
  return DRAFT_BANNER + `<h1>Securities Analysis Framework (Educational)<br/>Re: Whether Membership Interests in<br/>${escapeHtml(d.companyName || '[Company Name]')}</h1>
<div class="section" style="text-align:right; font-style:italic;">Educational illustration &mdash; not a legal opinion, not privileged, not for reliance</div>
<div class="section"><strong>PREPARED FOR:</strong> The Members, as a framework for discussion with counsel</div>
<div class="section"><strong>PREPARED BY:</strong> Self-service educational tool (donovan.law) &mdash; not counsel</div>
<div class="section"><strong>DATE:</strong> ${fmtDate(d.effectiveDate)}</div>
<div class="section"><strong>RE:</strong> Whether membership interests in ${escapeHtml(d.companyName || '[Company Name]')} (the &ldquo;Company&rdquo;) constitute &ldquo;securities&rdquo; under the Securities Act of 1933 and corresponding state law, and the applicability of registration requirements or exemptions therefrom</div>

<p class="article-heading">I. ISSUE PRESENTED</p>
<div class="section">Whether the membership interests issued by the Company to its initial Members constitute &ldquo;securities&rdquo; within the meaning of Section 2(a)(1) of the Securities Act of 1933 (the &ldquo;<strong>Securities Act</strong>&rdquo;) and the corresponding provisions of the ${J.name} securities laws, and, if so, whether an exemption from federal and state registration is available such that no registration or notice filing is required.</div>

<p class="article-heading">II. SHORT ANSWER</p>
<div class="section">Based on the facts and structural analysis set forth below, the framework below suggests that the membership interests issued by the Company would likely <strong>not</strong> be characterized as &ldquo;securities&rdquo; under the federal &ldquo;investment contract&rdquo; analysis articulated in <em>SEC v. W.J. Howey Co.</em>, 328 U.S. 293 (1946), as elaborated by the Fifth Circuit in <em>Williamson v. Tucker</em>, 645 F.2d 404 (5th Cir. 1981), <em>cert. denied</em>, 454 U.S. 897 (1981). This conclusion is principally driven by the operating-Member control structure of the Company: each Member has the right (and the expertise and experience) to participate meaningfully in the management of the Company\u2019s affairs, such that the Members do not rely &ldquo;solely&rdquo; or even predominantly on the entrepreneurial or managerial efforts of any other Person for the realization of profits. Accordingly, no Reg&nbsp;D filing, state notice filing, or Form&nbsp;D submission is being made in connection with the issuance of these membership interests, and no Private Placement Memorandum has been prepared. <strong>Each Member is acquiring its membership interest based on its own due diligence and not in reliance on any disclosure document of the type contemplated by Rule 502 of Regulation D.</strong></div>

<p class="article-heading">III. FACTUAL BACKGROUND</p>
<div class="section"><strong>A. The Company.</strong> The Company is a ${J.name} limited liability company formed for the purpose of [insert business purpose]. The Company has [insert number] initial Members, each of whom is contributing [cash / property / services] in exchange for a membership interest. The Company is governed by its operating agreement of even date herewith (the &ldquo;Operating Agreement&rdquo;).</div>
<div class="section"><strong>B. The Members.</strong> Each Member is an individual or entity that (i) has the relevant experience and expertise in the underlying business activity of the Company, (ii) is contributing operating efforts to the Company in addition to capital, and (iii) has bargained at arm&rsquo;s length for the terms of its membership and the Operating Agreement. <strong>[Counsel to insert specific factual recitals about each Member&rsquo;s background, role, and contribution.]</strong></div>
<div class="section"><strong>C. The Governance Structure.</strong> The Operating Agreement provides that the Members participate actively in the management of the Company\u2019s business. <strong>[Counsel to insert specific facts about each Member&rsquo;s management role, voting rights, consent rights for major decisions, information rights, and ability to remove or replace any Manager.]</strong> No single Member or third party has the unilateral right to make material decisions on behalf of the Company without the consent of the other Members.</div>
<div class="section"><strong>D. Absence of Public Distribution.</strong> The membership interests are being issued in a private transaction among Persons known to one another. There has been no general solicitation, no public advertising, no public offering, and no use of any general distribution channels. The interests are not freely transferable and are subject to substantial transfer restrictions in the Operating Agreement.</div>

<p class="article-heading">IV. LEGAL ANALYSIS</p>
<div class="section"><strong>A. The Howey Test.</strong> Under <em>SEC v. W.J. Howey Co.</em>, 328 U.S. 293, 298\u2013299 (1946), an &ldquo;investment contract&rdquo; (and thus a &ldquo;security&rdquo;) exists where there is: (1) an investment of money; (2) in a common enterprise; (3) with an expectation of profits; (4) to be derived <em>solely from the efforts of others</em>. The Supreme Court in <em>United Housing Foundation, Inc. v. Forman</em>, 421 U.S. 837 (1975), and the lower federal courts have subsequently relaxed the &ldquo;solely&rdquo; element to require that profits be derived <em>predominantly</em> or <em>substantially</em> from the efforts of others. <em>See, e.g.,</em> <em>SEC v. Glenn W. Turner Enterprises, Inc.</em>, 474 F.2d 476, 482\u2013483 (9th Cir.), <em>cert. denied</em>, 414 U.S. 821 (1973).</div>
<div class="section"><strong>B. Application of the First Three Howey Elements.</strong> The first three elements of <em>Howey</em> are likely satisfied with respect to the membership interests: (i) each Member is investing money or other consideration; (ii) the Members have a common enterprise (horizontally and vertically), as they share in the economic outcomes of the Company\u2019s business; and (iii) each Member has an expectation of profits from its investment.</div>
<div class="section"><strong>C. The Critical Fourth Element &mdash; Efforts of Others.</strong> The dispositive question is whether the Members\u2019 expected profits are to be derived predominantly from the entrepreneurial or managerial efforts of <em>others</em>. The Fifth Circuit&rsquo;s analysis in <em>Williamson v. Tucker</em>, 645 F.2d at 424\u2013425, is directly applicable. <em>Williamson</em> held that an interest in a partnership (or analogous unincorporated entity) is presumed <strong>not</strong> to be a security, but may be re-characterized as a security where: (1) the partnership-style agreement leaves so little power in the hands of the investor that the arrangement in fact distributes power as would a limited partnership; (2) the investor is so inexperienced and unknowledgeable in business affairs that he is incapable of intelligently exercising his partnership powers; or (3) the investor is so dependent on some unique entrepreneurial or managerial ability of the promoter or manager that he cannot replace the manager of the enterprise or otherwise exercise meaningful partnership powers. Each of these factors weighs against re-characterization here.</div>
<div class="section"><strong>1. Meaningful Management Rights Retained.</strong> Under the Operating Agreement, each Member has the right to vote on major decisions of the Company, to inspect the books and records, to receive periodic financial reporting, and to consent to the appointment, removal, and replacement of any Manager. <strong>[Counsel to expand based on specific consent rights, voting thresholds, and Major Decisions enumerated in the Operating Agreement.]</strong> The Members are not in the position of passive limited partners; they retain operative governance powers.</div>
<div class="section"><strong>2. Experience and Expertise of the Members.</strong> Each Member possesses substantial experience and expertise in the underlying business activity of the Company. <strong>[Counsel to insert specific facts about each Member&rsquo;s industry experience, professional credentials, and prior involvement in similar enterprises.]</strong> The Members are sophisticated business people capable of intelligently exercising the management powers granted to them under the Operating Agreement.</div>
<div class="section"><strong>3. Manager Replaceability.</strong> The Operating Agreement provides that any Manager may be removed and replaced upon [insert consent threshold] of the Members. No Member is dependent on any unique entrepreneurial or managerial ability of any single Person; the Company\u2019s business is one that can be operated by any of several capable Persons, and the Members retain the practical and contractual ability to effect such a change.</div>

<p class="article-heading">V. STATE-LAW ANALYSIS</p>
<div class="section">${J.name}\u2019s securities laws generally follow the federal &ldquo;investment contract&rdquo; test in defining &ldquo;security.&rdquo; <strong>[Counsel to insert ${J.name}-specific analysis under blue-sky statutes, citing any relevant state administrator interpretations or no-action positions.]</strong> Based on the analysis in Part IV above, the membership interests should likewise not be characterized as securities under ${J.name} law.</div>

<p class="article-heading">VI. CONCLUSION AND CAVEATS</p>
<div class="section"><strong>A. Conclusion.</strong> Based on the foregoing analysis and the factual representations made by the Members, the framework suggests that the membership interests would likely not be characterized as &ldquo;securities&rdquo; under the federal Securities Act of 1933 or under the corresponding ${J.name} state law. Accordingly: (i) no registration under Section 5 of the Securities Act is required; (ii) no Reg&nbsp;D exemption need be claimed and no Form&nbsp;D need be filed with the SEC; (iii) no state notice filing or blue-sky exemption need be claimed in ${J.name} or in any state where a Member is resident; and (iv) no Private Placement Memorandum or other Reg D-style disclosure document is being prepared or delivered.</div>
<div class="section"><strong>B. Reliance and Limitations.</strong> This memorandum is based on (i) the structural analysis of the Operating Agreement, (ii) the factual representations made by the Members in their respective Member Joinder &amp; Acknowledgment instruments, and (iii) the legal authorities cited herein as in effect on the date hereof. This memorandum is not an opinion on which any other Person may rely. The conclusion herein could be affected by, among other things: (i) any material change in the structure or governance of the Company that reduces the Members\u2019 management rights or increases their reliance on a single Manager; (ii) any subsequent sale or transfer of membership interests to persons other than the original operating Members; (iii) any change in the experience or expertise of the Members; (iv) any solicitation activity that would reach Persons other than the original operating Members; or (v) any subsequent judicial or regulatory development. This framework would have to be revisited in light of any such change.</div>
<div class="section"><strong>C. Practitioner Note.</strong> Even where the structural analysis supports a non-security characterization, counsel would ordinarily recommend as a matter of risk management: (i) that each Member execute a Member Joinder &amp; Acknowledgment that incorporates the operating-control representations on which this analysis depends; (ii) that the Operating Agreement be drafted with explicit operating-Member governance terms; (iii) that membership interests not be marketed publicly or to Persons unknown to the initial Members; and (iv) that any subsequent issuance, transfer, or admission of new Members be analyzed separately, as the Howey-Williamson conclusion does not necessarily extend to future transactions.</div>

<div class="section" style="margin-top:2.5rem; font-style:italic;">This framework is not an opinion of counsel and no one has signed it. Whether any exemption is available depends on facts this tool does not have; securities counsel must make that determination before any interest is offered or sold.</div>`;
}

// -----------------------------------------------------------------------------
// LEVEL 1: Risk Disclosure Letter (F&F 506(b))
// -----------------------------------------------------------------------------
function buildRiskDisclosureLetter(d) {
  if (d.regDLevel !== '506b_ff') {
    return DRAFT_BANNER + '<h1>Risk Disclosure Letter</h1><div class="section" style="font-style:italic;">This document is generated when Securities Compliance Level is set to Level 1 (506(b) Friends &amp; Family). Other levels use the Private Placement Memorandum or no disclosure document. Select Level 1 in the Members panel to generate this letter.</div>';
  }
  const J = getJurisdiction(d.jurisdiction);
  return DRAFT_BANNER + `<h1>Risk Disclosure Letter<br/>${escapeHtml(d.companyName || '[Company Name]')}</h1>
<div class="section" style="text-align:right;">Date: ${fmtDate(d.effectiveDate)}</div>
<div class="section"><strong>TO:</strong> Each Prospective Investor in ${escapeHtml(d.companyName || '[Company Name]')}</div>

<p class="article-heading">1. PURPOSE OF THIS LETTER</p>
<div class="section">This Risk Disclosure Letter (this &ldquo;<strong>Letter</strong>&rdquo;) is being delivered to each prospective investor (each, an &ldquo;<strong>Investor</strong>&rdquo;) in connection with the offering of membership interests in ${escapeHtml(d.companyName || '[Company Name]')} (the &ldquo;<strong>Company</strong>&rdquo;). The offering is being made in reliance upon the exemption from registration provided by Section 4(a)(2) of the Securities Act of 1933 (the &ldquo;<strong>Securities Act</strong>&rdquo;) and Rule 506(b) of Regulation D promulgated thereunder. This Letter is not a Private Placement Memorandum. It is a streamlined disclosure document appropriate for an offering being conducted (i) to a limited number of Investors known to the principals of the Company; (ii) without any general solicitation or general advertising; and (iii) on a &ldquo;friends-and-family&rdquo; basis. This Letter is not, and should not be considered, a complete description of the Company or the Investment. Each Investor should rely on its own investigation and on the Operating Agreement and Subscription Agreement to be entered into in connection with the Investment.</div>

<p class="article-heading">2. SUMMARY OF THE OFFERING</p>
<div class="section">${[
  ['Issuer', escapeHtml(d.companyName || '[Company Name]')],
  ['Type of Security', 'Membership Interests in a ' + J.name + ' limited liability company'],
  ['Aggregate Offering Amount', d.regDOfferingAmount ? fmtMoney(d.regDOfferingAmount) : '[$ to be specified]'],
  ['Minimum Subscription per Investor', d.regDMinSubscription ? fmtMoney(d.regDMinSubscription) : '[$ to be specified]'],
  ['Exemption Claimed', '506(b) of Regulation D under the Securities Act'],
  ['Use of Proceeds', d.regDUseOfProceeds ? escapeHtml(d.regDUseOfProceeds) : '[Insert: acquisition costs, working capital, reserves, etc.]']
].map(r => `<div><strong>${r[0]}:</strong> ${r[1]}</div>`).join('')}</div>

<p class="article-heading">3. INVESTOR SUITABILITY</p>
<div class="section">The Investment is suitable only for Investors who: (a) are &ldquo;accredited investors&rdquo; within the meaning of Rule 501(a) under the Securities Act${d.regDNonAccredited === 'yes_with_purchaser_rep' ? ' (or, if not accredited, are sophisticated Investors who, alone or together with a designated purchaser representative, have such knowledge and experience in financial and business matters that they are capable of evaluating the merits and risks of the Investment, with the limit of thirty-five (35) such non-accredited Investors as required by Rule 506(b))' : ''}; (b) have sufficient financial resources to bear the economic risk of a complete loss of the Investment; (c) are capable of evaluating the merits and risks of the Investment, including the highly illiquid and speculative nature of the Investment; and (d) are familiar with, or have consulted advisors familiar with, the substantive provisions of the Operating Agreement, including the distribution waterfall, capital call mechanics, transfer restrictions, and tax treatment.</div>

<p class="article-heading">4. RISK FACTORS</p>
<div class="section">An investment in the Company involves substantial risks, including the risk of total loss. Each Investor should carefully consider the following risk factors, together with all of the other information contained in this Letter, the Operating Agreement, and the Subscription Agreement, before making a decision to invest. <strong>The risks identified below are not exhaustive and are not presented in order of importance.</strong></div>

<div class="section" style="margin-top:1rem;"><strong>4.1 Speculative Nature; Risk of Total Loss.</strong> The Investment is speculative and involves a high degree of risk. There is no assurance that the Company will achieve its investment objectives or that any Investor will receive any return of capital or any return on capital. An Investor could lose its entire Investment.</div>
<div class="section"><strong>4.2 Illiquidity; No Public Market.</strong> The membership interests are highly illiquid and are subject to substantial transfer restrictions under the Operating Agreement. There is no public market for the membership interests, and no public market is expected to develop. An Investor may be required to hold its membership interest for an indefinite period of time and may not be able to dispose of it at any price.</div>
<div class="section"><strong>4.3 Reliance on the Manager.</strong> The Company is managed by a Manager (or by Managers, in the case of a Board-Managed Company), and Investors do not have day-to-day control over the Company\u2019s business. The success of the Investment depends substantially on the judgment, skill, and integrity of the Manager.</div>
<div class="section"><strong>4.4 Real Estate Market Risk.</strong> If the Company invests in real estate or real estate-related assets, the Investment is subject to all of the risks of real estate ownership, including risks relating to property values, occupancy, rent levels, capital expenditure requirements, regulatory changes, environmental liabilities, natural disasters, and broad real estate market conditions. Real estate values may decline materially as a result of factors beyond the control of the Manager.</div>
<div class="section"><strong>4.5 Leverage.</strong> The Company is likely to incur indebtedness in connection with its investments. Leverage increases both the potential return on equity and the potential loss. In the event of a default, the lender may foreclose on the Company\u2019s assets, in which case the Investors\u2019 equity may be eliminated.</div>
<div class="section"><strong>4.6 Conflicts of Interest.</strong> The Manager and its affiliates may have conflicts of interest with the Company and the Investors, including with respect to fee structures, allocation of opportunities among multiple portfolios managed by the Manager, related-party transactions, and the timing and pricing of dispositions. The Operating Agreement contains provisions intended to address certain of these conflicts but does not eliminate them entirely.</div>
<div class="section"><strong>4.7 Tax Risks.</strong> The Company intends to be classified as a partnership for U.S. federal income tax purposes. Investors will receive Schedules K-1 and will be required to report their share of the Company\u2019s items of income, gain, loss, deduction, and credit on their personal tax returns regardless of whether they receive cash distributions sufficient to pay the resulting taxes. The Company may make tax distributions, but is not guaranteed to. Each Investor should consult its own tax advisor regarding the tax consequences of an investment in the Company.</div>
<div class="section"><strong>4.8 ERISA Considerations.</strong> Investors that are subject to ERISA or to corresponding provisions of the Internal Revenue Code should consult their own advisors with respect to the application of ERISA and the Code to their investment in the Company.</div>
<div class="section"><strong>4.9 Limited Operating History.</strong> The Company is a newly formed entity with no operating history. Past performance of the Manager or its affiliates with respect to other investments is not necessarily indicative of future results.</div>
<div class="section"><strong>4.10 Concentration Risk.</strong> The Company\u2019s investments may be concentrated in a single asset, a single geography, or a single asset class, which increases the impact of adverse developments affecting that asset, geography, or asset class.</div>
<div class="section"><strong>4.11 Regulatory Risk.</strong> Changes in federal, state, or local laws, regulations, or administrative interpretations (including those relating to real estate, tax, environmental matters, and securities) could materially adversely affect the Company\u2019s business and the value of the Investment.</div>
<div class="section"><strong>4.12 Subscription Acceptance.</strong> The Company reserves the right to reject any Investor\u2019s subscription in whole or in part, in its sole discretion, for any or no reason.</div>

<p class="article-heading">5. NO REPRESENTATION; INVESTOR\u2019S OWN INVESTIGATION</p>
<div class="section">The Company, the Manager, and their respective affiliates make no representation or warranty as to the accuracy or completeness of any projection, forecast, or estimate that may have been provided to any prospective Investor. Each Investor is expected to conduct its own independent investigation, to consult with its own legal, tax, accounting, and financial advisors, and to make its own decision whether to invest in the Company on the basis of such Investor\u2019s own analysis.</div>

<p class="article-heading">6. ACKNOWLEDGMENT</p>
<div class="section">By executing the Subscription Agreement and the Operating Agreement, each Investor acknowledges that it has received and read this Letter and that it understands the risk factors set forth herein.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<div>Sincerely,</div>
<div style="margin-top:1rem;">${escapeHtml(d.companyName || '[Company Name]')}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager</div>
</div>`;
}

// -----------------------------------------------------------------------------
// LEVEL 2/3: Private Placement Memorandum (Sophisticated 506(b) / 506(c))
// -----------------------------------------------------------------------------
function buildPrivatePlacementMemorandum(d) {
  if (d.regDLevel !== '506b_soph' && d.regDLevel !== '506c') {
    return DRAFT_BANNER + '<h1>Private Placement Memorandum</h1><div class="section" style="font-style:italic;">The PPM is generated for Securities Compliance Level 2 (Sophisticated 506(b)) or Level 3 (506(c) General Solicitation). Other levels use the Risk Disclosure Letter (Level 1) or no disclosure document (Level 0). Select Level 2 or Level 3 in the Members panel to generate this document.</div>';
  }
  const J = getJurisdiction(d.jurisdiction);
  const is506c = d.regDLevel === '506c';
  const exemptionText = is506c ? 'Rule 506(c) of Regulation D under the Securities Act of 1933 (the "Securities Act")' : 'Rule 506(b) of Regulation D under the Securities Act of 1933 (the "Securities Act")';
  const solicitText = is506c ?
    'THIS OFFERING IS BEING CONDUCTED UNDER RULE 506(c), WHICH PERMITS GENERAL SOLICITATION AND GENERAL ADVERTISING BUT REQUIRES THE COMPANY TO TAKE REASONABLE STEPS TO VERIFY THAT EACH PURCHASER IS AN ACCREDITED INVESTOR.' :
    'THIS OFFERING IS BEING CONDUCTED UNDER RULE 506(b) AND IS NOT BEING MADE BY MEANS OF GENERAL SOLICITATION OR GENERAL ADVERTISING. NO INVESTOR MAY HAVE BEEN INTRODUCED TO THE OFFERING THROUGH ANY MEDIUM CONSTITUTING GENERAL SOLICITATION OR GENERAL ADVERTISING WITHIN THE MEANING OF RULE 502(c).';

  return DRAFT_BANNER + `<div style="text-align:center; margin-bottom:2rem;">
<h1 style="margin-bottom:0.5rem;">CONFIDENTIAL PRIVATE PLACEMENT MEMORANDUM</h1>
<div style="font-size:1.2rem; font-weight:bold; margin-bottom:1rem;">${escapeHtml(d.companyName || '[Company Name]')}</div>
<div style="font-size:0.9rem;">A ${J.name} Limited Liability Company</div>
<div style="font-size:1.1rem; margin-top:1rem;">${d.regDOfferingAmount ? fmtMoney(d.regDOfferingAmount) : '[$_______________]'} of Membership Interests</div>
<div style="font-size:0.85rem; margin-top:1rem;">Date of this Memorandum: ${fmtDate(d.effectiveDate)}</div>
<div style="font-size:0.85rem; margin-top:0.5rem;">Memorandum Number: __________</div>
</div>

<div class="section" style="border:2px solid #1a1a1a; padding:1rem; font-size:0.85rem; margin-top:1.5rem;">
<strong>IMPORTANT NOTICES</strong><br/><br/>
THESE SECURITIES HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OR THE SECURITIES LAWS OF ANY STATE. THEY ARE BEING OFFERED IN RELIANCE UPON THE EXEMPTION FROM REGISTRATION PROVIDED BY ${escapeHtml(exemptionText.toUpperCase())}, AND CORRESPONDING STATE EXEMPTIONS.<br/><br/>
${solicitText}<br/><br/>
THE SECURITIES MAY NOT BE SOLD, TRANSFERRED, ASSIGNED, OR HYPOTHECATED EXCEPT IN COMPLIANCE WITH THE SECURITIES ACT AND APPLICABLE STATE SECURITIES LAWS AND IN ACCORDANCE WITH THE TRANSFER RESTRICTIONS SET FORTH IN THE COMPANY\u2019S OPERATING AGREEMENT.<br/><br/>
THIS MEMORANDUM CONSTITUTES AN OFFER ONLY TO THE PERSON TO WHOM IT IS DELIVERED. NO OTHER PERSON IS AUTHORIZED TO USE OR DISTRIBUTE THIS MEMORANDUM. ANY REPRODUCTION OR REDISTRIBUTION OF THIS MEMORANDUM IS STRICTLY PROHIBITED.<br/><br/>
THIS MEMORANDUM CONTAINS FORWARD-LOOKING STATEMENTS THAT ARE BASED ON THE MANAGER\u2019S ASSUMPTIONS AND EXPECTATIONS AS OF THE DATE HEREOF. ACTUAL RESULTS COULD DIFFER MATERIALLY FROM THOSE PROJECTED OR ANTICIPATED. NO REPRESENTATION OR WARRANTY IS MADE AS TO THE ACCURACY OF ANY FORWARD-LOOKING STATEMENT.<br/><br/>
NEITHER THE SEC NOR ANY STATE SECURITIES REGULATOR HAS APPROVED OR DISAPPROVED OF THESE SECURITIES, PASSED UPON THE MERITS OF THIS OFFERING, OR DETERMINED THAT THIS MEMORANDUM IS TRUTHFUL OR COMPLETE. ANY REPRESENTATION TO THE CONTRARY IS A CRIMINAL OFFENSE.
</div>

<p class="article-heading">SUMMARY OF THE OFFERING</p>
<table class="schedule-table">
<tbody>
<tr><td><strong>Issuer</strong></td><td>${escapeHtml(d.companyName || '[Company Name]')}</td></tr>
<tr><td><strong>Jurisdiction of Formation</strong></td><td>${J.name}</td></tr>
<tr><td><strong>Securities Offered</strong></td><td>Membership Interests</td></tr>
<tr><td><strong>Aggregate Offering Amount</strong></td><td>${d.regDOfferingAmount ? fmtMoney(d.regDOfferingAmount) : '[$_______________]'}</td></tr>
<tr><td><strong>Minimum Investment</strong></td><td>${d.regDMinSubscription ? fmtMoney(d.regDMinSubscription) : '[$_______________]'}</td></tr>
<tr><td><strong>Maximum Number of Investors</strong></td><td>${is506c ? 'No limit (accredited investors only)' : (d.regDNonAccredited === 'yes_with_purchaser_rep' ? 'Up to 35 non-accredited sophisticated investors plus unlimited accredited investors' : 'Accredited investors only')}</td></tr>
<tr><td><strong>Federal Exemption</strong></td><td>${escapeHtml(exemptionText)}</td></tr>
<tr><td><strong>Manager</strong></td><td>${escapeHtml(d.managerName || '[Manager Entity Name] LLC')}</td></tr>
<tr><td><strong>Use of Proceeds</strong></td><td>${d.regDUseOfProceeds ? escapeHtml(d.regDUseOfProceeds) : '[Insert: acquisition costs, working capital, reserves, etc.]'}</td></tr>
<tr><td><strong>Subscription Procedure</strong></td><td>See Section 12 (Plan of Distribution) and the Subscription Agreement</td></tr>
</tbody>
</table>

<p class="article-heading">1. THE COMPANY</p>
<div class="section">${escapeHtml(d.companyName || '[Company Name]')} (the &ldquo;<strong>Company</strong>&rdquo;) is a ${J.name} limited liability company. The Company was organized for the purpose described in Section&nbsp;3 below. The Company is managed by ${escapeHtml(d.managerName || '[Manager Entity Name] LLC')} (the &ldquo;<strong>Manager</strong>&rdquo;).</div>
<div class="section"><strong>[FIRM INSERT &mdash; Company description, history, organizational chart (including HoldCo / OpCo if applicable), and sponsor track record.]</strong></div>

<p class="article-heading">2. THE SPONSOR / MANAGER</p>
<div class="section"><strong>[FIRM INSERT &mdash; Sponsor biography, principal bios, track record, prior fund / deal performance, AUM, references. Include each principal\u2019s relevant credentials and Real-Estate Professional Status if applicable.]</strong></div>

<p class="article-heading">3. INVESTMENT STRATEGY</p>
<div class="section"><strong>[FIRM INSERT &mdash; Investment strategy, target asset class, geographic focus, value-creation thesis, hold period, target returns, exit strategy.]</strong></div>

<p class="article-heading">4. THE PROPERTY / ASSETS</p>
<div class="section"><strong>[FIRM INSERT &mdash; Description of specific property or asset (if known), or description of pipeline for blind-pool offerings. Include market data, comps, appraisals, environmental reports, title summaries, lease abstracts (if any), and the Manager&rsquo;s underwriting.]</strong></div>

<p class="article-heading">5. USE OF PROCEEDS</p>
<div class="section">The net proceeds of the Offering, after payment of the fees and expenses described herein, will be applied as follows: ${d.regDUseOfProceeds ? escapeHtml(d.regDUseOfProceeds) : '<strong>[FIRM INSERT &mdash; Use of proceeds table: acquisition costs, financing costs, organizational expenses, working capital reserve, closing reserves, and other applications.]</strong>'}</div>

<p class="article-heading">6. SUMMARY OF TERMS</p>
<div class="section">The following is a summary of the principal terms of the Investment. This summary is qualified in its entirety by reference to the Operating Agreement and the Subscription Agreement, copies of which are attached as exhibits hereto. The Operating Agreement and the Subscription Agreement, and not this Memorandum, govern the legal rights of the Investors.</div>
<div class="section"><strong>[FIRM INSERT &mdash; Terms summary, including: class structure, preferred return, promote / carried interest waterfall, distribution timing, allocation methodology, capital call mechanics and default remedies, transfer restrictions, drag-along, tag-along, ROFO/ROFR, governance (Manager removal, Major Decisions, voting), expense reimbursement, fees payable to Manager and affiliates, key-person events, and term of the investment vehicle.]</strong></div>

<p class="article-heading">7. RISK FACTORS</p>
<div class="section">An investment in the Company involves substantial risks, including the risk of complete loss. Prospective Investors should carefully consider, among other matters, the following risk factors, together with all of the other information contained or incorporated by reference in this Memorandum, before making a decision to invest. <strong>The risks identified below are not exhaustive and are not presented in order of importance.</strong></div>

<div class="section" style="margin-top:1rem; font-weight:bold;">7.1 Investment Risks</div>
<div class="section"><strong>(a) Speculative Nature; Risk of Total Loss.</strong> The Investment is speculative and involves a high degree of risk. There can be no assurance that the Company will achieve its investment objectives. Investors may lose their entire investment.</div>
<div class="section"><strong>(b) Illiquidity.</strong> Membership Interests are highly illiquid and are subject to substantial transfer restrictions. There is no public market for Membership Interests and no public market is expected to develop. Investors must be prepared to hold their Membership Interests for an indefinite period of time.</div>
<div class="section"><strong>(c) Limited Operating History.</strong> The Company is a newly organized entity with no operating history. Past performance of the Manager or its affiliates is not necessarily indicative of future results.</div>
<div class="section"><strong>(d) Leverage.</strong> The Company is likely to incur substantial indebtedness in connection with its investments. Leverage increases both the potential return on equity and the potential loss; in the event of a foreclosure, an Investor\u2019s equity may be eliminated entirely.</div>
<div class="section"><strong>(e) Capital Call Default.</strong> Investors that default on a Capital Call are subject to severe remedies under the Operating Agreement, including punitive dilution, default-loan interest at penalty rates, forced sale, and forfeiture. Defaulting Investors may lose part or all of their original Investment.</div>

<div class="section" style="margin-top:1rem; font-weight:bold;">7.2 Real Estate Risks</div>
<div class="section"><strong>(a) General Real Estate Risk.</strong> Real estate investments are subject to numerous risks, including risks relating to property values, occupancy levels, rent levels, capital expenditure requirements, market conditions, interest rates, environmental matters, natural disasters, and changes in laws and regulations.</div>
<div class="section"><strong>(b) Environmental Liability.</strong> The Company may incur liability under federal and state environmental laws, including CERCLA, for the cost of investigating, remediating, and removing hazardous substances on or under the Property, regardless of whether the Company was responsible for the contamination.</div>
<div class="section"><strong>(c) Concentration Risk.</strong> The Company\u2019s investments may be concentrated in a single asset, geography, or asset class, increasing the impact of adverse developments affecting that asset, geography, or asset class.</div>
<div class="section"><strong>(d) Construction and Development Risk.</strong> If the Investment involves new construction, redevelopment, or substantial renovation, the Company is subject to risks of cost overruns, construction delays, contractor failure, permit denials, and entitlement risks.</div>
<div class="section"><strong>(e) Tenant Default.</strong> The Company\u2019s revenue may depend on a limited number of tenants. Default by a major tenant could materially adversely affect the Company\u2019s cash flow.</div>

<div class="section" style="margin-top:1rem; font-weight:bold;">7.3 Manager and Conflict-of-Interest Risks</div>
<div class="section"><strong>(a) Reliance on the Manager.</strong> Investors do not have day-to-day control over the Company\u2019s business and must rely on the Manager. The success of the Investment depends substantially on the Manager\u2019s judgment, skill, integrity, and continued involvement.</div>
<div class="section"><strong>(b) Conflicts of Interest.</strong> The Manager and its affiliates have multiple actual and potential conflicts of interest with the Company and the Investors, including with respect to: fees payable to the Manager and its affiliates; the allocation of investment opportunities among the Company and other portfolios; related-party transactions; co-investment opportunities offered to the principals of the Manager or their affiliates; the timing, pricing, and structuring of dispositions; and the use of affiliated service providers. Although the Operating Agreement and the Management Services Agreement contain provisions intended to address certain of these conflicts, no assurance can be given that the conflicts will not materially adversely affect the Investors.</div>
<div class="section"><strong>(c) Modification or Elimination of Fiduciary Duties.</strong> The Operating Agreement may modify or eliminate certain fiduciary duties that would otherwise be owed by the Manager to the Investors. Investors should carefully review Article IX of the Operating Agreement.</div>
<div class="section"><strong>(d) Key-Person Risk.</strong> The Investment depends on the continued involvement of the principals of the Manager. The death, permanent disability, or voluntary departure of any such principal could materially adversely affect the Company.</div>

<div class="section" style="margin-top:1rem; font-weight:bold;">7.4 Tax Risks</div>
<div class="section"><strong>(a) Partnership Classification.</strong> The Company intends to be classified as a partnership for U.S. federal income tax purposes. If the Company were instead classified as a publicly traded partnership taxable as a corporation under Code Section 7704, the Company\u2019s income would be subject to corporate-level tax and the after-tax return to Investors would be materially reduced.</div>
<div class="section"><strong>(b) Phantom Income.</strong> Investors will be required to report their allocable share of the Company\u2019s items of income, gain, loss, deduction, and credit on their personal tax returns regardless of whether they receive cash distributions sufficient to pay the resulting tax liability.</div>
<div class="section"><strong>(c) BBA Audit Regime.</strong> The Company is subject to the centralized partnership audit regime under the Bipartisan Budget Act of 2015. Adjustments resulting from an IRS audit may be assessed against the Company at the entity level (rather than against the Investors individually), which could disproportionately affect Investors who are not Members in the year to which the adjustment relates.</div>
<div class="section"><strong>(d) UBTI / UDFI.</strong> Tax-exempt Investors may incur unrelated business taxable income (UBTI) and unrelated debt-financed income (UDFI) as a result of the Company\u2019s use of leverage. Each tax-exempt Investor should consult its own tax advisor.</div>
<div class="section"><strong>(e) FIRPTA.</strong> Non-U.S. Investors may be subject to U.S. federal income tax on their share of the Company\u2019s effectively connected income and to FIRPTA withholding on dispositions of U.S. real property interests. Each non-U.S. Investor should consult its own tax advisor.</div>
<div class="section"><strong>(f) State and Local Taxes.</strong> The Company may operate in multiple state and local jurisdictions, exposing Investors to multi-state tax filings, withholding obligations, and entity-level taxation in certain states.</div>

<div class="section" style="margin-top:1rem; font-weight:bold;">7.5 Securities-Law and Regulatory Risks</div>
<div class="section"><strong>(a) Reg D Compliance.</strong> The Offering is being conducted in reliance on the Reg D safe harbor described above. If the Company were determined not to have complied with Reg D, the Investors could be entitled to rescind their Investments. ${is506c ? 'Under Rule 506(c), the Company is required to take reasonable steps to verify each Investor\u2019s accredited status. Failure to satisfy these verification requirements could result in loss of the Reg D safe harbor.' : ''}</div>
<div class="section"><strong>(b) Investment Company Act.</strong> The Company has structured its business to avoid registration as an investment company under the Investment Company Act of 1940. If the Company were required to register, its operations would be materially adversely affected.</div>
<div class="section"><strong>(c) ERISA.</strong> If 25% or more of the Company\u2019s equity is held by &ldquo;benefit plan investors&rdquo; within the meaning of ERISA, the Company\u2019s assets would be deemed plan assets, subjecting the Manager to additional fiduciary obligations and certain transactions to prohibited-transaction analysis. The Manager intends to manage the Company so as to avoid plan-asset treatment.</div>

<p class="article-heading">8. MATERIAL FEDERAL INCOME TAX CONSIDERATIONS</p>
<div class="section"><strong>8.1 Partnership Taxation.</strong> The Company will be classified as a partnership for U.S. federal income tax purposes. The Company will file an annual partnership tax return (Form 1065) and will issue Schedules K-1 to its Members reporting their share of the Company\u2019s items of income, gain, loss, deduction, and credit. The Members are personally responsible for reporting these items on their own federal, state, and local tax returns.</div>
<div class="section"><strong>8.2 Allocations.</strong> The Company\u2019s allocations of items of income, gain, loss, deduction, and credit are governed by Article VI of the Operating Agreement and are intended to have &ldquo;substantial economic effect&rdquo; under Code Section 704(b) and the Regulations promulgated thereunder, including the seven regulatory chargeback rules.</div>
<div class="section"><strong>8.3 Section 704(c).</strong> Where property is contributed to the Company with a built-in gain or loss, the Company will apply ${({remedial: 'the remedial method', traditional: 'the traditional method', curative: 'the curative method', traditional_with_curative_allocations: 'the traditional method with curative allocations'})[d.section704cMethod] || 'the elected Section 704(c) method'} under Treasury Regulation Section 1.704-3.</div>
<div class="section"><strong>8.4 Section 754 Election.</strong> ${({mandatory_make: 'The Company will make a Code Section 754 election effective for its first taxable year.', manager_discretion: 'The Manager has discretion to cause the Company to make a Code Section 754 election if and when the Manager determines it would be in the best interests of the Company and the Members.', member_request: 'The Company will make a Code Section 754 election upon the written request of any Member who acquires a Membership Interest by purchase, transfer, or upon the death of another Member.', no_election: 'The Company does not intend to make a discretionary Code Section 754 election, but will comply with the mandatory basis-adjustment provisions of Code Sections 743(b) and 734(b).'})[d.section754Election] || 'The Manager has discretion to cause the Company to make a Code Section 754 election.'}</div>
<div class="section"><strong>8.5 Phantom Income.</strong> Members may have taxable income in years in which they do not receive cash distributions sufficient to pay the resulting tax. The Operating Agreement provides for tax distributions in certain circumstances, but no assurance can be given that such tax distributions will be sufficient.</div>
<div class="section"><strong>8.6 BBA Partnership Representative.</strong> The Company is subject to the BBA centralized partnership audit regime. The Manager (or another Person designated by the Manager) serves as the &ldquo;partnership representative&rdquo; under Code Section 6223 and has broad authority to make decisions binding on the Members in connection with any IRS audit.</div>
<div class="section"><strong>8.7 Push-Out Election.</strong> The Operating Agreement provides for a Code Section 6226 push-out election in certain audit scenarios, which would push adjustments through to the Members in the reviewed year rather than imposing entity-level tax on the Company.</div>
<div class="section"><strong>8.8 Section 199A.</strong> Members may be entitled to claim a 20% deduction for qualified business income under Code Section 199A, subject to applicable limitations and the rules under the Section 199A Regulations.</div>
<div class="section"><strong>8.9 Section 1031.</strong> The Company may engage in like-kind exchanges under Code Section 1031, in which case the recognition of gain by the Members may be deferred.</div>
<div class="section"><strong>8.10 Section 1014.</strong> Upon the death of a natural-person Member, such Member\u2019s heirs may receive a basis adjustment under Code Section 1014 with respect to such Member\u2019s Membership Interest.</div>
<div class="section"><strong>[ADDITIONAL TAX CONTENT &mdash; FIRM INSERT for deal-specific tax considerations, including any opportunity-zone, REIT, or other elections.]</strong></div>

<p class="article-heading">9. ERISA CONSIDERATIONS</p>
<div class="section">The Manager intends to manage the Company so that the Company\u2019s assets are not treated as &ldquo;plan assets&rdquo; under ERISA. Investors that are employee benefit plans, individual retirement accounts, or other benefit-plan investors should consult their own advisors with respect to the application of ERISA and Code Section 4975 to their Investment.</div>

<p class="article-heading">10. CONFLICTS OF INTEREST</p>
<div class="section">The Manager and its affiliates have numerous actual and potential conflicts of interest with the Company and the Investors. <strong>[FIRM INSERT &mdash; Conflicts table: fee structure, allocation of opportunities, related-party transactions, co-investment, dispositions, affiliated service providers, key-person events, and modification of fiduciary duties under the Operating Agreement.]</strong></div>

<p class="article-heading">11. SUITABILITY STANDARDS</p>
<div class="section">The Investment is suitable only for Investors who: (a) are &ldquo;accredited investors&rdquo; within the meaning of Rule 501(a)${is506c ? ' (Rule 506(c) does not permit non-accredited Investors)' : (d.regDNonAccredited === 'yes_with_purchaser_rep' ? ' (or, if not accredited, are sophisticated Investors who, alone or together with a designated purchaser representative, have such knowledge and experience in financial and business matters that they are capable of evaluating the merits and risks of the Investment, subject to the limit of 35 such non-accredited Investors under Rule 506(b))' : '')}; (b) have sufficient financial resources to bear the economic risk of a complete loss of the Investment; (c) are capable of evaluating the merits and risks of the Investment; and (d) have read this Memorandum in its entirety, together with the Operating Agreement and the Subscription Agreement.</div>
${is506c ? '<div class="section" style="margin-top:1rem;"><strong>Verification of Accredited Status.</strong> Because this Offering is being conducted under Rule 506(c), the Company is required to take reasonable steps to verify that each Investor is an accredited investor. The Accredited Investor Questionnaire accompanying this Memorandum sets forth the verification methods that the Company will accept.</div>' : ''}

<p class="article-heading">12. PLAN OF DISTRIBUTION</p>
<div class="section"><strong>12.1 Manner of Offering.</strong> ${is506c ? 'This Offering is being made under Rule 506(c) and may be conducted through general solicitation and general advertising, including online portals, social media, and other public means. Notwithstanding such general solicitation, sales may be made only to Investors that the Company has reasonably verified as accredited investors.' : 'This Offering is being conducted on a private basis without general solicitation or general advertising. The Company shall conduct the Offering exclusively through pre-existing substantive relationships with Investors known to the Manager and its affiliates.'}</div>
<div class="section"><strong>12.2 Subscription Procedure.</strong> Each prospective Investor must (a) complete and execute a Subscription Agreement and an Accredited Investor Questionnaire, (b) deliver the foregoing to the Company at the address set forth therein, and (c) deliver the Subscription Amount by wire transfer to the account designated by the Company. The Company reserves the right to reject any subscription, in whole or in part, in its sole and absolute discretion.</div>
<div class="section"><strong>12.3 Selling Compensation.</strong> ${escapeHtml('[FIRM INSERT — Sales compensation, if any, to broker-dealers, registered representatives, or finders, including disclosure required under FINRA Rule 5110 and Rule 506.]')}</div>

<p class="article-heading">13. REPORTING</p>
<div class="section">The Company will furnish each Member with (a) annual audited financial statements within ${'[120]'} days following the end of each Fiscal Year; (b) quarterly unaudited financial statements within ${'[45]'} days following the end of each calendar quarter; (c) Schedule K-1 within ${'[90]'} days following the end of each Fiscal Year; and (d) such other information as the Manager reasonably determines is appropriate.</div>

<p class="article-heading">14. CERTAIN ADDITIONAL INFORMATION</p>
<div class="section"><strong>14.1 Use of Estimates and Projections.</strong> Any financial projections, forecasts, or estimates contained in this Memorandum or in any supplemental materials reflect the Manager\u2019s assumptions as of the date hereof, are not guarantees of future performance, and should not be relied upon as such.</div>
<div class="section"><strong>14.2 No Other Information.</strong> No Person has been authorized to make any representation or to provide any information other than as contained in this Memorandum and its exhibits, and any such representation or information should not be relied upon.</div>
<div class="section"><strong>14.3 Document Hierarchy.</strong> In the event of any inconsistency between this Memorandum and the Operating Agreement or the Subscription Agreement, the Operating Agreement and the Subscription Agreement shall control as to the legal rights of the Members.</div>

<p class="article-heading">15. AVAILABLE INFORMATION</p>
<div class="section">The Company will make available to each prospective Investor (and the Investor\u2019s advisors), upon reasonable request, the opportunity to ask questions of, and receive answers from, the Manager and its representatives concerning the terms and conditions of the Offering and to obtain any additional information that the prospective Investor reasonably considers necessary to verify the accuracy of the information set forth in this Memorandum, to the extent the Company possesses such information or can acquire it without unreasonable effort or expense.</div>

<p class="article-heading">EXHIBITS</p>
<div class="section">A &mdash; Limited Liability Company Operating Agreement of the Company<br/>
B &mdash; Subscription Agreement<br/>
C &mdash; Accredited Investor Questionnaire<br/>
D &mdash; Management Services Agreement (if applicable)<br/>
E &mdash; ${'[FIRM INSERT &mdash; Property summary or pipeline; sponsor track record; legal opinions; tax opinions; other deal-specific exhibits]'}
</div>

<div class="section" style="margin-top:2rem; font-style:italic; font-size:0.85rem;">[END OF MEMORANDUM]</div>`;
}

// -----------------------------------------------------------------------------
// AIQ — Accredited Investor Questionnaire (Levels 1, 2, 3)
// -----------------------------------------------------------------------------
function buildAccreditedInvestorQuestionnaire(d) {
  if (d.regDLevel === 'none') {
    return DRAFT_BANNER + '<h1>Accredited Investor Questionnaire</h1><div class="section" style="font-style:italic;">An Accredited Investor Questionnaire is not required for Level 0 (No Reg D Filing) offerings. Select a Reg D Level (1, 2, or 3) in the Members panel to generate this document.</div>';
  }
  const is506c = d.regDLevel === '506c';
  const verificationBlock = is506c ? `
<p class="article-heading">PART IV. VERIFICATION OF ACCREDITED STATUS &mdash; RULE 506(c)(2)(ii)</p>
<div class="section">Because this Offering is being conducted under Rule 506(c), the Company is required to take <em>reasonable steps</em> to verify that each Investor is an accredited investor. Rule 506(c)(2)(ii) sets forth a non-exclusive list of safe-harbor verification methods. The Investor must complete at least one of the following alternative verification paths:</div>

<div class="section" style="margin-top:1rem;"><strong>Path A &mdash; Income Verification (for natural-person Investors qualifying on income basis).</strong> The Investor shall provide copies of (i) IRS Forms W-2, 1099, Schedule K-1, or Form 1040 (with personally identifying information redacted as the Investor prefers) for the two most recent years, evidencing that the Investor\u2019s individual income exceeded $200,000 (or $300,000 jointly with spouse or spousal equivalent) in each of those years; and (ii) a written representation by the Investor that the Investor has a reasonable expectation of reaching the required income level in the current year.</div>

<div class="section" style="margin-top:1rem;"><strong>Path B &mdash; Net Worth Verification (for natural-person Investors qualifying on net worth basis).</strong> The Investor shall provide:
<ul style="margin-left:1.5rem; margin-top:0.5rem;">
<li>Assets: bank statements, brokerage statements, certificates of deposit, tax assessments, and appraisal reports from independent third parties, in each case dated within three months of the verification.</li>
<li>Liabilities: a credit report from at least one of the three national consumer-reporting agencies, dated within three months of the verification.</li>
<li>A written representation by the Investor that all liabilities have been disclosed.</li>
</ul></div>

<div class="section" style="margin-top:1rem;"><strong>Path C &mdash; Third-Party Verification.</strong> The Investor may instead submit a written confirmation, dated within three months of the date hereof, from any of the following Persons that such Person has taken reasonable steps to verify that the Investor is an accredited investor and has determined that the Investor is an accredited investor: (i) a U.S.-licensed certified public accountant; (ii) a U.S.-licensed attorney in good standing; (iii) a registered broker-dealer; or (iv) an SEC-registered investment adviser.</div>

<div class="section" style="margin-top:1rem;"><strong>Path D &mdash; Prior Investor Status.</strong> If the Investor previously participated in a Rule 506(b) offering of the Company or its affiliates as an accredited investor and remains an accredited investor at the time of this Offering, the Investor may certify the same and the Company may rely upon such certification.</div>

<div class="section" style="margin-top:1rem;"><strong>Path E &mdash; Professional Certification.</strong> The Investor holds, in good standing, one of the following professional certifications, designations, or credentials: General Securities Representative license (Series 7), Private Securities Offerings Representative license (Series 82), or Licensed Investment Adviser Representative (Series 65). Verification consists of evidence of the certification, designation, or credential in good standing as of the date of investment.</div>

<div class="section" style="margin-top:1rem;"><strong>Investor\u2019s Selected Verification Path:</strong> [_] Path A &nbsp; [_] Path B &nbsp; [_] Path C &nbsp; [_] Path D &nbsp; [_] Path E</div>
<div class="section">Documentation submitted: ____________________________ &nbsp; Date: ____________</div>
` : '';

  return DRAFT_BANNER + `<h1>Accredited Investor Questionnaire<br/>${escapeHtml(d.companyName || '[Company Name]')}</h1>
<div class="section" style="text-align:right;">Date: ${fmtDate(d.effectiveDate)}</div>

<p class="article-heading">PART I. INVESTOR INFORMATION</p>
<div class="section">Investor Name: ____________________________</div>
<div class="section">Investor Type: [_] Individual &nbsp; [_] Joint with Spouse &nbsp; [_] Entity (specify): __________</div>
<div class="section">Address: ____________________________</div>
<div class="section">Email: ____________________________ &nbsp; Phone: ____________________________</div>
<div class="section">Social Security Number / EIN (last 4 digits only): _______</div>
<div class="section">State of Residence (or, if an entity, state of formation and state of principal place of business): ____________________________</div>

<p class="article-heading">PART II. ACCREDITED INVESTOR STATUS</p>
<div class="section">Under Rule 501(a) of Regulation D under the Securities Act of 1933, an &ldquo;accredited investor&rdquo; means any Person who falls within (or whom the Company reasonably believes to fall within) one or more of the categories below. Please initial each applicable category. Submitting this Questionnaire constitutes the Investor\u2019s representation that the Investor in fact satisfies each initialed category.</div>

<div class="section" style="margin-top:1rem;"><strong>FOR NATURAL PERSONS:</strong></div>
<div class="section">_____ <strong>(a) Net Worth Test.</strong> The Investor (alone or jointly with the Investor\u2019s spouse or spousal equivalent) has an individual net worth, or joint net worth with such spouse or spousal equivalent, in excess of $1,000,000, excluding the value of the Investor\u2019s primary residence (and any indebtedness secured by the primary residence in excess of the value of the residence is included as a liability).</div>
<div class="section">_____ <strong>(b) Income Test.</strong> The Investor had individual income in excess of $200,000 (or joint income with the Investor\u2019s spouse or spousal equivalent in excess of $300,000) in each of the two most recent years, and has a reasonable expectation of reaching the same income level in the current year.</div>
<div class="section">_____ <strong>(c) Professional Certification.</strong> The Investor holds, in good standing, a Series 7, Series 65, or Series 82 license (or other professional certification, designation, or credential designated by the SEC for this purpose).</div>
<div class="section">_____ <strong>(d) Knowledgeable Employee.</strong> The Investor is a &ldquo;knowledgeable employee&rdquo; (as defined in Rule 3c-5(a)(4) under the Investment Company Act) of the Company or of an affiliated entity that is the issuer of a covered fund.</div>
<div class="section">_____ <strong>(e) Family-Office Family Client.</strong> The Investor is a &ldquo;family client&rdquo; (as defined in Rule 202(a)(11)(G)-1 under the Investment Advisers Act) of a family office that itself is an accredited investor under category (g) below.</div>

<div class="section" style="margin-top:1rem;"><strong>FOR ENTITIES:</strong></div>
<div class="section">_____ <strong>(f) Total Assets Test.</strong> The Investor is a corporation, partnership, limited liability company, business trust, or 501(c)(3) entity, in each case not formed for the specific purpose of acquiring the securities offered, with total assets in excess of $5,000,000.</div>
<div class="section">_____ <strong>(g) All-Equity-Owners-Accredited Test.</strong> The Investor is an entity in which each equity owner is itself an accredited investor.</div>
<div class="section">_____ <strong>(h) Bank, Broker-Dealer, Insurance Company, etc.</strong> The Investor is a bank, savings and loan, insurance company, registered investment company, business development company, SBIC, or other entity expressly listed in Rule 501(a)(1).</div>
<div class="section">_____ <strong>(i) Family Office.</strong> The Investor is a family office (as defined in Rule 202(a)(11)(G)-1 under the Investment Advisers Act) with at least $5,000,000 in assets under management and that is not formed for the specific purpose of acquiring the securities offered.</div>
<div class="section">_____ <strong>(j) Trust.</strong> The Investor is a trust with total assets in excess of $5,000,000, not formed for the specific purpose of acquiring the securities offered, whose purchase is directed by a Person who has such knowledge and experience in financial and business matters that such Person is capable of evaluating the merits and risks of the Investment.</div>
<div class="section">_____ <strong>(k) Investment Adviser.</strong> The Investor is an investment adviser registered with the SEC, with a state securities authority, or with the SEC under the Advisers Act as an exempt reporting adviser.</div>
${d.regDNonAccredited === 'yes_with_purchaser_rep' ? `
<div class="section" style="margin-top:1rem;"><strong>FOR NON-ACCREDITED INVESTORS (506(b) only):</strong></div>
<div class="section">_____ <strong>(l) Sophisticated Non-Accredited Investor.</strong> The Investor does not qualify as accredited under categories (a)\u2013(k) but represents that the Investor, alone or together with the Investor\u2019s purchaser representative, has such knowledge and experience in financial and business matters that the Investor is capable of evaluating the merits and risks of the Investment. <em>This option is available only if the Offering is being conducted under Rule 506(b) and the total number of non-accredited investors is limited to 35.</em></div>
<div class="section">If category (l) is initialed, please complete <strong>Schedule 1 (Purchaser Representative Designation)</strong> attached.</div>
` : ''}

<p class="article-heading">PART III. INVESTOR REPRESENTATIONS</p>
<div class="section">By executing this Questionnaire, the Investor represents and warrants to the Company that: (i) the responses set forth in Part II are true, correct, and complete in all material respects; (ii) the Investor will promptly notify the Company in writing of any change in circumstances that would render any of such responses no longer true; (iii) the Investor understands that the Company is relying on the responses in determining whether to accept the Investor\u2019s Subscription and in claiming the Reg D exemption from federal registration; and (iv) the Investor authorizes the Company to make such further inquiries or to undertake such further verification as may be required by Rule 506(c)(2)(ii) (if applicable) or as the Company reasonably determines to be necessary or appropriate.</div>

${verificationBlock}

<div class="signature-block" style="margin-top:2.5rem;">
<div><strong>INVESTOR:</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Title (if entity): ____________________________</div>
<div>Date: ____________________________</div>
</div>

${d.regDNonAccredited === 'yes_with_purchaser_rep' ? `
<div class="schedule-heading" style="margin-top:2rem; page-break-before:always;">SCHEDULE 1 &mdash; PURCHASER REPRESENTATIVE DESIGNATION</div>
<div class="section">If the Investor is a non-accredited Investor relying on a purchaser representative pursuant to Rule 506(b)(2)(ii), the Investor hereby designates the following Person as the Investor\u2019s purchaser representative:</div>
<div class="section">Name of Purchaser Representative: ____________________________</div>
<div class="section">Title / Profession: ____________________________</div>
<div class="section">Address: ____________________________</div>
<div class="section">Relationship to Investor: ____________________________</div>
<div class="section">The purchaser representative confirms that: (i) such Person is not an affiliate, director, officer, or beneficial owner of 10% or more of any class of the equity of the Company, except as disclosed in writing to the Investor; (ii) such Person has such knowledge and experience in financial and business matters that such Person is capable of evaluating the merits and risks of the Investment; (iii) such Person has been acknowledged in writing by the Investor as such Person\u2019s purchaser representative; and (iv) such Person has disclosed to the Investor any material relationship between such Person and the Company in writing.</div>
<div class="signature-block" style="margin-top:1.5rem;">
<div><strong>PURCHASER REPRESENTATIVE:</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ____________________________</div>
<div>Date: ____________________________</div>
</div>
` : ''}`;
}

// -----------------------------------------------------------------------------
// Form D Worksheet (Levels 1, 2, 3)
// -----------------------------------------------------------------------------
function buildFormDWorksheet(d) {
  if (d.regDLevel === 'none') {
    return DRAFT_BANNER + '<h1>Form D Worksheet</h1><div class="section" style="font-style:italic;">A Form D filing is not required for Level 0 (No Reg D Filing). Select a Reg D Level (1, 2, or 3) in the Members panel to generate this worksheet.</div>';
  }
  const J = getJurisdiction(d.jurisdiction);
  const is506c = d.regDLevel === '506c';
  return DRAFT_BANNER + `<h1>Form D Worksheet<br/>${escapeHtml(d.companyName || '[Company Name]')}</h1>
<div class="section">This worksheet pre-populates the key fields required for SEC Form D (Notice of Sale) under Reg D. The actual Form D must be filed electronically through the SEC&rsquo;s EDGAR system within 15 days following the date of first sale of securities. State Form D notice filings (where required) must be made separately&mdash;see the Blue Sky Notice Summary.</div>

<p class="article-heading">ITEM 1. ISSUER\u2019S IDENTITY</p>
<table class="schedule-table">
<tbody>
<tr><td><strong>Name of Issuer</strong></td><td>${escapeHtml(d.companyName || '[Company Name]')}</td></tr>
<tr><td><strong>Jurisdiction of Incorporation/Organization</strong></td><td>${J.name}</td></tr>
<tr><td><strong>Entity Type</strong></td><td>Limited Liability Company</td></tr>
<tr><td><strong>Year of Incorporation/Organization</strong></td><td>2026</td></tr>
<tr><td><strong>Previous Names (if any)</strong></td><td>None</td></tr>
<tr><td><strong>CIK (if previously assigned)</strong></td><td>[None &mdash; first-time filer]</td></tr>
</tbody>
</table>

<p class="article-heading">ITEM 2. PRINCIPAL PLACE OF BUSINESS AND CONTACT INFORMATION</p>
<table class="schedule-table">
<tbody>
<tr><td><strong>Street Address 1</strong></td><td>${escapeHtml(d.principalStreet || '[Street]')}</td></tr>
<tr><td><strong>Street Address 2</strong></td><td></td></tr>
<tr><td><strong>City</strong></td><td>${escapeHtml((d.principalCsz || '').split(',')[0] || '[City]')}</td></tr>
<tr><td><strong>State/Province/Country</strong></td><td>${escapeHtml(((d.principalCsz || '').split(',')[1] || '').trim().split(' ')[0] || J.nameAbbrev)}</td></tr>
<tr><td><strong>Zip/Postal Code</strong></td><td>${escapeHtml(((d.principalCsz || '').split(',')[1] || '').trim().split(' ')[1] || '[ZIP]')}</td></tr>
<tr><td><strong>Phone</strong></td><td>[Manager phone]</td></tr>
</tbody>
</table>

<p class="article-heading">ITEM 3. RELATED PERSONS (Executive Officers, Directors, and Promoters)</p>
<div class="section">List each promoter, executive officer, director, manager, and any beneficial owner of 10% or more of any class of equity of the Issuer.</div>
<table class="schedule-table">
<thead><tr><th>Name</th><th>Title</th><th>Address</th></tr></thead>
<tbody>
<tr><td>${escapeHtml(d.managerName || '[Manager Entity Name]')}</td><td>Manager</td><td>${escapeHtml(d.principalCsz || '[Address]')}</td></tr>
${d.members.map(m => `<tr><td>${escapeHtml(m.name || '[Member]')}</td><td>Member</td><td>${escapeHtml(m.address || '[Address]')}</td></tr>`).join('')}
</tbody>
</table>

<p class="article-heading">ITEM 4. INDUSTRY GROUP</p>
<div class="section">Industry classification: <strong>${({real_estate_holding: 'Real Estate \u2014 Other Real Estate', real_estate_development: 'Real Estate \u2014 Construction', real_estate_operating: 'Real Estate \u2014 Other Real Estate', investment_fund: 'Pooled Investment Fund \u2014 Other', operating_business: 'Other'})[d.businessPurpose] || 'Other'}</strong></div>

<p class="article-heading">ITEM 5. ISSUER SIZE</p>
<div class="section">Revenue range: [_] $0 &nbsp; [_] $1 &mdash; $1,000,000 &nbsp; [_] $1,000,001 &mdash; $5,000,000 &nbsp; [_] $5,000,001 &mdash; $25,000,000 &nbsp; [_] $25,000,001 &mdash; $100,000,000 &nbsp; [_] Over $100,000,000 &nbsp; [_] Decline to disclose &nbsp; [X] Not applicable (newly formed)</div>
<div class="section">Aggregate net asset value (for funds): [_] $0 &nbsp; [_] $1 &mdash; $5,000,000 &nbsp; [_] $5,000,001 &mdash; $25,000,000 &nbsp; [_] $25,000,001 &mdash; $50,000,000 &nbsp; [_] Over $50,000,000 &nbsp; [X] Not applicable</div>

<p class="article-heading">ITEM 6. FEDERAL EXEMPTION(S) AND EXCLUSION(S) CLAIMED</p>
<div class="section">[_] Rule 504 &nbsp; ${is506c ? '[_] Rule 506(b) &nbsp; [X] Rule 506(c)' : '[X] Rule 506(b) &nbsp; [_] Rule 506(c)'} &nbsp; [_] Securities Act Section 4(a)(5) &nbsp; [_] Securities Act Section 4(a)(2) &nbsp; [_] Investment Company Act Section 3(c)(1) &nbsp; [_] Investment Company Act Section 3(c)(7) &nbsp; [_] Other</div>

<p class="article-heading">ITEM 7. TYPE OF FILING</p>
<div class="section">[X] New notice &nbsp; [_] Amendment</div>
<div class="section">Date of first sale: ____________ (estimated based on subscription closing)</div>

<p class="article-heading">ITEM 8. DURATION OF OFFERING</p>
<div class="section">Does the Issuer intend this offering to last more than one year? [_] Yes &nbsp; [_] No</div>

<p class="article-heading">ITEM 9. TYPE(S) OF SECURITIES OFFERED</p>
<div class="section">[_] Equity &nbsp; [_] Debt &nbsp; [_] Option, warrant or other right to acquire another security &nbsp; [_] Security to be acquired upon exercise of option, warrant or other right to acquire security &nbsp; [_] Pooled investment fund interests &nbsp; [X] <strong>Other &mdash; Limited Liability Company Membership Interests</strong></div>

<p class="article-heading">ITEM 10. BUSINESS COMBINATION TRANSACTION</p>
<div class="section">Is this offering being made in connection with a business combination transaction (e.g., merger, acquisition, exchange offer)? [_] Yes &nbsp; [X] No</div>

<p class="article-heading">ITEM 11. MINIMUM INVESTMENT</p>
<div class="section">Minimum investment accepted from any outside investor: ${d.regDMinSubscription ? fmtMoney(d.regDMinSubscription) : '[$_____]'}</div>

<p class="article-heading">ITEM 12. SALES COMPENSATION</p>
<div class="section">Has any Person been or will any Person be paid sales commission in connection with this offering? [_] Yes &nbsp; [_] No &nbsp; <strong>[FIRM CONFIRM]</strong></div>
<div class="section">If yes, identify each broker-dealer, list the CRD number, identify each Person being compensated, and identify the states in which the broker-dealer is registered.</div>

<p class="article-heading">ITEM 13. OFFERING AND SALES AMOUNT</p>
<table class="schedule-table">
<tbody>
<tr><td><strong>Total offering amount</strong></td><td>${d.regDOfferingAmount ? fmtMoney(d.regDOfferingAmount) : '[$_____]'}</td></tr>
<tr><td><strong>Total amount sold (as of filing date)</strong></td><td>$_____ (complete at first sale)</td></tr>
<tr><td><strong>Total remaining to be sold</strong></td><td>$_____ (computed)</td></tr>
<tr><td><strong>Indefinite offering amount?</strong></td><td>[_] Yes &nbsp; [_] No</td></tr>
</tbody>
</table>

<p class="article-heading">ITEM 14. INVESTORS</p>
<div class="section">Total number of investors to whom securities have been sold in this offering: <strong>${escapeHtml(d.regDInvestorCount || '[__]')}</strong></div>
<div class="section">Number of non-accredited investors: ${is506c ? '0 (Rule 506(c) prohibits non-accredited investors)' : (d.regDNonAccredited === 'yes_with_purchaser_rep' ? '[Up to 35 permitted]' : '0')}</div>

<p class="article-heading">ITEM 15. SALES COMMISSIONS &amp; FINDER\u2019S FEES EXPENSES</p>
<div class="section">Total sales commissions: $_____</div>
<div class="section">Finder&rsquo;s fees: $_____</div>

<p class="article-heading">ITEM 16. USE OF PROCEEDS</p>
<div class="section">Amount of gross proceeds used or proposed to be used for payments to executive officers, directors, or promoters listed in Item 3: $_____ <strong>[FIRM CONFIRM &mdash; include acquisition fees, organizational fees, and any other payments to insiders]</strong></div>
<div class="section">Description of intended use of proceeds: ${d.regDUseOfProceeds ? escapeHtml(d.regDUseOfProceeds) : '<strong>[FIRM INSERT]</strong>'}</div>

<p class="article-heading">SIGNATURE</p>
<div class="section">The Issuer or its duly authorized representative shall sign and submit this notice via EDGAR. By signing this notice, each Issuer named above is: (1) Notifying the SEC and/or each state in which this notice is filed of the offering of securities described and undertaking to furnish them, upon written request, in the accordance with applicable law, the information furnished to offerees; (2) Irrevocably appointing each of the Secretary of the SEC and, the Securities Administrator or other legally designated officer of the state in which the Issuer maintains its principal place of business and any state in which this notice is filed, as its agents for service of process, and agreeing that these Persons may accept service on its behalf, of any notice, process or pleading; (3) Certifying that, if the Issuer is claiming a Regulation D exemption for the offering, the Issuer is not disqualified from relying on Rule 504, Rule 505, or Rule 506 for any of the reasons stated in any applicable disqualification provision (the &ldquo;bad actor&rdquo; disqualifications).</div>

<div class="signature-block" style="margin-top:1.5rem;">
<div>${escapeHtml(d.companyName || '[Issuer]')}</div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager</div>
<div>Date: ____________________________</div>
</div>

<div class="section" style="margin-top:1rem; font-style:italic; font-size:0.9rem;"><strong>Filing Instructions.</strong> File electronically through the SEC&rsquo;s EDGAR system within 15 days following the date of first sale. Obtain EDGAR access codes (CIK, CCC, PMAC, password) from the SEC before filing. There is no SEC filing fee. State-level notice filings under the Blue Sky Notice Summary may have separate fees and deadlines.</div>`;
}

// -----------------------------------------------------------------------------
// Blue Sky Notice Summary (Levels 1, 2, 3)
// -----------------------------------------------------------------------------
function buildBlueSkyNoticeSummary(d) {
  if (d.regDLevel === 'none') {
    return DRAFT_BANNER + '<h1>State Blue Sky Notice Summary</h1><div class="section" style="font-style:italic;">No state notice filings are required for Level 0 (No Reg D Filing) offerings if the analysis in the JV Securities Memo holds. Select a Reg D Level (1, 2, or 3) in the Members panel to generate this summary.</div>';
  }
  const stateRows = [
    ['AL', 'Alabama', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['AK', 'Alaska', 'Form D + filing fee', '$600', '15 days after first sale'],
    ['AZ', 'Arizona', 'Form D + filing fee', '$250', '15 days after first sale'],
    ['AR', 'Arkansas', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['CA', 'California', 'Form D notice required; Form 25102(f) required for limited offering exemption', '$300', '15 days after first sale'],
    ['CO', 'Colorado', 'Form D + filing fee', '$75', '15 days after first sale'],
    ['CT', 'Connecticut', 'Form D + filing fee; consent to service of process', '$150', '15 days after first sale'],
    ['DE', 'Delaware', 'Form D filing not required for 506; voluntary filing accepted', 'N/A (no required fee)', 'N/A'],
    ['DC', 'District of Columbia', 'Form D + filing fee', '$250', '15 days after first sale'],
    ['FL', 'Florida', 'Form D + filing fee for 506 offerings', '$200', '15 days after first sale'],
    ['GA', 'Georgia', 'Form D + filing fee', '$250', '15 days after first sale'],
    ['HI', 'Hawaii', 'Form D + filing fee', '$200', '15 days after first sale'],
    ['ID', 'Idaho', 'Form D + filing fee', '$80', '15 days after first sale'],
    ['IL', 'Illinois', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['IN', 'Indiana', 'Form D + filing fee', '$350', '15 days after first sale'],
    ['IA', 'Iowa', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['KS', 'Kansas', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['KY', 'Kentucky', 'Form D + filing fee', '$250', '15 days after first sale'],
    ['LA', 'Louisiana', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['ME', 'Maine', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['MD', 'Maryland', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['MA', 'Massachusetts', 'Form D + filing fee; consent to service required', '$300', '15 days after first sale'],
    ['MI', 'Michigan', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['MN', 'Minnesota', 'Form D + filing fee', '$50', '15 days after first sale'],
    ['MS', 'Mississippi', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['MO', 'Missouri', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['MT', 'Montana', 'Form D + filing fee', '$200', '15 days after first sale'],
    ['NE', 'Nebraska', 'Form D + filing fee', '$200', '15 days after first sale'],
    ['NV', 'Nevada', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['NH', 'New Hampshire', 'Form D + filing fee', '$500', '15 days after first sale'],
    ['NJ', 'New Jersey', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['NM', 'New Mexico', 'Form D + filing fee', '$350', '15 days after first sale'],
    ['NY', 'New York', '<em>Note:</em> NY rescinded its state-level Form D-style filing for 506 offerings effective December 2020. EDGAR-filed Form D is sufficient for NY purposes. No state-level filing fee required.', 'N/A (post-2020)', 'N/A'],
    ['NC', 'North Carolina', 'Form D + filing fee', '$350', '15 days after first sale'],
    ['ND', 'North Dakota', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['OH', 'Ohio', 'Form D + filing fee', '$100', '15 days after first sale'],
    ['OK', 'Oklahoma', 'Form D + filing fee', '$200', '15 days after first sale'],
    ['OR', 'Oregon', 'Form D + filing fee', '$225', '15 days after first sale'],
    ['PA', 'Pennsylvania', 'Form D + filing fee', '$575', '15 days after first sale'],
    ['RI', 'Rhode Island', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['SC', 'South Carolina', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['SD', 'South Dakota', 'Form D + filing fee', '$150', '15 days after first sale'],
    ['TN', 'Tennessee', 'Form D + filing fee', '$500', '15 days after first sale'],
    ['TX', 'Texas', 'Form D + filing fee', '$500', '15 days after first sale'],
    ['UT', 'Utah', 'Form D + filing fee', '$60', '15 days after first sale'],
    ['VT', 'Vermont', 'Form D + filing fee', '$600', '15 days after first sale'],
    ['VA', 'Virginia', 'Form D + filing fee', '$250', '15 days after first sale'],
    ['WA', 'Washington', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['WV', 'West Virginia', 'Form D + filing fee', '$300', '15 days after first sale'],
    ['WI', 'Wisconsin', 'Form D + filing fee', '$200', '15 days after first sale'],
    ['WY', 'Wyoming', 'Form D + filing fee', '$200', '15 days after first sale']
  ];

  const selectedStates = (d.regDSaleStates || '').split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const filterToSelected = selectedStates.length > 0;
  const filteredRows = filterToSelected ? stateRows.filter(r => selectedStates.includes(r[0])) : stateRows;

  const totalFee = filteredRows.reduce((sum, r) => {
    const m = r[3].match(/\$([0-9,]+)/);
    if (!m) return sum;
    return sum + parseInt(m[1].replace(/,/g, ''));
  }, 0);

  return DRAFT_BANNER + `<h1>State Blue Sky Notice Summary<br/>${escapeHtml(d.companyName || '[Company Name]')}</h1>
<div class="section">This summary identifies the state-level notice filing requirements applicable to a Reg D offering. Most states require a Form D-style notice filing within 15 days following the date of first sale in the state, accompanied by a filing fee. Fees are stated as of September 2026 and change; counsel should verify each fee against the relevant state securities administrator&rsquo;s website before filing.</div>
${filterToSelected ? `<div class="section"><strong>States selected for this offering:</strong> ${escapeHtml(selectedStates.join(', '))}.</div>` : '<div class="section"><strong>All 50 states + DC shown.</strong> To filter to specific states only, populate the "States Where Sales Will Be Made" field in the Members panel.</div>'}

<table class="schedule-table">
<thead><tr><th>State</th><th>Filing Required</th><th>Fee</th><th>Deadline</th></tr></thead>
<tbody>
${filteredRows.map(r => `<tr><td>${escapeHtml(r[1] + ' (' + r[0] + ')')}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}
<tr style="font-weight:bold; border-top:2px solid #1a1a1a;"><td colspan="2">Aggregate fees (if filing in all listed states)</td><td>${fmtMoney(totalFee)}</td><td>&mdash;</td></tr>
</tbody>
</table>

<div class="section" style="margin-top:1.5rem; font-style:italic;"><strong>Filing Mechanics.</strong> Most state notice filings can be made through the <em>NASAA Electronic Filing Depository (EFD)</em> at https://www.efdnasaa.org, which forwards the Form D to participating states upon submission and accepts the state filing fee electronically. Currently 47 states participate in EFD; the non-participating states (Florida, New York, and a small handful of others) require direct filing with the state administrator. Counsel should check the EFD participation status before submitting filings.</div>
<div class="section" style="font-style:italic;"><strong>State-Specific Notes.</strong> (i) <em>New York</em>: as of December 2, 2020, NY no longer requires its state-level Form 99 filing for Reg D 506 offerings; the federal Form D submitted via EDGAR satisfies NY notice requirements. (ii) <em>California</em>: a separate state-law exemption notice (Form 25102(f)) is required in addition to the Form D notice; the deadline is 15 calendar days following the first sale. (iii) <em>Pennsylvania</em>: has unusually high filing fees and aggressive notice deadlines; counsel should prioritize PA filings. (iv) <em>Massachusetts and Connecticut</em>: require consent to service of process forms to be submitted with the Form D notice.</div>`;
}

/* ============================================================================
   LEVEL 3 — INVESTOR VERIFICATION DOCUMENTATION STANDARD
   ============================================================================
   Migrated from former buildVerificationStandard (secLevel-keyed) to regDLevel.
   Stand-alone procedural document the Issuer publishes to investors describing
   how the Issuer will discharge its Rule 506(c)(2)(ii) duty. Complements (does
   not duplicate) Part IV of the Accredited Investor Questionnaire.
   ============================================================================ */
function buildVerificationStandard(d) {
  if (d.regDLevel !== '506c') {
    return DRAFT_BANNER + '<h1>Investor Verification Documentation Standard</h1><div class="section" style="font-style:italic;">This document is generated only when Securities Compliance Level is set to Level 3 (Rule 506(c) General Solicitation), where the Issuer is required to take reasonable steps to verify the accredited status of each purchaser. Select Level 3 in the Securities Compliance panel to generate this document.</div>';
  }
  return DRAFT_BANNER + `<h1>Investor Verification<br/>Documentation Standard<br/><span style="font-size:0.6em; font-weight:normal;">${escapeHtml(d.companyName || '[Company]')} &mdash; Rule 506(c) Offering</span></h1>
<div class="section">Because the offering of Membership Interests of ${escapeHtml(d.companyName || '[Company]')} (the &ldquo;<strong>Company</strong>&rdquo;) is being conducted pursuant to Rule 506(c) of Regulation D, the Company is required under Rule 506(c)(2)(ii) to take <em>reasonable steps</em> to verify the accredited investor status of each purchaser. This document sets forth the verification methods the Company will accept and the documentation each prospective Investor must provide. This Standard supplements (and does not replace) Part IV of the Accredited Investor Questionnaire.</div>

<p class="article-heading">1. STANDARD: REASONABLE STEPS</p>
<div class="section"><strong>1.1 Statutory Standard.</strong> Rule 506(c)(2)(ii) requires that the Company take &ldquo;reasonable steps&rdquo; to verify that each purchaser is an accredited investor. The standard is principles-based: what is reasonable depends on the facts and circumstances of each purchase, including (a) the nature of the purchaser and the type of accredited investor that the purchaser claims to be; (b) the amount and type of information that the Company has about the purchaser; and (c) the nature of the offering, such as the manner in which the purchaser was solicited and the terms of the offering (including any minimum investment amount).</div>
<div class="section"><strong>1.2 SEC Guidance.</strong> The SEC has provided four non-exclusive safe-harbor verification methods (the &ldquo;<strong>Safe Harbors</strong>&rdquo;) under Rule 506(c)(2)(ii), summarized in Section 2 below. The Company will accept any of the Safe Harbors and may also rely on other methods that constitute reasonable steps under the circumstances. <strong>Self-certification alone is insufficient under Rule 506(c);</strong> each purchaser must affirmatively provide verification documentation.</div>

<p class="article-heading">2. SAFE-HARBOR VERIFICATION METHODS</p>
<div class="section"><strong>2.1 Income Verification.</strong> Review of any IRS form that reports the purchaser&rsquo;s income for the two most recent years (such as Forms W-2, K-1, 1099, or 1040 or any equivalent), plus a written representation from the purchaser that the purchaser has a reasonable expectation of reaching the income level necessary to qualify as an accredited investor during the current year. Joint income requires forms covering both spouses or spousal equivalents.</div>
<div class="section"><strong>2.2 Net Worth Verification.</strong> Review of one or more of the following documents, dated within the three (3) months preceding the date of verification, plus a written representation from the purchaser that all liabilities necessary to make the net worth determination have been disclosed:</div>
<div class="section" style="padding-left:1.5rem;">(a) <strong>Assets:</strong> bank statements, brokerage statements, statements of securities holdings, certificates of deposit, tax assessments, third-party appraisal reports, or any document evidencing ownership of assets.<br/><br/>(b) <strong>Liabilities:</strong> a credit report from at least one of the nationwide consumer reporting agencies (e.g., Equifax, Experian, TransUnion).</div>
<div class="section">For the net-worth method, the purchaser&rsquo;s primary residence is excluded from assets, and any indebtedness secured by the residence in excess of the residence&rsquo;s fair market value is netted against the purchaser&rsquo;s assets.</div>
<div class="section"><strong>2.3 Third-Party Confirmation.</strong> Receipt of a written confirmation, dated within the three (3) months preceding the date of verification, from one of the following: (a) a registered broker-dealer; (b) an SEC-registered investment adviser; (c) a licensed attorney in good standing; or (d) a licensed certified public accountant in good standing. The confirmation must state that the professional has taken reasonable steps to verify the purchaser&rsquo;s accredited status within the prior three (3) months and has determined that the purchaser is an accredited investor.</div>
<div class="section"><strong>2.4 Prior-Investor Re-Verification.</strong> If the purchaser invested in a prior Rule 506(c) offering of the Issuer (or an affiliate of the Issuer) and was verified at that time, the Issuer may rely on a written confirmation from the purchaser that the purchaser continues to qualify as an accredited investor, provided that the prior verification was completed within five (5) years before the new sale and the Issuer has no actual knowledge that the purchaser no longer qualifies.</div>

<p class="article-heading">3. SUBMISSION PROCEDURES</p>
<div class="section"><strong>3.1 Documentation Required.</strong> Each prospective Investor must submit, together with the Accredited Investor Questionnaire and Subscription Agreement, the verification documentation indicated in Section 2 corresponding to the verification method elected by the Investor. Documentation is submitted to the Manager via the secure data room established for the offering or to such other address as the Manager designates.</div>
<div class="section"><strong>3.2 Confidentiality.</strong> Verification documentation submitted to the Company will be held in confidence and used solely for the purposes of: (a) determining the Investor&rsquo;s eligibility; (b) maintaining the Company&rsquo;s books and records of the offering; and (c) responding to inquiries from securities regulators. Verification materials will not be disclosed to any third party except as required by applicable law or with the Investor&rsquo;s prior written consent. The Manager will treat all such materials as confidential information of the Investor.</div>
<div class="section"><strong>3.3 Acceptance or Rejection.</strong> The Manager will review the submitted verification materials and notify the Investor in writing whether the Investor has been deemed verified for purposes of the offering. The Manager may, in its discretion, request additional documentation or clarification. Acceptance of the Investor&rsquo;s Subscription is conditioned on satisfactory verification.</div>
<div class="section"><strong>3.4 Recordkeeping.</strong> The Company will retain copies of all verification documentation in the offering file for at least three (3) years (and longer if reasonably necessary to support the Issuer&rsquo;s Rule 506(c) reliance position) following the close of the offering.</div>

<p class="article-heading">4. SPECIAL CASES</p>
<div class="section"><strong>4.1 Entities.</strong> Entity Investors that qualify as accredited under Rule 501(a) categories (assets test, all-accredited-owners, bank, registered investment company, etc.) may satisfy verification through documentation of entity formation, audited financial statements, regulator registration, or the third-party confirmation method in Section&nbsp;2.3.</div>
<div class="section"><strong>4.2 Trusts.</strong> Trust Investors should provide the trust agreement (or relevant excerpts) demonstrating that the trust qualifies under Rule&nbsp;501(a)(7) (qualifying trust with assets in excess of $5,000,000) or that all grantors of a revocable trust are accredited.</div>
<div class="section"><strong>4.3 Family Offices.</strong> Family-office Investors should provide documentation evidencing $5,000,000+ in assets under management and that the prospective investment is directed by a person with the requisite knowledge and experience under Rule 501(a)(12).</div>
<div class="section"><strong>4.4 Professional Certifications.</strong> Natural-person Investors qualifying under Rule 501(a)(10) (holding in good standing FINRA Series 7, Series 65, or Series 82) should provide current FINRA BrokerCheck or other registry confirmation showing the license in good standing.</div>
<div class="section"><strong>4.5 Knowledgeable Employees of Private Funds.</strong> Where applicable, &ldquo;knowledgeable employees&rdquo; of a private fund under Rule 3c-5 under the Investment Company Act may rely on their employment status as evidence of accredited status under Rule 501(a)(11); employment documentation must be provided.</div>

<p class="article-heading">5. CONTINUING OBLIGATIONS</p>
<div class="section">Each verified Investor agrees to promptly notify the Manager in writing if the Investor ceases to be an accredited investor at any time during the period in which the Investor is invested in the Company. This obligation does not, of itself, give rise to any right of redemption or any obligation by the Company to redeem the Investor.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<div>This Investor Verification Documentation Standard is dated as of ${fmtDate(d.effectiveDate)}.</div>
<div style="margin-top:1.5rem;"><strong>${escapeHtml(d.companyName || '[Company]')}</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager</div>
</div>`;
}

/* ============================================================================
   LEVEL 3 — GENERAL SOLICITATION COMPLIANCE MEMORANDUM
   ============================================================================
   Migrated from former buildGenSolicComplianceMemo (secLevel-keyed) to
   regDLevel. Internal compliance memorandum guiding the Company, the Manager,
   and all persons acting on the Company's behalf in conducting a Rule 506(c)
   offering that uses general solicitation.
   ============================================================================ */
function buildGenSolicComplianceMemo(d) {
  if (d.regDLevel !== '506c') {
    return DRAFT_BANNER + '<h1>General Solicitation Compliance Memorandum</h1><div class="section" style="font-style:italic;">This document is generated only when Securities Compliance Level is set to Level 3 (Rule 506(c) General Solicitation). Select Level 3 in the Securities Compliance panel to generate this memorandum.</div>';
  }
  return DRAFT_BANNER + `<h1>General Solicitation<br/>Compliance Memorandum<br/><span style="font-size:0.6em; font-weight:normal;">${escapeHtml(d.companyName || '[Company]')} &mdash; Rule 506(c) Offering</span></h1>
<div class="section" style="background:#fafaf5; border-left:3px solid #d4a017; padding:0.85rem 1.1rem; font-style:italic;"><strong>PURPOSE.</strong> This memorandum sets forth the compliance framework for general solicitation and general advertising in connection with the Rule 506(c) offering of Membership Interests of ${escapeHtml(d.companyName || '[Company]')} (the &ldquo;<strong>Company</strong>&rdquo;). It is intended to guide the Company, the Manager, and all persons acting on the Company&rsquo;s behalf in conducting the offering in compliance with Rule 506(c) of Regulation D and applicable state law.</div>

<p class="article-heading">1. RULE 506(c) FRAMEWORK</p>
<div class="section"><strong>1.1 Exemption.</strong> The Company is offering its Membership Interests in reliance on the exemption from registration provided by Rule 506(c) of Regulation D under the Securities Act of 1933 (the &ldquo;<strong>Securities Act</strong>&rdquo;).</div>
<div class="section"><strong>1.2 Permitted Activities.</strong> Rule 506(c) permits the use of general solicitation and general advertising in connection with the offering, provided that: (a) all purchasers in the offering are accredited investors; (b) the Company takes reasonable steps to verify the accredited status of each purchaser (see the separate <em>Investor Verification Documentation Standard</em>); and (c) the Company complies with the bad-actor disqualification provisions of Rule 506(d) (see Section&nbsp;4 below and the separate <em>Rule 506(d) Bad Actor Questionnaire</em>).</div>
<div class="section"><strong>1.3 General Solicitation Defined.</strong> &ldquo;General solicitation&rdquo; and &ldquo;general advertising&rdquo; include, without limitation: (a) advertisements in newspapers, magazines, online news sites, television, and radio; (b) communications published on the Internet, including websites, social media (LinkedIn, X/Twitter, Facebook, Instagram), email blasts, podcasts, and webinars; (c) seminars or meetings to which attendees have been invited by general solicitation or advertising; (d) third-party referrals through public-facing programs; and (e) any other communication conducted through means that do not involve a prior substantive relationship.</div>

<p class="article-heading">2. COMPLIANCE PROCEDURES</p>
<div class="section"><strong>2.1 Approval of Marketing Materials.</strong> All marketing materials, including websites, social media posts, presentation decks, email solicitations, podcasts, and any other public-facing communication relating to the offering, must be approved in writing by the Manager (with counsel review) prior to dissemination. The Manager will maintain a log of all approved materials and the dates of dissemination.</div>
<div class="section"><strong>2.2 Accuracy and Balance.</strong> All marketing communications must (a) be accurate and not materially misleading; (b) include balanced presentation of risks alongside benefits; (c) include any required legends or disclaimers (see Section&nbsp;3); and (d) avoid forward-looking statements that are not appropriately framed with disclaimers and assumptions and accompanied by meaningful cautionary language.</div>
<div class="section"><strong>2.3 Investor Intake.</strong> All prospective Investors directed to or expressing interest in the Company through general solicitation channels will be required to complete the Accredited Investor Questionnaire and submit verification documentation pursuant to the Investor Verification Documentation Standard <strong>before</strong> receiving the Private Placement Memorandum, Operating Agreement, Subscription Agreement, or other detailed offering materials.</div>
<div class="section"><strong>2.4 Sale Only to Verified Accredited Investors.</strong> The Company will not accept a Subscription from any person who has not been verified as an accredited investor pursuant to the Investor Verification Documentation Standard. Investments will be returned (or never accepted) for any prospective Investor whose verification fails.</div>
<div class="section"><strong>2.5 No Non-Accredited Sales.</strong> Rule 506(c) prohibits any sale to a non-accredited investor. The Company will not extend the offering to friends and family without verification and will not sell to any non-accredited person under any circumstances.</div>
<div class="section"><strong>2.6 Testing the Waters.</strong> &ldquo;Testing-the-waters&rdquo; communications conducted before commencement of the offering are subject to separate analysis under Rule&nbsp;241 and Rule&nbsp;148. Counsel must be consulted before any such communications are made.</div>

<p class="article-heading">3. REQUIRED DISCLOSURES AND LEGENDS</p>
<div class="section">All marketing communications relating to the offering must include the following disclosures and legends, modified for the specific medium:</div>
<div class="section" style="padding-left:1.5rem; font-style:italic;">&ldquo;Securities offered pursuant to Rule 506(c) of Regulation D under the Securities Act of 1933. Sales are limited to accredited investors whose status has been verified by the Issuer. Investment involves substantial risk including possible loss of principal. Past performance is not indicative of future results. The investment is illiquid; no public market exists. Each investor must rely on its own due diligence and its own professional advisors. This is not an offer to sell or a solicitation of an offer to buy in any jurisdiction where such offer or sale is not permitted.&rdquo;</div>

<p class="article-heading">4. BAD-ACTOR DISQUALIFICATION (RULE 506(d))</p>
<div class="section"><strong>4.1 Standard.</strong> Rule 506(d) disqualifies a Reg D offering if any &ldquo;covered person&rdquo; is subject to certain disqualifying events. Covered persons include: (a) the Issuer, the Manager, and their respective predecessors and affiliated issuers; (b) directors, executive officers, general partners, and managing members of the Issuer; (c) any 20% beneficial owner of the Issuer&rsquo;s outstanding voting equity, calculated on the basis of total voting power; (d) promoters connected with the Issuer in any capacity at the time of the sale; (e) any investment manager of an issuer that is a pooled investment fund, any principal of such investment manager, and any compensated solicitor of investors; and (f) any director, executive officer, or other officer participating in the offering of any of the foregoing.</div>
<div class="section"><strong>4.2 Disqualifying Events.</strong> Disqualifying events under Rule&nbsp;506(d)(1) include, among others: criminal convictions in connection with the purchase or sale of any security, false filings, or making false statements to regulators; court injunctions or restraining orders relating to securities, false filings, fraud, or the conduct of securities business; certain SEC and CFTC disciplinary orders; U.S. Postal Service false-representation orders; suspensions or expulsions from a securities self-regulatory organization; SEC cease-and-desist orders for scienter-based or Section&nbsp;5 violations; and a number of other specified events. The look-back periods range from five (5) to ten (10) years depending on event type.</div>
<div class="section"><strong>4.3 Diligence Conducted.</strong> The Company, the Manager, and counsel have conducted reasonable due diligence into the background of each covered person, including: (a) reviewing FINRA BrokerCheck records; (b) reviewing SEC EDGAR enforcement records; (c) requesting and reviewing each covered person&rsquo;s completed Rule 506(d) Bad Actor Questionnaire and accompanying representations; and (d) reviewing publicly available criminal-history and litigation records to the extent reasonably available. Based on that diligence, the Company has concluded that no covered person is subject to a disqualifying event under Rule&nbsp;506(d).</div>
<div class="section"><strong>4.4 Ongoing Monitoring.</strong> The Company will require each covered person to promptly notify the Manager of any event that could constitute a Disqualifying Event. If any covered person becomes subject to a Disqualifying Event during the offering, the Company will consult counsel as to whether continued sales in reliance on Rule&nbsp;506 are permitted; a Rule&nbsp;506(d)(2)(ii) curative waiver may be available in limited circumstances and must be applied for and granted by the SEC.</div>

<p class="article-heading">5. RECORDKEEPING</p>
<div class="section">The Company shall maintain, for at least three (3) years following the close of the offering:</div>
<div class="section" style="padding-left:1.5rem;">(a) copies of all marketing materials disseminated in connection with the offering;<br/>(b) the marketing-materials approval log required by Section&nbsp;2.1;<br/>(c) all Accredited Investor Questionnaires and verification documentation;<br/>(d) all bad-actor due-diligence materials, including completed Rule 506(d) Bad Actor Questionnaires and supporting representations;<br/>(e) the federal Form D filing and any amendments;<br/>(f) all state Blue Sky notice filings; and<br/>(g) all Subscription Agreements and Operating Agreement joinder agreements.</div>

<p class="article-heading">6. STATE LAW CONSIDERATIONS</p>
<div class="section">While Rule&nbsp;506 offerings are &ldquo;covered securities&rdquo; under Section&nbsp;18 of the Securities Act preempting most state registration requirements, states retain jurisdiction over: (a) state notice filings and filing fees; (b) anti-fraud authority; and (c) certain advertising restrictions and broker-dealer registration requirements. The Manager and counsel will ensure compliance with the most restrictive applicable state law in any state from which prospective Investors may be solicited or where prospective Investors reside.</div>

<div class="signature-block" style="margin-top:2.5rem;">
<div>This General Solicitation Compliance Memorandum is dated as of ${fmtDate(d.effectiveDate)}.</div>
<div style="margin-top:1.5rem;"><strong>${escapeHtml(d.companyName || '[Company]')}</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Name: ${escapeHtml(d.managerName || '____________________________')}</div>
<div>Title: Manager</div>
</div>`;
}

/* ============================================================================
   LEVEL 3 — RULE 506(d) BAD ACTOR QUESTIONNAIRE
   ============================================================================
   New for Phase 4. Required at Level 3 per user spec. Each "covered person"
   under Rule 506(d)(1) must complete this questionnaire so that the Issuer
   can document its reasonable-care defense under Rule 506(d)(2)(iv).
   ============================================================================ */
function buildBadActorQuestionnaire(d) {
  if (d.regDLevel !== '506c') {
    return DRAFT_BANNER + '<h1>Rule 506(d) Bad Actor Questionnaire</h1><div class="section" style="font-style:italic;">This questionnaire is generated only when Securities Compliance Level is set to Level 3 (Rule 506(c) General Solicitation), where the Issuer must conduct factual inquiry of each &ldquo;covered person&rdquo; under Rule 506(d). For Level 1 and Level 2 (Rule 506(b)) offerings, a background check conducted by counsel or the issuer is typically sufficient and a separate questionnaire is generally not required; consult counsel if the issuer wishes to memorialize the inquiry in writing for those levels. Select Level 3 in the Securities Compliance panel to generate this questionnaire.</div>';
  }
  return DRAFT_BANNER + `<h1>Rule 506(d) Bad Actor Questionnaire<br/><span style="font-size:0.6em; font-weight:normal;">${escapeHtml(d.companyName || '[Company]')} &mdash; Rule 506(c) Offering</span></h1>

<div class="section" style="background:#fafaf5; border-left:3px solid #d4a017; padding:0.85rem 1.1rem; font-style:italic;"><strong>INSTRUCTIONS.</strong> Rule 506(d) of Regulation D under the Securities Act of 1933 (the &ldquo;<strong>Securities Act</strong>&rdquo;) disqualifies an issuer from relying on Rule&nbsp;506 if certain &ldquo;covered persons&rdquo; have been the subject of one or more specified disqualifying events (the &ldquo;<strong>Disqualifying Events</strong>&rdquo;). This Questionnaire is being delivered to each covered person of ${escapeHtml(d.companyName || '[Company]')} (the &ldquo;<strong>Company</strong>&rdquo;) so that the Company may discharge its factual inquiry obligation under Rule&nbsp;506(d) and document its reasonable-care defense under Rule&nbsp;506(d)(2)(iv). Please complete and return this Questionnaire to the Manager no later than ten (10) business days before the first sale of securities in the offering. Each covered person must update this Questionnaire promptly upon learning of any change in answer.</div>

<p class="article-heading">PART I. COVERED PERSON IDENTIFICATION</p>
<table class="schedule-table">
<tbody>
<tr><td><strong>Full legal name</strong></td><td>____________________________</td></tr>
<tr><td><strong>Date of birth (if natural person)</strong></td><td>____________________________</td></tr>
<tr><td><strong>Residence / principal business address</strong></td><td>____________________________</td></tr>
<tr><td><strong>Relationship to the Issuer (check all that apply)</strong></td><td>
[_] Issuer<br/>
[_] Predecessor of Issuer<br/>
[_] Affiliated Issuer<br/>
[_] Director / Manager / Managing Member / General Partner of Issuer<br/>
[_] Executive Officer / Other Officer participating in offering<br/>
[_] 20% Beneficial Owner of Issuer&rsquo;s outstanding voting equity<br/>
[_] Promoter connected with Issuer at the time of sale<br/>
[_] Investment Manager of a pooled-investment-fund Issuer<br/>
[_] Principal of any of the above<br/>
[_] Compensated solicitor / placement agent / broker-dealer
</td></tr>
<tr><td><strong>Date became a covered person</strong></td><td>____________________________</td></tr>
</tbody>
</table>

<p class="article-heading">PART II. DISQUALIFYING EVENTS</p>
<div class="section">For each item below, mark <strong>Yes</strong> or <strong>No</strong>. If <strong>Yes</strong>, attach a written description (date, court / regulator, case caption or order number, conduct at issue, current status, and any sanction or settlement). The look-back period applicable to each event is stated next to the item. <strong>If you are unsure whether an event qualifies, mark Yes and let counsel evaluate.</strong></div>

<div class="section" style="margin-top:1rem;"><strong>1. Criminal Convictions [10-year look-back for issuers and underwriters; 5-year look-back for all other covered persons]. </strong>Within the applicable look-back period, have you been convicted of any felony or misdemeanor: (a) in connection with the purchase or sale of any security; (b) involving the making of any false filing with the SEC; or (c) arising out of the conduct of the business of an underwriter, broker, dealer, municipal securities dealer, investment adviser, or paid solicitor of purchasers of securities?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>2. Court Injunctions and Restraining Orders [5-year look-back]. </strong>Within the past five (5) years, have you been subject to any order, judgment, or decree of any court of competent jurisdiction entered against you that, at the time of the proposed sale of securities, restrains or enjoins you from engaging or continuing to engage in any conduct or practice: (a) in connection with the purchase or sale of any security; (b) involving the making of any false filing with the SEC; or (c) arising out of the conduct of the business of an underwriter, broker, dealer, municipal securities dealer, investment adviser, or paid solicitor of purchasers of securities?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>3. Final Orders of State Regulators and Federal Banking Agencies [10-year look-back]. </strong>Are you subject to a final order of (a) a state securities commission (or an agency or officer performing similar functions); (b) a state authority that supervises or examines banks, savings associations, or credit unions; (c) a state insurance commission (or an agency or officer performing similar functions); (d) an appropriate federal banking agency; (e) the U.S. Commodity Futures Trading Commission; or (f) the National Credit Union Administration, that: (i) at the time of the sale, bars you from association with an entity regulated by such commission, authority, agency, or officer; engaging in the business of securities, insurance, or banking; or engaging in savings association or credit union activities; or (ii) constitutes a final order based on a violation of any law or regulation that prohibits fraudulent, manipulative, or deceptive conduct entered within the past ten (10) years?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>4. SEC Disciplinary Orders [for the duration of the order]. </strong>Are you subject to an order of the SEC, entered pursuant to Section&nbsp;15(b) or 15B(c) of the Securities Exchange Act of 1934 or Section&nbsp;203(e) or 203(f) of the Investment Advisers Act of 1940 that: (a) suspends or revokes your registration as a broker, dealer, municipal securities dealer, or investment adviser; (b) places limitations on your activities, functions, or operations; or (c) bars you from being associated with any entity or from participating in the offering of any penny stock?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>5. SEC Cease-and-Desist Orders [5-year look-back]. </strong>Within the past five (5) years, have you been subject to any order of the SEC entered pursuant to Section&nbsp;8A of the Securities Act, Section&nbsp;21C of the Exchange Act, Section&nbsp;9(f) of the Investment Company Act, or Section&nbsp;203(k) of the Investment Advisers Act that orders you to cease and desist from committing or causing a violation or future violation of: (a) any scienter-based anti-fraud provision of the federal securities laws (including, without limitation, Section&nbsp;17(a)(1) of the Securities Act, Section&nbsp;10(b) of the Exchange Act and Rule 10b-5 thereunder, Section&nbsp;15(c)(1) of the Exchange Act, and Section&nbsp;206(1) of the Investment Advisers Act); or (b) Section&nbsp;5 of the Securities Act?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>6. Suspension or Expulsion from SRO [for duration of suspension or expulsion]. </strong>Are you suspended or expelled from membership in, or suspended or barred from association with a member of, a registered national securities exchange or a registered national or affiliated securities association for any act or omission to act constituting conduct inconsistent with just and equitable principles of trade?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>7. Stop Orders and Refusal Orders [5-year look-back]. </strong>Within the past five (5) years, have you filed (as a registrant or issuer), or were you named as an underwriter in, any registration statement or Regulation A offering statement that was the subject of a refusal order, stop order, or order suspending the Regulation A exemption, or are you the subject of an investigation or proceeding to determine whether such an order should be issued?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>8. U.S. Postal Service False Representation Orders [5-year look-back]. </strong>Within the past five (5) years, have you been subject to a U.S. Postal Service false representation order (or are you currently subject to a temporary restraining order or preliminary injunction with respect to conduct alleged by the U.S. Postal Service to constitute a scheme or device for obtaining money or property through the mail by means of false representations)?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<p class="article-heading">PART III. OTHER PROCEEDINGS AND BACKGROUND</p>
<div class="section"><strong>9. Pending Proceedings.</strong> Are you currently the subject of any pending criminal proceeding, regulatory investigation, formal order of investigation, administrative proceeding, civil action, or arbitration alleging any of the conduct described in Items 1-8 above? If yes, attach a written description.<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<div class="section" style="margin-top:0.75rem;"><strong>10. FINRA Disclosures.</strong> If you have ever held a FINRA registration, please attach a current FINRA BrokerCheck report (or CRD snapshot) covering all reportable events.<br/>&nbsp;&nbsp;[_] Attached &nbsp; [_] Not applicable</div>

<div class="section" style="margin-top:0.75rem;"><strong>11. Other Matters.</strong> Are you aware of any other fact or circumstance that, in your reasonable judgment, the Issuer or its counsel would want to know in connection with the Rule&nbsp;506(d) diligence (for example, a tax-fraud conviction, a private civil judgment for securities fraud, a personal bankruptcy with claims of malfeasance, or a settled disciplinary matter)?<br/>&nbsp;&nbsp;[_] Yes &nbsp; [_] No</div>

<p class="article-heading">PART IV. REPRESENTATIONS, COVENANTS, AND UPDATE OBLIGATION</p>
<div class="section">By executing this Questionnaire, the covered person represents and warrants to the Company that:</div>
<div class="section" style="padding-left:1.5rem;">(a) the responses set forth in Parts&nbsp;I through III above are true, correct, and complete in all material respects as of the date of execution;<br/><br/>(b) the covered person understands that the Company is relying on these responses in determining whether the Rule&nbsp;506 exemption is available, and that any material misstatement could cause loss of the exemption with materially adverse consequences for the Company and its investors;<br/><br/>(c) the covered person will promptly notify the Manager in writing of any event after the date hereof that would require any answer in Parts II or III to be updated, including any post-execution Disqualifying Event or any threatened, anticipated, or commenced regulatory or criminal action that could reasonably lead to a Disqualifying Event; and<br/><br/>(d) if the covered person becomes the subject of a Disqualifying Event after the date hereof, the covered person will cooperate fully with the Company, the Manager, and counsel in evaluating whether: (i) the event predates September&nbsp;23, 2013 (the &ldquo;<strong>Rule 506(d) Effective Date</strong>&rdquo;) and is therefore subject to disclosure-only treatment under Rule 506(e) rather than disqualification under Rule 506(d); (ii) a waiver under Rule 506(d)(2)(ii) may be available; or (iii) the covered person should resign or be removed from the position that makes the covered person a &ldquo;covered person&rdquo; under Rule 506(d).</div>

<div class="signature-block" style="margin-top:2.5rem;">
<div><strong>COVERED PERSON:</strong></div>
<div style="margin-top:1rem;">By: <span class="signature-line"></span></div>
<div>Print Name: ____________________________</div>
<div>Title (if applicable): ____________________________</div>
<div>Date: ____________________________</div>
</div>

<div class="section" style="margin-top:2rem; font-style:italic; font-size:0.85rem;"><strong>Note for Manager / Counsel.</strong> Cross-check answers against FINRA BrokerCheck, SEC litigation releases, EDGAR enforcement records, and publicly available criminal and civil dockets, and retain the completed Questionnaire, supporting documents, and the cross-check evidence in the offering file for at least three (3) years following the close of the offering. A &ldquo;Yes&rdquo; answer in Parts&nbsp;II or III does not automatically disqualify the offering; consult counsel as to whether the event falls within a specified Disqualifying Event, whether the relevant look-back has expired, whether a Rule 506(d)(2)(ii) waiver is or may be available, and whether disclosure-only treatment under Rule 506(e) applies.</div>`;
}

// =============================================================================
// ADDRESS BLOCKS (2026-09-04 audit). Each address is entered as street / suite /
// city / state / ZIP. The legacy single "City, State ZIP" field the document
// builders read is now a hidden input, composed here from the parts, so the
// builders, the saved-draft keys and the review panel are unchanged.
// =============================================================================
function dlComposeAddress(targetId) {
  const hidden = document.getElementById(targetId);
  if (!hidden) return;
  let s2 = '', city = '', st = '', zip = '';
  document.querySelectorAll('[data-dl-addr="' + targetId + '"]').forEach(function (p) {
    const v = (p.value || '').trim();
    if (/_street2$/.test(p.id)) s2 = v; else if (/_city$/.test(p.id)) city = v;
    else if (/_state$/.test(p.id)) st = v; else if (/_zip$/.test(p.id)) zip = v;
  });
  const cityLine = [city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  hidden.value = [s2, cityLine].filter(Boolean).join(', ');
  hidden.dispatchEvent(new Event('input', { bubbles: true }));
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}
function dlRestoreAddressParts(targetId) {
  // A saved draft carries only the composed line; put what can be parsed back
  // into the parts so the visitor is not shown empty boxes over a filled hidden field.
  const hidden = document.getElementById(targetId);
  if (!hidden || !hidden.value) return;
  const parts = {};
  document.querySelectorAll('[data-dl-addr="' + targetId + '"]').forEach(function (p) {
    if (/_street2$/.test(p.id)) parts.s2 = p; else if (/_city$/.test(p.id)) parts.city = p;
    else if (/_state$/.test(p.id)) parts.st = p; else if (/_zip$/.test(p.id)) parts.zip = p;
  });
  if (parts.city && parts.city.value) return; // already populated
  const m = hidden.value.match(/^(?:(.*?),\s*)?([^,]+?),\s*([A-Z]{2})\s*([0-9]{5}(?:-[0-9]{4})?)?\s*$/);
  if (!m) return;
  if (parts.s2 && m[1]) parts.s2.value = m[1];
  if (parts.city) parts.city.value = m[2] || '';
  if (parts.st) parts.st.value = m[3] || '';
  if (parts.zip && m[4]) parts.zip.value = m[4];
}
function dlBindAddressBlocks(root) {
  (root || document).querySelectorAll('[data-dl-addr]').forEach(function (el) {
    const target = el.getAttribute('data-dl-addr');
    ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { dlComposeAddress(target); }); });
  });
  const seen = {};
  (root || document).querySelectorAll('[data-dl-addr]').forEach(function (el) {
    const t = el.getAttribute('data-dl-addr'); if (seen[t]) return; seen[t] = true; dlRestoreAddressParts(t);
  });
}
const DL_STATE_OPTIONS = '<option value="">State</option><option value="AL">AL &mdash; Alabama</option><option value="AK">AK &mdash; Alaska</option><option value="AZ">AZ &mdash; Arizona</option><option value="AR">AR &mdash; Arkansas</option><option value="CA">CA &mdash; California</option><option value="CO">CO &mdash; Colorado</option><option value="CT">CT &mdash; Connecticut</option><option value="DE">DE &mdash; Delaware</option><option value="DC">DC &mdash; District of Columbia</option><option value="FL">FL &mdash; Florida</option><option value="GA">GA &mdash; Georgia</option><option value="HI">HI &mdash; Hawaii</option><option value="ID">ID &mdash; Idaho</option><option value="IL">IL &mdash; Illinois</option><option value="IN">IN &mdash; Indiana</option><option value="IA">IA &mdash; Iowa</option><option value="KS">KS &mdash; Kansas</option><option value="KY">KY &mdash; Kentucky</option><option value="LA">LA &mdash; Louisiana</option><option value="ME">ME &mdash; Maine</option><option value="MD">MD &mdash; Maryland</option><option value="MA">MA &mdash; Massachusetts</option><option value="MI">MI &mdash; Michigan</option><option value="MN">MN &mdash; Minnesota</option><option value="MS">MS &mdash; Mississippi</option><option value="MO">MO &mdash; Missouri</option><option value="MT">MT &mdash; Montana</option><option value="NE">NE &mdash; Nebraska</option><option value="NV">NV &mdash; Nevada</option><option value="NH">NH &mdash; New Hampshire</option><option value="NJ">NJ &mdash; New Jersey</option><option value="NM">NM &mdash; New Mexico</option><option value="NY">NY &mdash; New York</option><option value="NC">NC &mdash; North Carolina</option><option value="ND">ND &mdash; North Dakota</option><option value="OH">OH &mdash; Ohio</option><option value="OK">OK &mdash; Oklahoma</option><option value="OR">OR &mdash; Oregon</option><option value="PA">PA &mdash; Pennsylvania</option><option value="RI">RI &mdash; Rhode Island</option><option value="SC">SC &mdash; South Carolina</option><option value="SD">SD &mdash; South Dakota</option><option value="TN">TN &mdash; Tennessee</option><option value="TX">TX &mdash; Texas</option><option value="UT">UT &mdash; Utah</option><option value="VT">VT &mdash; Vermont</option><option value="VA">VA &mdash; Virginia</option><option value="WA">WA &mdash; Washington</option><option value="WV">WV &mdash; West Virginia</option><option value="WI">WI &mdash; Wisconsin</option><option value="WY">WY &mdash; Wyoming</option><option value="PR">PR &mdash; Puerto Rico</option><option value="VI">VI &mdash; U.S. Virgin Islands</option>';

/**
 * Print a document written into a popup. The site's Content-Security-Policy
 * (script-src 'self' + nonce) also governs the about:blank popup, so any
 * <script> written INTO the popup is blocked -- which is why "Print / Save as
 * PDF" silently did nothing. Everything is wired from this window instead:
 * the toolbar button and the automatic print both call the popup's print().
 */
function dlWirePrintWindow(w) {
  if (!w || !w.document) return;
  const go = function () { try { w.focus(); w.print(); } catch (e) { /* user closed it */ } };
  const btn = w.document.getElementById('dl_print_now');
  if (btn) btn.addEventListener('click', go);
  // Fonts and the stylesheet links need a beat; document.write'd documents are
  // usually 'complete' already, so fall back to a timer.
  if (w.document.readyState === 'complete') { setTimeout(go, 450); }
  else { w.addEventListener('load', function () { setTimeout(go, 300); }); setTimeout(go, 1500); }
}
