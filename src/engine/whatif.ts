// "What-if climate" stress test: a simple delta-change perturbation of the NASA POWER daily record.
// Precipitation is scaled, ΔT is added to T2M / T2M_MAX / T2M_MIN, and everything downstream (ET₀ via
// FAO-56 Penman–Monteith with relative humidity held constant, sowing detection, the FAO-56 water
// balance and the FAO-33/66 Ky yield response) is recomputed by the unchanged replay pipeline.
// This is a sensitivity test on the historical record — not a climate projection.
import type { DailySeries, FarmScenario, RegionPack, SoilProfile } from '../domain/types';
import { runEngine, type EngineOutput, type PlanResult } from './plan';

export interface WhatIf { rainScale: number; dT: number }

export const WHATIF_NONE: WhatIf = { rainScale: 1, dT: 0 };
export const WHATIF_LIMITS = { rain: { min: 0.7, max: 1.2, step: 0.05 }, dT: { min: 0, max: 3, step: 0.5 } } as const;
export const WHATIF_PRESETS: { id: string; label: string; w: WhatIf }[] = [
  { id: 'drier-hotter', label: 'Drier & hotter: −15%, +2 °C', w: { rainScale: 0.85, dT: 2 } },
  { id: 'reset', label: 'Reset to NASA record', w: WHATIF_NONE },
];

const snap = (x: number, step: number) => Math.round(x / step) * step;
/** Clamp and snap to the slider grid; anything non-finite falls back to the NASA record. */
export function normalizeWhatIf(w: Partial<WhatIf> | null | undefined): WhatIf {
  const r = Number(w?.rainScale ?? 1), t = Number(w?.dT ?? 0);
  const L = WHATIF_LIMITS;
  return {
    rainScale: Number.isFinite(r) ? +Math.min(L.rain.max, Math.max(L.rain.min, snap(r, L.rain.step))).toFixed(2) : 1,
    dT: Number.isFinite(t) ? +Math.min(L.dT.max, Math.max(L.dT.min, snap(t, L.dT.step))).toFixed(1) : 0,
  };
}
export const isIdentity = (w: WhatIf) => w.rainScale === 1 && w.dT === 0;

/**
 * Perturbed copy of a NASA POWER daily series (pure; the input is never mutated). Missing values stay
 * missing. A new object is always returned, so the memoized ET₀ (keyed by series identity) is recomputed
 * from the shifted temperatures.
 */
export function perturbSeries(s: DailySeries, w: WhatIf): DailySeries {
  const { rainScale, dT } = w;
  const scale = (a: (number | null)[]) => (rainScale === 1 ? a.slice() : a.map((v) => (v == null ? v : v * rainScale)));
  const shift = (a: (number | null)[]) => (dT === 0 ? a.slice() : a.map((v) => (v == null ? v : v + dT)));
  return {
    ...s,
    meta: { ...s.meta, label: isIdentity(w) ? s.meta.label : `${s.meta.label} · what-if ${Math.round((rainScale - 1) * 100)}% rain, +${dT} °C` },
    P: scale(s.P), T: shift(s.T), TX: shift(s.TX), TN: shift(s.TN),
  };
}

export interface PlanStress {
  id: string; label: string; isBaseline: boolean; crops: [string, string];
  pairs: [number, number];
  severe: [number, number];          // share of replayed season pairs with severe water stress: record → what-if
  medianRel: [number, number];       // median water-limited yield (share of attainable) across season pairs
  harvestChange: number | null;      // relative change of the modeled median harvest (what-if vs record)
}

export interface WhatIfResult { w: WhatIf; plans: PlanStress[]; ms: number; seasons: number }

/**
 * The same engine, narrowed to the crops the given plans need (plus the farm's history crops, so the
 * baseline and rotation rules resolve exactly as before). Only those crops are replayed, which keeps a
 * what-if re-run to a few tens of milliseconds. Plan identities do not depend on the weather, so the
 * comparison with the full run is like for like (tests/whatif.test.ts checks the identity case).
 */
export function replayPlans(sc: FarmScenario, s: DailySeries, soil: SoilProfile, pack: RegionPack, plans: { crops: [string, string] }[], baseline: [string, string]): Map<string, PlanResult> {
  const keep = new Set<string>([...plans.flatMap((p) => p.crops), ...baseline, ...sc.history.map((h) => h.cropId)]);
  if (pack.crops.includes('fallow')) keep.add('fallow');
  const narrow: RegionPack = {
    ...pack,
    crops: pack.crops.filter((c) => keep.has(c)),
    seasons: pack.seasons.map((sd) => ({ ...sd, crops: sd.crops.filter((c) => keep.has(c)) })),
  };
  const out = runEngine({ ...sc, baselineOverride: baseline }, s, soil, narrow);
  return new Map([out.baseline, ...out.allPlans].map((p) => [p.id, p] as const));
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Stress-test the plans the Compare page shows (baseline + up to two options) under a what-if climate. */
export function stressTest(sc: FarmScenario, s: DailySeries, soil: SoilProfile, pack: RegionPack, base: EngineOutput, w: WhatIf): WhatIfResult {
  const t0 = now();
  const shown = [base.baseline, ...base.alternatives];
  const alt = isIdentity(w) ? null : replayPlans(sc, perturbSeries(s, w), soil, pack, shown, base.baseline.crops);
  const plans = shown.map((p): PlanStress => {
    const q = alt?.get(p.id) ?? p;
    const a = p.outcome, b = q.outcome;
    const harvestChange = Number.isFinite(a.medianRel) && Number.isFinite(b.medianRel) && a.medianRel > 0 ? b.medianRel / a.medianRel - 1 : null;
    return { id: p.id, label: p.label, isBaseline: p.isBaseline, crops: p.crops, pairs: [a.pairs, b.pairs], severe: [a.pSevereAny, b.pSevereAny], medianRel: [a.medianRel, b.medianRel], harvestChange };
  });
  return { w, plans, ms: now() - t0, seasons: Object.values(base.risks)[0]?.years.length ?? 0 };
}

const fin = (x: number) => (Number.isFinite(x) ? x : 0);
const pctS = (x: number) => `${Math.round(fin(x) * 100)}%`;
/** Robust = severe-stress risk stays low (< 20% of season pairs) and rises by at most 5 points. */
export const isRobust = (p: PlanStress) => fin(p.severe[1]) < 0.2 && fin(p.severe[1]) - fin(p.severe[0]) <= 0.05;
const nameOf = (p: PlanStress) => (p.isBaseline ? 'your usual plan' : p.label);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Plain-language headline that only states what the replay actually shows. */
export function stressHeadline(r: WhatIfResult): string | null {
  if (isIdentity(r.w) || !r.plans.length) return null;
  const cond = describeWhatIf(r.w);
  const base = r.plans.find((p) => p.isBaseline);
  const alts = r.plans.filter((p) => !p.isBaseline);
  const robust = r.plans.filter(isRobust), fragile = r.plans.filter((p) => !isRobust(p));
  const move = (p: PlanStress) => `${pctS(p.severe[0])} → ${pctS(p.severe[1])}`;
  const bestAlt = [...alts].sort((a, b) => fin(a.severe[1]) - fin(b.severe[1]) || fin(b.medianRel[1]) - fin(a.medianRel[1]))[0];
  if (base && !isRobust(base) && bestAlt && isRobust(bestAlt)) {
    return `${bestAlt.label} stays robust when it is ${cond} (severe stress ${move(bestAlt)}); your usual plan doesn’t (${move(base)}).`;
  }
  if (!fragile.length) {
    const drops = r.plans.map((p) => p.harvestChange).filter((x): x is number => x != null);
    const worst = drops.length ? Math.min(...drops) : 0;
    return `All ${r.plans.length === 3 ? 'three ' : ''}plans stay robust when it is ${cond}${worst < -0.005 ? `; median harvest falls by up to ${Math.round(-worst * 100)}%` : ''}.`;
  }
  if (robust.length) {
    return `${cap(list(robust.map(nameOf)))} ${robust.length > 1 ? 'stay' : 'stays'} robust when it is ${cond}; severe stress for ${list(fragile.map((p) => `${nameOf(p)} goes ${move(p)}`))}.`;
  }
  if (base && bestAlt && fin(bestAlt.severe[1]) + 0.05 < fin(base.severe[1])) {
    return `No plan stays robust when it is ${cond}, but ${bestAlt.label} keeps severe stress far lower than your usual plan (${pctS(bestAlt.severe[1])} vs ${pctS(base.severe[1])}).`;
  }
  if (base && bestAlt && fin(base.severe[1]) + 0.05 < fin(bestAlt.severe[1])) {
    return `No plan stays robust when it is ${cond}; your usual plan holds up best (${pctS(base.severe[1])} severe stress).`;
  }
  return `No plan stays robust when it is ${cond}: severe-stress risk is high for every option.`;
}

export function describeWhatIf(w: WhatIf): string {
  const r = Math.round((w.rainScale - 1) * 100);
  const parts: string[] = [];
  if (r !== 0) parts.push(`${Math.abs(r)}% ${r < 0 ? 'drier' : 'wetter'}`);
  if (w.dT !== 0) parts.push(`${w.dT.toFixed(1).replace(/\.0$/, '')} °C hotter`);
  return parts.length ? parts.join(' and ') : 'as in the NASA record';
}
