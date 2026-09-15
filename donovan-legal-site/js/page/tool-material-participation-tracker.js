/* ---------- Participation taxonomy (§1.469-5T(f)) ---------- */
const CATS=[
 {g:"Operating & management work — counts (§1.469-5T(f)(1))", items:[
   {id:"tenant",t:"Tenant / guest acquisition, screening & relations",counts:true,mgmt:false,inv:false,ex:"Showed unit to two applicants; ran credit and background screening; resolved a tenant maintenance complaint."},
   {id:"leasing",t:"Leasing, booking & reservation management",counts:true,mgmt:false,inv:false,ex:"Reviewed and approved three booking requests; updated availability calendar and nightly pricing."},
   {id:"revenue",t:"Rent / revenue collection & billing",counts:true,mgmt:false,inv:false,ex:"Issued monthly invoices; reconciled rent receipts; followed up on a delinquent balance."},
   {id:"books_op",t:"Operational bookkeeping & bill payment",counts:true,mgmt:false,inv:false,ex:"Paid utility and vendor invoices and ran payroll for on-site help — operating the business, not reviewing results."},
   {id:"repairs_self",t:"Repairs & maintenance — performed personally",counts:true,mgmt:false,inv:false,ex:"Replaced HVAC filter, repaired a faucet leak, and re-keyed the entry lock in Unit 2."},
   {id:"repairs_sup",t:"Repairs & maintenance — arranging & supervising",counts:true,mgmt:true,inv:false,ex:"Met the plumber on site, scoped the repair, and inspected the completed work."},
   {id:"inspect",t:"Property inspection & condition monitoring",counts:true,mgmt:false,inv:false,ex:"Walked the property, photographed condition, and logged deferred-maintenance items."},
   {id:"vendor",t:"Vendor / contractor hiring & supervision",counts:true,mgmt:true,inv:false,ex:"Interviewed two landscapers, selected and onboarded one, and reviewed the service scope."},
   {id:"purchasing",t:"Purchasing supplies, furnishings & equipment",counts:true,mgmt:false,inv:false,ex:"Sourced and purchased a replacement refrigerator; received and installed delivery."},
   {id:"marketing",t:"Marketing & advertising",counts:true,mgmt:false,inv:false,ex:"Wrote and posted the listing, photographed the unit, and answered prospect inquiries."},
   {id:"capital",t:"Capital improvement / renovation oversight",counts:true,mgmt:true,inv:false,ex:"Directed the kitchen remodel, approved change orders, and coordinated the trades on site."},
   {id:"negotiate",t:"Lease / contract negotiation",counts:true,mgmt:false,inv:false,ex:"Negotiated renewal terms and revised and executed the lease addendum."},
   {id:"compliance",t:"Permitting, licensing, insurance & regulatory",counts:true,mgmt:false,inv:false,ex:"Renewed the short-term-rental permit, bound the property insurance, and filed the local registration."},
   {id:"employees",t:"Employee hiring, supervision & firing",counts:true,mgmt:true,inv:false,ex:"Hired the cleaner, set the weekly schedule, supervised the work, and conducted a performance review."},
   {id:"travel",t:"Travel to / from property for participation work",counts:true,mgmt:false,inv:false,ex:"Drove to the property (45 minutes each way) to meet the contractor and inspect the repair."},
 ]},
 {g:"Investor-capacity work — §1.469-5T(f)(2)(ii) (counts ONLY with day-to-day management/operations)", items:[
   {id:"inv_review",t:"Reviewing financial statements / operating reports",counts:false,mgmt:false,inv:true,ex:"Reviewed the monthly P&L and occupancy report. Counts only if I also run day-to-day management/operations of this activity (f)(2)(ii)(B)."},
   {id:"inv_summary",t:"Preparing finance summaries / analyses for own use",counts:false,mgmt:false,inv:true,ex:"Built a cash-flow analysis for my own review. Counts only with a day-to-day management/operations role (f)(2)(ii)(B)."},
   {id:"inv_monitor",t:"Monitoring finances / operations (capacity depends on role)",counts:false,mgmt:false,inv:true,ex:"Monitored operations and bank activity. Non-managerial monitoring is investor work; managerial day-to-day involvement makes it count (f)(2)(ii)(B)."},
 ]},
 {g:"Anti-abuse — does NOT count (§1.469-5T(f)(2)(i))", items:[
   {id:"noncustomary",t:"Work not customarily done by an owner (avoidance purpose)",counts:false,mgmt:false,inv:false,ex:"Performed routine cleaning normally hired out, primarily to accumulate hours. (Not customarily owner work — excluded.)"},
 ]},
];
const CATMAP={}; CATS.forEach(g=>g.items.forEach(c=>CATMAP[c.id]=c));
const RPTB_TYPES=new Set(["Rental","Operation","Management","Leasing","Brokerage","Development","Redevelopment","Construction","Reconstruction","Acquisition","Conversion"]);
const HOLD_LABEL={Direct:"Direct",GP:"General partner",LLC:"LLC member",SCorp:"S-corp",LP:"Limited partner"};
/* How-held is a closed set. Anything restored from localStorage or an imported
   backup that is not one of these is not a holding form — normalise it to the
   select's default rather than letting an arbitrary string reach the state. */
const HOLDS=Object.keys(HOLD_LABEL);
function normHold(v){return HOLDS.includes(v)?v:'Direct';}
/* Ids and the prior-year count are numbers, never text — but JSON.parse hands
   back whatever the storage held, and a.id / a.prior / e.id are the three fields
   that reach HTML unescaped: a.prior as the Test 5 / Test 6 figure, and the two
   ids inside the delActivity()/delEntry() inline-action attributes. Number() is
   the coercion; a value that will not survive it is not an id, so the record
   carrying it is dropped rather than rendered.
   uid() is Date.now()+Math.random(), so a genuine id is always positive. */
function numId(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
/* Prior years of material participation: a count, 0 when absent or unreadable. */
function numPrior(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function sanitizeActivities(list){
  return (Array.isArray(list)?list:[])
    .filter(a=>a&&typeof a==='object'&&numId(a.id)!==null)
    .map(a=>{a.id=numId(a.id);a.prior=numPrior(a.prior);a.hold=normHold(a.hold);return a;});}
function sanitizeEntries(list){
  return (Array.isArray(list)?list:[])
    .filter(e=>e&&typeof e==='object'&&numId(e.id)!==null)
    .map(e=>{e.id=numId(e.id);return e;});}

const KEY="donovan_reps_mp_v3";
let activities=[], entries=[], savedCount=0, lastFileSave=null;

function val(id){return document.getElementById(id).value;}
function chk(id){return document.getElementById(id).checked;}
function esc(s){return (s||"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function nm(p){return p==='taxpayer'?(val('tpName')||'Taxpayer'):p==='spouse'?(val('spName')||'Spouse'):'';}
function settings(){return {tpName:val('tpName'),spName:val('spName'),year:val('year')};}
function uid(){return Date.now()+Math.random();}
function load(){try{const r=localStorage.getItem(KEY);if(r){const d=JSON.parse(r);activities=sanitizeActivities(d.activities);entries=sanitizeEntries(d.entries);savedCount=d.savedCount||0;lastFileSave=d.lastFileSave||null;
  if(d.settings)Object.keys(d.settings).forEach(k=>{if(document.getElementById(k))document.getElementById(k).value=d.settings[k];});}}catch(e){}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({activities,entries,settings:settings(),savedCount,lastFileSave}));}catch(e){}scheduleFileSync();}

function buildCatSelect(){
  const s=document.getElementById('eCat');s.innerHTML='';
  CATS.forEach(g=>{const og=document.createElement('optgroup');og.label=g.g;
    g.items.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.t;og.appendChild(o);});s.appendChild(og);});
  onCatChange();
}
function onCatChange(){
  const c=CATMAP[val('eCat')];const h=document.getElementById('catHelper');const dd=document.getElementById('ddWrap');
  if(!c){h.textContent='';return;}
  if(c.inv){
    dd.style.display='block'; h.className='helper invwarn';
    h.innerHTML=`<b>Investor-capacity work — not automatically excluded.</b> Under §1.469-5T(f)(2)(ii)(B) it counts when you are directly involved in the day-to-day management or operations of the activity. Set the determination below.<br><span class="ex">Example: ${esc(c.ex)}</span>`;
  } else {
    dd.style.display='none'; h.className='helper';
    const tag=c.counts?'<b>Counts as participation.</b>':'<b style="color:var(--fail)">Does not count (anti-abuse).</b>';
    const mg=c.mgmt?' <span class="pill mgmt">management</span>':'';
    h.innerHTML=`${tag}${mg}<br><span class="ex">Example: ${esc(c.ex)}</span>`;
  }
}
function onPersonChange(){const o=val('ePerson')==='other';document.getElementById('otherWrap').style.display=o?'block':'none';document.getElementById('compWrap').style.display=o?'block':'none';}
function toggleGP(){document.getElementById('gpWrap').style.display=val('naHold')==='LP'?'flex':'none';}

/* ---------- Activities ---------- */
function activitySelect(){const s=document.getElementById('eActivity');const cur=s.value;s.innerHTML='';
  if(!activities.length){const o=document.createElement('option');o.value='';o.textContent='— add an activity first —';s.appendChild(o);return;}
  activities.forEach(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.name+' ('+a.type+')';s.appendChild(o);});
  if(cur)s.value=cur;}
function addActivity(){const n=val('naName').trim();if(!n){alert("Name the activity.");return;}
  activities.push({id:uid(),name:n,type:val('naType'),hold:val('naHold'),gp:val('naHold')==='LP'?chk('naGP'):false,psa:chk('naPSA'),prior:parseInt(val('naPrior')||'0',10)});
  document.getElementById('naName').value='';document.getElementById('naPrior').value='0';document.getElementById('naGP').checked=false;document.getElementById('naPSA').checked=false;
  render();persist();}
function delActivity(id){if(entries.some(e=>e.act==id)){if(!confirm("This activity has logged time. Delete it and its entries?"))return;entries=entries.filter(e=>e.act!=id);}activities=activities.filter(a=>a.id!=id);render();persist();}
function lpRestricted(a){return a.hold==='LP' && !a.gp;}
function renderActivities(){const w=document.getElementById('actList');
  w.innerHTML=activities.length?activities.map(a=>`<div class="miniact"><span class="an">${esc(a.name)}</span>
    <span class="pill ${RPTB_TYPES.has(a.type)?'rptb':'nonre'}">${esc(a.type)}</span>
    <span class="pill ${lpRestricted(a)?'lp':'hold'}">${esc(HOLD_LABEL[a.hold]||a.hold)}${a.hold==='LP'&&a.gp?' + GP':''}</span>
    ${a.psa?'<span class="pill hold">PSA</span>':''}
    <span style="font-size:11.5px;color:var(--mute)">prior MP: ${numPrior(a.prior)}/10</span>
    <button class="btn btn-ghost btn-sm no-print" style="margin-left:auto" data-dvn-on="click" data-dvn-do="delActivity(${numId(a.id)})">Remove</button></div>`).join('')
    :'<p style="color:var(--mute);font-size:13px;margin:4px 0">No activities yet — add one below.</p>';}

/* ---------- Entries ---------- */
function addEntry(){
  if(!activities.length){alert("Add an activity first.");return;}
  const h=parseFloat(val('eHours'));if(!h||h<=0){alert("Enter hours greater than zero.");return;}
  const desc=val('eDesc').trim();if(desc.length<8){alert("A specific description is required on every entry — it is the record that wins the issue.");document.getElementById('eDesc').focus();return;}
  const person=val('ePerson');const c=CATMAP[val('eCat')];
  const dd=c.inv?(val('eDD')==='1'):false;
  const counts=c.inv?dd:c.counts;            // investor work counts only with day-to-day mgmt/ops (f)(2)(ii)(B)
  entries.push({id:uid(),date:val('eDate')||new Date().toISOString().slice(0,10),person,
    other:person==='other'?(val('eOther')||'Other'):'',comp:person==='other'&&val('eComp')==='1',
    act:val('eActivity'),cat:c.id,inv:c.inv,dd,counts,mgmt:c.mgmt,hours:h,desc});
  document.getElementById('eHours').value='';document.getElementById('eDesc').value='';document.getElementById('eOther').value='';
  render();persist();}
function delEntry(id){entries=entries.filter(e=>e.id!=id);render();persist();}
function clearAll(){if(confirm("Delete all activities and entries? Export a backup first.")){activities=[];entries=[];render();persist();}}
function chip(el,st,tx){el.className='chip '+st;el.innerHTML='<span class="dot"></span>'+tx;}

/* ---------- Per-activity material participation ---------- */
function scoreActivity(a){
  const es=entries.filter(e=>e.act==a.id);
  let combined=0,combinedMgmt=0;const others={},othersMgmt={};let anyCompMgr=false;
  for(const e of es){ if(!e.counts)continue;
    if(e.person==='other'){const k=e.other||'Other';others[k]=(others[k]||0)+e.hours; if(e.mgmt){othersMgmt[k]=(othersMgmt[k]||0)+e.hours; if(e.comp)anyCompMgr=true;}}
    else{combined+=e.hours; if(e.mgmt)combinedMgmt+=e.hours;}}
  const oVals=Object.values(others),oMax=oVals.length?Math.max(...oVals):0,oTot=oVals.reduce((s,v)=>s+v,0);
  const oMgmtMax=Object.values(othersMgmt).length?Math.max(...Object.values(othersMgmt)):0;
  const all=combined+oTot;
  const lp=lpRestricted(a);
  const t1=combined>500;
  const t2=!lp && combined>0 && (oTot===0||combined/all>=0.95);
  const t3=!lp && combined>100 && combined>=oMax;
  const t5=a.prior>=5;
  const t6=a.psa && a.prior>=3;
  const fcExcludeMgmt=anyCompMgr||(oMgmtMax>combinedMgmt);
  const fcHours=fcExcludeMgmt?(combined-combinedMgmt):combined;
  const t7avail=!lp && fcHours>100;
  const definitively=t1||t2||t3||t5||t6;        // t4 resolved globally
  return {combined,oMax,oTot,all,combinedMgmt,oMgmtMax,anyCompMgr,t1,t2,t3,t5,t6,t7avail,fcHours,fcExcludeMgmt,lp,definitively,
          topOther:Object.entries(others).sort((x,y)=>y[1]-x[1])[0]};
}
function renderMP(){
  const zone=document.getElementById('mpZone');
  if(!activities.length){zone.innerHTML='<p style="color:var(--mute);font-size:13.5px">Add an activity and log hours — each activity is scored across all seven tests here.</p>';return;}
  const scores={};activities.forEach(a=>scores[a.id]=scoreActivity(a));
  let spaTotal=0;const spaSet=new Set();
  activities.forEach(a=>{const s=scores[a.id]; if(!s.lp && s.combined>100 && !s.definitively){spaSet.add(a.id);spaTotal+=s.combined;}});
  const t4met=spaTotal>500;
  zone.innerHTML=activities.map(a=>{
    const s=scores[a.id];const t4=t4met&&spaSet.has(a.id);const met=s.definitively||t4;
    const na='n/a · limited partner';
    const cells=[
      {k:"Test 1 · >500 hrs",v:s.combined.toFixed(0)+" hrs",n:s.t1?"✓ clears":"need "+Math.max(0,500-s.combined).toFixed(0)+" more",on:s.t1},
      s.lp?{k:"Test 2 · substantially all",v:"—",n:na,na:true}:{k:"Test 2 · substantially all",v:(s.all>0?Math.round(s.combined/s.all*100):0)+"%",n:s.t2?"✓ ~all participation":"others participate too",on:s.t2},
      s.lp?{k:"Test 3 · >100 & not less",v:"—",n:na,na:true}:{k:"Test 3 · >100 & not less",v:s.combined.toFixed(0)+" vs "+s.oMax.toFixed(0),n:s.t3?"✓ clears":(s.combined<=100?"need >100 hrs":"an other logs more"+(s.topOther?" ("+esc(s.topOther[0])+")":"")),on:s.t3},
      s.lp?{k:"Test 4 · SPA aggregation",v:"—",n:na,na:true}:{k:"Test 4 · SPA aggregation",v:t4met?spaTotal.toFixed(0)+" hrs":"—",n:t4?"✓ via >500 across SPAs":(spaSet.has(a.id)?"SPA; portfolio ≤500":"n/a"),on:t4},
      {k:"Test 5 · 5 of 10 yrs",v:numPrior(a.prior)+"/10",n:s.t5?"✓ clears on history":"incl. pass-through yrs (h)(3)",on:s.t5},
      {k:"Test 6 · PSA · 3 yrs",v:a.psa?(numPrior(a.prior)+"/3+"):"—",n:a.psa?(s.t6?"✓ clears":"need 3 prior yrs"):"not a personal-service activity",on:s.t6},
      s.lp?{k:"Test 7 · facts & circ.",v:"—",n:na,na:true}:{k:"Test 7 · facts & circ.",v:s.fcHours.toFixed(0)+" hrs",n:s.t7avail?("supportable"+(s.fcExcludeMgmt?" — mgmt excluded (b)(2)":"")):"need >100 eligible hrs",fc:s.t7avail},
    ];
    return `<div class="actcard">
      <div class="acthead">
        <div><span class="actname">${esc(a.name)}</span> <span class="pill ${RPTB_TYPES.has(a.type)?'rptb':'nonre'}">${esc(a.type)}</span> <span class="pill ${s.lp?'lp':'hold'}">${esc(HOLD_LABEL[a.hold]||a.hold)}${a.hold==='LP'&&a.gp?' + GP':''}</span></div>
        <span class="chip ${met?'pass':(s.combined>0?'warn':'fail')}"><span class="dot"></span>${met?'Materially participates':(s.combined>0?'Not yet established':'No counted hours')}</span>
      </div>
      ${s.lp?'<div class="lpbanner">Limited-partner interest — material participation available only under Tests 1, 5, or 6 (§1.469-5T(e)). Tests 2, 3, 4, 7 disregarded.</div>':''}
      <div class="tests">
        ${cells.map(c=>`<div class="tcell ${c.on?'met':''} ${c.fc?'fc':''} ${c.na?'na':''}"><div class="tk">${c.k}</div><div class="tv">${c.v}</div><div class="tn">${c.n}</div></div>`).join('')}
      </div>
    </div>`;
  }).join('')+`<div class="note"><b>Investor-capacity hours</b> are included above only where you marked direct day-to-day management/operations involvement (§1.469-5T(f)(2)(ii)(B)). <b>Test 3</b> is defeated by any other individual whose hours exceed yours; <b>Test 7</b> is facts-and-circumstances, never auto-green, with management hours stripped under (b)(2) when a paid manager exists or another individual out-manages you.</div>`;
}

/* ---------- REP gate ---------- */
function spouseAloneMP(a,who){
  if(lpRestricted(a)){ // LP: only tests 1,5,6 for that spouse alone
    let self=0;entries.forEach(e=>{if(e.act==a.id&&e.person===who&&e.counts)self+=e.hours;});
    return self>500||a.prior>=5||(a.psa&&a.prior>=3);
  }
  const es=entries.filter(e=>e.act==a.id&&e.counts);let self=0;const others={};
  for(const e of es){ if(e.person===who)self+=e.hours; else{const k=e.person==='other'?(e.other||'Other'):nm(e.person);others[k]=(others[k]||0)+e.hours;} }
  const oMax=Object.values(others).length?Math.max(...Object.values(others)):0;
  const oTot=Object.values(others).reduce((s,v)=>s+v,0);
  return self>500||(self>100&&self>=oMax)||a.prior>=5||(a.psa&&a.prior>=3)||(oTot===0&&self>0);
}
function renderREP(){
  const who=val('repWho');let qual=0,allRptb=0,totalTB=0;
  for(const a of activities){const isR=RPTB_TYPES.has(a.type);let h=0;entries.forEach(e=>{if(e.act==a.id&&e.person===who&&e.counts)h+=e.hours;});
    if(isR){allRptb+=h;totalTB+=h;if(spouseAloneMP(a,who))qual+=h;} else {totalTB+=h;}}
  const rptb=qual;
  const f7=document.getElementById('fill750');f7.style.width=Math.min(100,rptb/750*100)+'%';f7.style.background=rptb>750?'var(--emerald)':'var(--gold-lt)';
  document.getElementById('num750').textContent=rptb.toFixed(0);
  chip(document.getElementById('chip750'),rptb>750?'pass':'fail',rptb.toFixed(0)+' hrs'+(allRptb>rptb?' ('+(allRptb-rptb).toFixed(0)+' in non-MP RPTBs excluded)':'')+(rptb>750?' · clears':''));
  const pct=totalTB>0?rptb/totalTB*100:0;
  const f5=document.getElementById('fill50');f5.style.width=Math.min(100,pct)+'%';f5.style.background=pct>50?'var(--emerald)':'var(--gold-lt)';
  document.getElementById('num50').textContent=(totalTB>0?pct.toFixed(0):'0')+'%';
  chip(document.getElementById('chip50'),pct>50?'pass':'fail',(totalTB>0?pct.toFixed(0):0)+'% of working time');
  const ok=rptb>750&&pct>50;const v=document.getElementById('repVerdict');v.className='verdict '+(ok?'qual':'no');
  document.getElementById('repVLabel').textContent=ok?(nm(who)+' qualifies as a REP for this year'):'Not yet a REP';
  chip(document.getElementById('repChip'),ok?'pass':'fail',ok?'Per se passive rule switched off':'Both prongs required');
}

/* ---------- Log table ---------- */
function actName(id){const a=activities.find(x=>x.id==id);return a?a.name:'(deleted)';}
function catPills(e){let p=e.counts?'<span class="pill counts">counts</span>':(e.inv?'<span class="pill inv">investor · excluded</span>':'<span class="pill excl">excluded</span>');
  if(e.inv&&e.dd)p='<span class="pill counts">counts · (f)(2)(ii)(B)</span>'; if(e.mgmt)p+=' <span class="pill mgmt">mgmt</span>';return p;}
function renderLog(){const b=document.getElementById('logBody');const s=[...entries].sort((a,b)=>a.date<b.date?-1:1);
  b.innerHTML=s.length?s.map(e=>`<tr><td>${esc(e.date)}</td><td>${e.person==='other'?esc(e.other):esc(nm(e.person))}${e.person==='other'&&e.comp?' <span class="pill mgmt">paid</span>':''}</td>
    <td>${esc(actName(e.act))}</td><td>${esc(CATMAP[e.cat]?CATMAP[e.cat].t:e.cat)}<br>${catPills(e)}</td>
    <td class="num">${e.hours.toFixed(2)}</td><td style="max-width:330px">${esc(e.desc)}</td>
    <td class="no-print"><button class="del" data-dvn-on="click" data-dvn-do="delEntry(${numId(e.id)})">×</button></td></tr>`).join('')
    :`<tr><td colspan="7" style="color:var(--mute);text-align:center;padding:20px">No entries yet.</td></tr>`;}

function render(){activitySelect();renderActivities();renderMP();renderREP();renderLog();updateDurBar();buildTurnover();}

/* ---------- Export ---------- */
function exportCSV(){const rows=[["Date","Who","Compensated","Activity","RPTB type","How held","Category","Investor (f)(2)(ii)","Day-to-day mgmt (B)","Counts","Management","Hours","Description"]];
  [...entries].sort((a,b)=>a.date<b.date?-1:1).forEach(e=>{const a=activities.find(x=>x.id==e.act)||{};
    rows.push([e.date,e.person==='other'?e.other:nm(e.person),e.comp?"Yes":"",a.name||'',a.type||'',HOLD_LABEL[a.hold]||a.hold||'',CATMAP[e.cat]?CATMAP[e.cat].t:e.cat,e.inv?"Yes":"No",e.inv?(e.dd?"Yes":"No"):"",e.counts?"Yes":"No",e.mgmt?"Yes":"No",e.hours,e.desc]);});
  const csv=rows.map(r=>r.map(c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`).join(",")).join("\n");
  dl(new Blob([csv],{type:"text/csv"}),`REPS-MP-log-${val('year')||'record'}.csv`);}
function exportJSON(){dl(new Blob([JSON.stringify({activities,entries,settings:settings()},null,2)],{type:"application/json"}),`REPS-MP-backup-${val('year')||'record'}.json`);savedCount=entries.length;lastFileSave=Date.now();persist();updateDurBar();}
function importJSON(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);activities=sanitizeActivities(d.activities);entries=sanitizeEntries(d.entries);if(d.settings)Object.keys(d.settings).forEach(k=>{if(document.getElementById(k))document.getElementById(k).value=d.settings[k];});render();persist();}catch(e){alert("Could not read that file.");}};r.readAsText(f);ev.target.value='';}
function dl(blob,fn){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u);}

/* ---------- Durability: backup discipline + File System Access auto-save ---------- */
const FS_OK=(typeof window!=='undefined')&&('showSaveFilePicker' in window);
let fileHandle=null, pendingHandle=null, syncTimer=null;
function fmtDate(ts){if(!ts)return null;const d=new Date(ts);return d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('donovan_fs',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function idbSet(k,v){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});}catch(e){}}
async function idbGet(k){try{const db=await idb();return await new Promise((res,rej)=>{const t=db.transaction('kv','readonly');const q=t.objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}catch(e){return null;}}
async function idbDel(k){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=res;t.onerror=()=>rej(t.error);});}catch(e){}}
async function verifyPerm(h){const o={mode:'readwrite'};try{if((await h.queryPermission(o))==='granted')return true;if((await h.requestPermission(o))==='granted')return true;}catch(e){}return false;}
async function writeHandle(){if(!fileHandle)return false;try{const w=await fileHandle.createWritable();await w.write(JSON.stringify({activities,entries,settings:settings()},null,2));await w.close();return true;}catch(e){return false;}}
async function linkFile(){if(!FS_OK)return;try{const h=await window.showSaveFilePicker({suggestedName:`REPS-MP-${val('year')||'log'}.json`,types:[{description:'JSON',accept:{'application/json':['.json']}}]});fileHandle=h;pendingHandle=null;await idbSet('handle',h);if(await writeHandle()){savedCount=entries.length;lastFileSave=Date.now();persist();}updateDurBar();}catch(e){}}
async function resumeFile(){if(!pendingHandle)return;if(await verifyPerm(pendingHandle)){fileHandle=pendingHandle;pendingHandle=null;if(await writeHandle()){savedCount=entries.length;lastFileSave=Date.now();persist();}updateDurBar();}}
function unlinkFile(){fileHandle=null;idbDel('handle');updateDurBar();}
async function initFS(){if(!FS_OK){updateDurBar();return;}const h=await idbGet('handle');if(h){try{if((await h.queryPermission({mode:'readwrite'}))==='granted')fileHandle=h;else pendingHandle=h;}catch(e){}}updateDurBar();}
function scheduleFileSync(){if(!fileHandle)return;clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{if(await writeHandle()){savedCount=entries.length;lastFileSave=Date.now();try{localStorage.setItem(KEY,JSON.stringify({activities,entries,settings:settings(),savedCount,lastFileSave}));}catch(e){}updateDurBar();}},800);}
function updateDurBar(){
  const bar=document.getElementById('durBar');if(!bar)return;
  const pending=Math.max(0,entries.length-savedCount);let cls='dur-bar no-print',stat='',actions='';
  if(fileHandle){cls+=' ok';
    stat=`<span class="dok">Auto-saving to your file.</span> Every entry is written to <b>${esc(fileHandle.name||'your file')}</b>${lastFileSave?' · last write '+fmtDate(lastFileSave):''}. That file is your record of truth.`;
    actions=`<button class="btn btn-ghost btn-sm" data-dvn-on="click" data-dvn-do="unlinkFile()">Stop auto-save</button>`;
  }else if(pendingHandle){cls+=' alert';
    stat=`Auto-save file <b>${esc(pendingHandle.name||'')}</b> needs permission to resume after reload.`;
    actions=`<button class="btn btn-primary btn-sm" data-dvn-on="click" data-dvn-do="resumeFile()">Resume auto-save</button>`;
  }else{const never=!lastFileSave;cls+=(never||pending>0)?' alert':'';
    if(never)stat=`<span class="dwarn">Your log lives only in this browser.</span> Clearing browsing data, switching devices, or — on iPhone/Safari — a week away can erase it. Download a backup file to keep the record safe.`;
    else stat=`Last backup file: <b>${fmtDate(lastFileSave)}</b>${pending>0?` · <span class="dwarn">${pending} entr${pending===1?'y':'ies'} added since</span>`:` · <span class="dok">up to date</span>`}.`;
    actions=`<button class="btn btn-primary btn-sm" data-dvn-on="click" data-dvn-do="exportJSON()">Download backup</button>`+(FS_OK?` <button class="btn btn-ghost btn-sm" data-dvn-on="click" data-dvn-do="linkFile()">Auto-save to a file…</button>`:'');
  }
  bar.className=cls;bar.innerHTML=`<div class="dstat">${stat}</div><div class="dactions">${actions}</div>`;
}

/* ---------- Certified turnover record (print) ---------- */
function governingTest(s,t4){if(s.t1)return"Test 1 — more than 500 hours";if(s.t2)return"Test 2 — substantially all participation";if(s.t3)return"Test 3 — more than 100 hours and not less than any other";if(t4)return"Test 4 — significant-participation aggregation";if(s.t5)return"Test 5 — 5 of the prior 10 years";if(s.t6)return"Test 6 — personal-service activity, 3 prior years";if(s.t7avail)return"Test 7 — facts and circumstances (supportable; confirm with firm)";return"Not yet established";}
function buildTurnover(){
  const el=document.getElementById('turnover');if(!el)return;
  if(!activities.length){el.innerHTML='';return;}
  const scores={};activities.forEach(a=>scores[a.id]=scoreActivity(a));
  let spaTotal=0;const spaSet=new Set();activities.forEach(a=>{const s=scores[a.id];if(!s.lp&&s.combined>100&&!s.definitively){spaSet.add(a.id);spaTotal+=s.combined;}});const t4met=spaTotal>500;
  const spouseHours=entries.some(e=>e.person==='spouse'&&e.counts);
  const rows=activities.map(a=>{const s=scores[a.id];const t4=t4met&&spaSet.has(a.id);const met=s.definitively||t4;
    return `<tr><td>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${esc(HOLD_LABEL[a.hold]||a.hold)}${a.hold==='LP'&&a.gp?' + GP':''}</td><td class="num">${s.combined.toFixed(1)}</td><td>${met?governingTest(s,t4):'<i>Not yet established</i>'}</td></tr>`;}).join('');
  const yr=esc(val('year')||''),tp=esc(nm('taxpayer')),sp=esc(nm('spouse'));
  el.innerHTML=`<div class="to-title">Material Participation Record — ${yr}</div>
    <div class="to-meta">Taxpayer: ${tp}${spouseHours?' · Spouse: '+sp:''} · Prepared ${new Date().toLocaleDateString()} · IRC §469 / Treas. Reg. §1.469-5T</div>
    <table><thead><tr><th>Activity</th><th>RPTB type</th><th>How held</th><th class="num">Counted hrs</th><th>Material participation</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="cert">I certify that the foregoing and the attached time log constitute a true and contemporaneous record of the time I${spouseHours?' and my spouse':''} spent participating in the activities listed during the ${yr} tax year, recorded at or near the time the work was performed and maintained in the ordinary course. Investor-capacity time is included only where I was directly involved in the day-to-day management or operations of the activity (Treas. Reg. §1.469-5T(f)(2)(ii)(B)). Submitted to Donovan Legal PLLC for use in preparing and, if necessary, defending the §469 position.
      <div class="sig"><div class="sigline">${tp} — signature &amp; date</div>${spouseHours?'<div class="sigline">'+sp+' — signature &amp; date</div>':''}</div></div>`;
}

["tpName","spName","year"].forEach(id=>document.getElementById(id).addEventListener('input',()=>{render();persist();}));
document.getElementById('eDate').value=new Date().toISOString().slice(0,10);
buildCatSelect();load();render();initFS();
