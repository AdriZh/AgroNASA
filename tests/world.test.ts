// World coverage: FAOSTAT data, multi-season engine, NASA GIBS colormap decoding.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { countryInfo, cropPriceUsd, fxFactor } from '../src/data/countries';
import { detectPack, EUROPE, PACKS, SOUTH_ASIA, EAST_AFRICA } from '../src/data/regionPacks';
import { CROPS } from '../src/data/crops';
import { runEngine } from '../src/engine/plan';
import { effectiveSoil } from '../src/soil/soil';
import { DEMO_SENEGAL } from '../src/state/demo';
import { lookup, parseColormap, rangeMid, tilePixel, IGBP } from '../src/weather/gibsPoint';
import { pearson, slopePerYear } from '../src/state/space';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const sc = (o: object) => ({ ...structuredClone(DEMO_SENEGAL), history: [], fertilizer: [], availableFunds: 1e9, reserve: 0, allowFallow: false, irrigation: 'no' as const, ...o });

describe('FAOSTAT country data', () => {
  it('has currency, exchange rate and producer prices', () => {
    expect(countryInfo('SN')?.currency).toBe('XOF');
    expect(countryInfo('KE')?.currency).toBe('KES');
    expect(fxFactor('USD', 'KES')).toBeGreaterThan(50);
    expect(fxFactor('USD', 'USD')).toBe(1);
    expect(cropPriceUsd('KE', 'maize')?.source).toBe('faostat-country');
  });
  it('falls back to the global median when a country has no price', () => {
    const p = cropPriceUsd('IN', 'rice');
    expect(p?.source).toBe('faostat-median');
    expect(p!.usdPerT).toBeGreaterThan(100);
  });
});

describe('regional packs', () => {
  it('every pack crop exists with economics and a season', () => {
    for (const p of PACKS) for (const c of p.crops) {
      expect(CROPS[c], `${p.id}:${c}`).toBeTruthy();
      expect(p.economics[c], `${p.id}:${c} economics`).toBeTruthy();
      expect(p.seasons.some((s) => s.crops.includes(c))).toBe(true);
    }
  });
  it('detects packs by country and latitude band', () => {
    expect(detectPack(12, 8.5, 'NG').id).toBe('sn-groundnut-basin');
    expect(detectPack(-14, 33.7, 'MW').id).toBe('sa-summer-rain');
    expect(detectPack(48.4, 32.5, 'UA').id).toBe(EUROPE.id);
    expect(detectPack(55, 37.6, 'RU').id).toBe(EUROPE.id);
  });
});

describe('multi-season engine', () => {
  it('double-season packs plan two seasons in the same year', () => {
    const out = runEngine(sc({ currency: 'KES', countryIso2: 'KE' }), (bambey as any).series, effectiveSoil('loam', null), EAST_AFRICA);
    const [a, b] = out.baseline.seasons;
    expect(a.seasonId).toBe('long');
    expect(b.seasonId).toBe('short');
    expect(a.year).toBe(b.year);
    expect(out.windows).toHaveLength(2);
  });
  it('blocks a long first crop that is still in the field at the second sowing', () => {
    const out = runEngine(sc({ currency: 'INR', countryIso2: 'IN', irrigation: 'yes', irrigationCapacityMm: 400 }), (bambey as any).series, effectiveSoil('loam', null), SOUTH_ASIA);
    const p = out.allPlans.find((x) => x.id === 'cotton→wheat')!;
    expect(p.reasons.some((r) => r.code === 'SEASON_OVERLAP')).toBe(true);
    expect(p.feasible).toBe(false);
  });
  it('annual packs sequence winter and spring crops without overlap', () => {
    const s = sc({ currency: 'UAH', countryIso2: 'UA' });
    const out = runEngine(s, (kostanay as any).series, effectiveSoil('loam', null), EUROPE);
    const mw = out.allPlans.find((x) => x.id === 'maize→winterwheat')!;
    expect(mw.seasons[1].year).toBe(mw.seasons[0].year); // maize harvested, wheat sown the same autumn
    const wm = out.allPlans.find((x) => x.id === 'winterwheat→maize')!;
    expect(wm.seasons[1].year).toBe(wm.seasons[0].year + 2); // wheat harvested next summer, maize the spring after
    for (const p of out.allPlans) expect(p.reasons.some((r) => r.code === 'SEASON_OVERLAP')).toBe(false);
  });
  it('uses FAOSTAT country prices converted to the scenario currency', () => {
    const out = runEngine(sc({ currency: 'KES', countryIso2: 'KE' }), (bambey as any).series, effectiveSoil('loam', null), EAST_AFRICA);
    expect(out.prices.maize.source).toBe('faostat-country');
    expect(out.prices.maize.perT!).toBeGreaterThan(10000);
    expect(out.fx.factor).toBeGreaterThan(50);
  });
});

describe('NASA GIBS colormap decoding', () => {
  const ndvi = parseColormap(readFileSync('tests/fixtures/cm_MODIS_L3_NDVI.xml', 'utf8'));
  const igbp = parseColormap(readFileSync('tests/fixtures/cm_MODIS_IGBP_Land_Cover_Type.xml', 'utf8'));
  it('parses ranges and classes', () => {
    expect(rangeMid('[0.4876,0.4951)')).toBeCloseTo(0.49135, 4);
    expect(rangeMid('[-INF,-30.00)')).toBe(-30);
    expect(ndvi.length).toBeGreaterThan(100);
    expect(lookup(ndvi, 93, 163, 1)!.value!).toBeCloseTo(0.491, 2); // Bambey, late Aug 2024
    const crop = lookup(igbp, 250, 239, 115)!;
    expect(IGBP[Math.round(crop.value!)]).toBe('Cropland');
  });
  it('never guesses a far colour', () => {
    expect(lookup(ndvi, 255, 0, 255)).toBeNull();
  });
  it('locates the field pixel in Web-Mercator tiles', () => {
    expect(tilePixel(14.71, -16.46, 9)).toMatchObject({ tx: 232, ty: 234 });
  });
  it('statistics helpers', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1, 6);
    expect(slopePerYear([2002, 2003, 2004, 2005, 2006].map((y, i) => ({ year: y, value: 10 - 2 * i })))).toBeCloseTo(-2, 6);
  });
});
