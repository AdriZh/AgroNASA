// Orchestrator: normalize → indicators → candidates → rules → costs → feasibility → rank → explain.
// Pure and deterministic: identical inputs always give identical results (no LLM in this path).
import type { CostItemDef, DailySeries, FarmScenario, Reason, RegionPack, SoilProfile } from '../domain/types';
import { CROPS, cropFor, cropName } from '../data/crops';
import { IRRIGATION_USD_PER_MM_HA } from '../data/regionPacks';
import { countryInfo, cropPriceUsd, fxFactor, fxPerUsd } from '../data/countries';
import { toHectares } from '../domain/units';
import { addDays, diffDays } from '../domain/dates';
import { median, quantile } from '../weather/indicators';
import { evaluateBudget, costLine, type BudgetResult, type CostLine } from './budget';
import { replayCrop, resolveSeasons, type CropRisk, type SowingWindow } from './replay';

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

export interface PriceInfo { perT: number | null; label: string; source: 'farmer' | 'faostat-country' | 'faostat-median' | 'pack' }

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
}

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
    if (prev && prev.id !== 'fallow') {
      const shared = c.diseaseGroups.filter((g) => prev.diseaseGroups.includes(g));
      for (const g of shared) {
        if (prev.id === c.id && c.minReturnSeasons > 0) continue; // already covered by return interval
        if (HARD_DISEASE.has(g)) {
          R.push({ code: 'DISEASE_GROUP', severity: 'block', text: `${tag}: follows ${prev.name}; both host ${g.replace('-', ' ')}.`, refs: [has('KZ-R3') && g === 'sclerotinia' ? 'KZ-R3' : 'G-R2'] });
        }
      }
      if (prev.group === 'legume' && c.group === 'cereal') {
        R.push({ code: 'LEGUME_BENEFIT', severity: 'good', text: `${tag}: follows a grain legume (${prev.name}) — possible residual-N and pest-break benefit.`, refs: [has('SN-R1') ? 'SN-R1' : has('KZ-R1') ? 'KZ-R1' : 'G-R3'] });
      }
    }
    if (prev?.id === 'fallow' && c.group === 'cereal' && has('KZ-R1')) {
      R.push({ code: 'FALLOW_BENEFIT', severity: 'good', text: `${tag}: follows fallow — stored soil moisture and disease break.`, refs: ['KZ-R1'] });
    }
    if (prev && prev.id === c.id && c.id !== 'fallow' && c.minReturnSeasons === 0) {
      R.push({ code: 'PRIOR_CROP_RULE', severity: 'warn', text: `${tag}: same crop as the previous season — rotation benefits lost; pest and disease carry-over.`, refs: ['G-R1', 'R31'] });
    }
    if (k >= 2 && [seq[k - 2], seq[k - 1], seq[k]].every((x) => CROPS[x]?.group === 'cereal')) {
      R.push({ code: 'PRIOR_CROP_RULE', severity: 'warn', text: `${tag}: third consecutive cereal season — pest, weed and fertility pressure rises.`, refs: ['G-R4'] });
    }
    // farmer constraints
    if (c.id !== 'fallow') {
      if (sc.unavailableCrops.includes(c.id)) R.push({ code: 'SEED_UNAVAILABLE', severity: 'block', text: `${tag}: seed reported unavailable.`, refs: ['input:unavailableCrops'] });
      if (sc.marketCrops.length && !sc.marketCrops.includes(c.id)) R.push({ code: 'MARKET_CONSTRAINT', severity: 'block', text: `${tag}: not in the crops you can sell or use.`, refs: ['input:marketCrops'] });
      if (LABOR_RANK[c.labor] > LABOR_RANK[sc.laborAvailable]) R.push({ code: 'LABOR_LIMIT', severity: 'block', text: `${tag}: needs ${c.labor} labor; ${sc.laborAvailable} available.`, refs: ['input:laborAvailable'] });
      if (c.irrigationRequired && sc.irrigation !== 'yes') R.push({ code: 'IRRIGATION_REQUIRED', severity: 'block', text: `${tag}: requires irrigation, which is not available.`, refs: ['input:irrigation'] });
      // climate screening from the NASA replay
      const r = plannedRisks[k - plannedFrom];
      if (r && r.years.length) {
        if (r.tempOutOfRange > 0.5) R.push({ code: 'CLIMATE_UNSUITABLE', severity: 'block', text: `${tag}: season mean temperature (${r.meanSeasonT?.toFixed(1)} °C) is outside ${c.name}'s range ${c.tMeanRange[0]}–${c.tMeanRange[1]} °C in most years.`, refs: ['D1', 'R17'] });
        else if (r.medianRel < 0.35) R.push({ code: 'CLIMATE_UNSUITABLE', severity: 'block', text: `${tag}: modeled water-limited yield is only ${(r.medianRel * 100).toFixed(0)}% of attainable in a median year.`, refs: ['R8', 'R18'] });
        else if (r.pSevere >= 0.35) R.push({ code: 'CLIMATE_RISK_HIGH', severity: 'warn', text: `${tag}: severe water stress (<50% of attainable) in ${(r.pSevere * 100).toFixed(0)}% of replayed years.`, refs: ['R8', 'R18'] });
        if (r.pHeat >= 0.3) R.push({ code: 'HEAT_EXPOSURE', severity: 'warn', text: `${tag}: ≥3 days with Tmax ≥ ${c.heatThresholdC} °C around flowering in ${(r.pHeat * 100).toFixed(0)}% of years (exploratory threshold).`, refs: ['R30', 'R17'] });
        if (r.pFrost >= 0.2) R.push({ code: 'FROST_RISK', severity: 'warn', text: `${tag}: frost (Tmin ≤ 0 °C) after emergence in ${(r.pFrost * 100).toFixed(0)}% of years.`, refs: ['R17'] });
      }
      if (soil.ph != null && (soil.ph < c.phRange[0] - 0.3 || soil.ph > c.phRange[1] + 0.3)) {
        R.push({ code: 'SOIL_PH', severity: 'warn', text: `${tag}: soil pH ${soil.ph.toFixed(1)} (${soil.source === 'soilgrids' ? 'SoilGrids estimate' : 'reported'}) is outside the usual ${c.phRange[0]}–${c.phRange[1]} range.`, refs: [soil.source === 'soilgrids' ? 'R21' : 'input:soil'] });
      }
    }
  }
  const planned = seq.slice(plannedFrom);
  if (sc.needsResidue && planned.every((x) => !CROPS[x].residueForLivestock)) {
    R.push({ code: 'RESIDUE_NEED', severity: 'warn', text: 'Neither season leaves residue for livestock, which you said you need.', refs: ['input:needsResidue'] });
  }
  return R;
}

function stats(v: number[]) { return { p20: quantile(v, 0.2), median: median(v), p80: quantile(v, 0.8) }; }

function outcomeFor(crops: [string, string], seasonRisks: [CropRisk | null, CropRisk | null], yearOffset: number, pack: RegionPack, sc: FarmScenario, areaHa: number, budget: BudgetResult, prices: Record<string, PriceInfo>): PlanOutcome {
  const r1 = seasonRisks[0] ?? undefined, r2 = seasonRisks[1] ?? undefined;
  const e1 = pack.economics[crops[0]], e2 = pack.economics[crops[1]];
  const pr1 = prices[crops[0]]?.perT ?? null, pr2 = prices[crops[1]]?.perT ?? null;
  const yld = (cropId: string, base: number) => { const o = sc.priceOverrides[`${cropId}:yield`]; return o != null ? o : base; };
  const y1Att = yld(crops[0], e1?.attainableYieldTHa ?? 0), y2Att = yld(crops[1], e2?.attainableYieldTHa ?? 0);
  const byYear = (r: CropRisk | undefined) => new Map((r?.years ?? []).map((y) => [y.year, y.relYield]));
  const m1 = byYear(r1), m2 = byYear(r2);
  const rels: number[] = [], severe: boolean[] = [], revs: number[] = [];
  const isF1 = crops[0] === 'fallow', isF2 = crops[1] === 'fallow';
  // replay coherent historical season pairs (Y, Y + offset): same weather sequence a farmer would have lived through
  const years = [...new Set([...m1.keys(), ...[...m2.keys()].map((y) => y - yearOffset)])].sort();
  for (const y of years) {
    const a = m1.get(y), b = m2.get(y + yearOffset);
    if ((!isF1 && a === undefined) || (!isF2 && b === undefined)) continue;
    const ra = isF1 ? null : a!, rb = isF2 ? null : b!;
    const active = [ra, rb].filter((x): x is number => x != null);
    if (!active.length) continue;
    rels.push(active.reduce((s, x) => s + x, 0) / active.length);
    severe.push(active.some((x) => x < 0.5));
    if ((ra == null || pr1 != null) && (rb == null || pr2 != null)) {
      revs.push(((ra ?? 0) * y1Att * (pr1 ?? 0) + (rb ?? 0) * y2Att * (pr2 ?? 0)) * areaHa);
    }
  }
  const yStats = (r: CropRisk | undefined, att: number, isF: boolean) => (isF || !r ? null : stats(r.years.map((y) => y.relYield * att * areaHa)));
  const revenue = revs.length ? stats(revs) : null;
  const net = revenue && budget.status !== 'unverified' ? { p20: revenue.p20 - budget.totalCash, median: revenue.median - budget.totalCash, p80: revenue.p80 - budget.totalCash } : null;
  return { pairs: rels.length, medianRel: median(rels), pSevereAny: severe.length ? severe.filter(Boolean).length / severe.length : NaN, revenue, net, yields: [yStats(r1, y1Att, isF1), yStats(r2, y2Att, isF2)] };
}

export function runEngine(sc: FarmScenario, s: DailySeries, soil: SoilProfile, pack: RegionPack): EngineOutput {
  const areaHa = toHectares(sc.area, sc.areaUnit);
  const windows = resolveSeasons(pack, s);
  const irrigation = { on: sc.irrigation === 'yes', capMm: sc.irrigationCapacityMm || 0 };
  const risks: Record<string, CropRisk> = {};
  const risksAfterFallow: Record<string, CropRisk> = {};
  const fallowInPlay = pack.mode === 'annual' && pack.crops.includes('fallow') && (sc.allowFallow || sc.history.some((h) => h.cropId === 'fallow') || !!sc.baselineOverride?.includes('fallow'));
  for (const w of windows) {
    for (const id of w.crops) {
      if (id === 'fallow' || !CROPS[id]) continue;
      const key = riskKey(pack, w, id);
      if (risks[key]) continue;
      const crop = cropFor(pack, id);
      risks[key] = { ...replayCrop(s, w, crop, soil, irrigation), seasonId: w.id, seasonLabel: w.label };
      if (fallowInPlay) risksAfterFallow[key] = { ...replayCrop(s, w, crop, soil, irrigation, true), seasonId: w.id, seasonLabel: w.label };
    }
  }

  // currency: pack economics are in pack.currency; convert into the scenario currency with FAOSTAT exchange rates
  const fx = { factor: fxFactor(pack.currency, sc.currency), from: pack.currency, to: sc.currency, year: countryInfo(sc.countryIso2)?.fxYear };
  const toLocalPerUsd = fxPerUsd(sc.currency) ?? (sc.currency === 'USD' ? 1 : null);
  const prices: Record<string, PriceInfo> = {};
  for (const c of pack.crops) {
    if (c === 'fallow') continue;
    const o = sc.priceOverrides[`${c}:price`];
    if (o !== undefined) { prices[c] = { perT: o, label: 'Your price', source: 'farmer' }; continue; }
    const ref = toLocalPerUsd ? cropPriceUsd(sc.countryIso2, c) : null;
    if (ref && toLocalPerUsd) prices[c] = { perT: Math.round(ref.usdPerT * toLocalPerUsd), label: ref.label, source: ref.source };
    else prices[c] = { perT: pack.economics[c]?.pricePerT != null ? Math.round(pack.economics[c].pricePerT! * (pack.currency === 'USD' ? (toLocalPerUsd ?? 1) : fx.factor)) : null, label: 'Placeholder price (synthetic; FAOSTAT has none)', source: 'pack' };
  }

  const hist = historyOrder(sc, pack);
  const history = hist.map((h) => h.cropId);
  const base = baselineCrops(sc, pack);
  const nSeasons = Object.values(risks)[0]?.years.length ?? 0;
  const notes: Reason[] = [];
  if (pack.reviewStatus !== 'reviewed') notes.push({ code: 'UNREVIEWED_RULES', severity: 'info', text: `Rule pack "${pack.short}" v${pack.version} has not been signed off by a local agronomist — results are a demonstration.`, refs: pack.rules.map((r) => r.id) });
  const country = countryInfo(sc.countryIso2);
  const priceNote = Object.values(prices).some((p) => p.source === 'faostat-country') ? `Crop sale prices: FAOSTAT producer prices${country ? ` for ${country.name}` : ''}` : 'Crop sale prices: FAOSTAT global medians (no country prices)';
  notes.push({ code: 'SYNTHETIC_PRICES', severity: 'info', text: `${priceNote}. Input costs are a synthetic regional template${fx.factor !== 1 ? ` converted ${fx.from}→${fx.to} at the FAOSTAT ${fx.year ?? ''} exchange rate` : ''} — edit them in Resources with dated local quotes.`, refs: ['R33', 'price-pack'] });
  notes.push({ code: 'CLIMATE_CONTEXT_ONLY', severity: 'info', text: `Risk comes from replaying ${nSeasons} historical NASA POWER seasons for this grid cell${windows.length > 1 ? ` in each of ${windows.length} seasons (${windows.map((w) => w.label).join(', ')})` : ''} — a conditional historical scenario, not a forecast.`, refs: ['D1', 'R17', 'R8'] });
  if (pack.irrigationTypical && sc.irrigation !== 'yes') notes.push({ code: 'IRRIGATION_REQUIRED', severity: 'info', text: `Most farms in "${pack.short}" are irrigated. Rainfed results here will look poor — set irrigation to “Yes” in Resources if your field is irrigated.`, refs: ['input:irrigation'] });
  if (sc.history.some((h) => !h.plantedOn) || sc.fertilizer.some((f) => f.treatedAreaHa == null)) notes.push({ code: 'HISTORY_INCOMPLETE', severity: 'info', text: 'Some crop dates or fertilizer treated areas are unknown; history interpretation is limited.', refs: ['input:history'] });

  const typicalSow = (w: SowingWindow, cropId: string, year: number) => {
    const r = risks[riskKey(pack, w, cropId)];
    const md = r?.medianSowing?.slice(5) ?? (w.earliest === 'auto' ? '06-15' : w.earliest);
    return `${year}-${md}`;
  };
  const duration = (c: string) => cropFor(pack, c).stages.reduce((a, b) => a + b, 0);
  const fmt = (x: number) => `${Math.round(x).toLocaleString('en-US')} ${sc.currency}`;
  const convert = (it: CostItemDef): CostItemDef => (fx.factor === 1 || it.unitPrice == null ? it : { ...it, unitPrice: Math.round(it.unitPrice * fx.factor * 100) / 100 });
  const irrUnit = Math.round(IRRIGATION_USD_PER_MM_HA * (toLocalPerUsd ?? 1) * 100) / 100;

  const build = (crops: [string, string], isBaseline: boolean): PlanResult => {
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
      const key = riskKey(pack, w, c);
      const risk = prevCrop === 'fallow' && risksAfterFallow[key] ? risksAfterFallow[key] : risks[key] ?? null;
      const sowing = k === 0 ? sow1 : typicalSow(w, c2, yr);
      return { season: (k + 1) as 1 | 2, year: yr, cropId: c, sowing, maturity: addDays(sowing, duration(c) - 1), risk, seasonId: w.id, seasonLabel: w.label };
    }) as [PlanSeason, PlanSeason];
    const lines: CostLine[] = [];
    seasons.forEach((ps) => {
      const e = pack.economics[ps.cropId];
      if (!e) return;
      for (const it of e.items) lines.push(costLine(convert(it), ps.season, ps.cropId, areaHa, ps.sowing, sc.priceOverrides[`${ps.cropId}:${it.key}`]));
      const irr = ps.risk?.medianIrrigation ?? 0;
      if (irrigation.on && irr > 0) {
        const key = 'irrigation-water';
        lines.push(costLine({ key, category: 'irrigation', label: `Irrigation water (modeled median ${irr.toFixed(0)} mm)`, qtyPerHa: irr, unit: 'mm·ha', unitPrice: irrUnit, dueOffsetDays: 45, essential: true, cash: true }, ps.season, ps.cropId, areaHa, ps.sowing, sc.priceOverrides[`${ps.cropId}:${key}`]));
      }
    });
    const budget = evaluateBudget(lines, sc.availableFunds, sc.reserve, sc.confirmedInflows, seasons[0].sowing);
    const reasons = ruleCheck([...history, ...crops], history.length, sc, pack, [seasons[0].risk, seasons[1].risk], soil);
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
    return {
      id: crops.join('→'), label: isBaseline ? 'Your usual plan' : '', isBaseline, crops, seasons, reasons, eligible, feasible, budget,
      outcome: outcomeFor(crops, [seasons[0].risk, seasons[1].risk], y2 - y1, pack, sc, areaHa, budget, prices), newCrops,
    };
  };

  const baseline = build(base, true);
  const all: PlanResult[] = [];
  const slot1 = pack.mode === 'double' ? windows[0].crops : pack.crops;
  const slot2 = pack.mode === 'double' ? (windows[1] ?? windows[0]).crops : pack.crops;
  for (const a of slot1) for (const b of slot2) {
    if (!CROPS[a] || !CROPS[b]) continue;
    if (a === 'fallow' && b === 'fallow') continue;
    if (!sc.allowFallow && (a === 'fallow' || b === 'fallow')) continue;
    if (a === base[0] && b === base[1]) continue;
    all.push(build([a, b], false));
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
  const alternatives = picked.map((p, i) => ({ ...p, rank: i + 1, label: i === 0 ? 'Option A' : 'Option B' }));
  const excluded = all.filter((p) => !p.feasible);
  return { pack, window: windows[0], windows, areaHa, risks, risksAfterFallow, prices, fx, baseline, alternatives, allPlans: all, excluded, notes };
}

const n0 = (x: number) => (Number.isFinite(x) ? x : 0);
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
  const chain: Record<string, ((a: PlanResult, b: PlanResult) => number)[]> = {
    cost: [byCost, byWarn, byClimate],
    climate: [byClimate, byWarn, byCost],
    continuity: [(a, b) => a.newCrops - b.newCrops, byWarn, byGood, byCost],
    return: [byReturn, byClimate, byCost],
  };
  return (a: PlanResult, b: PlanResult) => {
    for (const f of chain[priority]) { const d = f(a, b); if (Math.abs(d) > 1e-9) return d; }
    return tie(a, b);
  };
}

export function planTitle(p: PlanResult) {
  return `${cropName(p.crops[0])} → ${cropName(p.crops[1])}`;
}
