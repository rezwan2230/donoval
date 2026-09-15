#!/usr/bin/env node
/* Smoke tests for tool-1031-exchange.js — 4-tier ladder build.
 *
 * Tier ladder: public < gold < platinum < reserve.
 * Each tier inherits everything below it.
 *
 * Run from /home/claude/build:
 *   node smoke/smoke-1031.js
 */

const path = require('path');
const ENGINE_PATH = path.resolve(__dirname, '..', 'js', 'tool-1031-exchange.js');

function loadEngine(tier) {
  global.window = { __DONOVAN_TIER: tier };
  global.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null
  };
  delete require.cache[ENGINE_PATH];
  return require(ENGINE_PATH);
}

let pass = 0, fail = 0;
const failures = [];

function approx(a, b, tol) {
  tol = tol || 0.5;
  return Math.abs(a - b) <= tol;
}

function assert(name, condition, detail) {
  if (condition) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    failures.push({ name, detail });
    console.log('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function section(title) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
}

// =============================================================================
section('Tier ladder — public');
// =============================================================================
{
  const e = loadEngine('public');
  assert('TIER = public', e.TIER === 'public');
  assert('isPublic true', e.isPublic());
  assert('isGold false', !e.isGold());
  assert('isPlatinum false', !e.isPlatinum());
  assert('isReserve false', !e.isReserve());
  assert('isMember (back-compat) false', !e.isMember());
  assert('isAtLeast public true', e.isAtLeast('public'));
  assert('isAtLeast gold false', !e.isAtLeast('gold'));
}

// =============================================================================
section('Tier ladder — gold');
// =============================================================================
{
  const e = loadEngine('gold');
  assert('TIER = gold', e.TIER === 'gold');
  assert('isPublic false', !e.isPublic());
  assert('isGold true', e.isGold());
  assert('isPlatinum false', !e.isPlatinum());
  assert('isReserve false', !e.isReserve());
  assert('isMember (back-compat) true', e.isMember());
  assert('isAtLeast gold true', e.isAtLeast('gold'));
  assert('isAtLeast platinum false', !e.isAtLeast('platinum'));
}

// =============================================================================
section('Tier ladder — platinum');
// =============================================================================
{
  const e = loadEngine('platinum');
  assert('TIER = platinum', e.TIER === 'platinum');
  assert('isPublic false', !e.isPublic());
  assert('isGold true (inherits)', e.isGold());
  assert('isPlatinum true', e.isPlatinum());
  assert('isReserve false', !e.isReserve());
  assert('isMember (back-compat) true', e.isMember());
  assert('isAtLeast platinum true', e.isAtLeast('platinum'));
  assert('isAtLeast reserve false', !e.isAtLeast('reserve'));
}

// =============================================================================
section('Tier ladder — reserve');
// =============================================================================
{
  const e = loadEngine('reserve');
  assert('TIER = reserve', e.TIER === 'reserve');
  assert('isPublic false', !e.isPublic());
  assert('isGold true (inherits)', e.isGold());
  assert('isPlatinum true (inherits)', e.isPlatinum());
  assert('isReserve true', e.isReserve());
  assert('isAtLeast reserve true', e.isAtLeast('reserve'));
}

// =============================================================================
section('Tier ladder — back-compat alias (client → gold)');
// =============================================================================
{
  const e = loadEngine('client');
  assert('legacy client mapped to gold', e.TIER === 'gold');
  assert('client raw value preserved', e.RAW_TIER === 'client');
  assert('client tier unlocks gold helpers', e.isGold());
  assert('client tier does not unlock platinum', !e.isPlatinum());
}

// =============================================================================
section('Tier ladder — unknown tier defaults sanely');
// =============================================================================
{
  const e = loadEngine(undefined);
  assert('undefined → public', e.TIER === 'public');
}
{
  const e = loadEngine('garbage');
  assert('garbage tier ranks as 0 (public-equivalent gating)', !e.isGold());
}

// =============================================================================
section('Per-mode tier requirements');
// =============================================================================
{
  const e = loadEngine('reserve');
  assert('Forward requires public', e.modeRequiresTier('forward') === 'public');
  assert('Reverse requires platinum', e.modeRequiresTier('reverse') === 'platinum');
  assert('Drop-Swap requires reserve', e.modeRequiresTier('drop-swap') === 'reserve');
  assert('Multi requires reserve', e.modeRequiresTier('multi') === 'reserve');
  assert('modeRequiresReserve true for drop-swap', e.modeRequiresReserve('drop-swap'));
  assert('modeRequiresReserve true for multi', e.modeRequiresReserve('multi'));
  assert('modeRequiresReserve false for reverse (now platinum)', !e.modeRequiresReserve('reverse'));
  assert('modeRequiresReserve false for forward', !e.modeRequiresReserve('forward'));
}

// =============================================================================
section('Tier × mode access matrix');
// =============================================================================
function canAccess(tier, mode) {
  const e = loadEngine(tier);
  return e.isAtLeast(e.modeRequiresTier(mode));
}
// public
assert('public can access forward', canAccess('public', 'forward'));
assert('public cannot access reverse', !canAccess('public', 'reverse'));
assert('public cannot access drop-swap', !canAccess('public', 'drop-swap'));
assert('public cannot access multi', !canAccess('public', 'multi'));
// gold
assert('gold can access forward', canAccess('gold', 'forward'));
assert('gold cannot access reverse', !canAccess('gold', 'reverse'));
assert('gold cannot access drop-swap', !canAccess('gold', 'drop-swap'));
// platinum
assert('platinum can access forward', canAccess('platinum', 'forward'));
assert('platinum can access reverse', canAccess('platinum', 'reverse'));
assert('platinum cannot access drop-swap', !canAccess('platinum', 'drop-swap'));
assert('platinum cannot access multi', !canAccess('platinum', 'multi'));
// reserve
assert('reserve can access forward', canAccess('reserve', 'forward'));
assert('reserve can access reverse', canAccess('reserve', 'reverse'));
assert('reserve can access drop-swap', canAccess('reserve', 'drop-swap'));
assert('reserve can access multi', canAccess('reserve', 'multi'));

// =============================================================================
section('STATES_1031 conformity table');
// =============================================================================
{
  const e = loadEngine('reserve');
  assert('CA marked special (FTB 3840)', e.STATES_1031.CA.conforms === 'special');
  assert('OR marked special (Form 24)', e.STATES_1031.OR.conforms === 'special');
  assert('FL marked no_tax', e.STATES_1031.FL.conforms === 'no_tax');
  assert('PA conforms', e.STATES_1031.PA.conforms === true);
  assert('MA conforms with note', e.STATES_1031.MA.conforms === true && e.STATES_1031.MA.note.length > 0);
  const noTax = ['AK','FL','NV','NH','SD','TN','TX','WA','WY'];
  assert('nine no-tax states correctly tagged', noTax.every(s => e.STATES_1031[s].conforms === 'no_tax'));
}

// Subsequent compute tests are pure-function — load reserve once and use it.
const e = loadEngine('reserve');

// =============================================================================
section('computeExchange — Scenario A: Full deferral (no boot)');
// =============================================================================
{
  const inputs = {
    relFMV: 2000000, relSellExp: 120000, relBasis: 800000,
    relAccumDep: 200000, rel1245Dep: 50000, relMortgage: 1000000,
    repFMV: 2000000, repMortgage: 1000000, cashAdded: 0, cashReceived: 0,
    eatFees: 0, improvementCost: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25,
    niitRate: 0.038, stateRate: 0, stateCode: 'FL',
    use121: false, exclusion121: 0, applyDLTS: false
  };
  const r = e.computeExchange(inputs);
  assert('A1 amount realized = $1.88M', approx(r.amountRealized, 1880000));
  assert('A1 realized gain = $1.08M', approx(r.realizedGain, 1080000));
  assert('A1 total boot = 0', approx(r.totalBoot, 0));
  assert('A1 recognized gain = 0 (full deferral)', approx(r.recognizedGain, 0));
  assert('A1 deferred gain = realized gain', approx(r.deferredGain, 1080000));
  assert('A1 replacement basis = $920K', approx(r.repBasis, 920000));
  assert('A1 carryover basis = $600K', approx(r.carryoverBasis, 600000));
  assert('A1 excess basis = $320K', approx(r.excessBasis, 320000));
  assert('A1 state tax recognized = 0 (FL)', approx(r.stateTaxRecognized, 0));
  assert('A1 hypFedTax > 0', r.hypFedTax > 0);
  assert('A1 deferred fed tax = hypFedTax (no recognition)', approx(r.deferredFedTax, r.hypFedTax));
}

// =============================================================================
section('computeExchange — Scenario B: Cash boot only');
// =============================================================================
{
  const inputs = {
    relFMV: 2000000, relSellExp: 120000, relBasis: 800000,
    relAccumDep: 200000, rel1245Dep: 50000, relMortgage: 1000000,
    repFMV: 1950000, repMortgage: 1000000, cashAdded: 0, cashReceived: 50000,
    eatFees: 0, improvementCost: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25,
    niitRate: 0.038, stateRate: 0, stateCode: 'FL',
    use121: false, exclusion121: 0, applyDLTS: false
  };
  const r = e.computeExchange(inputs);
  assert('B1 total boot = $50K cash', approx(r.totalBoot, 50000));
  assert('B1 recognized gain = $50K', approx(r.recognizedGain, 50000));
  assert('B1 § 1245 recapture = $50K', approx(r.recapture1245, 50000));
  assert('B1 § 1250 recapture = 0', approx(r.recapture1250, 0));
  assert('B1 LTCG recognition = 0', approx(r.recogLTCG, 0));
  assert('B1 deferred gain = $1.03M', approx(r.deferredGain, 1030000));
  assert('B1 fed tax recognized = $18,500', approx(r.fedTaxRecognized, 18500));
  assert('B1 replacement basis = $920K', approx(r.repBasis, 920000));
}

// =============================================================================
section('computeExchange — Scenario C: Net mortgage boot, partially offset');
// =============================================================================
{
  const inputs = {
    relFMV: 2000000, relSellExp: 120000, relBasis: 800000,
    relAccumDep: 200000, rel1245Dep: 50000, relMortgage: 1000000,
    repFMV: 1850000, repMortgage: 750000, cashAdded: 100000, cashReceived: 0,
    eatFees: 0, improvementCost: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25,
    niitRate: 0.038, stateRate: 0.05, stateCode: 'CA',
    use121: false, exclusion121: 0, applyDLTS: false
  };
  const r = e.computeExchange(inputs);
  assert('C1 gross mortgage boot = $250K', approx(r.grossMortgageBoot, 250000));
  assert('C1 net mortgage boot = $150K', approx(r.netMortgageBoot, 150000));
  assert('C1 net cash boot = 0', approx(r.netCashBoot, 0));
  assert('C1 total boot = $150K', approx(r.totalBoot, 150000));
  assert('C1 recognized gain = $150K', approx(r.recognizedGain, 150000));
  assert('C1 § 1245 recapture = $50K', approx(r.recapture1245, 50000));
  assert('C1 § 1250 recapture = $100K', approx(r.recapture1250, 100000));
  assert('C1 LTCG recognition = 0', approx(r.recogLTCG, 0));
  assert('C1 CA state tax recognized = $7,500', approx(r.stateTaxRecognized, 7500));
}

// =============================================================================
section('computeExchange — Scenario D: § 121 layered + § 1031');
// =============================================================================
{
  const inputs = {
    relFMV: 1000000, relSellExp: 0, relBasis: 300000,
    relAccumDep: 80000, rel1245Dep: 0, relMortgage: 500000,
    repFMV: 1000000, repMortgage: 500000, cashAdded: 0, cashReceived: 0,
    eatFees: 0, improvementCost: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25,
    niitRate: 0.038, stateRate: 0, stateCode: 'FL',
    use121: true, exclusion121: 500000, applyDLTS: false
  };
  const r = e.computeExchange(inputs);
  assert('D1 realized gain = $700K', approx(r.realizedGain, 700000));
  assert('D1 § 121 excluded = $500K', approx(r.section121Excluded, 500000));
  assert('D1 gain after § 121 = $200K', approx(r.gainAfter121, 200000));
  assert('D1 no boot → no recognition', approx(r.recognizedGain, 0));
  assert('D1 deferred gain = $200K', approx(r.deferredGain, 200000));
}

// =============================================================================
section('computeExchange — Scenario E: Reverse w/ EAT fees + improvements');
// =============================================================================
{
  const inputs = {
    relFMV: 3000000, relSellExp: 180000, relBasis: 1200000,
    relAccumDep: 300000, rel1245Dep: 80000, relMortgage: 1500000,
    repFMV: 2500000, repMortgage: 1500000, cashAdded: 0, cashReceived: 0,
    eatFees: 25000, improvementCost: 400000,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25,
    niitRate: 0.038, stateRate: 0, stateCode: 'FL',
    use121: false, exclusion121: 0, applyDLTS: false
  };
  const r = e.computeExchange(inputs);
  assert('E1 amount realized includes EAT fees', approx(r.amountRealized, 2795000));
  assert('E1 realized gain = $1.595M', approx(r.realizedGain, 1595000));
  assert('E1 no boot → no recognition', approx(r.recognizedGain, 0));
  assert('E1 repFMV with improvements = $2.9M', approx(r.repFMVWithImprovements, 2900000));
  assert('E1 replacement basis includes improvements', approx(r.repBasis, 1305000));
}

// =============================================================================
section('computeMultiYearProjection — basic arithmetic');
// =============================================================================
{
  const inputs = {
    relFMV: 2000000, relSellExp: 120000, relBasis: 800000,
    relAccumDep: 200000, rel1245Dep: 50000, relMortgage: 1000000,
    repFMV: 2000000, repMortgage: 1000000, cashAdded: 0, cashReceived: 0,
    eatFees: 0, improvementCost: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25,
    niitRate: 0.038, stateRate: 0, stateCode: 'FL',
    use121: false, exclusion121: 0, applyDLTS: false
  };
  const r = e.computeExchange(inputs);
  const proj = e.computeMultiYearProjection(r, 5, 'residential', 20);
  assert('Proj has 5 year rows', proj.years.length === 5);
  assert('Carryover annual dep = $30K', approx(proj.carryAnnualDep, 30000));
  assert('Excess annual dep ≈ $11,636', approx(proj.excessAnnualDep, 11636.36, 1));
  assert('Year 1 total dep ≈ $41,636', approx(proj.years[0].yearDep, 41636, 1));
  assert('Year 1 cum dep = year 1 total dep', approx(proj.years[0].cumDep, proj.years[0].yearDep, 1));
  assert('Year 5 cum dep ≈ 5x year 1', approx(proj.years[4].cumDep, 5 * proj.years[0].yearDep, 5));
  assert('Year 5 adj basis = repBasis - cumDep', approx(proj.years[4].adjBasis, r.repBasis - proj.years[4].cumDep, 1));
  assert('Hyp fed tax at sale includes original deferral', proj.hypotheticalFedTaxAtSale >= proj.deferredCarriedFromOriginal);
}

// =============================================================================
section('computeForwardTimeline — 180-day cap vs tax filing acceleration');
// =============================================================================
{
  const t1 = e.computeForwardTimeline('2026-08-01', '2027-04-15');
  assert('T1 day 45 = Sep 15 2026', t1.date45 === '2026-09-15');
  assert('T1 day 180 = Jan 28 2027', t1.date180 === '2027-01-28');
  assert('T1 acquisition deadline = day 180 (no acceleration)', t1.acquisitionDeadline === t1.date180);

  const t2 = e.computeForwardTimeline('2026-11-15', '2027-04-15');
  assert('T2 day 180 = May 14 2027', t2.date180 === '2027-05-14');
  assert('T2 acquisition accelerated to tax filing date', t2.acquisitionDeadline === '2027-04-15');
  assert('T2 source notes acceleration', t2.acquisitionDeadlineSource.indexOf('accelerated') >= 0);
}

// =============================================================================
section('computeReverseTimeline — QEAA safe harbor status');
// =============================================================================
{
  const t1 = e.computeReverseTimeline('2026-08-01', '2027-01-15', 'rep-park');
  assert('R1 day 45 = Sep 15 2026', t1.day45 === '2026-09-15');
  assert('R1 day 180 = Jan 28 2027', t1.day180 === '2027-01-28');
  assert('R1 actual days = 167', t1.actualDays === 167);
  assert('R1 safe harbor: within', t1.safeHarborStatus === 'within');

  const t2 = e.computeReverseTimeline('2026-08-01', '2027-02-15', 'rep-park');
  assert('R2 actual days = 198', t2.actualDays === 198);
  assert('R2 safe harbor: blown', t2.safeHarborStatus === 'blown');

  const t3 = e.computeReverseTimeline('2026-08-01', '', 'rep-park');
  assert('R3 status pending when no close date', t3.safeHarborStatus === 'pending');
  assert('R3 actualDays null when no close date', t3.actualDays === null);
}

// =============================================================================
section('Date helpers');
// =============================================================================
assert('addDaysISO + 45', e.addDaysISO('2026-01-01', 45) === '2026-02-15');
assert('addDaysISO + 180', e.addDaysISO('2026-01-01', 180) === '2026-06-30');
assert('daysBetween 90 days', e.daysBetween('2026-01-01', '2026-04-01') === 90);
assert('daysBetween null for blank', e.daysBetween('', '2026-04-01') === null);

// =============================================================================
section('idRule helpers');
// =============================================================================
assert('idRuleText three', e.idRuleText('three').indexOf('3-Property') === 0);
assert('idRuleText 200', e.idRuleText('200').indexOf('200%') === 0);
assert('idRuleShort 95', e.idRuleShort('95') === '95% Exception');

// =============================================================================
section('computeMultiPropertyExchange — Phase 3: M→1 (consolidation)');
// =============================================================================
// Sell 2 properties, buy 1 larger consolidated property. Equal mortgages, no
// cash exchanged → full deferral. Validates aggregation, basis allocation.
{
  const relProps = [
    { label: 'Prop A', relFMV: 1500000, relSellExp: 90000, relBasis: 600000,
      relAccumDep: 150000, rel1245Dep: 30000, relMortgage: 700000 },
    { label: 'Prop B', relFMV: 2500000, relSellExp: 150000, relBasis: 1100000,
      relAccumDep: 300000, rel1245Dep: 70000, relMortgage: 1300000 }
  ];
  const repProps = [
    { label: 'Big New Building', repFMV: 4500000, repMortgage: 2000000 }
  ];
  const profile = {
    cashAdded: 0, cashReceived: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
    stateRate: 0, stateCode: 'FL', idRule: 'three'
  };
  const r = e.computeMultiPropertyExchange(relProps, repProps, profile);
  // Aggregate amount realized = (1.5M-90K) + (2.5M-150K) = 1.41M + 2.35M = 3.76M
  assert('M1 agg amount realized = $3.76M', approx(r.aggAmountRealized, 3760000));
  // Aggregate basis = 600K + 1.1M = 1.7M
  assert('M1 agg basis = $1.7M', approx(r.aggRelBasis, 1700000));
  // Aggregate realized gain = 3.76M - 1.7M = 2.06M
  assert('M1 agg realized gain = $2.06M', approx(r.aggRealizedGain, 2060000));
  // Mortgages: 700K + 1.3M = 2M; replacement 2M; net mortgage boot = 0
  assert('M1 net mortgage boot = 0', approx(r.netMortgageBoot, 0));
  assert('M1 net cash boot = 0', approx(r.netCashBoot, 0));
  assert('M1 total boot = 0', approx(r.totalBoot, 0));
  // No boot → full deferral
  assert('M1 recognized gain = 0', approx(r.recognizedGain, 0));
  assert('M1 deferred gain = $2.06M', approx(r.deferredGain, 2060000));
  // Aggregate replacement basis = 4.5M - 2.06M = 2.44M
  assert('M1 agg replacement basis = $2.44M', approx(r.aggRepBasis, 2440000));
  // Single replacement → 100% FMV ratio
  assert('M1 single replacement gets 100% FMV ratio', approx(r.repAllocations[0].fmvRatio, 1.0, 0.001));
  assert('M1 single replacement gets full basis', approx(r.repAllocations[0].allocatedBasis, 2440000));
}

// =============================================================================
section('computeMultiPropertyExchange — Phase 3: 1→N (split / diversification)');
// =============================================================================
// Sell 1 property, buy 3 properties for diversification. Equal mortgages.
{
  const relProps = [
    { label: 'Big Old Building', relFMV: 6000000, relSellExp: 360000, relBasis: 2400000,
      relAccumDep: 600000, rel1245Dep: 100000, relMortgage: 3000000 }
  ];
  const repProps = [
    { label: 'Prop X', repFMV: 2000000, repMortgage: 1000000 },
    { label: 'Prop Y', repFMV: 2000000, repMortgage: 1000000 },
    { label: 'Prop Z', repFMV: 1600000, repMortgage: 1000000 }
  ];
  const profile = {
    cashAdded: 0, cashReceived: 0,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
    stateRate: 0, stateCode: 'FL', idRule: 'three'
  };
  const r = e.computeMultiPropertyExchange(relProps, repProps, profile);
  // Aggregate amount realized = 6M - 360K = 5.64M
  assert('M2 agg amount realized = $5.64M', approx(r.aggAmountRealized, 5640000));
  // Aggregate realized gain = 5.64M - 2.4M = 3.24M
  assert('M2 agg realized gain = $3.24M', approx(r.aggRealizedGain, 3240000));
  // Aggregate replacement FMV = 5.6M
  assert('M2 agg replacement FMV = $5.6M', approx(r.aggRepFMV, 5600000));
  // Aggregate replacement mortgage = 3M; equal to relinquished → no mortgage boot
  assert('M2 net mortgage boot = 0', approx(r.netMortgageBoot, 0));
  // Replacement FMV ($5.6M) < relinquished amount realized ($5.64M) — but that
  // doesn't trigger boot directly under §1031 unless there's actual cash received.
  // No cash received in this scenario → no boot.
  assert('M2 total boot = 0 (no cash received)', approx(r.totalBoot, 0));
  // Full deferral of $3.24M
  assert('M2 recognized gain = 0', approx(r.recognizedGain, 0));
  assert('M2 deferred gain = $3.24M', approx(r.deferredGain, 3240000));
  // Aggregate replacement basis = 5.6M - 3.24M = 2.36M
  assert('M2 agg replacement basis = $2.36M', approx(r.aggRepBasis, 2360000));
  // FMV ratios: Prop X = 2M/5.6M ≈ 35.71%, Prop Y = same, Prop Z = 1.6M/5.6M ≈ 28.57%
  assert('M2 Prop X FMV ratio ≈ 35.71%', approx(r.repAllocations[0].fmvRatio, 0.3571, 0.001));
  assert('M2 Prop Z FMV ratio ≈ 28.57%', approx(r.repAllocations[2].fmvRatio, 0.2857, 0.001));
  // Allocated bases sum to aggregate
  const sumBases = r.repAllocations.reduce((s, a) => s + a.allocatedBasis, 0);
  assert('M2 allocated bases sum to aggregate', approx(sumBases, r.aggRepBasis, 1));
  // ID rule satisfied (3 props within 3-property cap)
  assert('M2 ID rule (3-property) satisfied', r.idRuleStatus.satisfied);
}

// =============================================================================
section('computeMultiPropertyExchange — Phase 3: M→N w/ cash boot');
// =============================================================================
// 2 relinquished, 2 replacement. Taxpayer receives $200K cash boot.
{
  const relProps = [
    { label: 'A', relFMV: 1000000, relSellExp: 60000, relBasis: 400000,
      relAccumDep: 100000, rel1245Dep: 25000, relMortgage: 500000 },
    { label: 'B', relFMV: 1500000, relSellExp: 90000, relBasis: 600000,
      relAccumDep: 150000, rel1245Dep: 35000, relMortgage: 750000 }
  ];
  const repProps = [
    { label: 'X', repFMV: 1100000, repMortgage: 600000 },
    { label: 'Y', repFMV: 1100000, repMortgage: 650000 }
  ];
  const profile = {
    cashAdded: 0, cashReceived: 200000,
    marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
    stateRate: 0, stateCode: 'FL', idRule: 'three'
  };
  const r = e.computeMultiPropertyExchange(relProps, repProps, profile);
  // Aggregate realized gain = (1M + 1.5M - 150K) - (400K + 600K) = 2.35M - 1M = 1.35M
  assert('M3 agg realized gain = $1.35M', approx(r.aggRealizedGain, 1350000));
  // Mortgages: 500K + 750K = 1.25M; 600K + 650K = 1.25M → no mortgage boot
  assert('M3 net mortgage boot = 0', approx(r.netMortgageBoot, 0));
  // Cash boot $200K
  assert('M3 net cash boot = $200K', approx(r.netCashBoot, 200000));
  assert('M3 total boot = $200K', approx(r.totalBoot, 200000));
  // Recognized = min(1.35M, 200K) = 200K
  assert('M3 recognized gain = $200K', approx(r.recognizedGain, 200000));
  // Aggregate § 1245 = 25K + 35K = 60K. § 1250 unrec = (250K - 60K) = 190K
  assert('M3 § 1245 recapture = $60K', approx(r.recapture1245, 60000));
  // Remaining 200K - 60K = 140K, all into § 1250 (cap 190K)
  assert('M3 § 1250 recapture = $140K', approx(r.recapture1250, 140000));
  assert('M3 LTCG recognition = 0', approx(r.recogLTCG, 0));
  // Deferred = 1.35M - 200K = 1.15M
  assert('M3 deferred gain = $1.15M', approx(r.deferredGain, 1150000));
}

// =============================================================================
section('computeMultiPropertyExchange — Phase 3: ID rule diagnostics');
// =============================================================================
// 4 replacements with 3-property rule → should fail
{
  const relProps = [{ label: 'A', relFMV: 1000000, relSellExp: 0, relBasis: 500000, relAccumDep: 0, rel1245Dep: 0, relMortgage: 0 }];
  const repProps = [
    { label: 'A', repFMV: 250000, repMortgage: 0 },
    { label: 'B', repFMV: 250000, repMortgage: 0 },
    { label: 'C', repFMV: 250000, repMortgage: 0 },
    { label: 'D', repFMV: 250000, repMortgage: 0 }
  ];
  const profile = { cashAdded: 0, cashReceived: 0, marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038, stateRate: 0, stateCode: 'FL', idRule: 'three' };
  const r = e.computeMultiPropertyExchange(relProps, repProps, profile);
  assert('M4 3-property rule fails with 4 replacements', !r.idRuleStatus.satisfied);
}
// 4 replacements with 200% rule, aggregate $1M ≤ 200% of $1M → satisfied
{
  const relProps = [{ label: 'A', relFMV: 1000000, relSellExp: 0, relBasis: 500000, relAccumDep: 0, rel1245Dep: 0, relMortgage: 0 }];
  const repProps = [
    { label: 'A', repFMV: 250000, repMortgage: 0 },
    { label: 'B', repFMV: 250000, repMortgage: 0 },
    { label: 'C', repFMV: 250000, repMortgage: 0 },
    { label: 'D', repFMV: 250000, repMortgage: 0 }
  ];
  const profile = { cashAdded: 0, cashReceived: 0, marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038, stateRate: 0, stateCode: 'FL', idRule: '200' };
  const r = e.computeMultiPropertyExchange(relProps, repProps, profile);
  assert('M5 200% rule satisfied with 4 reps at 100% aggregate FMV', r.idRuleStatus.satisfied);
  assert('M5 200% ratio computed correctly', approx(r.idRuleStatus.ratio, 1.0, 0.001));
}
// 200% rule exceeded — aggregate replacement FMV > 200% of relinquished
{
  const relProps = [{ label: 'A', relFMV: 1000000, relSellExp: 0, relBasis: 500000, relAccumDep: 0, rel1245Dep: 0, relMortgage: 0 }];
  const repProps = [
    { label: 'A', repFMV: 1500000, repMortgage: 0 },
    { label: 'B', repFMV: 1500000, repMortgage: 0 }
  ];
  const profile = { cashAdded: 0, cashReceived: 0, marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038, stateRate: 0, stateCode: 'FL', idRule: '200' };
  const r = e.computeMultiPropertyExchange(relProps, repProps, profile);
  assert('M6 200% rule fails when reps total 300% of relinquished', !r.idRuleStatus.satisfied);
  assert('M6 200% ratio = 3.0', approx(r.idRuleStatus.ratio, 3.0, 0.001));
}

// =============================================================================
section('computeMultiPropertyExchange — null/edge cases');
// =============================================================================
{
  const profile = { cashAdded: 0, cashReceived: 0, marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038, stateRate: 0, stateCode: 'FL', idRule: 'three' };
  assert('Empty rel props → null', e.computeMultiPropertyExchange([], [{ label: 'A', repFMV: 100000, repMortgage: 0 }], profile) === null);
  assert('Empty rep props → null', e.computeMultiPropertyExchange([{ label: 'A', relFMV: 100000, relSellExp: 0, relBasis: 50000, relAccumDep: 0, rel1245Dep: 0, relMortgage: 0 }], [], profile) === null);
}

// =============================================================================
section('Phase 4 — computeDropSwapHoldingGap classification');
// =============================================================================
{
  // Same-day → critical
  const g1 = e.computeDropSwapHoldingGap('2025-06-01', '2025-06-01', 'drop-swap');
  assert('Same-day gap = critical', g1.classification === 'critical');
  assert('Same-day gap days = 0', g1.gapDays === 0);
  // 7 days → critical
  const g2 = e.computeDropSwapHoldingGap('2025-06-01', '2025-06-08', 'drop-swap');
  assert('7-day gap = critical', g2.classification === 'critical');
  // 90 days → red (under 180)
  const g3 = e.computeDropSwapHoldingGap('2025-01-01', '2025-04-01', 'drop-swap');
  assert('~90-day gap = red', g3.classification === 'red');
  // 365 days → yellow (180 ≤ gap < 730)
  const g4 = e.computeDropSwapHoldingGap('2024-06-01', '2025-06-01', 'drop-swap');
  assert('1-year gap = yellow', g4.classification === 'yellow');
  // 800 days → green
  const g5 = e.computeDropSwapHoldingGap('2023-01-01', '2025-03-12', 'drop-swap');
  assert('>2-year gap = green', g5.classification === 'green');
  // Missing dates → unknown
  const g6 = e.computeDropSwapHoldingGap('', '', 'drop-swap');
  assert('Missing dates → unknown', g6.classification === 'unknown');
  // Swap-drop direction handles the reversed order
  const g7 = e.computeDropSwapHoldingGap('2024-06-01', '2024-01-01', 'swap-drop');
  assert('Swap-drop reversed-order gap classified by absolute days', g7.gapDays > 0 && g7.classification !== 'unknown');
}

// =============================================================================
section('Phase 4 — computeDropSwapCAFTBFlag');
// =============================================================================
{
  const lowRisk = { classification: 'green' };
  const highRisk = { classification: 'red' };
  // Non-CA → not triggered
  const f1 = e.computeDropSwapCAFTBFlag('FL', lowRisk);
  assert('FL property → FTB flag not triggered', !f1.triggered);
  // CA + low risk → triggered, standard severity
  const f2 = e.computeDropSwapCAFTBFlag('CA', lowRisk);
  assert('CA property + low risk → flag triggered, standard severity', f2.triggered && f2.severity === 'standard');
  // CA + red → triggered, elevated severity
  const f3 = e.computeDropSwapCAFTBFlag('CA', highRisk);
  assert('CA property + red risk → flag triggered, elevated severity', f3.triggered && f3.severity === 'elevated');
  // CA + critical → also elevated
  const f4 = e.computeDropSwapCAFTBFlag('CA', { classification: 'critical' });
  assert('CA property + critical risk → flag triggered, elevated severity', f4.triggered && f4.severity === 'elevated');
}

// =============================================================================
section('Phase 4 — dropSwapCaseAuthority');
// =============================================================================
{
  const dropSwap = e.dropSwapCaseAuthority('drop-swap');
  assert('drop-swap direction = drop-then-swap', dropSwap.direction === 'drop-then-swap');
  assert('drop-swap primary = Mason', dropSwap.primary.name === 'Mason v. Commissioner');
  assert('drop-swap corporate analog = Bolker', dropSwap.corporateAnalog.name === 'Bolker v. Commissioner');

  const swapDrop = e.dropSwapCaseAuthority('swap-drop');
  assert('swap-drop direction = swap-then-drop', swapDrop.direction === 'swap-then-drop');
  assert('swap-drop primary = Magneson', swapDrop.primary.name === 'Magneson v. Commissioner');
  assert('swap-drop corporate analog = Maloney (corrected from handoff)', swapDrop.corporateAnalog.name === 'Maloney v. Commissioner');
}

// =============================================================================
section('Phase 4 — computeDropSwap: 3 equal partners, all electing § 1031, full deferral');
// =============================================================================
// Three equal 1/3 partners. Property FMV $3M, basis $1.5M (each partner outside
// basis $500K). Equal mortgages, no cash. All elect § 1031. Each partner runs
// computeExchange on $1M allocated FMV vs $500K outside basis; equal mortgage
// → no boot → full deferral; no recognized gain; no tax now.
{
  const inputs = {
    variant: 'drop-swap',
    property: {
      fmv: 3000000, sellExp: 180000, insideBasis: 1500000,
      accumDep: 600000, sec1245Dep: 100000, mortgage: 1500000,
      stateCode: 'FL'
    },
    replacement: { fmv: 3000000, mortgage: 1500000 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2024-06-01', exchangeDate: '2025-08-01',
    partners: [
      { name: 'A', ownershipPct: 1/3, outsideBasis: 500000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' },
      { name: 'B', ownershipPct: 1/3, outsideBasis: 500000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' },
      { name: 'C', ownershipPct: 1/3, outsideBasis: 500000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' }
    ]
  };
  const r = e.computeDropSwap(inputs);
  assert('DS1 returns 3 partner results', r.partners.length === 3);
  assert('DS1 all three elect § 1031', r.aggregates.countElecting === 3 && r.aggregates.countCashOut === 0);
  assert('DS1 ownership sums to 1.0', approx(r.ownershipSum, 1.0, 0.001));
  assert('DS1 no ownership warning', r.ownershipWarning === null);
  // Per partner: allocated FMV = 1M - 60K (sell exp share) realized... amount realized = (3M-180K)/3 = 940K, basis 500K → realized gain 440K
  assert('DS1 per-partner realized gain ≈ $440K', approx(r.partners[0].realizedGain, 440000, 1));
  // No boot → full deferral
  assert('DS1 per-partner recognized gain = 0', approx(r.partners[0].recognizedGain, 0));
  assert('DS1 per-partner deferred gain ≈ $440K', approx(r.partners[0].deferredGain, 440000, 1));
  // No federal or state tax now
  assert('DS1 total federal tax now = 0', approx(r.aggregates.totalFederalTax, 0));
  assert('DS1 total state tax now = 0', approx(r.aggregates.totalStateTax, 0));
  // Holding period: ~14 months → yellow
  assert('DS1 holding-period gap = yellow', r.holdingPeriod.classification === 'yellow');
  // Not CA → FTB flag not triggered
  assert('DS1 CA FTB flag not triggered (FL)', !r.caFTBFlag.triggered);
  // Variant routing
  assert('DS1 case authority primary = Mason (drop-swap)', r.caseAuthority.primary.name === 'Mason v. Commissioner');
}

// =============================================================================
section('Phase 4 — computeDropSwap: mixed 2-elect + 1-cashout');
// =============================================================================
// Same partnership shape. Two partners elect § 1031 (full deferral on their
// share); one partner cashes out and recognizes their allocated realized gain
// immediately. State = FL → no state tax for any partner.
{
  const inputs = {
    variant: 'drop-swap',
    property: {
      fmv: 3000000, sellExp: 180000, insideBasis: 1500000,
      accumDep: 600000, sec1245Dep: 100000, mortgage: 1500000,
      stateCode: 'FL'
    },
    replacement: { fmv: 3000000, mortgage: 1500000 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2024-06-01', exchangeDate: '2025-08-01',
    partners: [
      { name: 'A', ownershipPct: 1/3, outsideBasis: 500000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' },
      { name: 'B', ownershipPct: 1/3, outsideBasis: 500000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' },
      { name: 'C', ownershipPct: 1/3, outsideBasis: 500000, elects1031: false,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' }
    ]
  };
  const r = e.computeDropSwap(inputs);
  assert('DS2 count electing = 2', r.aggregates.countElecting === 2);
  assert('DS2 count cash-out = 1', r.aggregates.countCashOut === 1);
  // Partner A (electing): recognized = 0, deferred ≈ 440K
  assert('DS2 partner A recognized = 0', approx(r.partners[0].recognizedGain, 0));
  // Partner C (cash-out): recognized = 440K
  assert('DS2 partner C recognized ≈ $440K', approx(r.partners[2].recognizedGain, 440000, 1));
  // Recapture stacking for cash-out partner C:
  // Allocated § 1245 = 100K/3 ≈ 33,333; allocated total dep = 600K/3 = 200K;
  // allocated § 1250 pool = 200K - 33,333 ≈ 166,667.
  // Recognized 440K → § 1245 = 33,333; § 1250 = 166,667; LTCG = 440K - 200K = 240K.
  assert('DS2 partner C § 1245 recapture ≈ $33,333', approx(r.partners[2].recapture1245, 33333, 1));
  assert('DS2 partner C § 1250 recapture ≈ $166,667', approx(r.partners[2].recapture1250, 166667, 1));
  assert('DS2 partner C LTCG portion = $240K', approx(r.partners[2].recogLTCG, 240000, 1));
  // Aggregate recognized gain ≈ 440K (only partner C's share)
  assert('DS2 aggregate recognized gain ≈ $440K', approx(r.aggregates.totalRecognizedGain, 440000, 1));
  // Aggregate deferred gain ≈ 880K (partners A and B)
  assert('DS2 aggregate deferred gain ≈ $880K', approx(r.aggregates.totalDeferredGain, 880000, 1));
}

// =============================================================================
section('Phase 4 — computeDropSwap: swap-and-drop variant');
// =============================================================================
{
  const inputs = {
    variant: 'swap-drop',
    property: {
      fmv: 2000000, sellExp: 120000, insideBasis: 800000,
      accumDep: 300000, sec1245Dep: 50000, mortgage: 1000000,
      stateCode: 'FL'
    },
    replacement: { fmv: 2000000, mortgage: 1000000 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2025-09-15', exchangeDate: '2025-09-01', // distribution 14 days after exchange
    partners: [
      { name: 'A', ownershipPct: 0.5, outsideBasis: 400000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' },
      { name: 'B', ownershipPct: 0.5, outsideBasis: 400000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' }
    ]
  };
  const r = e.computeDropSwap(inputs);
  assert('SD1 variant = swap-drop', r.variant === 'swap-drop');
  assert('SD1 case authority primary = Magneson', r.caseAuthority.primary.name === 'Magneson v. Commissioner');
  assert('SD1 case authority corporate analog = Maloney', r.caseAuthority.corporateAnalog.name === 'Maloney v. Commissioner');
  // 14-day gap → critical
  assert('SD1 14-day gap → critical', r.holdingPeriod.classification === 'critical');
}

// =============================================================================
section('Phase 4 — computeDropSwap: CA FTB flag triggered');
// =============================================================================
{
  const inputs = {
    variant: 'drop-swap',
    property: {
      fmv: 3000000, sellExp: 180000, insideBasis: 1500000,
      accumDep: 600000, sec1245Dep: 100000, mortgage: 1500000,
      stateCode: 'CA'
    },
    replacement: { fmv: 3000000, mortgage: 1500000 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2025-05-01', exchangeDate: '2025-06-01', // 31 days
    partners: [
      { name: 'A', ownershipPct: 1.0, outsideBasis: 500000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0.123, stateCode: 'CA' }
    ]
  };
  const r = e.computeDropSwap(inputs);
  assert('CA1 FTB flag triggered (CA property)', r.caFTBFlag.triggered);
  // 31 days → red → elevated FTB severity
  assert('CA1 holding-period 31 days = red', r.holdingPeriod.classification === 'red');
  assert('CA1 FTB severity = elevated', r.caFTBFlag.severity === 'elevated');
}

// =============================================================================
section('Phase 4 — computeDropSwap: edge cases');
// =============================================================================
{
  // Empty partners → null
  const empty = e.computeDropSwap({
    variant: 'drop-swap',
    property: { fmv: 100000, sellExp: 0, insideBasis: 50000, accumDep: 0, sec1245Dep: 0, mortgage: 0, stateCode: 'FL' },
    replacement: { fmv: 100000, mortgage: 0 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2025-01-01', exchangeDate: '2025-06-01',
    partners: []
  });
  assert('Empty partners → null', empty === null);

  // Mismatched ownership (sums to 90%) → ownershipWarning fires
  const mismatch = e.computeDropSwap({
    variant: 'drop-swap',
    property: { fmv: 1000000, sellExp: 0, insideBasis: 500000, accumDep: 0, sec1245Dep: 0, mortgage: 0, stateCode: 'FL' },
    replacement: { fmv: 1000000, mortgage: 0 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2024-01-01', exchangeDate: '2025-01-01',
    partners: [
      { name: 'A', ownershipPct: 0.45, outsideBasis: 250000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' },
      { name: 'B', ownershipPct: 0.45, outsideBasis: 250000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' }
    ]
  });
  assert('Mismatched ownership → warning fires', mismatch.ownershipWarning !== null);

  // Single partner with 100% ownership behaves like a sole-owner exchange
  const single = e.computeDropSwap({
    variant: 'drop-swap',
    property: { fmv: 1000000, sellExp: 60000, insideBasis: 400000, accumDep: 0, sec1245Dep: 0, mortgage: 500000, stateCode: 'FL' },
    replacement: { fmv: 1000000, mortgage: 500000 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2023-01-01', exchangeDate: '2025-01-01',
    partners: [
      { name: 'Sole', ownershipPct: 1.0, outsideBasis: 400000, elects1031: true,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' }
    ]
  });
  assert('Single partner returns 1 result', single.partners.length === 1);
  assert('Single partner ownership warning = null', single.ownershipWarning === null);
  // Amount realized = 1M - 60K = 940K; basis 400K → realized gain 540K; no boot → recognized 0, deferred 540K
  assert('Single partner realized gain = $540K', approx(single.partners[0].realizedGain, 540000));
  assert('Single partner deferred gain = $540K', approx(single.partners[0].deferredGain, 540000));

  // Loss scenario: basis exceeds amount realized → realized gain negative, recognized = 0
  const loss = e.computeDropSwap({
    variant: 'drop-swap',
    property: { fmv: 500000, sellExp: 30000, insideBasis: 800000, accumDep: 0, sec1245Dep: 0, mortgage: 0, stateCode: 'FL' },
    replacement: { fmv: 500000, mortgage: 0 },
    cashAdded: 0, cashReceived: 0,
    distributionDate: '2024-01-01', exchangeDate: '2025-01-01',
    partners: [
      { name: 'Cashout', ownershipPct: 1.0, outsideBasis: 800000, elects1031: false,
        marginalRate: 0.37, ltcgRate: 0.20, unrec1250Rate: 0.25, niitRate: 0.038,
        stateRate: 0, stateCode: 'FL' }
    ]
  });
  assert('Loss: realized gain negative', loss.partners[0].realizedGain < 0);
  assert('Loss: recognized gain floored at 0', approx(loss.partners[0].recognizedGain, 0));
  assert('Loss: no federal tax', approx(loss.partners[0].federalTax, 0));
}

// =============================================================================
section('Phase 4 — Tier × mode access (drop-swap is Reserve-only)');
// =============================================================================
// Confirm the existing MODE_REQUIRES table still has drop-swap pinned to reserve
// after the Phase 4 implementation activates the mode.
{
  assert('MODE_REQUIRES drop-swap = reserve', e.MODE_REQUIRES['drop-swap'] === 'reserve');
  assert('modeRequiresTier(drop-swap) = reserve', e.modeRequiresTier('drop-swap') === 'reserve');
}

// =============================================================================
console.log('\n' + '='.repeat(50));
console.log(`Total: ${pass + fail}  Pass: ${pass}  Fail: ${fail}`);
console.log('='.repeat(50));
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  • ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  process.exit(1);
}
process.exit(0);
