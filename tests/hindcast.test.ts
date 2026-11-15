import { describe, expect, it } from 'vitest';
import { HINDCAST_CASES, hindcast, linearTrend, pearson } from '../src/data/hindcast/hindcast';
import { modeledIndex } from '../src/data/hindcast/modelIndex';
import faostat from '../src/data/hindcast/faostat-yields.json';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';
import modeled from '../src/data/hindcast/modeled.json';

describe('hindcast vs FAOSTAT national yields', () => {
  it('stored modeled index matches the engine (regenerate with scripts/build-hindcast.ts)', () => {
    const DATA = { bambey, kostanay } as const;
    for (const c of HINDCAST_CASES) expect(modeledIndex(c, DATA[c.demo] as never)).toEqual((modeled.series as Record<string, unknown>)[c.key]);
  });
  it('FAOSTAT file carries provenance and real QCL codes', () => {
    expect(faostat.retrieved).toBe('2026-11-15');
    expect(faostat.series['SN-millet'].itemCode).toBe(79);
    expect(faostat.series['KZ-wheat'].areaCode).toBe(108);
    expect(faostat.series['SN-millet'].points.find((p) => p.year === 2002)?.kgHa).toBe(506.1);
  });
  it('statistics helpers', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    const t = linearTrend([0, 1, 2], [1, 3, 5]);
    expect(t.b).toBeCloseTo(2); expect(t.a).toBeCloseTo(1);
  });
  it('reports r, n and drought-year hits for every case', () => {
    for (const c of HINDCAST_CASES) {
      const h = hindcast(c);
      expect(h.n).toBeGreaterThanOrEqual(20);
      expect(Number.isFinite(h.r)).toBe(true);
      expect(h.hits.map((x) => x.year)).toEqual(c.droughtYears);
    }
    // Kazakhstan wheat is the strongest comparison (one dominant crop over a homogeneous steppe belt)
    expect(hindcast(HINDCAST_CASES[2]).r).toBeGreaterThan(0.4);
  });
});
