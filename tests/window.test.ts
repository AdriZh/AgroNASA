// "When is your field free?": short-window maturity / frost / water check on the NASA POWER replay.
import { describe, expect, it } from 'vitest';
import type { DailySeries } from '../src/domain/types';
import { addDays, diffDays } from '../src/domain/dates';
import { CROPS } from '../src/data/crops';
import { detectPack, KAZAKHSTAN, PACKS } from '../src/data/regionPacks';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { effectiveSoil } from '../src/soil/soil';
import { loadFaostat } from '../src/data/countries';
import { runEngine } from '../src/engine/plan';
import { defaultWindow, fitWindow, killTempC, windowCandidates, windowDays, type WindowResult } from '../src/engine/window';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

await loadFaostat();

/** Synthetic daily series 2001–2010: constant weather, with optional per-day overrides of the minimum temperature. */
function synth(opts: { T?: number; TN?: number; P?: number; frost?: { mmdd: string; tn: number } } = {}): DailySeries {
  const start = '2001-01-01', end = '2010-12-31';
  const n = diffDays(start, end) + 1;
  const fill = (v: number) => new Array<number | null>(n).fill(v);
  const s: DailySeries = {
    meta: { lat: 50, lon: 60, elevation: 200, start, end, retrievedAt: '', query: 'synthetic', sources: [], fillValue: -999, cached: true, label: 'synthetic' },
    n, P: fill(opts.P ?? 3), T: fill(opts.T ?? 20), TX: fill((opts.T ?? 20) + 6), TN: fill(opts.TN ?? 12),
    RH: fill(60), WS: fill(2), RS: fill(18), GWR: fill(0.5), GWT: fill(0.5),
  };
  if (opts.frost) for (let y = 2001; y <= 2010; y++) s.TN[diffDays(start, `${y}-${opts.frost.mmdd}`)] = opts.frost.tn;
  return s;
}
const fit = (r: WindowResult, id: string) => r.all.find((f) => f.cropId === id)!;

describe('fitWindow on synthetic weather', () => {
  it('matures on growing-degree days and reports the median maturity date', () => {
    const r = fitWindow(synth(), KAZAKHSTAN, ['buckwheat', 'mustard-gm'], { start: '07-15', end: '11-30' });
    const bw = fit(r, 'buckwheat'); // tbase 5 °C, 600 °C·d at a constant 20 °C → 15 °C·d per day → 40th day
    expect(bw.method).toBe('gdd');
    expect(bw.matured).toBe(10);
    expect(bw.medianMaturity).toBe(addDays('2001-07-15', 39).slice(5));
    expect(bw.frostKills).toBe(0);
  });

  it('a 0 °C frost before maturity kills frost-sensitive crops but not frost-tolerant ones; −3 °C kills both', () => {
    expect(killTempC(CROPS.buckwheat)).toBe(0);
    expect(killTempC(CROPS['mustard-gm'])).toBe(-2);
    const light = fitWindow(synth({ frost: { mmdd: '08-05', tn: -1 } }), KAZAKHSTAN, ['buckwheat', 'mustard-gm'], { start: '07-15', end: '11-30' });
    expect(fit(light, 'buckwheat').frostKills).toBe(10);
    expect(fit(light, 'buckwheat').binding).toBe('frost');
    expect(fit(light, 'buckwheat').reason).toMatch(/frost .*10 of 10/);
    expect(fit(light, 'mustard-gm').frostKills).toBe(0);
    const hard = fitWindow(synth({ frost: { mmdd: '08-05', tn: -3 } }), KAZAKHSTAN, ['buckwheat', 'mustard-gm'], { start: '07-15', end: '11-30' });
    expect(fit(hard, 'mustard-gm').frostKills).toBe(10);
    expect(hard.recommended).toBe('fallow');
  });

  it('a frost after maturity does not count', () => {
    const r = fitWindow(synth({ frost: { mmdd: '10-01', tn: -5 } }), KAZAKHSTAN, ['buckwheat'], { start: '07-15', end: '11-30' });
    expect(fit(r, 'buckwheat').matured).toBe(10);
  });

  it('a window that is too short recommends rest, which is always listed last', () => {
    const r = fitWindow(synth(), KAZAKHSTAN, undefined, { start: '07-15', end: '08-05' });
    for (const f of r.all.filter((x) => x.tag !== 'rest')) { expect(f.matured).toBe(0); expect(f.binding).toBe('window'); }
    expect(r.recommended).toBe('fallow');
    expect(r.options[r.options.length - 1].cropId).toBe('fallow');
    expect(r.options.length).toBeLessThanOrEqual(4);
  });

  it('too cold to sow is reported, not silently sown', () => {
    const r = fitWindow(synth({ T: 3, TN: 1 }), KAZAKHSTAN, ['buckwheat'], { start: '07-15', end: '11-30' });
    expect(fit(r, 'buckwheat').noSowing).toBe(10);
    expect(fit(r, 'buckwheat').binding).toBe('cold');
  });

  it('rejects malformed windows', () => {
    expect(() => fitWindow(synth(), KAZAKHSTAN, undefined, { start: '13-01', end: '11-30' })).toThrow();
    expect(windowDays({ start: '11-01', end: '02-01' })).toBe(92);
  });
});

const DEMOS = [
  { sc: DEMO_KAZAKHSTAN, d: kostanay as any },
  { sc: DEMO_SENEGAL, d: bambey as any },
].map(({ sc, d }) => {
  const s = d.series as DailySeries;
  const pack = detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  const soil = effectiveSoil(sc.soil.texture, d.soil);
  return { sc, s, pack, soil, run: (start: string, end: string, ids?: string[]) => fitWindow(s, pack, ids, { start, end }, { awcMmPerM: soil.awcMmPerM }) };
});
const [KZ, SN] = DEMOS;

describe('fitWindow on the bundled NASA POWER demo cells', () => {
  it('replays all 25 complete seasons (2001–2025)', () => {
    for (const D of DEMOS) expect(D.run('07-15', '11-30').seasons).toBe(25);
  });

  it('a longer window never reduces the matured fraction', () => {
    for (const D of DEMOS) {
      const ids = Object.values(CROPS).filter((c) => c.cover).map((c) => c.id).concat(D.pack.crops.filter((c) => c !== 'fallow'));
      let prev: WindowResult | null = null;
      for (const end of ['08-15', '09-01', '09-15', '10-01', '10-15', '11-01', '11-30', '12-31']) {
        const r = D.run('07-15', end, ids);
        if (prev) for (const f of r.all) expect(f.maturedFrac).toBeGreaterThanOrEqual(fit(prev, f.cropId).maturedFrac);
        prev = r;
      }
    }
  });

  it('cover crops are never ranked as cash crops, and the main planner never offers them', () => {
    const cover = new Set(Object.values(CROPS).filter((c) => c.cover).map((c) => c.id));
    expect(cover.size).toBeGreaterThanOrEqual(3);
    for (const id of cover) {
      expect(CROPS[id].reviewStatus).toBe('demo-unreviewed');
      expect(CROPS[id].coverSeed!.kgPerHa * CROPS[id].coverSeed!.usdPerKg).toBeGreaterThan(0);
    }
    for (const p of PACKS) for (const c of p.crops) expect(cover.has(c)).toBe(false);
    for (const D of DEMOS) {
      for (const w of [{ start: '07-15', end: '11-30' }, defaultWindow(D.pack)]) {
        const r = D.run(w.start, w.end);
        for (const f of r.all) expect(f.tag === 'cover').toBe(cover.has(f.cropId));
        for (const f of r.all) if (f.tag !== 'cover') expect(f.seedUsdPerHa).toBeNull();
      }
      const out = runEngine(D.sc, D.s, D.soil, D.pack);
      for (const p of [out.baseline, ...out.allPlans]) for (const c of p.crops) expect(cover.has(c)).toBe(false);
    }
  });

  it('same window, different answers: frost-limited in Kostanay, warm enough in Bambey', () => {
    const kz = KZ.run('07-15', '11-30'), sn = SN.run('07-15', '11-30');
    // Kostanay: every cash crop that fits the calendar is killed by autumn frost in most years; a cover crop is the answer
    const kzCash = kz.all.filter((f) => f.tag === 'cash');
    expect(kzCash.length).toBeGreaterThan(0);
    for (const f of kzCash) { expect(f.binding).toBe('frost'); expect(f.maturedFrac).toBeLessThan(0.5); }
    expect(CROPS[kz.recommended].cover).toBe(true);
    expect(kz.options.some((f) => f.tag === 'cash')).toBe(true); // the frost-limited cash crop is shown, not hidden
    // Bambey: no frost at all; a cash crop matures in time in (nearly) every season
    for (const f of sn.all) expect(f.frostKills).toBe(0);
    expect(CROPS[sn.recommended].cover).toBeFalsy();
    expect(sn.recommended).not.toBe('fallow');
  });

  it('Bambey after the rains (Oct → Dec) is rain-limited: rest is recommended', () => {
    const r = SN.run('10-01', '12-31');
    for (const f of r.all.filter((x) => x.tag === 'cash')) expect(f.binding).toBe('water');
    expect(r.recommended).toBe('fallow');
  });

  it('the Kostanay post-harvest default (mid-Aug → end-Oct) is frost-limited: rest is recommended', () => {
    const w = defaultWindow(KZ.pack);
    const r = KZ.run(w.start, w.end);
    expect(r.recommended).toBe('fallow');
    for (const f of r.all.filter((x) => x.tag !== 'rest')) expect(f.binding).toBe('frost');
  });

  it('candidates: short-enough pack crops plus every cover crop', () => {
    const ids = windowCandidates(KZ.pack, { start: '08-15', end: '10-31' });
    expect(ids).not.toContain('wheat'); // 100-day cycle does not fit 77 days
    expect(ids).toContain('mustard-gm');
    expect(ids[ids.length - 1]).toBe('fallow');
  });
});
