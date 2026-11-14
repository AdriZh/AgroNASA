// Acceptance tests from 03_Step_by_Step_Implementation_Plan §7.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeApplication, toHectares, P2O5_TO_P } from '../src/domain/units';
import { costLine, evaluateBudget } from '../src/engine/budget';
import type { CostItemDef, FertilizerApplication } from '../src/domain/types';
import { parsePower } from '../src/weather/power';
import { windowStats, yearlyWindow } from '../src/weather/indicators';
import { et0PenmanMonteith } from '../src/weather/et0';
import { runEngine } from '../src/engine/plan';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { detectPack, GLOBAL, KAZAKHSTAN, SENEGAL } from '../src/data/regionPacks';
import { effectiveSoil, saxtonRawlsAwc, textureClass } from '../src/soil/soil';
import { reviewSeason } from '../src/engine/review';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const app = (o: Partial<FertilizerApplication>): FertilizerApplication => ({
  id: 'a', cropSeasonId: 's', productId: 'urea', productName: 'Urea', type: 'mineral', approximateDate: false,
  quantity: 100, quantityUnit: 'kg', treatedAreaHa: 2, n: 46, p2o5: 0, k2o: 0, source: 'receipt', ...o,
});
const item = (price: number | null, due = 0, essential = true): CostItemDef => ({ key: 'k', category: 'seed', label: 'x', qtyPerHa: 1, unit: 'lot', unitPrice: price, dueOffsetDays: due, essential, cash: true });

describe('units and fertilizer history', () => {
  it('area conversion: 100 kg / 2 ha = 50 kg/ha; acre and m² consistent', () => {
    expect(normalizeApplication(app({})).rateKgHa).toBe(50);
    expect(toHectares(1, 'acre')).toBeCloseTo(0.404686, 5);
    expect(toHectares(10000, 'm2')).toBeCloseTo(1, 10);
    expect(() => toHectares(0, 'ha')).toThrow();
  });
  it('N label: 46% N at 50 kg product/ha → 23 kg applied N/ha', () => {
    expect(normalizeApplication(app({})).nKgHa).toBeCloseTo(23, 10);
  });
  it('missing composition stays unknown, not zero', () => {
    const r = normalizeApplication(app({ productId: 'manure', type: 'organic', n: null, p2o5: null, k2o: null }));
    expect(r.nKgHa).toBeNull();
    expect(r.flags.join(' ')).toMatch(/composition unknown/);
  });
  it('unknown treated area never assumes the whole field', () => {
    const r = normalizeApplication(app({ treatedAreaHa: null }));
    expect(r.rateKgHa).toBeNull();
    expect(r.nKgHa).toBeNull();
  });
  it('bags need a bag mass; P2O5 convention preserved', () => {
    expect(normalizeApplication(app({ quantityUnit: 'bag', quantity: 2, bagMassKg: null })).productKg).toBeNull();
    expect(normalizeApplication(app({ quantityUnit: 'bag', quantity: 2, bagMassKg: 50 })).productKg).toBe(100);
    expect(P2O5_TO_P).toBeCloseTo(0.4364, 4);
  });
});

describe('budget engine', () => {
  it('boundary: funds 1,000 − reserve 100 = 900; 900 passes, 900.01 fails', () => {
    const ok = evaluateBudget([costLine(item(900), 1, 'c', 1, '2027-07-01')], 1000, 100, [], '2027-07-01');
    expect(ok.cap).toBe(900);
    expect(ok.status).toBe('affordable');
    const no = evaluateBudget([costLine(item(900.01), 1, 'c', 1, '2027-07-01')], 1000, 100, [], '2027-07-01');
    expect(no.status).toBe('unaffordable');
  });
  it('synthetic fixture: baseline 1,120 excluded; A/B/C headroom 40/120/210', () => {
    const plans = { Baseline: [200, 300, 350, 170, 100], A: [180, 220, 300, 80, 80], B: [160, 180, 300, 60, 80], C: [140, 150, 280, 40, 80] };
    const res = Object.fromEntries(Object.entries(plans).map(([k, v]) => [k, evaluateBudget(v.map((p) => costLine(item(p), 1, 'c', 1, '2027-07-01')), 1000, 100, [], '2027-07-01')]));
    expect(res.Baseline.totalCash).toBe(1120);
    expect(res.Baseline.status).toBe('unaffordable');
    expect([res.A.headroom, res.B.headroom, res.C.headroom]).toEqual([40, 120, 210]);
  });
  it('cash timing: fits total with a later inflow but not before planting', () => {
    const lines = [costLine(item(800, -5), 1, 'c', 1, '2027-07-01'), costLine(item(300, 60), 1, 'c', 1, '2027-07-01')];
    const r = evaluateBudget(lines, 1000, 300, [{ id: 'i', date: '2027-08-01', amount: 500, label: 'subsidy' }], '2027-07-01');
    expect(r.totalCash).toBe(1100);
    expect(r.status).toBe('timing');
    expect(r.timingViolation?.date).toBe('2027-06-26');
  });
  it('missing essential price → not verified affordable', () => {
    const r = evaluateBudget([costLine(item(null), 1, 'c', 1, '2027-07-01')], 1000, 0, [], '2027-07-01');
    expect(r.status).toBe('unverified');
  });
  it('a dated user price replaces the missing one', () => {
    const r = evaluateBudget([costLine(item(null), 1, 'c', 1, '2027-07-01', 50)], 1000, 0, [], '2027-07-01');
    expect(r.status).toBe('affordable');
    expect(r.lines[0].overridden).toBe(true);
  });
});

describe('NASA POWER regression (archived D1 query)', () => {
  const raw = JSON.parse(readFileSync('data/archive/04_NASA_POWER_Bambey_2001_2025.json', 'utf8'));
  const { series, quality } = parsePower(raw, 'D1', '2026-11-14', 'D1');
  it('D1 has 9,131 records and no missing values', () => {
    expect(quality.records).toBe(9131);
    expect(Object.values(quality.missing).every((m) => m === 0 || m === 9131)).toBe(true);
  });
  it('June–October 2002 = 308.92 mm and 2009 = 975.63 mm', () => {
    expect(windowStats(series, '2002-06-01', '2002-10-31').rainMm).toBeCloseTo(308.92, 2);
    expect(windowStats(series, '2009-06-01', '2009-10-31').rainMm).toBeCloseTo(975.63, 2);
  });
  it('window sensitivity: ≥10-day spells 20/25 (Jun–Oct) vs 1/25 (Jul–Sep)', () => {
    const jo = yearlyWindow(series, '06-01', '10-31');
    const js = yearlyWindow(series, '07-01', '09-30');
    expect(jo.length).toBe(25);
    expect(jo.filter((r) => r.longestDry >= 10).length).toBe(20);
    expect(js.filter((r) => r.longestDry >= 10).length).toBe(1);
  });
  it('fill values are flagged, never treated as zero', () => {
    const copy = JSON.parse(JSON.stringify(raw));
    copy.properties.parameter.PRECTOTCORR['20020715'] = -999;
    const { series: s2, quality: q2 } = parsePower(copy, 'x', 'x', 'x');
    expect(q2.missing.PRECTOTCORR).toBe(1);
    expect(windowStats(s2, '2002-06-01', '2002-10-31').rainMm).toBeNull();
  });
});

describe('science helpers', () => {
  it('FAO-56 Example 18 (Brussels, 6 July): ET0 ≈ 3.9 mm/day', () => {
    // Tmax 21.5, Tmin 12.3, RHmean from ea 1.409 kPa (≈ 71%), u2 2.078, Rs 22.07, lat 50.8, z 100
    expect(et0PenmanMonteith(21.5, 12.3, 71.4, 2.078, 22.07, 50.8, 187, 100)).toBeCloseTo(3.9, 0);
  });
  it('soil texture and pedotransfer behave sensibly', () => {
    expect(textureClass(85, 5)).toBe('loamy-sand');
    expect(textureClass(40, 20)).toBe('loam');
    expect(saxtonRawlsAwc(20, 20, 2.5)).toBeGreaterThan(saxtonRawlsAwc(88, 5, 0.5));
  });
  it('region detection', () => {
    expect(detectPack(14.7, -16.5).id).toBe(SENEGAL.id);
    expect(detectPack(53, 64).id).toBe(KAZAKHSTAN.id);
    expect(detectPack(40, -95).id).toBe(GLOBAL.id);
  });
});

describe('decision engine (demo farms)', () => {
  const run = (sc: typeof DEMO_SENEGAL, d: any) => runEngine(sc, d.series, effectiveSoil(sc.soil.texture, d.soil), detectPack(sc.location.lat, sc.location.lon));
  it('baseline is always shown, even when unaffordable', () => {
    const out = run(DEMO_SENEGAL, bambey);
    expect(out.baseline.isBaseline).toBe(true);
    expect(out.baseline.budget.status).toBe('unaffordable');
    expect(out.baseline.reasons[0].code).toBe('BUDGET_EXCEEDED');
  });
  it('no labelled-affordable plan exceeds cash at its due dates', () => {
    for (const [sc, d] of [[DEMO_SENEGAL, bambey], [DEMO_KAZAKHSTAN, kostanay]] as const) {
      const out = run(sc, d);
      for (const p of out.allPlans.filter((x) => x.budget.status === 'affordable')) {
        expect(p.budget.timingViolation).toBeNull();
        expect(p.budget.totalCash).toBeLessThanOrEqual(p.budget.cap + p.budget.inflowsTotal + 1e-9);
      }
    }
  });
  it('rule exclusions carry reason ids (groundnut after groundnut, Sclerotinia)', () => {
    const sn = run(DEMO_SENEGAL, bambey);
    const gg = sn.allPlans.find((p) => p.id === 'groundnut→groundnut')!;
    expect(gg.feasible).toBe(false);
    expect(gg.reasons.some((r) => r.code === 'RETURN_INTERVAL' && r.refs.includes('SN-R2'))).toBe(true);
    const kz = run(DEMO_KAZAKHSTAN, kostanay);
    const sr = kz.allPlans.find((p) => p.id === 'sunflower→rapeseed')!;
    expect(sr.reasons.some((r) => r.code === 'DISEASE_GROUP')).toBe(true);
  });
  it('unavailable seed removes the crop with a reason', () => {
    const out = run({ ...DEMO_SENEGAL, unavailableCrops: ['sesame'] }, bambey);
    expect(out.alternatives.every((p) => !p.crops.includes('sesame'))).toBe(true);
    expect(out.excluded.find((p) => p.crops.includes('sesame'))!.reasons.some((r) => r.code === 'SEED_UNAVAILABLE')).toBe(true);
  });
  it('no result is honest: zero alternatives when nothing fits', () => {
    const out = run({ ...DEMO_SENEGAL, availableFunds: 1000, reserve: 0 }, bambey);
    expect(out.alternatives.length).toBe(0);
  });
  it('a budget edit changes feasibility and the reason explains it', () => {
    const rich = run({ ...DEMO_SENEGAL, availableFunds: 2_000_000 }, bambey);
    expect(rich.baseline.budget.status).toBe('affordable');
    expect(rich.baseline.reasons[0].code).toBe('BUDGET_OK');
  });
  it('deterministic: same inputs → same output', () => {
    const a = run(DEMO_KAZAKHSTAN, kostanay), b = run(DEMO_KAZAKHSTAN, kostanay);
    expect(a.alternatives.map((p) => p.id)).toEqual(b.alternatives.map((p) => p.id));
  });
  it('past-season feedback never asserts causes', () => {
    const out = run(DEMO_SENEGAL, bambey);
    const soil = effectiveSoil('unknown', (bambey as any).soil);
    for (const h of DEMO_SENEGAL.history) {
      const r = reviewSeason(DEMO_SENEGAL, h, (bambey as any).series, out.window, soil)!;
      const text = r.statements.map((s) => s.text).join(' ');
      expect(text).not.toMatch(/failed because|caused your|will earn|guarantee/i);
      expect(text).toMatch(/not measured/);
    }
  });
});
