// Rotation rules (G-R6 monoculture, G-R7 same family, G-R8 cereal → legume), placeholder budgets for new farms,
// and FAOSTAT price sanity guards.
import { describe, expect, it } from 'vitest';
import type { FarmScenario } from '../src/domain/types';
import { refreshPlaceholder, rotationPenalty, runEngine, type EngineOutput } from '../src/engine/plan';
import { niceRound, placeholderBudget } from '../src/engine/budget';
import { cropPriceUsd } from '../src/data/countries';
import { detectPack, EAST_AFRICA, GLOBAL, SE_ASIA, SENEGAL } from '../src/data/regionPacks';
import { effectiveSoil } from '../src/soil/soil';
import { blankScenario } from '../src/state/AppContext';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const S = (bambey as any).series;
const soil = effectiveSoil('loam', null);
const sc = (o: Partial<FarmScenario>): FarmScenario => ({ ...structuredClone(DEMO_SENEGAL), history: [], fertilizer: [], availableFunds: 1e9, reserve: 0, laborAvailable: 'high', allowFallow: false, irrigation: 'no', needsResidue: false, ...o });
const codes = (out: EngineOutput, id: string) => out.allPlans.concat(out.baseline).find((p) => p.id === id)!.reasons.map((r) => `${r.code}:${r.severity}`);

describe('rotation rule: no monoculture in the options', () => {
  const out = runEngine(sc({ currency: 'USD', countryIso2: undefined }), S, soil, GLOBAL);
  it('same crop twice is excluded, with a MONOCULTURE block citing G-R6', () => {
    const mm = out.allPlans.find((p) => p.id === 'millet→millet')!;
    expect(mm.feasible).toBe(false);
    expect(out.excluded.some((p) => p.id === 'millet→millet')).toBe(true);
    expect(mm.reasons.some((r) => r.code === 'MONOCULTURE' && r.severity === 'block' && r.refs.includes('G-R6'))).toBe(true);
    for (const p of out.alternatives) expect(p.crops[0]).not.toBe(p.crops[1]);
  });
  it('the usual plan is still shown when it is a monoculture, flagged with the reason', () => {
    expect(out.baseline.crops).toEqual(['maize', 'maize']);
    expect(out.baseline.reasons.some((r) => r.code === 'MONOCULTURE')).toBe(true);
    expect(out.notes.some((n) => n.code === 'HISTORY_INCOMPLETE' && /assumed/.test(n.text))).toBe(true);
  });
  it('repeating last season’s crop is a monoculture too', () => {
    const o = runEngine(sc({ history: [{ id: 'h', cropId: 'millet', year: 2026, approximateDate: true }] }), S, soil, SENEGAL);
    const r = o.allPlans.find((p) => p.id === 'millet→cowpea')!.reasons.find((x) => x.code === 'MONOCULTURE')!;
    expect(r.severity).toBe('block');
    expect(r.text).toMatch(/last season/);
  });
  it('same family / shared pest group is warned and cereal ↔ legume is credited', () => {
    expect(codes(out, 'millet→sorghum')).toContain('SAME_FAMILY:warn');
    expect(codes(out, 'millet→cowpea')).toContain('BREAK_CROP:good');
    expect(codes(out, 'cowpea→millet')).toContain('LEGUME_BENEFIT:good');
    expect(codes(out, 'cowpea→millet')).not.toContain('SAME_FAMILY:warn');
  });
  it('rotations with a weaker break rank below clean rotations', () => {
    const ranks = out.alternatives.map(rotationPenalty);
    const best = Math.min(...out.allPlans.filter((p) => p.feasible).map(rotationPenalty));
    expect(ranks[0]).toBe(best);
  });
  it('an accepted continuous crop (irrigated rice–rice) is penalized, not excluded', () => {
    const o = runEngine(sc({ currency: 'USD', irrigation: 'yes', irrigationCapacityMm: 600, baselineOverride: ['maize', 'soybean'] }), S, soil, SE_ASIA);
    const rr = o.allPlans.find((p) => p.id === 'rice→rice')!;
    const m = rr.reasons.find((r) => r.code === 'MONOCULTURE')!;
    expect(m.severity).toBe('warn');
    expect(rotationPenalty(rr)).toBeGreaterThanOrEqual(2);
    if (o.alternatives.length) expect(o.alternatives[0].id).not.toBe('rice→rice');
  });
});

describe('demo farms keep their headline results', () => {
  const run = (s: FarmScenario, d: any) => runEngine(s, d.series, effectiveSoil(s.soil.texture, d.soil), detectPack(s.location.lat, s.location.lon));
  it('Bambey: usual groundnut → millet is 74,500 XOF over budget; two options fit', () => {
    const out = run(DEMO_SENEGAL, bambey);
    expect(out.baseline.id).toBe('groundnut→millet');
    expect(out.baseline.budget.headroom).toBe(-74500);
    expect(out.alternatives.map((p) => p.id)).toEqual(['sesame→millet', 'sesame→sorghum']);
  });
  it('Kostanay: usual wheat → wheat is flagged as a monoculture; options are break-crop rotations', () => {
    const out = run(DEMO_KAZAKHSTAN, kostanay);
    expect(out.baseline.reasons.some((r) => r.code === 'MONOCULTURE' && r.refs.includes('G-R6'))).toBe(true);
    expect(out.baseline.budget.status).toBe('unaffordable');
    expect(out.alternatives).toHaveLength(2);
    for (const p of out.alternatives) expect(p.crops).not.toContain('wheat');
  });
});

describe('placeholder budget for new farms', () => {
  it('nice rounding and the 90% rule', () => {
    expect(niceRound(471234)).toBe(470000);
    expect(niceRound(1049)).toBe(1050);
    expect(niceRound(1001, 'up')).toBe(1050);
    expect(niceRound(1000, 'up')).toBe(1000);
    const b = placeholderBudget(100000);
    expect(b).toEqual({ funds: 100000, reserve: 10000, spendable: 90000 });
  });
  it('raises spendable just enough that the cheapest alternative fits when none would at 90%', () => {
    const b = placeholderBudget(1000, [960, 990]);
    expect(b.spendable).toBeGreaterThanOrEqual(960);
    expect(b.spendable).toBeLessThan(1000);
  });

  const settle = (s: FarmScenario, pack = detectPack(s.location.lat, s.location.lon, s.countryIso2), series = S) => {
    let out = runEngine(s, series, soil, pack);
    const patch = refreshPlaceholder(s, out);
    if (patch) { s = { ...s, ...patch }; out = runEngine(s, series, soil, pack); }
    return { s, out };
  };
  for (const at of [
    { lat: 14.71, lon: -16.46, label: 'Bambey', iso2: 'SN' },
    { lat: 53.0, lon: 64.0, label: 'Kostanay', iso2: 'KZ', series: (kostanay as any).series },
    { lat: 12.0, lon: -90.0, label: 'Global screening', iso2: undefined },
  ] as { lat: number; lon: number; label: string; iso2?: string; series?: any }[]) {
    it(`${at.label}: usual plan slightly over budget, at least one alternative fits`, () => {
      const blank = blankScenario(at);
      expect(blank.synthetic).toBe(false);
      expect(blank.budgetPlaceholder).toBeTruthy();
      const { s, out } = settle(blank, undefined, at.series ?? S);
      const cost = out.baseline.budget.totalCash;
      expect(out.baseline.budget.status).toBe('unaffordable');
      expect(-out.baseline.budget.headroom / cost).toBeLessThan(0.15); // "slightly" over: ≤ 15%
      expect(out.alternatives.length).toBeGreaterThanOrEqual(1);
      expect(out.allPlans.filter((p) => p.feasible).length).toBeLessThan(out.allPlans.length / 2); // still a trade-off
      expect(out.notes[0].code).toBe('BUDGET_PLACEHOLDER');
      expect(s.reserve / s.availableFunds).toBeCloseTo(0.1, 2);
    });
  }
  it('the Kenya placeholder is in shillings and in a smallholder range', () => {
    const { s, out } = settle({ ...blankScenario({ lat: -0.4, lon: 35.95, iso2: 'KE' }), area: 1.5 }, EAST_AFRICA);
    expect(s.currency).toBe('KES');
    const usd = out.baseline.budget.totalCash / 129.3;
    expect(usd).toBeGreaterThan(300);
    expect(usd).toBeLessThan(2000);
  });
  it('stops being a placeholder once the farmer edits it; FX conversion is not an edit', () => {
    const { s, out } = settle(blankScenario({ lat: 14.71, lon: -16.46, iso2: 'SN' }));
    expect(refreshPlaceholder(s, out)).toBeNull();
    expect(refreshPlaceholder({ ...s, availableFunds: s.availableFunds + 5000 }, out)).toEqual({ budgetPlaceholder: null });
    const k = 1 / 581.928481; // XOF → USD as the Farm page converts it
    const usd = { ...s, currency: 'USD', availableFunds: Math.round(s.availableFunds * k), reserve: Math.round(s.reserve * k) };
    const patch = refreshPlaceholder(usd, runEngine(usd, S, soil, SENEGAL));
    expect(patch?.budgetPlaceholder).toBeTruthy();
    expect(patch?.budgetPlaceholder?.currency).toBe('USD');
  });
});

describe('FAOSTAT price sanity', () => {
  it('rejects country prices more than 3× off the global median, with an honest label', () => {
    const p = cropPriceUsd('PK', 'bean')!; // FAOSTAT lists 71 USD/t
    expect(p.source).toBe('faostat-median');
    expect(p.replaced?.usdPerT).toBeCloseTo(71.3, 1);
    expect(p.label).toMatch(/not used/);
    expect(cropPriceUsd('KE', 'maize')!.source).toBe('faostat-country');
  });
  it('engine reports replaced prices in its notes', () => {
    const out = runEngine(sc({ currency: 'NGN', countryIso2: 'NG' }), S, soil, SENEGAL);
    expect(out.prices.groundnut.replaced).toBeTruthy(); // 2013 value, 0.2× the median
    expect(out.notes.some((n) => n.code === 'PRICE_IMPLAUSIBLE')).toBe(true);
  });
  it('winter rapeseed is priced with the FAOSTAT rapeseed series', () => {
    expect(cropPriceUsd('UA', 'winterrapeseed')?.usdPerT).toBe(cropPriceUsd('UA', 'rapeseed')?.usdPerT);
  });
});

describe('regional packs: agronomic sense', () => {
  it('Corn Belt and Cerrado get their own packs', () => {
    expect(detectPack(42.0, -93.75, 'US').id).toBe('na-corn-belt');
    expect(detectPack(47.5, -101, 'US').id).toBe('na-temperate');
    expect(detectPack(-12.6, -55.9, 'BR').id).toBe('sam-cerrado-safrinha');
    expect(detectPack(-33, -61, 'AR').id).toBe('sam-summer-safrinha');
  });
  it('a usual plan that is assumed (no history) uses the regional typical sequence', () => {
    const b = blankScenario({ lat: 42.0, lon: -93.75, iso2: 'US' });
    const out = runEngine(b, S, soil, detectPack(42.0, -93.75, 'US'));
    expect(out.baseline.crops).toEqual(['maize', 'soybean']);
  });
});
