// Engagement Scoping Tool — extracted verbatim from engagement-scoping/index.html.
//
// Previously an inline <script type="text/babel"> compiled in the browser by
// babel-standalone. That could never run under this site CSP: babel-standalone
// appends its compiled output as a NEW inline <script>, and that injected element
// carries no nonce, so script-src blocked it and #root stayed empty.
//
// The app logic below is unchanged. Only the two module imports are new: React and
// ReactDOM were previously window globals from a CDN <script>; they are now bundled
// from npm by esbuild (npm run build:es-js) so the page loads no third-party origin.
import React from 'react';
import * as ReactDOM from 'react-dom/client';
const { useState, useMemo, useEffect } = React;

// ============== CONFIG (edit before deploy) ==============
const FIRM_EMAIL = "info@donovan.law";
const FIRM_PHONE = "(561)666-6022";         // ← Update before deploy

// ============== ICONS (inline SVG) ==============
const Svg = ({ children, w = 16, sw = 2 }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Check = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12" /></Svg>;
const Calculator = (p) => <Svg {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="12" y1="10" x2="14" y2="10" /><line x1="16" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="12" y1="14" x2="14" y2="14" /><line x1="16" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="10" y2="18" /><line x1="12" y1="18" x2="14" y2="18" /><line x1="16" y1="18" x2="16" y2="18" /></Svg>;
const FileText = (p) => <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></Svg>;
const Building = (p) => <Svg {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></Svg>;
const Home = (p) => <Svg {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Svg>;
const Send = (p) => <Svg {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Svg>;
const AlertCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Svg>;
const Sparkles = (p) => <Svg {...p}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></Svg>;
const ScrollText = (p) => <Svg {...p}><path d="M15 12h-5" /><path d="M15 8h-5" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /></Svg>;
const ArrowDown = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></Svg>;
const Mail = (p) => <Svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></Svg>;
const Download = (p) => <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Svg>;

// ============== DATA ==============
const BUNDLES = {
  acquisition: { name: "Acquisition Lifecycle Bundle", tier: "Gold", type: "project", base: 22750, tagline: "For non-STR property acquisitions", components: ["§1.1 Pre-Acquisition Consultation", "§1.2 Entity Formation", "§1.4 Closing T1", "§1.7 Cost Seg Coord.", "§8.A.1 Property Sourcing", "§8.A.2 Broker", "§8.A.3 Lender", "§8.A.4 Contractor", "§8.B.1 Property Model"], icon: Building },
  ownership: { name: "Ownership Lifecycle Bundle", tier: "Platinum", type: "annual", base: 24000, tagline: "Annual integrated retainer for ongoing ownership", components: ["§2.1 Annual Strategy", "§2.4 Entity Maintenance", "§5.1 Form 1040", "§5.2 Form 1065 (if partnership)", "§8.A.5 Analyzer Access", "Quarterly Check-ins", "Priority Access"], icon: Home },
  disposition: { name: "Disposition Lifecycle Bundle", tier: "Gold", type: "project", base: 8750, tagline: "For property dispositions (STR or non-STR)", components: ["§3.1 Pre-Disposition Strategy", "§3.2 Sale Closing T1", "§8.A.2 Listing Broker"], icon: ScrollText },
  strGold: { name: "Gold STR — Acquisition & Setup", tier: "Gold", type: "project", base: 25250, tagline: "Project-scoped STR acquisition + setup", components: ["§1.1 Pre-Acq Consult.", "§1.2 Entity", "§1.4 Closing", "§1.7 Cost Seg", "§2.3 STR Strategy", "§8.A.1-4 Deal Advisory", "§8.B.1 Property Model"], icon: Sparkles },
  strPlatinum: { name: "Platinum STR — Annual Integrated", tier: "Platinum", type: "annual", base: 29000, tagline: "Annual STR retainer with STR-specific intensity", components: ["§2.1 Annual Strategy", "§2.3 STR Refresh", "§2.4 Entity Maintenance", "§5.1 Form 1040", "§5.2 Form 1065", "Unlimited Analyzer", "Quarterly Check-ins", "Mat. Participation Review"], icon: Sparkles },
};

const MODIFIERS = {
  "M-V": { name: "Property Value", description: "Drives transactional component pricing", type: "single", appliesTo: ["acquisition", "disposition", "strGold"], options: [
    { code: "M-V1", label: "Under $2M", sub: "Default — Tier 1", impact: 0 },
    { code: "M-V2", label: "$2M to $10M", sub: "Tier 2", impact: { acquisition: 2250, disposition: 2250, strGold: 2250 } },
    { code: "M-V3", label: "Over $10M", sub: "Tier 3 — scoped at engagement", impact: "scoped" },
  ]},
  "M-P": { name: "Portfolio Size", description: "Drives entity structure and ongoing scope", type: "single", appliesTo: ["acquisition", "ownership", "strGold", "strPlatinum"], options: [
    { code: "M-P1", label: "Single property", sub: "Default", impact: 0 },
    { code: "M-P2", label: "Adding to portfolio (2–5 properties)", sub: "§1.5 two-tier or scope expansion", impact: { acquisition: 4750, ownership: 6000, strGold: 4750, strPlatinum: 6000 } },
    { code: "M-P3", label: "Series LLC / 6+ properties", sub: "Reserve-tier promotion recommended", impact: { acquisition: 6500, ownership: "Reserve", strGold: 6500, strPlatinum: "Reserve" } },
  ]},
  "M-E": { name: "Exit Strategy", description: "Pre-positioning or executing exit strategy", type: "single", appliesTo: ["acquisition", "ownership", "disposition", "strGold", "strPlatinum"], options: [
    { code: "M-E1", label: "Outright sale / no specific exit", sub: "Default", impact: 0 },
    { code: "M-E2", label: "§1031 exchange", sub: "Acquisition or disposition side", impact: { acquisition: 2500, disposition: 2500, strGold: 2500 } },
    { code: "M-E3", label: "Installment sale", sub: "Disposition-side only", impact: { disposition: 2000 } },
    { code: "M-E4", label: "Opportunity Zone reinvestment", sub: "Reserve-tier promotion required", impact: "Reserve" },
    { code: "M-E5", label: "Multi-strategy comparison modeling", sub: "§8.B.6 modeling engagement", impact: { acquisition: 4000, disposition: 4000, ownership: 4000, strGold: 4000, strPlatinum: 4000 } },
  ]},
  "M-CB": { name: "Cross-Border Posture", description: "Foreign investor or multi-tier offshore", type: "single", appliesTo: ["acquisition", "ownership", "disposition", "strGold", "strPlatinum"], options: [
    { code: "M-CB1", label: "Domestic", sub: "U.S.-resident, U.S. property — Default", impact: 0 },
    { code: "M-CB2", label: "Foreign investor / foreign seller", sub: "§4.1 inbound or §4.2 FIRPTA", impact: { acquisition: 5000, disposition: 3500, ownership: "scoped", strGold: 5000, strPlatinum: "scoped" } },
    { code: "M-CB3", label: "Multi-tier offshore structure", sub: "Reserve-tier required", impact: "Reserve" },
  ]},
  "M-SC": { name: "Structural Complexity", description: "Multi-select — flat additive modifiers ($2,500 each; SC5 is $3,500/yr)", type: "multi", appliesTo: ["acquisition", "ownership", "disposition", "strGold", "strPlatinum"], options: [
    { code: "M-SC1", label: "Construction-management overlay", sub: "CCM credential work", impact: 2500 },
    { code: "M-SC2", label: "Multi-parcel acquisition / disposition", sub: "Multiple parcels under one PSA", impact: 2500 },
    { code: "M-SC3", label: "Mixed-use property", sub: "Commercial + residential mix", impact: 2500 },
    { code: "M-SC4", label: "Condominium master-deed work", sub: "HOA / master-deed amendments", impact: 2500 },
    { code: "M-SC5", label: "REPS election active (Ownership only)", sub: "Ongoing material-participation discipline", impact: { ownership: 3500, strPlatinum: 3500 } },
  ]},
};

// ============== HELPERS ==============
function getModifierImpact(option, bundleKey) {
  if (typeof option.impact === "number") return option.impact;
  if (option.impact === "scoped" || option.impact === "Reserve") return option.impact;
  if (typeof option.impact === "object") return option.impact[bundleKey] ?? 0;
  return 0;
}

function calculateFee(bundleKey, singleSelections, multiSelections) {
  if (!bundleKey) return { total: 0, breakdown: [], status: "no-bundle" };
  const bundle = BUNDLES[bundleKey];
  let total = bundle.base, scoped = false, reserveRequired = false;
  const breakdown = [{ label: bundle.name + " (base)", amount: bundle.base }];
  Object.entries(singleSelections).forEach(([catKey, optCode]) => {
    const cat = MODIFIERS[catKey];
    if (!cat || !cat.appliesTo.includes(bundleKey)) return;
    const opt = cat.options.find(o => o.code === optCode);
    if (!opt) return;
    const impact = getModifierImpact(opt, bundleKey);
    if (impact === "scoped") { scoped = true; breakdown.push({ label: opt.code + " " + opt.label, amount: "scoped at engagement" }); }
    else if (impact === "Reserve") { reserveRequired = true; breakdown.push({ label: opt.code + " " + opt.label, amount: "Reserve-tier required" }); }
    else if (impact > 0) { total += impact; breakdown.push({ label: opt.code + " " + opt.label, amount: impact }); }
  });
  multiSelections.forEach(optCode => {
    const cat = MODIFIERS["M-SC"];
    const opt = cat.options.find(o => o.code === optCode);
    if (!opt) return;
    const impact = getModifierImpact(opt, bundleKey);
    if (typeof impact === "number" && impact > 0) { total += impact; breakdown.push({ label: opt.code + " " + opt.label, amount: impact }); }
  });
  const status = reserveRequired ? "reserve-required" : scoped ? "partially-scoped" : "complete";
  return { total, breakdown, status, bundle };
}

function computeSteering(bundleKey, singleSelections, multiSelections, clientInfo) {
  const messages = [];
  const fee = calculateFee(bundleKey, singleSelections, multiSelections);
  if (fee.status === "reserve-required") messages.push({ kind: "promotion", text: "Your selections include a modifier that requires Reserve-tier engagement. The partner will discuss the Reserve promotion with you before drafting the engagement letter." });
  if (bundleKey === "disposition" && singleSelections["M-P"] && singleSelections["M-P"] !== "M-P1") messages.push({ kind: "note", text: "Note: each disposition is its own engagement. If you are disposing of multiple properties, contact the firm to scope a multi-disposition arrangement." });
  if (singleSelections["M-E"] === "M-E2" && (bundleKey === "acquisition" || bundleKey === "disposition")) { const other = bundleKey === "acquisition" ? "Disposition" : "Acquisition"; messages.push({ kind: "credit", text: `§1031 exchange selected. If you also engage the ${other} Lifecycle Bundle for the other side of this same exchange, a $1,000 cross-bundle credit applies on the second engagement letter.` }); }
  if (bundleKey === "acquisition" && !singleSelections["M-P"]) messages.push({ kind: "tip", text: "Tip: most clients add Platinum Ownership Bundle within 12 months of acquisition for ongoing tax strategy and compliance. Discuss at the engagement-letter stage." });
  if (clientInfo.propertyState && clientInfo.propertyState !== "FL" && clientInfo.propertyState !== "MA" && (bundleKey === "acquisition" || bundleKey === "disposition" || bundleKey === "strGold")) messages.push({ kind: "info", text: `Property in ${clientInfo.propertyState}. The firm will retain outside counsel for the state-specific closing work as a firm expense — outside counsel cost is included in the bundle fee, not a separate charge.` });
  return messages;
}

function buildLetterBlocks(bundleKey, singleSelections, multiSelections, clientInfo) {
  if (!bundleKey) return [];
  const bundle = BUNDLES[bundleKey];
  const fee = calculateFee(bundleKey, singleSelections, multiSelections);
  const blocks = [];
  blocks.push({ key: "opening", type: "universal", title: "Engagement Confirmation", body: `This letter confirms the engagement of Donovan Legal PLLC (the "firm") by ${clientInfo.clientName || "[Client Name]"} (the "client") for the legal and tax services described below. Paul K. Donovan will serve as the responsible partner.` });
  blocks.push({ key: "scope", type: "universal", title: "Scope of Services", body: `The firm is engaged to provide the ${bundle.name} as specified in the firm's Service & Price List. The bundle scope includes the following components and the integrated coordination among them:\n\n• ${bundle.components.join("\n• ")}\n\nEach component carries the scope definitions and scope-change triggers specified in the Service & Price List. When a scope-change trigger fires, the firm provides written notice identifying the trigger and the additional fee structure; out-of-scope work does not commence until the client's written acknowledgment.` });
  const activeModLabels = [];
  Object.entries(singleSelections).forEach(([catKey, optCode]) => {
    const cat = MODIFIERS[catKey]; if (!cat || !cat.appliesTo.includes(bundleKey)) return;
    const opt = cat.options.find(o => o.code === optCode);
    if (opt && opt.code !== `${catKey}1`) activeModLabels.push(`${opt.code} — ${opt.label}`);
  });
  multiSelections.forEach(code => { const opt = MODIFIERS["M-SC"].options.find(o => o.code === code); if (opt) activeModLabels.push(`${opt.code} — ${opt.label}`); });
  if (activeModLabels.length > 0) blocks.push({ key: "modifiers", type: "templated", title: "Applicable Modifiers", body: `The following modifiers from the cross-cutting modifier stack apply to this engagement:\n\n• ${activeModLabels.join("\n• ")}\n\nEach modifier is priced per the firm's Service & Price List. The total fee reflects the base bundle plus the modifier-stack additions.` });
  const feeText = fee.status === "complete" ? `Total fee: $${fee.total.toLocaleString()}${bundle.type === "annual" ? " per year" : ""}.` : fee.status === "reserve-required" ? "This engagement requires Reserve-tier promotion. Final fee will be quoted at the Reserve engagement letter." : "Final fee includes scoped components quoted separately at the engagement-letter stage.";
  blocks.push({ key: "fee", type: "universal-calculated", title: "Fee Structure", body: `${feeText} ${bundle.type === "annual" ? "Annual retainer billed at engagement; advance fee deposit treatment per the Trust Accounting section below. Renewal at year-end with partner-driven review." : "Fixed fee payable per the schedule below: 50% retainer at engagement (advance fee deposit); 50% at closing or comparable milestone."} The fee covers all scope as defined in the bundle plus the applicable modifiers; out-of-scope work converts to hourly at the firm's standard rates (Partner $750/hr; Of Counsel $550/hr; Paralegal $250/hr) with the conversion-protocol notice provisions of this letter.` });
  blocks.push({ key: "trustAccounting", type: "universal", title: "Trust Accounting (Florida Bar Rule 5-1.1 / MA Rule 1.15)", body: `Advance fee deposit treatment is the default for this engagement. The retainer is deposited into the firm's IOLTA trust account and drawn down as work is performed (or, for annual retainers, as quarterly drawdowns whichever is greater). Client receives quarterly accountings showing drawdowns against the retainer balance. Payment of retainer is by check made payable to the firm's IOLTA trust account, or by wire transfer to the trust account per instructions the firm will provide.` });
  const isReserve = fee.status === "reserve-required";
  blocks.push({ key: "practiceScope", type: "tier-dependent", title: "Practice Scope", body: isReserve ? "This engagement is at the Reserve tier and includes the full practice scope: REITs (private, public, UPREIT, DownREIT), Qualified Opportunity Funds and QOZBs (§1400Z-2), Tenancy-in-Common structures under Rev. Proc. 2002-22, Delaware Statutory Trusts under Rev. Rul. 2004-86, and Reg D 506(b)/506(c) syndication document preparation. DLTS overlay applies." : `This engagement is at the ${bundle.tier} tier. Reserve-only structures (REITs, QOFs/QOZBs, TIC under Rev. Proc. 2002-22, DSTs under Rev. Rul. 2004-86, Reg D 506(b)/506(c) syndication) are out of scope at this tier. If the engagement scope evolves to include these structures, a Reserve-tier promotion will be discussed; mid-year tier conversion is handled by pro-rated retainer.` });
  blocks.push({ key: "outOfScope", type: "universal", title: "Out-of-Scope Conversion Protocol", body: "When a scope-change trigger fires (per the Service & Price List), the firm provides written notice to the client identifying the trigger and the additional fee structure. Out-of-scope work does not commence until the client's written acknowledgment of the additional fees." });
  const has8A2 = ["acquisition", "disposition", "strGold", "strPlatinum"].includes(bundleKey);
  if (has8A2) blocks.push({ key: "brokerCapacity", type: "conditional", condition: "8.A.2 broker selection in scope", title: "Broker Capacity Disclosure (RESPA §8(c)(3); Rules 4-1.7 and 4-1.8(f))", body: `The firm partner, Paul K. Donovan, holds a Massachusetts Attorney-Broker license issued under G.L. c. 112, §§ 87PP–87DDD. This license is held personally by Mr. Donovan as sole proprietor, separate from Donovan Legal PLLC. In connection with this engagement, Mr. Donovan may receive cooperating broker referral compensation from real estate brokers in other states with whom the firm coordinates on the client's behalf. This compensation is permitted under the cooperative brokerage exemption to the Real Estate Settlement Procedures Act, 12 U.S.C. § 2607(c)(3), and is paid to Mr. Donovan in his MA Attorney-Broker capacity, not to Donovan Legal PLLC.\n\nClient acknowledges receipt of this disclosure and consents to Mr. Donovan's receipt of such referral compensation, in accordance with Florida Bar Rules 4-1.7 and 4-1.8(f) (and MA SJC Rule 3:07 equivalents). The firm represents that its recommendations of cooperating brokers are based on independent professional judgment in the client's interest, not on the availability of referral compensation. Client retains the right to select any broker, whether or not recommended by the firm.` });
  if (clientInfo.propertyState && clientInfo.propertyState !== "FL" && clientInfo.propertyState !== "MA" && ["acquisition", "disposition", "strGold"].includes(bundleKey)) blocks.push({ key: "outsideCounsel", type: "conditional", condition: `Property in ${clientInfo.propertyState} (non-FL/MA)`, title: "Outside Counsel Retention (Rule 4-1.5(e))", body: `Donovan Legal PLLC is admitted to practice law in Florida and Massachusetts only. The property contemplated in this engagement is located in ${clientInfo.propertyState}, which requires representation by counsel admitted in that state for the state-specific closing work. The firm will retain outside counsel admitted in ${clientInfo.propertyState} to perform the state-specific closing work in connection with this engagement.\n\nOutside counsel is engaged by Donovan Legal PLLC, not by client. Outside counsel's fees are paid by the firm out of the bundle fee as a firm expense. The bundle fee disclosed in this letter is the complete client-facing fee; client will not receive a separate invoice from outside counsel and will not pay outside counsel directly. Florida Bar Rule 4-1.5(g) is not implicated; this is not a fee-sharing arrangement. The firm will identify the outside counsel firm by name to client prior to engagement.` });
  blocks.push({ key: "nonBrokerNonAcceptance", type: "universal", title: "Residential Non-Broker Settlement Service Non-Acceptance", body: "The firm does not accept referral compensation from residential mortgage lenders, title insurance companies, escrow agents, or real estate appraisers in connection with this or any other engagement. No Affiliated Business Arrangement (within the meaning of 12 U.S.C. § 2607(c)(4) and 12 C.F.R. § 1024.15) exists between the firm and any such provider. Recommendations of such providers (if any) are made solely on independent professional judgment in the client's interest." });
  const has8A4 = ["acquisition", "strGold"].includes(bundleKey);
  if (has8A4) blocks.push({ key: "nonSettlementVendor", type: "conditional", condition: "8.A.4 contractor/vendor selection in scope", title: "Non-Settlement Vendor Referral Disclosure (Rule 4-1.8(f))", body: "In connection with this engagement, the firm may recommend or coordinate with third-party vendors including cost-segregation engineering firms, contractors, construction managers, and similar service providers. The firm may receive referral compensation from such vendors. This compensation is permitted under Florida Bar Rule 4-1.8(f) subject to the disclosure and consent provisions of this letter. RESPA does not apply to these vendors as they do not perform settlement services within the meaning of 12 U.S.C. § 2602. Client acknowledges receipt of this disclosure and consents to the firm's receipt of such referral compensation. Client retains the right to select any vendor." });
  if (clientInfo.propertyState && clientInfo.propertyState !== "FL" && clientInfo.propertyState !== "MA") blocks.push({ key: "upl", type: "conditional", condition: `Non-FL/MA matter`, title: "Unauthorized Practice of Law Representation (Rule 4-5.5)", body: `Donovan Legal PLLC is admitted to practice law in the states of Florida and Massachusetts. The firm partner is admitted in both states and is in good standing in each. The firm does not represent itself as admitted to practice law in any other state. For matters involving the application of the law of any other state, the firm engages outside counsel admitted in that state. The firm partner also holds a Massachusetts Attorney-Broker license; this license authorizes real estate brokerage activity in Massachusetts only.` });
  const hasTaxPrep = ["ownership", "strPlatinum"].includes(bundleKey);
  if (hasTaxPrep) blocks.push({ key: "section7216", type: "conditional", condition: "Tax return preparation in scope", title: "§7216 Tax Information Consent", body: "Internal Revenue Code §7216 and the regulations thereunder generally prohibit the unauthorized disclosure or use of taxpayer information by tax return preparers. Client hereby consents to the firm's use of client's tax return information for purposes of providing the integrated services described in this engagement letter, including tax strategy review, real estate analyzer applications, position memos, deal modeling, and coordination across the firm's services. This consent does not authorize disclosure to any third party except as expressly contemplated by this engagement letter. Consent is valid for the term of this engagement and may be revoked in writing at any time, subject to the firm's existing obligations." });
  const hasMaterialParticipation = multiSelections.includes("M-SC5") || bundleKey === "strGold" || bundleKey === "strPlatinum";
  if (hasMaterialParticipation) blocks.push({ key: "materialParticipation", type: "conditional", condition: "REPS election active or STR positioning", title: "Material Participation Documentation", body: "The tax positioning in this engagement (REPS election under §469(c)(7) or short-term-rental exception under §469 and Reg. §1.469-1T(e)(3)) depends on the client's actual material participation in the relevant activities. The firm provides templates and reviews documentation; the client is responsible for maintaining contemporaneous time logs and supporting records. The firm's review is reasonable diligence supporting the tax position, not a guarantee of audit success." });
  if (singleSelections["M-E"] === "M-E2" && (bundleKey === "acquisition" || bundleKey === "disposition")) { const otherSide = bundleKey === "acquisition" ? "Disposition" : "Acquisition"; blocks.push({ key: "crossBundleCredit", type: "conditional", condition: "§1031 modifier engaged", title: "Cross-Bundle §1031 Credit", body: `Client has elected the §1031 exchange modifier (M-E2) for this engagement. If client has previously engaged, or subsequently engages, the firm's ${otherSide} Lifecycle Bundle with the parallel §1031 modifier for the other side of this same like-kind exchange (within the 180-day exchange period under §1031(a)(3)(B)), a $1,000 cross-bundle credit will be applied to the second engagement letter.` }); }
  blocks.push({ key: "conflicts", type: "universal", title: "Conflict Screening (Rule 4-1.7)", body: "The firm represents to client that conflict screening has been performed against the firm's current client base. To the firm's knowledge, no conflict of interest currently exists that would preclude this engagement. If a conflict is identified during the engagement, the firm will provide prompt written notice and discuss the appropriate path. Client agrees to identify any potential adverse parties at intake and to update the firm promptly if new parties emerge." });
  blocks.push({ key: "communication", type: "universal", title: "Communication and File Handling", body: "Client may communicate with the firm via email, phone, or postal mail. The firm targets responses within 24 hours (next business day) for routine matters and same-day for time-sensitive matters. Client files are retained for the duration of the engagement plus seven (7) years post-engagement, in accordance with the firm's file retention policy and applicable Florida Bar and Massachusetts SJC requirements. Client may request file copies at any time during the retention period." });
  blocks.push({ key: "termination", type: "universal", title: "Termination", body: "Either party may terminate this engagement upon written notice. Termination by client: the firm will provide a final accounting of services rendered through the termination date and return any unearned portion of the retainer from the trust account within 30 days. Termination by the firm: permitted under the Rules of Professional Conduct (Florida Bar Rule 4-1.16; MA SJC Rule 3:07 / MA Rule 1.16); the firm will provide reasonable notice and assist with orderly transition to successor counsel." });
  blocks.push({ key: "signature", type: "universal", title: "Acceptance", body: `Acceptance of this engagement is by client's signature below (wet-ink, or electronic signature in compliance with the Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 et seq., and applicable state electronic transactions acts). Upon execution, the retainer payment becomes due per the fee schedule above; the firm will provide trust account payment instructions separately.\n\n_____________________________________\n${clientInfo.clientName || "[Client Name]"}\nDate: _____________` });
  return blocks;
}

function buildEmailBody(bundleKey, singleSelections, multiSelections, clientInfo, fee) {
  if (!bundleKey) return "";
  const bundle = BUNDLES[bundleKey];
  let body = `NEW ENGAGEMENT SCOPING SUBMISSION\n\nClient: ${clientInfo.clientName}\n`;
  if (clientInfo.propertyState) body += `Property/Operating State: ${clientInfo.propertyState}\n`;
  body += `\nBUNDLE SELECTED:\n${bundle.name} (${bundle.tier} tier)\n\nMODIFIERS SELECTED:\n`;
  const mods = [];
  Object.entries(singleSelections).forEach(([catKey, optCode]) => {
    const cat = MODIFIERS[catKey]; if (!cat || !cat.appliesTo.includes(bundleKey)) return;
    const opt = cat.options.find(o => o.code === optCode);
    if (opt && opt.code !== `${catKey}1`) mods.push(`• ${opt.code} — ${opt.label}`);
  });
  multiSelections.forEach(code => { const opt = MODIFIERS["M-SC"].options.find(o => o.code === code); if (opt) mods.push(`• ${opt.code} — ${opt.label}`); });
  body += mods.length ? mods.join("\n") : "(none beyond defaults)";
  body += `\n\nESTIMATED FEE:\n${fee.status === "complete" ? "$" + fee.total.toLocaleString() + (bundle.type === "annual" ? " per year" : "") : fee.status === "reserve-required" ? "Reserve-tier promotion required" : "Partially scoped"}\n\nFEE BREAKDOWN:\n`;
  fee.breakdown.forEach(item => { body += `• ${item.label}: ${typeof item.amount === "number" ? "$" + item.amount.toLocaleString() : item.amount}\n`; });
  if (clientInfo.description) body += `\nCLIENT NOTES:\n${clientInfo.description}\n`;
  body += `\n---\nSubmitted via the firm's engagement scoping tool.`;
  return body;
}

function downloadLetter(blocks, clientInfo, fee, bundleKey) {
  const bundle = BUNDLES[bundleKey];
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Engagement Letter Draft — ${clientInfo.clientName}</title><style>body{font-family:Georgia,serif;max-width:7in;margin:1in auto;line-height:1.65;color:#1c1917;padding:0 0.5in;}h1{color:#169B62;border-bottom:2px solid #C9A961;padding-bottom:0.5rem;}h2{margin-top:2rem;font-size:1.1rem;}.meta{color:#78716c;font-size:0.85rem;margin-bottom:2rem;}p{white-space:pre-wrap;}</style></head><body>`;
  html += `<h1>Donovan Legal PLLC — Engagement Letter Draft</h1>`;
  html += `<div class="meta">Client: ${clientInfo.clientName} · ${bundle.name} · ${new Date().toLocaleDateString()}</div>`;
  blocks.forEach(b => {
    html += `<h2>${b.title}</h2><p>${b.body.replace(/</g, "&lt;")}</p>`;
  });
  html += `</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Engagement-Letter-Draft-${clientInfo.clientName.replace(/[^a-zA-Z0-9]/g, "-")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============== MAIN COMPONENT ==============
function CartConfigurator() {
  const [bundleKey, setBundleKey] = useState(null);
  const [singleSelections, setSingleSelections] = useState({});
  const [multiSelections, setMultiSelections] = useState([]);
  const [clientInfo, setClientInfo] = useState({ clientName: "", propertyState: "", description: "", email: "", phone: "" });
  const [view, setView] = useState("summary");
  const [submitted, setSubmitted] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const fee = useMemo(() => calculateFee(bundleKey, singleSelections, multiSelections), [bundleKey, singleSelections, multiSelections]);
  const steering = useMemo(() => computeSteering(bundleKey, singleSelections, multiSelections, clientInfo), [bundleKey, singleSelections, multiSelections, clientInfo]);
  const blocks = useMemo(() => buildLetterBlocks(bundleKey, singleSelections, multiSelections, clientInfo), [bundleKey, singleSelections, multiSelections, clientInfo]);

  function handleBundleSelect(key) { setBundleKey(key); setSingleSelections({}); setMultiSelections([]); }
  function handleSingleModSelect(catKey, optCode) { setSingleSelections(prev => ({ ...prev, [catKey]: optCode })); }
  function handleMultiModToggle(optCode) { setMultiSelections(prev => prev.includes(optCode) ? prev.filter(c => c !== optCode) : [...prev, optCode]); }

  if (submitted) return <SubmissionConfirmation bundleKey={bundleKey} singleSelections={singleSelections} multiSelections={multiSelections} clientInfo={clientInfo} fee={fee} blocks={blocks} onReset={() => { setSubmitted(false); setBundleKey(null); setSingleSelections({}); setMultiSelections([]); setClientInfo({ clientName: "", propertyState: "", description: "", email: "", phone: "" }); }} />;

  const submitReady = bundleKey && clientInfo.clientName && clientInfo.email;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="display-font text-2xl font-semibold tracking-tight" style={{ color: "#169B62" }}>Donovan Legal PLLC</div>
            <div className="text-xs uppercase tracking-widest text-stone-500 mt-1">Engagement Scoping Tool</div>
          </div>
          <div className="text-xs text-stone-400 text-right">
            <a href={`mailto:${FIRM_EMAIL}`} className="hover:text-stone-600 block">{FIRM_EMAIL}</a>
            <span>{FIRM_PHONE}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-l-2 pl-5 py-2" style={{ borderColor: "#C9A961" }}>
            <h1 className="display-font text-3xl font-medium text-stone-900 mb-2 leading-tight">Configure your engagement.</h1>
            <p className="text-stone-600 max-w-xl leading-relaxed">Select the bundle, refine with applicable modifiers, and review the live engagement letter. The partner reviews every submission before any engagement letter is signed. No charge is made until you sign.</p>
          </div>

          <section>
            <SectionHeader number="1" title="Choose your engagement" subtitle="Select the bundle that matches what you need. Bundle scope and modifiers will adjust accordingly." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(BUNDLES).map(([key, b]) => <BundleCard key={key} bundleKey={key} bundle={b} selected={bundleKey === key} onSelect={() => handleBundleSelect(key)} />)}
            </div>
          </section>

          {bundleKey && <section>
            <SectionHeader number="2" title="Property and strategy details" subtitle="Modifiers adjust the bundle to your actual matter complexity. Selections that require Reserve-tier engagement are flagged." />
            <div className="space-y-5">
              {Object.entries(MODIFIERS).map(([catKey, cat]) => {
                if (!cat.appliesTo.includes(bundleKey)) return null;
                if (cat.type === "single") return <ModifierGroupSingle key={catKey} catKey={catKey} cat={cat} bundleKey={bundleKey} selected={singleSelections[catKey]} onChange={(code) => handleSingleModSelect(catKey, code)} />;
                return <ModifierGroupMulti key={catKey} catKey={catKey} cat={cat} bundleKey={bundleKey} selected={multiSelections} onToggle={handleMultiModToggle} />;
              })}
            </div>
          </section>}

          {bundleKey && <section>
            <SectionHeader number="3" title="Your information" subtitle="Basic intake. The partner will follow up for full details after submission." />
            <ClientInfoForm clientInfo={clientInfo} setClientInfo={setClientInfo} bundleKey={bundleKey} />
          </section>}

          {submitReady && <section className="pt-4">
            <button onClick={() => setSubmitted(true)} className="w-full sm:w-auto px-8 py-4 bg-stone-900 text-white font-medium tracking-wide rounded-sm hover:bg-stone-800 transition-colors flex items-center justify-center gap-2">
              <Send w={16} /> Submit for partner review
            </button>
            <p className="text-xs text-stone-500 mt-3 max-w-md">After submitting, you'll see options to send the scope summary to the firm and download a draft engagement letter for your records. The partner will follow up to confirm the engagement letter and provide retainer payment instructions.</p>
          </section>}
        </div>

        <aside className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            <div className="flex bg-stone-100 rounded-sm p-1">
              <button onClick={() => setView("summary")} className={`flex-1 px-3 py-2 text-sm rounded-sm flex items-center justify-center gap-2 ${view === "summary" ? "bg-white shadow-sm font-medium" : "text-stone-600"}`}>
                <Calculator w={14} /> Fee Summary
              </button>
              <button onClick={() => setView("letter")} className={`flex-1 px-3 py-2 text-sm rounded-sm flex items-center justify-center gap-2 ${view === "letter" ? "bg-white shadow-sm font-medium" : "text-stone-600"}`}>
                <FileText w={14} /> Letter Preview
              </button>
            </div>
            {view === "summary" ? <FeeSummary fee={fee} bundleKey={bundleKey} steering={steering} /> : <LetterPreview blocks={blocks} fee={fee} bundleKey={bundleKey} expanded={previewExpanded} setExpanded={setPreviewExpanded} />}
          </div>
        </aside>
      </main>

      <footer className="border-t border-stone-200 mt-12 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-xs text-stone-500 text-center">
          Donovan Legal PLLC · Internal pricing reference v1.2 · All engagements are subject to partner review and conflict screening before engagement letter execution.
        </div>
      </footer>
    </div>
  );
}

function Intro() {
  return null; // unused
}

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="display-font text-sm font-medium text-stone-400 num-tabular">0{number}</span>
        <h2 className="display-font text-xl font-medium text-stone-900">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-stone-600 ml-7 max-w-xl leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function BundleCard({ bundleKey, bundle, selected, onSelect }) {
  const Icon = bundle.icon;
  const tierColor = bundle.tier === "Gold" ? "#C9A961" : bundle.tier === "Platinum" ? "#8B9BAF" : "#169B62";
  return (
    <button onClick={onSelect} className={`text-left p-5 border transition-all relative ${selected ? "bg-white shadow-md" : "bg-white hover:shadow-sm"}`} style={{ borderColor: selected ? "#169B62" : "#e7e5e4", borderWidth: selected ? "2px" : "1px" }}>
      <div className="flex items-start justify-between mb-3">
        <span style={{ color: selected ? "#169B62" : "#78716c" }}><Icon w={20} /></span>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: tierColor }}>{bundle.tier}</span>
      </div>
      <h3 className="display-font text-lg font-medium text-stone-900 mb-1 leading-tight">{bundle.name}</h3>
      <p className="text-xs text-stone-500 mb-3 leading-snug">{bundle.tagline}</p>
      <div className="flex items-baseline gap-2 mt-3 pt-3 border-t border-stone-100">
        <span className="display-font text-2xl font-medium text-stone-900 num-tabular">${bundle.base.toLocaleString()}</span>
        <span className="text-xs text-stone-500">{bundle.type === "annual" ? "/ year base" : "base"}</span>
      </div>
      {selected && <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: "#169B62" }}><Check w={12} sw={3} /></div>}
    </button>
  );
}

function ModifierGroupSingle({ catKey, cat, bundleKey, selected, onChange }) {
  return (
    <div className="bg-white border border-stone-200 rounded-sm p-5">
      <div className="mb-3">
        <h3 className="display-font text-base font-medium text-stone-900">{cat.name} <span className="text-xs text-stone-400 font-normal">({catKey})</span></h3>
        <p className="text-xs text-stone-500 mt-1">{cat.description}</p>
      </div>
      <div className="space-y-2">
        {cat.options.map(opt => {
          const impact = getModifierImpact(opt, bundleKey);
          const isSelected = selected === opt.code;
          const displayImpact = impact === 0 ? "—" : impact === "scoped" ? "scoped" : impact === "Reserve" ? "Reserve" : `+$${impact.toLocaleString()}`;
          return (
            <label key={opt.code} className={`flex items-start gap-3 p-3 cursor-pointer border transition-all ${isSelected ? "bg-stone-50" : "hover:bg-stone-50"}`} style={{ borderColor: isSelected ? "#169B62" : "transparent" }}>
              <input type="radio" name={catKey} checked={isSelected} onChange={() => onChange(opt.code)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-stone-900">{opt.label}</span>
                  <span className={`text-sm num-tabular whitespace-nowrap ${impact === "Reserve" || impact === "scoped" ? "text-stone-500 italic" : "text-stone-700 font-medium"}`}>{displayImpact}</span>
                </div>
                <div className="text-xs text-stone-500 mt-0.5">{opt.sub}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ModifierGroupMulti({ catKey, cat, bundleKey, selected, onToggle }) {
  const applicable = cat.options.filter(o => {
    if (o.code === "M-SC5") return bundleKey === "ownership" || bundleKey === "strPlatinum";
    return true;
  });
  return (
    <div className="bg-white border border-stone-200 rounded-sm p-5">
      <div className="mb-3">
        <h3 className="display-font text-base font-medium text-stone-900">{cat.name} <span className="text-xs text-stone-400 font-normal">({catKey})</span></h3>
        <p className="text-xs text-stone-500 mt-1">{cat.description}</p>
      </div>
      <div className="space-y-2">
        {applicable.map(opt => {
          const impact = getModifierImpact(opt, bundleKey);
          if (impact === 0) return null;
          const isSelected = selected.includes(opt.code);
          const displayImpact = `+$${impact.toLocaleString()}${bundleKey === "ownership" || bundleKey === "strPlatinum" ? "/yr" : ""}`;
          return (
            <label key={opt.code} className={`flex items-start gap-3 p-3 cursor-pointer border transition-all ${isSelected ? "bg-stone-50" : "hover:bg-stone-50"}`} style={{ borderColor: isSelected ? "#169B62" : "transparent" }}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(opt.code)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-stone-900">{opt.label}</span>
                  <span className="text-sm num-tabular whitespace-nowrap text-stone-700 font-medium">{displayImpact}</span>
                </div>
                <div className="text-xs text-stone-500 mt-0.5">{opt.sub}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ClientInfoForm({ clientInfo, setClientInfo, bundleKey }) {
  const needsState = ["acquisition", "disposition", "strGold"].includes(bundleKey);
  return (
    <div className="bg-white border border-stone-200 rounded-sm p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Client name *</label>
          <input type="text" value={clientInfo.clientName} onChange={(e) => setClientInfo({ ...clientInfo, clientName: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-sm focus:outline-none focus:border-[#169B62] text-sm" placeholder="Full legal name or entity name" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Email *</label>
          <input type="email" value={clientInfo.email} onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-sm focus:outline-none focus:border-[#169B62] text-sm" placeholder="you@example.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Phone (optional)</label>
          <input type="tel" value={clientInfo.phone} onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-sm focus:outline-none focus:border-[#169B62] text-sm" />
        </div>
        {needsState && <div>
          <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Property state</label>
          <select value={clientInfo.propertyState} onChange={(e) => setClientInfo({ ...clientInfo, propertyState: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-sm focus:outline-none focus:border-[#169B62] text-sm">
            <option value="">Select state...</option>
            <option value="FL">Florida</option><option value="MA">Massachusetts</option><option value="TN">Tennessee</option>
            <option value="NC">North Carolina</option><option value="SC">South Carolina</option><option value="TX">Texas</option>
            <option value="AZ">Arizona</option><option value="CO">Colorado</option><option value="CA">California</option>
            <option value="NY">New York</option><option value="other">Other</option>
          </select>
        </div>}
        {!needsState && (bundleKey === "ownership" || bundleKey === "strPlatinum") && <div>
          <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Primary state of operations</label>
          <select value={clientInfo.propertyState} onChange={(e) => setClientInfo({ ...clientInfo, propertyState: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-sm focus:outline-none focus:border-[#169B62] text-sm">
            <option value="">Select state...</option><option value="FL">Florida</option><option value="MA">Massachusetts</option>
            <option value="multi">Multi-state portfolio</option><option value="other">Other</option>
          </select>
        </div>}
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5">Brief description (optional)</label>
        <textarea value={clientInfo.description} onChange={(e) => setClientInfo({ ...clientInfo, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-stone-200 rounded-sm focus:outline-none focus:border-[#169B62] text-sm" placeholder="Property type, value range, anything specific the partner should know..." />
      </div>
    </div>
  );
}

function FeeSummary({ fee, bundleKey, steering }) {
  if (!bundleKey) return <div className="bg-white border border-stone-200 rounded-sm p-6 text-center text-stone-500"><div className="mx-auto mb-3 text-stone-300 w-fit"><Calculator w={32} /></div><p className="text-sm">Select a bundle to see your fee summary.</p></div>;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-sm p-6">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Estimated Total</div>
        <div className="display-font text-4xl font-medium text-stone-900 num-tabular mb-1">${fee.total.toLocaleString()}</div>
        <div className="text-sm text-stone-500">{fee.bundle.type === "annual" ? "per year" : "engagement total"}{fee.status === "partially-scoped" && <span className="block mt-1 text-stone-600 italic">+ scoped components quoted at engagement</span>}{fee.status === "reserve-required" && <span className="block mt-1 text-stone-600 italic">Reserve-tier promotion required</span>}</div>
      </div>
      <div className="bg-white border border-stone-200 rounded-sm p-5">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">Breakdown</div>
        <div className="space-y-2">
          {fee.breakdown.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-stone-700 truncate">{item.label}</span>
              <span className="num-tabular text-stone-900 font-medium whitespace-nowrap">{typeof item.amount === "number" ? `$${item.amount.toLocaleString()}` : <span className="italic text-stone-500">{item.amount}</span>}</span>
            </div>
          ))}
        </div>
      </div>
      {steering.length > 0 && <div className="space-y-2">{steering.map((msg, i) => <SteeringMessage key={i} msg={msg} />)}</div>}
    </div>
  );
}

function SteeringMessage({ msg }) {
  const styles = {
    promotion: { bg: "#FEF3C7", border: "#C9A961", color: "#92400E" },
    credit: { bg: "#ECFDF5", border: "#169B62", color: "#065F46" },
    tip: { bg: "#F0F9FF", border: "#0284C7", color: "#0369A1" },
    info: { bg: "#F5F5F4", border: "#78716c", color: "#57534e" },
    note: { bg: "#F5F5F4", border: "#78716c", color: "#57534e" },
  };
  const s = styles[msg.kind] || styles.info;
  return (
    <div className="rounded-sm border-l-2 p-3 text-xs leading-relaxed flex gap-2" style={{ background: s.bg, borderColor: s.border }}>
      <span style={{ color: s.color }} className="mt-0.5"><AlertCircle w={14} /></span>
      <span style={{ color: s.color }}>{msg.text}</span>
    </div>
  );
}

function LetterPreview({ blocks, fee, bundleKey, expanded, setExpanded }) {
  if (!bundleKey || blocks.length === 0) return <div className="bg-white border border-stone-200 rounded-sm p-6 text-center text-stone-500"><div className="mx-auto mb-3 text-stone-300 w-fit"><FileText w={32} /></div><p className="text-sm">Select a bundle to preview your engagement letter.</p></div>;
  const visible = expanded ? blocks : blocks.slice(0, 4);
  return (
    <div className="bg-white border border-stone-200 rounded-sm overflow-hidden">
      <div className="bg-stone-50 border-b border-stone-200 px-5 py-3">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Engagement Letter — Live Preview</div>
        <div className="text-sm text-stone-700">{blocks.length} blocks assembled · {blocks.filter(b => b.type === "conditional").length} conditional</div>
      </div>
      <div className="px-5 py-4 max-h-[600px] overflow-y-auto space-y-5 letter-text">
        {visible.map((block) => (
          <div key={block.key} className={`pb-4 ${block.type === "conditional" ? "border-l-2 pl-4" : ""}`} style={block.type === "conditional" ? { borderColor: "#C9A961" } : {}}>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h4 className="font-semibold text-stone-900 text-base">{block.title}</h4>
              {block.type === "conditional" && <span className="text-[10px] uppercase tracking-widest whitespace-nowrap" style={{ color: "#92400E" }}>Conditional</span>}
              {block.type === "universal" && <span className="text-[10px] uppercase tracking-widest text-stone-400 whitespace-nowrap">Universal</span>}
            </div>
            {block.condition && <div className="text-xs italic mb-2" style={{ color: "#92400E" }}>Trigger: {block.condition}</div>}
            <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{block.body}</div>
          </div>
        ))}
        {!expanded && blocks.length > 4 && <button onClick={() => setExpanded(true)} className="w-full py-3 border border-dashed border-stone-300 rounded-sm text-sm text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-2"><ArrowDown w={14} /> Show {blocks.length - 4} more blocks</button>}
      </div>
      <div className="bg-stone-50 border-t border-stone-200 px-5 py-3 text-xs text-stone-500 flex flex-wrap gap-3 justify-between">
        <span>Working-draft language · partner reviews and refines before client signature</span>
        <span className="num-tabular">{fee.status === "complete" ? `$${fee.total.toLocaleString()}` : "scoped"}</span>
      </div>
    </div>
  );
}

function SubmissionConfirmation({ bundleKey, singleSelections, multiSelections, clientInfo, fee, blocks, onReset }) {
  const emailBody = useMemo(() => buildEmailBody(bundleKey, singleSelections, multiSelections, clientInfo, fee), [bundleKey, singleSelections, multiSelections, clientInfo, fee]);
  const mailtoUrl = `mailto:${FIRM_EMAIL}?subject=${encodeURIComponent("Engagement Scoping Submission — " + clientInfo.clientName)}&body=${encodeURIComponent(emailBody)}`;
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="bg-white border border-stone-200 rounded-sm max-w-2xl w-full p-10">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 text-[#169B62]" style={{ background: "#ECFDF5" }}><Check w={24} sw={2.5} /></div>
        <h1 className="display-font text-3xl font-medium text-stone-900 mb-3 leading-tight">Scoping complete.</h1>
        <p className="text-stone-600 leading-relaxed mb-6">Thank you, {clientInfo.clientName}. Your scoping summary is ready to send to the firm. Once received, Paul will personally review the scope, complete a conflict check, and prepare the formal engagement letter for your signature.</p>
        
        <div className="bg-stone-50 rounded-sm p-5 mb-6">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">Send your scoping to the firm</div>
          <a href={mailtoUrl} className="w-full px-5 py-3 bg-[#169B62] text-white font-medium rounded-sm hover:bg-[#138052] transition-colors inline-flex items-center justify-center gap-2 mb-3">
            <Mail w={16} /> Open email to firm
          </a>
          <p className="text-xs text-stone-500">Opens your email client with the scoping summary pre-filled to {FIRM_EMAIL}. Review and send. If your device does not open an email client, copy the summary below and email it directly.</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-widest text-stone-500">Scope Summary</div>
            <button onClick={() => { navigator.clipboard.writeText(emailBody); alert("Copied to clipboard"); }} className="text-xs text-stone-600 underline hover:text-stone-900">Copy to clipboard</button>
          </div>
          <pre className="text-xs whitespace-pre-wrap text-stone-700 font-mono max-h-64 overflow-y-auto">{emailBody}</pre>
        </div>

        <div className="bg-stone-50 rounded-sm p-5 mb-6">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">Optional: download draft engagement letter</div>
          <button onClick={() => downloadLetter(blocks, clientInfo, fee, bundleKey)} className="w-full sm:w-auto px-5 py-3 bg-white border border-stone-300 text-stone-900 font-medium rounded-sm hover:bg-stone-100 transition-colors inline-flex items-center justify-center gap-2 mb-2">
            <Download w={16} /> Download draft engagement letter
          </button>
          <p className="text-xs text-stone-500 mt-2">Working draft for your reference. The partner will provide the final engagement letter for signature after review.</p>
        </div>

        <div className="bg-amber-50 border-l-2 px-4 py-3 mb-6 text-sm" style={{ borderColor: "#C9A961" }}>
          <div className="text-stone-500 text-xs uppercase tracking-wider mb-1">What happens next</div>
          <ol className="space-y-1 text-stone-700 list-decimal list-inside text-sm">
            <li>Send your scoping summary to the firm (button above)</li>
            <li>Partner reviews submission and conducts conflict screening (typically within 24 hours)</li>
            <li>Partner may follow up with clarifying questions</li>
            <li>Firm prepares formal engagement letter and sends for your signature</li>
            <li>Retainer payment by check or wire to firm's IOLTA trust account (instructions provided with engagement letter)</li>
            <li>Engagement begins upon signed letter and retainer receipt</li>
          </ol>
        </div>
        <div className="text-sm text-stone-500 mb-6">No charge is made until you sign the engagement letter. If the partner identifies a meaningful scope adjustment during review, you will see the revised engagement letter before signing.</div>
        <button onClick={onReset} className="text-sm text-stone-700 underline hover:text-stone-900">Start a new submission</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CartConfigurator />);
setTimeout(() => document.getElementById("root").classList.add("ready"), 100);
