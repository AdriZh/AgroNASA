// Growing-season length (src/engine/season.ts) and the "Why these crops here?" location screen.
import { describe, expect, it } from 'vitest';
import type { DailySeries, FarmScenario } from '../src/domain/types';
import { frostYears, gdd, seasonLengthCheck } from '../src/engine/season';
import { runEngine, type EngineOutput } from '../src/engine/plan';
import { detectPack, GLOBAL } from '../src/data/regionPacks';
import { CROPS } from '../src/data/crops';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { effectiveSoil } from '../src/soil/soil';
import { loadFaostat } from '../src/data/countries';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

await loadFaostat();

/** Synthetic 2001–2003 record: Tmin 5 °C and Tmean 15 °C every day, with frost (Tmin −3 °C) on chosen days of year. */
function synthetic(frostDoys: number[], lat = 50): DailySeries {
  const n = 365 * 3;
  const TN: number[] = [], T: number[] = [], TX: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = (i % 365) + 1;
    TN.push(frostDoys.includes(d) ? -3 : 5); T.push(15); TX.push(25);
  }
  return { meta: { lat, lon: 0, elevation: 0, start: '2001-01-01', end: '2003-12-31', retrievedAt: '', query: '', sources: [], fillValue: -999, cached: true, label: 'synthetic' }, n, TN, T, TX, P: TN.map(() => 0), RH: TN.map(() => 50) } as unknown as DailySeries;
}

describe('frost dates, frost-free days and GDD (synthetic series)', () => {
  const s = synthetic([20, 100, 280, 330]); // last spring frost doy 100 (10 Apr), first autumn frost doy 280 (7 Oct)
  it('finds the last spring and first autumn frost of every year', () => {
    const fy = frostYears(s);
    expect(fy).toHaveLength(3);
    expect(fy[0]).toMatchObject({ year: 2001, lastSpringFrost: '2001-04-10', firstAutumnFrost: '2001-10-07', frostFreeDays: 179 });
    expect(fy[2].lastSpringFrost).toBe('2003-04-10');
  });
  it('accumulates GDD above the base temperature', () => {
    expect(gdd(s, '2001-05-01', 10, 10)).toBe(50);
    expect(gdd(s, '2001-05-01', 10, 20)).toBe(0);
  });
  const crop = (days: number, frostSensitive = true) => ({ stages: [days / 4, days / 4, days / 4, days / 4], frostSensitive });
  it('passes a crop that fits the frost-free season and blocks one that does not', () => {
    // frost-sensitive: sown a week after the last frost (doy 108) → 172 days to the first autumn frost
    const ok = seasonLengthCheck(s, crop(160));
    expect(ok).toMatchObject({ applicable: true, frostFree: false, years: 3, okYears: 3, pass: true, medianFrostFreeDays: 179, medianLastSpring: '04-10', medianFirstAutumn: '10-07' });
    expect(ok.detail[0].sowing).toBe('2001-04-18');
    expect(ok.detail[0].gdd).toBe(172 * 5);
    const short = seasonLengthCheck(s, crop(176));
    expect(short).toMatchObject({ okYears: 0, years: 3, pass: false });
  });
  it('uses the replay sowing dates when given', () => {
    const late = seasonLengthCheck(s, crop(120), { 2001: '2001-06-20', 2002: '2002-06-20', 2003: '2003-04-20' });
    // 20 Jun + 120 d = 17 Oct, after the 7 Oct frost; 20 Apr + 120 d = 17 Aug, before it → 1 of 3 years
    expect(late).toMatchObject({ years: 3, okYears: 1, pass: false });
  });
  it('treats frost-free records as always passing and skips overwintering crops', () => {
    const tropical = synthetic([]);
    expect(seasonLengthCheck(tropical, crop(300))).toMatchObject({ frostFree: true, pass: true });
    expect(seasonLengthCheck(s, { stages: [40, 150, 45, 30], frostSensitive: false })).toMatchObject({ applicable: false, pass: true });
  });
  it('uses a 1 July season year in the southern hemisphere', () => {
    const south = synthetic([200, 330], -30); // frost on 19 Jul and 26 Nov: days 18 and 148 of the season year, both spring
    const fy = frostYears(south);
    expect(fy[0].start).toBe('2001-07-01');
    expect(fy[0].lastSpringFrost).toBe('2001-11-26');
    expect(fy[0].firstAutumnFrost).toBeNull();
    expect(fy).toHaveLength(2);
  });
});

const soilOf = (sc: FarmScenario, d: any) => effectiveSoil(sc.soil.texture, d.soil);
const run = (sc: FarmScenario, d: any, pack = detectPack(sc.location.lat, sc.location.lon, sc.countryIso2)) => runEngine(sc, d.series as DailySeries, soilOf(sc, d), pack);
const screenOf = (out: EngineOutput, id: string) => out.screen.crops.find((c) => c.cropId === id)!;

describe('season length at the demo locations', () => {
  it('Kostanay blocks a long-season tropical crop (cotton) by season length', () => {
    const chk = seasonLengthCheck((kostanay as any).series, CROPS.cotton);
    expect(chk.applicable && !chk.frostFree).toBe(true);
    expect(chk.okYears).toBeLessThan(chk.years / 2);
    const out = run({ ...DEMO_KAZAKHSTAN, history: [] }, kostanay, GLOBAL);
    const cotton = screenOf(out, 'cotton');
    expect(cotton.ok).toBe(false);
    const st = cotton.items.find((i) => i.reason.code === 'SEASON_TOO_SHORT')!;
    expect(st.reason.severity).toBe('block');
    expect(st.short).toMatch(/^matures before frost in only \d+ of 25 years$/);
    expect(st.reason.refs).toContain('R40');
  });
  it('Kostanay spring crops of the steppe pack all mature before frost', () => {
    const out = run(DEMO_KAZAKHSTAN, kostanay);
    for (const c of out.screen.crops) {
      expect(c.items.some((i) => i.reason.code === 'SEASON_TOO_SHORT'), c.cropId).toBe(false);
      expect(c.line).toMatch(/matures before frost in \d+\/25 years/);
    }
  });
  it('Bambey is frost-free: every crop passes the frost and season-length checks', () => {
    const out = run(DEMO_SENEGAL, bambey);
    expect(out.screen.crops.length).toBe(6);
    for (const c of out.screen.crops) {
      expect(c.items.some((i) => i.reason.code === 'SEASON_TOO_SHORT' || i.reason.code === 'FROST_RISK'), c.cropId).toBe(false);
      expect(out.risks[c.cropId].season?.frostFree).toBe(true);
      expect(c.line.startsWith('frost-free location')).toBe(true);
    }
  });
});

describe('global-screening offers only crops that pass the NASA screen', () => {
  for (const [name, sc, d] of [['Kostanay', DEMO_KAZAKHSTAN, kostanay], ['Bambey', DEMO_SENEGAL, bambey]] as const) {
    it(name, () => {
      const out = run({ ...sc, history: [], baselineOverride: undefined }, d, GLOBAL);
      expect(out.screen.filtered).toBe(true);
      const ok = new Set(out.screen.crops.filter((c) => c.ok).map((c) => c.cropId));
      const failing = out.screen.crops.filter((c) => !c.ok).map((c) => c.cropId);
      expect(failing.length).toBeGreaterThan(0);
      for (const p of [out.baseline, ...out.allPlans, ...out.alternatives]) {
        for (const c of p.crops) if (c !== 'fallow') expect(ok.has(c), `${p.id} offers ${c}`).toBe(true);
      }
      for (const p of out.allPlans) expect(p.reasons.some((r) => r.code === 'CLIMATE_UNSUITABLE' || r.code === 'SEASON_TOO_SHORT')).toBe(false);
    });
  }
  it('no tropical crops in Kostanay, no cool-season crops in Bambey', () => {
    const kz = run({ ...DEMO_KAZAKHSTAN, history: [] }, kostanay, GLOBAL);
    for (const id of ['cotton', 'millet', 'rice']) expect(screenOf(kz, id).ok, id).toBe(false);
    const sn = run({ ...DEMO_SENEGAL, history: [] }, bambey, GLOBAL);
    for (const id of ['wheat', 'barley', 'potato']) expect(screenOf(sn, id).ok, id).toBe(false);
  });
});

describe('demo headlines are unchanged by the screen', () => {
  it('Senegal: usual groundnut → pearl millet 454,500 XOF, 74,500 over; best fit sesame → pearl millet', () => {
    const out = run(DEMO_SENEGAL, bambey);
    expect(out.baseline.id).toBe('groundnut→millet');
    expect(out.baseline.budget.totalCash).toBe(454500);
    expect(out.baseline.budget.headroom).toBe(-74500);
    expect(out.alternatives[0].id).toBe('sesame→millet');
  });
  it('Kazakhstan: usual wheat → wheat is over budget and flagged', () => {
    const out = run(DEMO_KAZAKHSTAN, kostanay);
    expect(out.baseline.id).toBe('wheat→wheat');
    expect(out.baseline.budget.status).toBe('unaffordable');
    expect(out.baseline.reasons.some((r) => r.code === 'MONOCULTURE')).toBe(true);
  });
});
