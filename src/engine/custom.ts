// "Try my own plan" and "Near misses": the farmer's own rotation, and the rotations that just missed, evaluated
// through the very same buildPlan() as the ranked plans (costing, rule checks, NASA replay, budget verdict).
// Nothing here re-implements a check; suggested changes are only shown after the engine re-runs with them applied.
import type { DailySeries, FarmScenario, Reason, RegionPack, SoilProfile } from '../domain/types';
import type { BudgetResult } from './budget';
import { buildPlan, engineContext, rankComparator, type EngineContext, type EngineOutput, type PlanResult } from './plan';
import { perturbSeries, type PlanStress, type WhatIf } from './whatif';
import { CROPS, cropName } from '../data/crops';
import { faostatReady } from '../data/countries';

export interface EngineInputs { sc: FarmScenario; series: DailySeries; soil: SoilProfile; pack: RegionPack }

// one context per (series, scenario, soil, pack): replays are cached inside it, so re-picking a crop is instant
const ctxCache = new WeakMap<DailySeries, { sc: FarmScenario; soil: SoilProfile; pack: RegionPack; fao: boolean; ctx: EngineContext }[]>();
function contextFor(i: EngineInputs): EngineContext {
  let list = ctxCache.get(i.series);
  if (!list) { list = []; ctxCache.set(i.series, list); }
  const fao = faostatReady(); // sale prices change once the lazily loaded FAOSTAT table arrives
  const hit = list.find((e) => e.sc === i.sc && e.soil === i.soil && e.pack === i.pack && e.fao === fao);
  if (hit) return hit.ctx;
  const ctx = engineContext(i.sc, i.series, i.soil, i.pack, { customFallow: true });
  list.push({ sc: i.sc, soil: i.soil, pack: i.pack, fao, ctx });
  if (list.length > 4) list.shift();
  return ctx;
}

/** Evaluate any two-season rotation exactly as the ranked plans are evaluated. */
export function evaluateRotation(inputs: EngineInputs, crops: [string, string]): PlanResult {
  for (const c of crops) if (!CROPS[c]) throw new Error(`Unknown crop "${c}"`);
  return { ...buildPlan(contextFor(inputs), crops, false), label: 'Your plan' };
}

/** Same plan with some scenario inputs changed (e.g. a larger budget); the cached replays are reused. */
function evaluateWith(inputs: EngineInputs, crops: [string, string], patch: Partial<FarmScenario>): PlanResult {
  const ctx = contextFor(inputs);
  return buildPlan({ ...ctx, sc: { ...ctx.sc, ...patch } }, crops, false);
}

const perturbed = new WeakMap<DailySeries, Map<string, DailySeries>>();
function perturbOnce(s: DailySeries, w: WhatIf): DailySeries {
  let m = perturbed.get(s);
  if (!m) { m = new Map(); perturbed.set(s, m); }
  const k = `${w.rainScale}|${w.dT}`;
  let p = m.get(k);
  if (!p) { p = perturbSeries(s, w); m.set(k, p); }
  return p;
}

/** The what-if stress result for one rotation, in the same shape the Compare cards use. */
export function stressRotation(inputs: EngineInputs, crops: [string, string], w: WhatIf): PlanStress {
  const p = evaluateRotation(inputs, crops);
  const q = evaluateRotation({ ...inputs, series: perturbOnce(inputs.series, w) }, crops);
  const a = p.outcome, b = q.outcome;
  const harvestChange = Number.isFinite(a.medianRel) && Number.isFinite(b.medianRel) && a.medianRel > 0 ? b.medianRel / a.medianRel - 1 : null;
  return { id: p.id, label: p.label, isBaseline: false, crops, pairs: [a.pairs, b.pairs], severe: [a.pSevereAny, b.pSevereAny], medianRel: [a.medianRel, b.medianRel], harvestChange };
}

// ---------- near misses ----------

/**
 * Smallest extra cash (scenario currency, rounded up to a whole unit) that makes both the season total and every
 * dated cash-timing step fit. Extra funds raise the cash available on every date by the same amount, so the
 * answer is the largest gap: total shortfall (−headroom) or the worst cumulative outflow above cash available.
 * 0 when the budget already fits; null when it cannot be verified (missing prices).
 */
export function budgetShortfall(b: BudgetResult): number | null {
  if (b.status === 'unverified') return null;
  const gaps = [-b.headroom, ...b.cumulative.map((c) => c.outflow - c.available)];
  const gap = Math.max(0, ...gaps);
  // amounts are exact to the cent; round to cents first so float noise never adds a unit
  return Math.ceil(Math.round(gap * 100) / 100);
}

export type FixKind = 'budget' | 'seed' | 'market';
export interface NearMiss {
  plan: PlanResult;
  blocks: Reason[];            // the blocking reasons as the engine states them
  change: string | null;       // the smallest change, verified by re-running the engine; null = none the engine can verify
  fixes: { kind: FixKind; text: string }[];
  shortfall: number | null;    // extra budget needed (only when budget is among the blocks)
}

const FIXABLE = new Set(['BUDGET_EXCEEDED', 'CASH_TIMING', 'SEED_UNAVAILABLE', 'MARKET_CONSTRAINT']);
// rotation rules the farmer cannot change; such plans are not "near"
const RULE_BLOCKS = new Set(['MONOCULTURE', 'RETURN_INTERVAL', 'DISEASE_GROUP']);
const fmtCur = (x: number, cur: string) => `${Math.round(x).toLocaleString('en-US')} ${cur}`;

/** Work out and verify the smallest change that makes a rejected plan feasible. */
export function smallestChange(inputs: EngineInputs, p: PlanResult): Pick<NearMiss, 'change' | 'fixes' | 'shortfall'> {
  const { sc } = inputs;
  const blocks = p.reasons.filter((r) => r.severity === 'block');
  const codes = new Set(blocks.map((r) => r.code));
  const planned = p.crops.filter((c) => c !== 'fallow');
  const fixes: NearMiss['fixes'] = [];
  const patch: Partial<FarmScenario> = {};
  let shortfall: number | null = null;
  if (![...codes].every((c) => FIXABLE.has(c))) {
    // a replay, calendar or rotation block: no input change the engine could verify
    if (codes.has('BUDGET_EXCEEDED') || codes.has('CASH_TIMING')) shortfall = budgetShortfall(p.budget);
    return { change: null, fixes, shortfall };
  }
  if (codes.has('SEED_UNAVAILABLE')) {
    const crops = planned.filter((c) => sc.unavailableCrops.includes(c));
    patch.unavailableCrops = sc.unavailableCrops.filter((c) => !crops.includes(c));
    fixes.push({ kind: 'seed', text: `allow ${crops.map(cropName).join(' and ')} in Budget & crops` });
  }
  if (codes.has('MARKET_CONSTRAINT')) {
    const crops = planned.filter((c) => !sc.marketCrops.includes(c));
    patch.marketCrops = [...sc.marketCrops, ...crops];
    fixes.push({ kind: 'market', text: `allow ${crops.map(cropName).join(' and ')} in Budget & crops` });
  }
  // budget last: the other fixes do not change costs, but verify the cash gap on the patched scenario
  let q = Object.keys(patch).length ? evaluateWith(inputs, p.crops, patch) : p;
  if (q.budget.status === 'unaffordable' || q.budget.status === 'timing') {
    shortfall = budgetShortfall(q.budget);
    if (shortfall == null || shortfall <= 0) return { change: null, fixes: [], shortfall };
    patch.availableFunds = sc.availableFunds + shortfall;
    fixes.unshift({ kind: 'budget', text: `+${fmtCur(shortfall, sc.currency)} budget` });
    q = evaluateWith(inputs, p.crops, patch);
  }
  if (!q.feasible) return { change: null, fixes: [], shortfall };
  return { change: fixes.map((f) => f.text).join(' and '), fixes, shortfall };
}

/**
 * The next few rejected rotations, each with its blocking reasons and the smallest verified change that would make
 * it work. Plans fixable by an input change come first (in the farmer's ranking order), then plans blocked only by
 * the NASA replay or the crop calendar (reason only). Rotation-rule blocks (monoculture, return interval, shared
 * disease) are never "near". Crop sets already offered as a ranked option are skipped.
 */
export function nearMisses(inputs: EngineInputs, out: EngineOutput, n = 3): NearMiss[] {
  const offered = new Set(out.alternatives.map((p) => [...p.crops].sort().join('+')));
  const candidates = out.excluded
    .filter((p) => !p.isBaseline)
    .filter((p) => !p.reasons.some((r) => r.severity === 'block' && RULE_BLOCKS.has(r.code)));
  const pool = [...candidates].sort(rankComparator(inputs.sc.weights));
  const fixable: NearMiss[] = [], reasonOnly: NearMiss[] = [];
  const seen = new Set(offered);
  for (const p of pool) {
    const set = [...p.crops].sort().join('+');
    if (seen.has(set)) continue;
    const blocks = p.reasons.filter((r) => r.severity === 'block');
    const fix = smallestChange(inputs, p);
    const m: NearMiss = { plan: p, blocks, ...fix };
    if (fix.change) { fixable.push(m); seen.add(set); } else if (reasonOnly.length < n) { reasonOnly.push(m); seen.add(set); }
    if (fixable.length >= n) break;
  }
  return [...fixable, ...reasonOnly].slice(0, n);
}

/** Short, plain statement of a blocking reason without the "Season 1 (Crop):" prefix. */
export function blockText(r: Reason): string {
  return r.text.replace(/^Season \d \(([^)]+)\): /, '$1: ');
}
