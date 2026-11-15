// Orchestrator: normalize → indicators → candidates → rules → costs → feasibility → rank → explain.
// Pure and deterministic: identical inputs always give identical results (no LLM in this path).
import type { BudgetPlaceholder, CostItemDef, CropDef, DailySeries, FarmScenario, Reason, RegionPack, SoilProfile } from '../domain/types';
import { CROPS, cropFor, cropName } from '../data/crops';
import { IRRIGATION_USD_PER_MM_HA } from '../data/regionPacks';
import { countryInfo, cropPriceUsd, fxFactor, fxPerUsd, PRICE_PLAUSIBLE_FACTOR } from '../data/countries';
import { toHectares } from '../domain/units';
import { addDays, diffDays } from '../domain/dates';
import { completeYears, median, quantile } from '../weather/indicators';
import { evaluateBudget, costLine, placeholderBudget, PLACEHOLDER_SPEND_SHARE, type BudgetResult, type CostLine } from './budget';
import { isSevere, replayCrop, resolveSeasons, type CropRisk, type SowingWindow } from './replay';

export interface PlanSeason { season: 1 | 2; year: number; cropId: string; sowing: string; maturity: string; risk: CropRisk | null; seasonId: string; seasonLabel: string }

export interface PlanOutcome {
  pairs: number;               // coherent historical season pairs replayed
  medianRel: number; pSevereAny: number;
  revenue: { p20: number; median: number; p80: number } | null;
  net: { p20: number; median: number; p80: number } | null;
  yields: [{ p20: number; median: number; p80: number } | null, { p20: number; median: number; p80: number } | null];
}

export interface PlanResult {
  id: string; label: string; isBaseline: boolean;
  crops: [string, string];
  seasons: [PlanSeason, PlanSeason];
  reasons: Reason[];
  eligible: boolean;           // passes hard rules and climate screening
  feasible: boolean;           // eligible and not unaffordable
  budget: BudgetResult;
  outcome: PlanOutcome;
  newCrops: number;            // crops not present in farmer history (continuity)
  rank?: number;
}

export interface PriceInfo {
  perT: number | null; label: string; source: 'farmer' | 'faostat-country' | 'faostat-median' | 'pack';
  replaced?: { usdPerT: number; year: number }; // implausible FAOSTAT country price that was not used
}

export interface EngineOutput {
  pack: RegionPack; window: SowingWindow; windows: SowingWindow[]; areaHa: number;
  risks: Record<string, CropRisk>;          // key: crop id (annual) or `${seasonId}:${crop}` (double)
  risksAfterFallow: Record<string, CropRisk>;
  prices: Record<string, PriceInfo>;        // farm-gate sale price per crop, scenario currency per tonne
  fx: { factor: number; from: string; to: string; year?: number };
  baseline: PlanResult;
  alternatives: PlanResult[];  // up to two ranked feasible alternatives
  allPlans: PlanResult[];
  excluded: PlanResult[];
  notes: Reason[];
  /** Every crop considered at this location with its NASA screen verdict ("Why these crops here?"). */
  screen: LocationScreen;
}

/** Screen verdict for one crop in one season window. */
export interface CropScreen {
  cropId: string; seasonId: string; seasonLabel: string;
  ok: boolean;                 // no blocking screen item: the crop may appear in plans
  items: ScreenItem[];         // the findings behind the verdict (cropScreenItems)
  line: string;                // one-line NASA-based summary, e.g. "matures before frost in 23/25 years; water-limited yield 71%"
  refs: string[];
}
export interface LocationScreen {
  crops: CropScreen[];
  /** True when crops failing the screen are removed from the candidate list (global-screening pack). */
  filtered: boolean;
}

/** The fallback pack screens a generic crop library; only crops that pass the NASA screen become candidates. */
export const GLOBAL_PACK_ID = 'global-screening';

const LABOR_RANK = { low: 0, medium: 1, high: 2 } as const;
const HARD_DISEASE = new Set(['sclerotinia', 'fusarium-flax', 'groundnut-pests', 'solanaceae', 'pulse-root-rot', 'bean-root-rot', 'fusarium-pulse', 'cotton-wilt']);

/** Season window for a crop in a slot: fixed per slot in double-season packs, the crop's own season otherwise. */
export function windowFor(pack: RegionPack, windows: SowingWindow[], slot: 0 | 1, cropId: string): SowingWindow {
  if (pack.mode === 'double') return windows[slot] ?? windows[0];
  return windows.find((w) => w.crops.includes(cropId)) ?? windows[0];
}
export const riskKey = (pack: RegionPack, w: SowingWindow, cropId: string) => (pack.mode === 'double' ? `${w.id}:${cropId}` : cropId);

function historyOrder(sc: FarmScenario, pack: RegionPack) {
  const idx = (h: FarmScenario['history'][number]) => {
    const i = pack.seasons.findIndex((s) => s.id === h.seasonId);
    if (i >= 0) return i;
    const j = pack.seasons.findIndex((s) => s.crops.includes(h.cropId));
    return j >= 0 ? j : 0;
  };
  return [...sc.history].filter((h) => CROPS[h.cropId]).sort((a, b) => a.year - b.year || idx(a) - idx(b));
}

export function baselineCrops(sc: FarmScenario, pack: RegionPack): [string, string] {
  if (sc.baselineOverride) return sc.baselineOverride;
  const hist = historyOrder(sc, pack);
  // No history entered: assume the region's typical sequence when the pack documents one.
  if (!hist.length && pack.usualRotation && pack.usualRotation.every((c) => pack.crops.includes(c))) return pack.usualRotation;
  if (pack.mode === 'double') {
    const pick = (slot: number) => {
      const allowed = pack.seasons[slot]?.crops ?? pack.crops;
      const last = [...hist].reverse().find((h) => (h.seasonId ? h.seasonId === pack.seasons[slot]?.id : allowed.includes(h.cropId)) && allowed.includes(h.cropId));
      return last?.cropId ?? allowed.find((c) => c !== 'fallow') ?? allowed[0];
    };
    return [pick(0), pick(1)];
  }
  const h = hist.map((x) => x.cropId).filter((c) => pack.crops.includes(c));
  if (h.length >= 2 && h[h.length - 1] !== h[h.length - 2]) return [h[h.length - 2], h[h.length - 1]];
  if (h.length >= 1) return [h[h.length - 1], h[h.length - 1]];
  const first = pack.crops.find((c) => c !== 'fallow') ?? pack.crops[0];
  return [first, first];
}

const GROUP_NOUN: Record<string, string> = { cereal: 'a cereal', legume: 'a legume', oilseed: 'an oilseed', tuber: 'a tuber crop', cover: 'a cover crop' };

/** One location-screen finding: the full reason (without the season tag) and a short phrase for one-line summaries. */
export interface ScreenItem { reason: Reason; short: string }
const pc = (x: number) => `${(x * 100).toFixed(0)}%`;
const mmddLabel = (md: string | null) => (md ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(md.slice(0, 2)) - 1]} ${Number(md.slice(3))}` : '—');

/**
 * Crop-level screening at this location, independent of the rotation: irrigation requirement, the NASA replay
 * (season-mean temperature, water-limited yield, water stress, heat and frost exposure), the growing-season length
 * (SEASON_TOO_SHORT, src/engine/season.ts) and soil pH. ruleCheck tags these per season; screenCrops lists them
 * per crop. A crop "passes the screen" when none of its items blocks.
 */
export function cropScreenItems(c: CropDef, r: CropRisk | null, soil: SoilProfile, sc: Pick<FarmScenario, 'irrigation'>): ScreenItem[] {
  const out: ScreenItem[] = [];
  if (c.id === 'fallow') return out;
  const add = (code: Reason['code'], severity: Reason['severity'], text: string, short: string, refs: string[]) => out.push({ reason: { code, severity, text, refs }, short });
  if (c.irrigationRequired && sc.irrigation !== 'yes') add('IRRIGATION_REQUIRED', 'block', 'requires irrigation, which is not available.', 'needs irrigation, which this farm does not have', ['input:irrigation']);
  if (r && r.years.length) {
    if (r.tempOutOfRange > 0.5) add('CLIMATE_UNSUITABLE', 'block', `season mean temperature (${r.meanSeasonT?.toFixed(1)} °C) is outside ${c.name}'s range ${c.tMeanRange[0]}–${c.tMeanRange[1]} °C in most years.`, `season mean ${r.meanSeasonT?.toFixed(0)} °C, needs ${c.tMeanRange[0]}–${c.tMeanRange[1]} °C`, ['D1', 'R17']);
    else if (r.medianRel < 0.35) add('CLIMATE_UNSUITABLE', 'block', `modeled water-limited yield is only ${(r.medianRel * 100).toFixed(0)}% of attainable in a median year.`, `water-limited yield only ${pc(r.medianRel)} of attainable in a median year`, ['R8', 'R18']);
    else if (r.pSevere >= 0.35) add('CLIMATE_RISK_HIGH', 'warn', `severe water stress (<50% of attainable) in ${(r.pSevere * 100).toFixed(0)}% of replayed years.`, `severe water stress in ${pc(r.pSevere)} of years`, ['R8', 'R18']);
    const ss = r.season;
    if (ss && ss.applicable && !ss.pass) {
      const need = ss.gddNeed != null ? `needs about ${ss.gddNeed.toLocaleString('en-US')} °C·d above ${ss.tbaseC} °C (its ${ss.cycleDays}-day FAO-56 cycle at ${((c.tMeanRange[0] + c.tMeanRange[1]) / 2).toFixed(0)} °C) and ` : `its ${ss.cycleDays}-day cycle (FAO-56 stage lengths) `;
      add('SEASON_TOO_SHORT', 'block', `${need}matures before the first autumn frost in only ${ss.okYears} of ${ss.years} years (median frost-free season ${ss.medianFrostFreeDays} days, last spring frost ${mmddLabel(ss.medianLastSpring)}, first autumn frost ${mmddLabel(ss.medianFirstAutumn)}).`, `matures before frost in only ${ss.okYears} of ${ss.years} years`, ['R8', 'R40', 'R17']);
    }
    if (r.pHeat >= 0.3) add('HEAT_EXPOSURE', 'warn', `≥3 days with Tmax ≥ ${c.heatThresholdC} °C around flowering in ${(r.pHeat * 100).toFixed(0)}% of years (exploratory threshold).`, `≥3 days ≥ ${c.heatThresholdC} °C at flowering in ${pc(r.pHeat)} of years`, ['R30', 'R17']);
    if (r.pFrost >= 0.2) add('FROST_RISK', 'warn', `frost (Tmin ≤ 0 °C) after emergence in ${(r.pFrost * 100).toFixed(0)}% of years.`, `frost after emergence in ${pc(r.pFrost)} of years`, ['R17']);
  }
  if (soil.ph != null && (soil.ph < c.phRange[0] - 0.3 || soil.ph > c.phRange[1] + 0.3)) {
    add('SOIL_PH', 'warn', `soil pH ${soil.ph.toFixed(1)} (${soil.source === 'soilgrids' ? 'SoilGrids estimate' : 'reported'}) is outside the usual ${c.phRange[0]}–${c.phRange[1]} range.`, `soil pH ${soil.ph.toFixed(1)} outside ${c.phRange[0]}–${c.phRange[1]}`, [soil.source === 'soilgrids' ? 'R21' : 'input:soil']);
  }
  return out;
}

function ruleCheck(seq: string[], plannedFrom: number, sc: FarmScenario, pack: RegionPack, plannedRisks: (CropRisk | null)[], soil: SoilProfile): Reason[] {
  const R: Reason[] = [];
  const has = (id: string) => pack.rules.some((r) => r.id === id);
  for (let k = plannedFrom; k < seq.length; k++) {
    const c = cropFor(pack, seq[k]);
    const prev = k > 0 ? cropFor(pack, seq[k - 1]) : undefined;
    const tag = `Season ${k - plannedFrom + 1} (${c.name})`;
    // return interval
    if (c.minReturnSeasons > 0) {
      for (let j = Math.max(0, k - c.minReturnSeasons); j < k; j++) {
        if (seq[j] === c.id) {
          const rid = c.id === 'groundnut' && has('SN-R2') ? 'SN-R2' : c.id === 'flax' && has('KZ-R2') ? 'KZ-R2' : 'G-R1';
          R.push({ code: 'RETURN_INTERVAL', severity: 'block', text: `${tag}: ${c.name} needs a ${c.minReturnSeasons}-season break but was grown ${k - j} season(s) earlier.`, refs: [rid] });
          break;
        }
      }
    }
    if (prev && prev.id !== 'fallow' && c.id !== 'fallow') {
      const shared = c.diseaseGroups.filter((g) => prev.diseaseGroups.includes(g));
      let hardBlocked = false;
      for (const g of shared) {
        if (prev.id === c.id) continue; // same crop: covered by the return interval / monoculture rules below
        if (HARD_DISEASE.has(g)) {
          hardBlocked = true;
          R.push({ code: 'DISEASE_GROUP', severity: 'block', text: `${tag}: follows ${prev.name}; both host ${g.replace('-', ' ')}.`, refs: [has('KZ-R3') && g === 'sclerotinia' ? 'KZ-R3' : 'G-R2'] });
        }
      }
      const after = k === plannedFrom ? `your last season's ${prev.name}` : prev.name;
      if (prev.id === c.id) {
        // G-R6 monoculture. Crops with a return interval are already blocked by RETURN_INTERVAL above.
        if (c.minReturnSeasons === 0) {
          if (pack.continuousCrops?.includes(c.id)) {
            R.push({ code: 'MONOCULTURE', severity: 'warn', text: `${tag}: ${c.name} again after ${after}. Continuous ${c.name.toLowerCase()} is an accepted practice in this system, but pests, diseases and nutrient drawdown build up; ranked below true rotations.`, refs: ['G-R6', 'R31'] });
          } else {
            R.push({ code: 'MONOCULTURE', severity: 'block', text: `${tag}: ${c.name} again after ${after} — the same crop twice is not a rotation (pest, disease and weed carry-over; no rotation benefit), so it is excluded from the options.`, refs: ['G-R6', 'R31'] });
          }
        }
      } else if (!hardBlocked && (prev.family === c.family || shared.length)) {
        const why = prev.family === c.family ? `same family (${c.family})` : '';
        const dis = shared.length ? `shared ${shared.map((g) => g.replace('-', ' ')).join(', ')}` : '';
        R.push({ code: 'SAME_FAMILY', severity: 'warn', text: `${tag}: follows ${after} — ${[why, dis].filter(Boolean).join(' and ')}, so it is a weak break for pests, diseases and weeds.`, refs: ['G-R7', 'R31'] });
      }
      if (prev.group === 'legume' && c.group === 'cereal') {
        R.push({ code: 'LEGUME_BENEFIT', severity: 'good', text: `${tag}: follows a grain legume (${prev.name}) — possible residual-N and pest-break benefit.`, refs: [has('SN-R1') ? 'SN-R1' : has('KZ-R1') ? 'KZ-R1' : 'G-R3'] });
      }
      if (prev.group === 'cereal' && c.group === 'legume') {
        R.push({ code: 'BREAK_CROP', severity: 'good', text: `${tag}: a grain legume after ${after} (a cereal) — breaks cereal pest and disease cycles and fixes its own nitrogen.`, refs: ['G-R8', 'R32'] });
      }
      // G-R9 group alternation beyond cereal ↔ legume (which G-R3 / G-R8 already credit), e.g. cereal ↔ oilseed.
      const cerLeg = (prev.group === 'cereal' && c.group === 'legume') || (prev.group === 'legume' && c.group === 'cereal');
      if (prev.group !== c.group && prev.family !== c.family && !shared.length && !cerLeg) {
        R.push({ code: 'ALTERNATION', severity: 'good', text: `${tag}: ${GROUP_NOUN[c.group] ?? c.group} after ${after} (${GROUP_NOUN[prev.group] ?? prev.group}) — a change of crop group, so pests, diseases and weeds of the previous crop get a break.`, refs: ['G-R9', 'R31'] });
      }
    }
    if (prev?.id === 'fallow' && c.group === 'cereal' && has('KZ-R1')) {
      R.push({ code: 'FALLOW_BENEFIT', severity: 'good', text: `${tag}: follows fallow — stored soil moisture and disease break.`, refs: ['KZ-R1'] });
    }
    if (k >= 2 && [seq[k - 2], seq[k - 1], seq[k]].every((x) => CROPS[x]?.group === 'cereal')) {
      R.push({ code: 'PRIOR_CROP_RULE', severity: 'warn', text: `${tag}: third consecutive cereal season — pest, weed and fertility pressure rises.`, refs: ['G-R4'] });
    }
    // farmer constraints
    if (c.id !== 'fallow') {
      if (sc.unavailableCrops.includes(c.id)) R.push({ code: 'SEED_UNAVAILABLE', severity: 'block', text: `${tag}: seed reported unavailable.`, refs: ['input:unavailableCrops'] });
      if (sc.marketCrops.length && !sc.marketCrops.includes(c.id)) R.push({ code: 'MARKET_CONSTRAINT', severity: 'block', text: `${tag}: not in the crops you can sell or use.`, refs: ['input:marketCrops'] });
      if (LABOR_RANK[c.labor] > LABOR_RANK[sc.laborAvailable]) R.push({ code: 'LABOR_LIMIT', severity: 'block', text: `${tag}: needs ${c.labor} labor; ${sc.laborAvailable} available.`, refs: ['input:laborAvailable'] });
      // location screening (irrigation need, NASA climate replay, growing-season length, soil pH): one code path
      // shared with the "Why these crops here?" screen
      for (const it of cropScreenItems(c, plannedRisks[k - plannedFrom], soil, sc)) R.push({ ...it.reason, text: `${tag}: ${it.reason.text}` });
    }
  }
  const planned = seq.slice(plannedFrom);
  if (sc.needsResidue && planned.every((x) => !CROPS[x].residueForLivestock)) {
    R.push({ code: 'RESIDUE_NEED', severity: 'warn', text: 'Neither season leaves residue for livestock, which you said you need.', refs: ['input:needsResidue'] });
  }
  return R;
}

function stats(v: number[]) { return { p20: quantile(v, 0.2), median: median(v), p80: quantile(v, 0.8) }; }

function outcomeFor(crops: [string, string], seasonRisks: [CropRisk | null, CropRisk | null], yearOffset: number, record: Set<number>, pack: RegionPack, sc: FarmScenario, areaHa: number, budget: BudgetResult, prices: Record<string, PriceInfo>): PlanOutcome {
  const r1 = seasonRisks[0] ?? undefined, r2 = seasonRisks[1] ?? undefined;
  const e1 = pack.economics[crops[0]], e2 = pack.economics[crops[1]];
  const pr1 = prices[crops[0]]?.perT ?? null, pr2 = prices[crops[1]]?.perT ?? null;
  const yld = (cropId: string, base: number) => { const o = sc.priceOverrides[`${cropId}:yield`]; return o != null ? o : base; };
  const y1Att = yld(crops[0], e1?.attainableYieldTHa ?? 0), y2Att = yld(crops[1], e2?.attainableYieldTHa ?? 0);
  const byYear = (r: CropRisk | undefined) => new Map((r?.years ?? []).map((y) => [y.year, y.relYield]));
  const m1 = byYear(r1), m2 = byYear(r2);
  // failed seasons (no rain onset) count as severe even when the late, window-end sowing still yields something
  const sevYear = (r: CropRisk | undefined) => new Map((r?.years ?? []).map((y) => [y.year, isSevere(y)]));
  const s1 = sevYear(r1), s2 = sevYear(r2);
  const rels: number[] = [], severe: boolean[] = [], revs: number[] = [];
  const isF1 = crops[0] === 'fallow', isF2 = crops[1] === 'fallow';
  // replay coherent historical season pairs (Y, Y + offset): same weather sequence a farmer would have lived through
  // Both years of a pair must lie inside the complete NASA record (2001–2025 → 24 consecutive pairs for a
  // cross-year rotation). Without this, a fallow-first plan also counted the pair (2000, 2001), because its
  // fallow season needs no weather, and showed "of 25" while every other plan showed "of 24".
  const years = [...new Set([...m1.keys(), ...[...m2.keys()].map((y) => y - yearOffset)])].filter((y) => record.has(y) && record.has(y + yearOffset)).sort();
  for (const y of years) {
    const a = m1.get(y), b = m2.get(y + yearOffset);
    if ((!isF1 && a === undefined) || (!isF2 && b === undefined)) continue;
    const ra = isF1 ? null : a!, rb = isF2 ? null : b!;
    const active = [ra, rb].filter((x): x is number => x != null);
    if (!active.length) continue;
    rels.push(active.reduce((s, x) => s + x, 0) / active.length);
    severe.push((!isF1 && !!s1.get(y)) || (!isF2 && !!s2.get(y + yearOffset)));
    if ((ra == null || pr1 != null) && (rb == null || pr2 != null)) {
      revs.push(((ra ?? 0) * y1Att * (pr1 ?? 0) + (rb ?? 0) * y2Att * (pr2 ?? 0)) * areaHa);
    }
  }
  const yStats = (r: CropRisk | undefined, att: number, isF: boolean) => (isF || !r ? null : stats(r.years.map((y) => y.relYield * att * areaHa)));
  const revenue = revs.length ? stats(revs) : null;
  const net = revenue && budget.status !== 'unverified' ? { p20: revenue.p20 - budget.totalCash, median: revenue.median - budget.totalCash, p80: revenue.p80 - budget.totalCash } : null;
  return { pairs: rels.length, medianRel: median(rels), pSevereAny: severe.length ? severe.filter(Boolean).length / severe.length : NaN, revenue, net, yields: [yStats(r1, y1Att, isF1), yStats(r2, y2Att, isF2)] };
}

/** Pack input costs (pack currency) → the scenario currency at the FAOSTAT exchange rate. */
function costConverter(pack: RegionPack, sc: FarmScenario) {
  const factor = fxFactor(pack.currency, sc.currency);
  return (it: CostItemDef): CostItemDef => (factor === 1 || it.unitPrice == null ? it : { ...it, unitPrice: Math.round(it.unitPrice * factor * 100) / 100 });
}

/** True when the scenario currency has no FAOSTAT exchange rate, so pack costs cannot be converted into it. */
const fxUnknown = (pack: RegionPack, sc: FarmScenario) => pack.currency !== sc.currency && (!fxPerUsd(sc.currency) || !fxPerUsd(pack.currency));

/**
 * Weather-independent cash cost of a two-season plan (scenario currency): the pack's input items, converted,
 * with the farmer's price overrides. Modeled irrigation water is excluded (it needs the NASA replay).
 * Used to size placeholder budgets before the weather has loaded.
 */
export function estimateCashCost(sc: FarmScenario, pack: RegionPack, crops: [string, string]): number {
  const areaHa = toHectares(sc.area, sc.areaUnit);
  const convert = costConverter(pack, sc);
  let total = 0;
  crops.forEach((c, k) => {
    for (const it of pack.economics[c]?.items ?? []) {
      if (!it.cash) continue;
      const l = costLine(convert(it), (k + 1) as 1 | 2, c, areaHa, '2000-01-01', sc.priceOverrides[`${c}:${it.key}`]);
      total += l.total ?? 0;
    }
  });
  return Math.round(total * 100) / 100;
}

/** Key of everything a placeholder budget depends on; when it changes, an unedited placeholder is recomputed. */
export function placeholderKey(sc: FarmScenario, pack: RegionPack, baseline: [string, string]): string {
  return [pack.id, sc.currency, toHectares(sc.area, sc.areaUnit).toFixed(4), baseline.join('>'), sc.irrigation].join('|');
}

/** Has the farmer edited the funds or reserve since the placeholder was generated (allowing for FX conversion)? */
export function placeholderEdited(sc: FarmScenario, ph: BudgetPlaceholder): boolean {
  const same = ph.currency === sc.currency;
  const k = same ? 1 : fxFactor(ph.currency, sc.currency);
  // exact in the same currency; after an FX conversion allow for the rounding of the converted amounts
  const near = (a: number, b: number) => (same ? a === b : Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005));
  return !near(sc.availableFunds, Math.round(ph.funds * k)) || !near(sc.reserve, Math.round(ph.reserve * k));
}

/**
 * Starting budget for a new or custom farm before weather is known: sized from the usual plan's cash cost
 * (see placeholderBudget in budget.ts for the rule). Returns the fields to merge into the scenario.
 */
export function initialPlaceholder(sc: FarmScenario, pack: RegionPack): Pick<FarmScenario, 'availableFunds' | 'reserve' | 'budgetPlaceholder'> {
  const base = baselineCrops(sc, pack);
  const usualCost = estimateCashCost(sc, pack, base);
  const b = placeholderBudget(usualCost);
  // 'estimate:' prefix → the app refines it once the engine has screened the alternatives
  return { availableFunds: b.funds, reserve: b.reserve, budgetPlaceholder: { funds: b.funds, reserve: b.reserve, currency: sc.currency, key: `estimate:${placeholderKey(sc, pack, base)}`, usualCost } };
}

/**
 * After an engine run: refresh an unedited placeholder budget when the location, currency, area or usual plan changed,
 * using the real usual-plan cost and the cash costs of the rule-passing alternatives. Returns null when nothing changes,
 * and `{ budgetPlaceholder: null }` once the farmer has entered their own figures.
 */
export function refreshPlaceholder(sc: FarmScenario, out: EngineOutput): Partial<FarmScenario> | null {
  const ph = sc.budgetPlaceholder;
  if (!ph) return null;
  if (placeholderEdited(sc, ph)) return { budgetPlaceholder: null };
  const key = placeholderKey(sc, out.pack, out.baseline.crops);
  if (ph.key === key) return null;
  const usualCost = out.baseline.budget.totalCash;
  const alts = out.allPlans.filter((p) => p.eligible && !p.isBaseline && p.budget.status !== 'unverified').map((p) => p.budget.totalCash);
  const b = placeholderBudget(usualCost, alts);
  return { availableFunds: b.funds, reserve: b.reserve, budgetPlaceholder: { funds: b.funds, reserve: b.reserve, currency: sc.currency, key, usualCost } };
}

/**
 * Everything a plan evaluation needs that does not depend on the plan itself: resolved sowing windows,
 * the NASA record, per-crop replays (computed on first use and cached), sale prices and cost conversion.
 * runEngine builds one per run; evaluateRotation (custom.ts) builds the same context, so a farmer's own
 * plan goes through exactly the same costing, rule checks and replay as the ranked plans.
 */
export interface EngineContext {
  sc: FarmScenario; s: DailySeries; soil: SoilProfile; pack: RegionPack;
  areaHa: number; windows: SowingWindow[]; record: Set<number>;
  irrigation: { on: boolean; capMm: number };
  fallowInPlay: boolean;
  risks: Record<string, CropRisk>;
  risksAfterFallow: Record<string, CropRisk>;
  prices: Record<string, PriceInfo>;
  fx: EngineOutput['fx'];
  toLocalPerUsd: number | null;
  history: string[];
  base: [string, string];
}

/** Replay of a crop in a window (cached in the context); after a fallow season when fallow is in play. */
function riskOf(ctx: EngineContext, w: SowingWindow, cropId: string, afterFallow = false): CropRisk | null {
  if (cropId === 'fallow' || !CROPS[cropId]) return null;
  const key = riskKey(ctx.pack, w, cropId);
  if (afterFallow) {
    if (!ctx.fallowInPlay) return null;
    if (!ctx.risksAfterFallow[key]) ctx.risksAfterFallow[key] = { ...replayCrop(ctx.s, w, cropFor(ctx.pack, cropId), ctx.soil, ctx.irrigation, true), seasonId: w.id, seasonLabel: w.label };
    return ctx.risksAfterFallow[key];
  }
  if (!ctx.risks[key]) ctx.risks[key] = { ...replayCrop(ctx.s, w, cropFor(ctx.pack, cropId), ctx.soil, ctx.irrigation), seasonId: w.id, seasonLabel: w.label };
  return ctx.risks[key];
}

const uniq = (a: string[]) => [...new Set(a)];

/** Screen one crop in one window: verdict, findings and a one-line summary, all from cropScreenItems. */
export function screenCrop(ctx: EngineContext, w: SowingWindow, cropId: string): CropScreen {
  const c = cropFor(ctx.pack, cropId);
  const r = riskOf(ctx, w, cropId);
  const items = cropScreenItems(c, r, ctx.soil, ctx.sc);
  const blocks = items.filter((i) => i.reason.severity === 'block');
  const warns = items.filter((i) => i.reason.severity === 'warn');
  let line: string;
  const refs = uniq(items.flatMap((i) => i.reason.refs));
  if (blocks.length) line = blocks.map((i) => i.short).join('; ');
  else if (!r || !r.years.length) line = 'no complete NASA POWER season to replay';
  else {
    const ss = r.season;
    const parts: string[] = [];
    if (ss?.frostFree) parts.push('frost-free location');
    else if (ss?.applicable) parts.push(`matures before frost in ${ss.okYears}/${ss.years} years`);
    else if (ss) parts.push('autumn-sown, overwinters');
    if (r.meanSeasonT != null) parts.push(`season mean ${r.meanSeasonT.toFixed(0)} °C`);
    parts.push(`water-limited yield ${(r.medianRel * 100).toFixed(0)}%`);
    line = [...parts, ...warns.map((i) => i.short)].join('; ');
    refs.unshift(...(ss?.applicable && !ss.frostFree ? ['R17', 'R40', 'R8'] : ['R17', 'R8']));
  }
  return { cropId, seasonId: w.id, seasonLabel: w.label, ok: !blocks.length, items, line, refs: uniq(refs) };
}

/** Every crop of the pack calendar (fallow excluded), screened in each window it can be sown in. */
export function screenCrops(ctx: EngineContext): CropScreen[] {
  const out: CropScreen[] = [];
  for (const w of ctx.windows) for (const id of w.crops) if (id !== 'fallow' && CROPS[id]) out.push(screenCrop(ctx, w, id));
  return out;
}

/** Farm-gate sale price for a crop (scenario currency per tonne), cached in the context. */
function priceOf(ctx: EngineContext, c: string): PriceInfo | undefined {
  if (c === 'fallow') return undefined;
  if (ctx.prices[c]) return ctx.prices[c];
  const { sc, pack, toLocalPerUsd, fx } = ctx;
  const o = sc.priceOverrides[`${c}:price`];
  let p: PriceInfo;
  if (o !== undefined) p = { perT: o, label: 'Your price', source: 'farmer' };
  else {
    const ref = toLocalPerUsd ? cropPriceUsd(sc.countryIso2, c) : null;
    if (ref && toLocalPerUsd) p = { perT: Math.round(ref.usdPerT * toLocalPerUsd), label: ref.label, source: ref.source, ...(ref.replaced ? { replaced: ref.replaced } : {}) };
    else p = { perT: pack.economics[c]?.pricePerT != null ? Math.round(pack.economics[c].pricePerT! * (pack.currency === 'USD' ? (toLocalPerUsd ?? 1) : fx.factor)) : null, label: 'Placeholder price (synthetic; FAOSTAT has none)', source: 'pack' };
  }
  ctx.prices[c] = p;
  return p;
}

/**
 * Build the shared context. `prefill` replays every crop of the pack calendar up front (runEngine does this so
 * the yield table is complete); without it, crops are replayed on first use. Both give identical numbers.
 * `customFallow` lets a farmer-chosen fallow season use the after-fallow replay in annual systems even when
 * fallow is not among the ranked options (it changes nothing for plans the ranking can produce).
 */
export function engineContext(sc: FarmScenario, s: DailySeries, soil: SoilProfile, pack: RegionPack, opts: { prefill?: boolean; customFallow?: boolean } = {}): EngineContext {
  const areaHa = toHectares(sc.area, sc.areaUnit);
  const windows = resolveSeasons(pack, s);
  const record = new Set(completeYears(s));
  const irrigation = { on: sc.irrigation === 'yes', capMm: sc.irrigationCapacityMm || 0 };
  const fallowAllowed = pack.mode === 'annual' && pack.crops.includes('fallow');
  const fallowInPlay = fallowAllowed && (sc.allowFallow || sc.history.some((h) => h.cropId === 'fallow') || !!sc.baselineOverride?.includes('fallow') || !!opts.customFallow);
  const fx = { factor: fxFactor(pack.currency, sc.currency), from: pack.currency, to: sc.currency, year: countryInfo(sc.countryIso2)?.fxYear };
  const toLocalPerUsd = fxPerUsd(sc.currency) ?? (sc.currency === 'USD' ? 1 : null);
  const ctx: EngineContext = {
    sc, s, soil, pack, areaHa, windows, record, irrigation, fallowInPlay, risks: {}, risksAfterFallow: {}, prices: {}, fx, toLocalPerUsd,
    history: historyOrder(sc, pack).map((h) => h.cropId), base: baselineCrops(sc, pack),
  };
  // Global screening without history: "your usual plan" is the first library crop that passes the NASA screen
  // here (not maize in Siberia or wheat in the Congo basin).
  if (pack.id === GLOBAL_PACK_ID && !ctx.history.length && !sc.baselineOverride) {
    const first = windows[0]?.crops.find((c) => c !== 'fallow' && CROPS[c] && screenCrop(ctx, windows[0], c).ok);
    if (first) ctx.base = [first, first];
  }
  if (opts.prefill) {
    for (const w of windows) {
      for (const id of w.crops) {
        if (id === 'fallow' || !CROPS[id]) continue;
        if (ctx.risks[riskKey(pack, w, id)]) continue;
        riskOf(ctx, w, id);
        if (fallowInPlay) riskOf(ctx, w, id, true);
      }
    }
    for (const c of pack.crops) priceOf(ctx, c);
  }
  return ctx;
}

const fmtIn = (cur: string) => (x: number) => `${Math.round(x).toLocaleString('en-US')} ${cur}`;

/** Cost, check and replay one two-season plan. The single code path for ranked, baseline and custom plans. */
export function buildPlan(ctx: EngineContext, crops: [string, string], isBaseline: boolean): PlanResult {
  const { sc, pack, windows, soil, areaHa, irrigation, history, record } = ctx;
  const fmt = fmtIn(sc.currency);
  // a crop sown in its own window (or one outside the whole calendar) is replayed there; a crop that belongs to
  // another window only lends a sowing date if it has already been replayed in this one
  const inCalendar = (c: string) => windows.some((w) => w.crops.includes(c));
  const typicalSow = (w: SowingWindow, cropId: string, year: number) => {
    const r = w.crops.includes(cropId) || !inCalendar(cropId) ? riskOf(ctx, w, cropId) : ctx.risks[riskKey(pack, w, cropId)] ?? null;
    const md = r?.medianSowing?.slice(5) ?? (w.earliest === 'auto' ? '06-15' : w.earliest);
    return `${year}-${md}`;
  };
  const duration = (c: string) => cropFor(pack, c).stages.reduce((a, b) => a + b, 0);
  const convert = costConverter(pack, sc);
  const irrUnit = Math.round(IRRIGATION_USD_PER_MM_HA * (ctx.toLocalPerUsd ?? 1) * 100) / 100;

  const w1 = windowFor(pack, windows, 0, crops[0] === 'fallow' ? crops[1] : crops[0]);
  const w2 = windowFor(pack, windows, 1, crops[1] === 'fallow' ? crops[0] : crops[1]);
  const y1 = sc.firstSeasonYear;
  const sow1 = typicalSow(w1, crops[0] === 'fallow' ? (crops[1] === 'fallow' ? pack.crops[0] : crops[1]) : crops[0], y1);
  const mat1 = addDays(sow1, duration(crops[0] === 'fallow' ? 'fallow' : crops[0]) - 1);
  // second season: the first sowing date after season 1 is harvested (same year for double-season systems)
  const c2 = crops[1] === 'fallow' ? (crops[0] === 'fallow' ? pack.crops[0] : crops[0]) : crops[1];
  let y2 = y1;
  if (pack.mode === 'double') {
    // both seasons belong to the same agricultural year; a second season earlier in the calendar falls in the next year
    if (w2.earliest !== 'auto' && w1.earliest !== 'auto' && w2.earliest < w1.earliest) y2 = y1 + 1;
  } else {
    while (diffDays(mat1, typicalSow(w2, c2, y2)) < 7 && y2 < y1 + 3) y2++;
    if (y2 === y1 && windows.length === 1) y2 = y1 + 1;
  }
  const lastHist = history[history.length - 1];
  const seasons: [PlanSeason, PlanSeason] = [crops[0], crops[1]].map((c, k) => {
    const w = k === 0 ? w1 : w2;
    const yr = k === 0 ? y1 : y2;
    const prevCrop = k === 0 ? lastHist : crops[0];
    const risk = (prevCrop === 'fallow' ? riskOf(ctx, w, c, true) : null) ?? riskOf(ctx, w, c);
    const sowing = k === 0 ? sow1 : typicalSow(w, c2, yr);
    return { season: (k + 1) as 1 | 2, year: yr, cropId: c, sowing, maturity: addDays(sowing, duration(c) - 1), risk, seasonId: w.id, seasonLabel: w.label };
  }) as [PlanSeason, PlanSeason];
  // crops outside the pack's sowing calendar (only reachable through a custom plan)
  const offCalendar = seasons.map((ps, k) => ps.cropId !== 'fallow' && !(k === 0 ? w1 : w2).crops.includes(ps.cropId));
  const lines: CostLine[] = [];
  seasons.forEach((ps, k) => {
    const e = pack.economics[ps.cropId];
    if (!e) {
      // no regional cost template: never show such a plan as cheap; its budget stays unverified
      if (offCalendar[k]) lines.push(costLine({ key: 'inputs', category: 'other', label: `Inputs for ${cropName(ps.cropId)} (no ${pack.short} cost template)`, qtyPerHa: 1, unit: 'ha', unitPrice: null, dueOffsetDays: 0, essential: true, cash: true }, ps.season, ps.cropId, areaHa, ps.sowing, sc.priceOverrides[`${ps.cropId}:inputs`]));
      return;
    }
    for (const it of e.items) lines.push(costLine(convert(it), ps.season, ps.cropId, areaHa, ps.sowing, sc.priceOverrides[`${ps.cropId}:${it.key}`]));
    const irr = ps.risk?.medianIrrigation ?? 0;
    if (irrigation.on && irr > 0) {
      const key = 'irrigation-water';
      lines.push(costLine({ key, category: 'irrigation', label: `Irrigation water (modeled median ${irr.toFixed(0)} mm)`, qtyPerHa: irr, unit: 'mm·ha', unitPrice: irrUnit, dueOffsetDays: 45, essential: true, cash: true }, ps.season, ps.cropId, areaHa, ps.sowing, sc.priceOverrides[`${ps.cropId}:${key}`]));
    }
  });
  const budget = evaluateBudget(lines, sc.availableFunds, sc.reserve, sc.confirmedInflows, seasons[0].sowing);
  const reasons = ruleCheck([...history, ...crops], history.length, sc, pack, [seasons[0].risk, seasons[1].risk], soil);
  for (let k = 1; k >= 0; k--) {
    if (!offCalendar[k]) continue;
    const w = k === 0 ? w1 : w2;
    reasons.unshift({ code: 'OUT_OF_CALENDAR', severity: 'block', text: `Season ${k + 1} (${cropName(seasons[k].cropId)}): not in the ${pack.short} crop calendar (${w.label}), so there is no regional sowing rule, cost template or rotation review for it.`, refs: pack.sources.slice(0, 1) });
  }
  if (crops[0] !== 'fallow' && crops[1] !== 'fallow' && diffDays(seasons[0].maturity, seasons[1].sowing) < 0) {
    reasons.unshift({ code: 'SEASON_OVERLAP', severity: 'block', text: `${cropName(crops[0])} (${duration(crops[0])} days) is still in the field when ${cropName(crops[1])} should be sown (${seasons[1].seasonLabel}).`, refs: ['G-R5'] });
  }
  if (budget.status === 'unaffordable') reasons.unshift({ code: 'BUDGET_EXCEEDED', severity: 'block', text: `Cash cost ${fmt(budget.totalCash)} exceeds spendable ${fmt(budget.cap + budget.inflowsTotal)} by ${fmt(-budget.headroom)}.`, refs: ['input:availableFunds', 'input:reserve'] });
  else if (budget.status === 'unverified') reasons.unshift({ code: 'PRICE_MISSING', severity: 'warn', text: `Budget not verified: missing price for ${budget.missingEssential.map((l) => l.label).join(', ')}.`, refs: budget.missingEssential.map((l) => `price:${l.cropId}:${l.key}`) });
  else if (budget.status === 'timing') reasons.unshift({ code: 'CASH_TIMING', severity: 'block', text: `Total fits, but by ${budget.timingViolation!.date} you would need ${fmt(budget.timingViolation!.needed)} with only ${fmt(budget.timingViolation!.available)} available.`, refs: ['input:confirmedInflows'] });
  else reasons.unshift({ code: 'BUDGET_OK', severity: 'good', text: `Fits the budget with ${fmt(budget.headroom)} headroom after your reserve.`, refs: ['input:availableFunds', 'input:reserve'] });
  const eligible = !reasons.some((r) => r.severity === 'block' && r.code !== 'BUDGET_EXCEEDED' && r.code !== 'CASH_TIMING');
  const feasible = eligible && (budget.status === 'affordable' || budget.status === 'unverified');
  const newCrops = crops.filter((c) => c !== 'fallow' && !history.includes(c)).length;
  const prices: Record<string, PriceInfo> = {};
  for (const c of crops) { const p = priceOf(ctx, c); if (p) prices[c] = p; }
  return {
    id: crops.join('→'), label: isBaseline ? 'Your usual plan' : '', isBaseline, crops, seasons, reasons, eligible, feasible, budget,
    outcome: outcomeFor(crops, [seasons[0].risk, seasons[1].risk], y2 - y1, record, pack, sc, areaHa, budget, prices), newCrops,
  };
}

export function runEngine(sc: FarmScenario, s: DailySeries, soil: SoilProfile, pack: RegionPack): EngineOutput {
  const ctx = engineContext(sc, s, soil, pack, { prefill: true });
  const { areaHa, windows, risks, risksAfterFallow, prices, fx, base } = ctx;

  const fmt = fmtIn(sc.currency);
  const hist = historyOrder(sc, pack);
  const nSeasons = Object.values(risks)[0]?.years.length ?? 0;
  const notes: Reason[] = [];
  if (pack.reviewStatus !== 'reviewed') notes.push({ code: 'UNREVIEWED_RULES', severity: 'info', text: `Rule pack "${pack.short}" v${pack.version} has not been signed off by a local agronomist — results are a demonstration.`, refs: pack.rules.map((r) => r.id) });
  const country = countryInfo(sc.countryIso2);
  const priceNote = Object.values(prices).some((p) => p.source === 'faostat-country') ? `Crop sale prices: FAOSTAT producer prices${country ? ` for ${country.name}` : ''}` : 'Crop sale prices: FAOSTAT global medians (no country prices)';
  notes.push({ code: 'SYNTHETIC_PRICES', severity: 'info', text: `${priceNote}. Input costs are a synthetic regional template${fx.factor !== 1 ? ` converted ${fx.from}→${fx.to} at the FAOSTAT ${fx.year ?? ''} exchange rate` : ''} — edit them in Resources with dated local quotes.`, refs: ['R33', 'price-pack'] });
  notes.push({ code: 'CLIMATE_CONTEXT_ONLY', severity: 'info', text: `Risk comes from replaying ${nSeasons} historical NASA POWER seasons for this grid cell${windows.length > 1 ? ` in each of ${windows.length} seasons (${windows.map((w) => w.label).join(', ')})` : ''} — a conditional historical scenario, not a forecast.`, refs: ['D1', 'R17', 'R8'] });
  if (pack.irrigationTypical && sc.irrigation !== 'yes') notes.push({ code: 'IRRIGATION_REQUIRED', severity: 'info', text: `Most farms in "${pack.short}" are irrigated. Rainfed results here will look poor — set irrigation to “Yes” in Resources if your field is irrigated.`, refs: ['input:irrigation'] });
  const odd = Object.entries(prices).filter(([, p]) => p.replaced);
  if (odd.length) notes.push({ code: 'PRICE_IMPLAUSIBLE', severity: 'info', text: `FAOSTAT country price${odd.length > 1 ? 's' : ''} for ${odd.map(([c, p]) => `${cropName(c)} (${Math.round(p.replaced!.usdPerT)} USD/t, ${p.replaced!.year})`).join(', ')} differ${odd.length > 1 ? '' : 's'} more than ${PRICE_PLAUSIBLE_FACTOR}× from the global median — likely a unit or exchange-rate artefact — so the global median is used instead. Enter your own price if you have one.`, refs: ['R33'] });
  if (fxUnknown(pack, sc)) notes.push({ code: 'SYNTHETIC_PRICES', severity: 'warn', text: `No FAOSTAT exchange rate for "${sc.currency}": input costs are shown unconverted in ${pack.currency} amounts. Use a 3-letter ISO currency code (e.g. ${countryInfo(sc.countryIso2)?.currency ?? 'USD'}) or enter local prices.`, refs: ['R33', 'input:currency'] });
  if (!hist.length && !sc.baselineOverride) notes.push({ code: 'HISTORY_INCOMPLETE', severity: 'info', text: `No crop history entered: “your usual plan” is assumed to be ${cropName(base[0])} → ${cropName(base[1])} (${pack.usualRotation && base.join() === pack.usualRotation.join() ? `a typical sequence in ${pack.short}` : base[0] === base[1] ? 'the first crop of this rule pack, grown continuously' : 'the first crop listed for each season'}). Add your last seasons in Farm to compare against what you really grow.`, refs: ['input:history'] });
  if (sc.budgetPlaceholder && !placeholderEdited(sc, sc.budgetPlaceholder)) {
    const ph = sc.budgetPlaceholder;
    notes.unshift({ code: 'BUDGET_PLACEHOLDER', severity: 'warn', text: `Placeholder budget — not your money. Funds ${fmt(sc.availableFunds)} with a ${fmt(sc.reserve)} reserve were set so the cash you can spend is about ${Math.round(PLACEHOLDER_SPEND_SHARE * 100)}% of the usual plan's cash cost (${fmt(ph.usualCost * (ph.currency === sc.currency ? 1 : fxFactor(ph.currency, sc.currency)))}), a typical pre-season squeeze. Enter the cash you really have in Resources.`, refs: ['input:availableFunds', 'input:reserve'] });
  }
  if (sc.history.some((h) => !h.plantedOn) || sc.fertilizer.some((f) => f.treatedAreaHa == null)) notes.push({ code: 'HISTORY_INCOMPLETE', severity: 'info', text: 'Some crop dates or fertilizer treated areas are unknown; history interpretation is limited.', refs: ['input:history'] });


  const baseline = buildPlan(ctx, base, true);
  const all: PlanResult[] = [];
  // (a) the global-screening fallback offers only crops that pass the NASA screen at this location;
  // regional packs keep their full calendar and show screen failures as excluded rotations
  const screen = screenCrops(ctx);
  const filtered = pack.id === GLOBAL_PACK_ID;
  const passes = (w: SowingWindow | undefined, c: string) => c === 'fallow' || screen.some((x) => x.cropId === c && x.ok && (!w || x.seasonId === w.id));
  const keep = (w: SowingWindow | undefined, list: string[]) => (filtered ? list.filter((c) => passes(w, c)) : list);
  const slot1 = keep(pack.mode === 'double' ? windows[0] : undefined, pack.mode === 'double' ? windows[0].crops : pack.crops);
  const slot2 = keep(pack.mode === 'double' ? windows[1] ?? windows[0] : undefined, pack.mode === 'double' ? (windows[1] ?? windows[0]).crops : pack.crops);
  if (filtered) {
    const n = new Set(screen.map((x) => x.cropId)).size, ok = new Set(screen.filter((x) => x.ok).map((x) => x.cropId)).size;
    notes.push({ code: 'CLIMATE_CONTEXT_ONLY', severity: 'info', text: `Global screening: ${ok} of ${n} library crops pass the NASA climate and season-length screen here; the other ${n - ok} are not offered (see “Why these crops here?”).`, refs: ['R17', 'R40', 'R8'] });
  }
  for (const a of slot1) for (const b of slot2) {
    if (!CROPS[a] || !CROPS[b]) continue;
    if (a === 'fallow' && b === 'fallow') continue;
    if (!sc.allowFallow && (a === 'fallow' || b === 'fallow')) continue;
    if (a === base[0] && b === base[1]) continue;
    all.push(buildPlan(ctx, [a, b], false));
  }
  const feasible = all.filter((p) => p.feasible);
  const cmp = rankComparator(sc.priority);
  feasible.sort(cmp);
  // second option must differ in crop set from the first (no mirror-image duplicates)
  const picked: PlanResult[] = [];
  for (const p of feasible) {
    if (picked.length >= 2) break;
    const set = [...p.crops].sort().join('+');
    if (picked.some((q) => [...q.crops].sort().join('+') === set)) continue;
    picked.push(p);
  }
  const alternatives = picked.map((p, i) => ({ ...p, rank: i + 1, label: i === 0 ? 'Best fit' : 'Option B' }));
  const excluded = all.filter((p) => !p.feasible);
  return { pack, window: windows[0], windows, areaHa, risks, risksAfterFallow, prices, fx, baseline, alternatives, allPlans: all, excluded, notes, screen: { crops: screen, filtered } };
}

const n0 = (x: number) => (Number.isFinite(x) ? x : 0);

/**
 * Rotation quality used in ranking (lower = better): +2 per accepted-but-continuous crop (MONOCULTURE warn, G-R6),
 * +1 per same-family / shared-disease succession (SAME_FAMILY, G-R7) or third consecutive cereal (G-R4).
 * Plans with a lower penalty always rank first; the farmer's priority then orders plans of equal rotation quality.
 */
export function rotationPenalty(p: PlanResult): number {
  return p.reasons.reduce((a, r) => a + (r.code === 'MONOCULTURE' && r.severity === 'warn' ? 2 : r.code === 'SAME_FAMILY' || (r.code === 'PRIOR_CROP_RULE' && r.severity === 'warn') ? 1 : 0), 0);
}
/** Count of rotation benefits: legume → cereal (G-R3), cereal → legume (G-R8), fallow → cereal (KZ-R1). */
export function rotationBenefit(p: PlanResult): number {
  return p.reasons.filter((r) => r.code === 'LEGUME_BENEFIT' || r.code === 'BREAK_CROP' || r.code === 'FALLOW_BENEFIT' || r.code === 'ALTERNATION').length;
}
/**
 * True when any planned succession (including last season → season 1) repeats the crop or its family
 * (MONOCULTURE warn on an accepted continuous crop, or SAME_FAMILY, G-R6/G-R7). Ranked strictly last (G-R9).
 */
export function isRepeat(p: PlanResult): boolean {
  return p.reasons.some((r) => r.code === 'MONOCULTURE' || r.code === 'SAME_FAMILY');
}

export function rankComparator(priority: FarmScenario['priority']) {
  const byCost = (a: PlanResult, b: PlanResult) => a.budget.totalCash - b.budget.totalCash;
  // climate score: share of replayed season pairs with severe water stress + 0.05 per climate warning
  const CLIM = new Set(['CLIMATE_RISK_HIGH', 'HEAT_EXPOSURE', 'FROST_RISK']);
  const climScore = (p: PlanResult) => n0(p.outcome.pSevereAny) + 0.05 * p.reasons.filter((r) => CLIM.has(r.code)).length;
  const byClimate = (a: PlanResult, b: PlanResult) => climScore(a) - climScore(b) || n0(b.outcome.medianRel) - n0(a.outcome.medianRel);
  const byReturn = (a: PlanResult, b: PlanResult) => (b.outcome.net?.median ?? -Infinity) - (a.outcome.net?.median ?? -Infinity);
  const byGood = (a: PlanResult, b: PlanResult) => b.reasons.filter((r) => r.severity === 'good').length - a.reasons.filter((r) => r.severity === 'good').length;
  const byWarn = (a: PlanResult, b: PlanResult) => a.reasons.filter((r) => r.severity === 'warn').length - b.reasons.filter((r) => r.severity === 'warn').length;
  const tie = (a: PlanResult, b: PlanResult) => a.id.localeCompare(b.id);
  // A repeat (same crop / same family) never outranks a feasible alternation; then lower rotation penalty first.
  const byPenalty = (a: PlanResult, b: PlanResult) => Number(isRepeat(a)) - Number(isRepeat(b)) || rotationPenalty(a) - rotationPenalty(b);
  const byBenefit = (a: PlanResult, b: PlanResult) => rotationBenefit(b) - rotationBenefit(a);
  const chain: Record<string, ((a: PlanResult, b: PlanResult) => number)[]> = {
    cost: [byCost, byBenefit, byWarn, byClimate],
    climate: [byClimate, byBenefit, byWarn, byCost],
    continuity: [(a, b) => a.newCrops - b.newCrops, byBenefit, byWarn, byGood, byCost],
    return: [byReturn, byBenefit, byClimate, byCost],
    // soil benefit: legume / break-crop / fallow benefits first (G-R8), then climate, then cost
    soil: [byBenefit, byGood, byClimate, byCost],
  };
  return (a: PlanResult, b: PlanResult) => {
    for (const f of [byPenalty, ...chain[priority]]) { const d = f(a, b); if (Math.abs(d) > 1e-9) return d; }
    return tie(a, b);
  };
}

export function planTitle(p: PlanResult) {
  return `${cropName(p.crops[0])} → ${cropName(p.crops[1])}`;
}
