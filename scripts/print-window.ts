// Prints the "When is your field free?" replay for both demo farms: npx vite-node scripts/print-window.ts [MM-DD MM-DD]
import type { DailySeries } from '../src/domain/types';
import { detectPack } from '../src/data/regionPacks';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { effectiveSoil } from '../src/soil/soil';
import { defaultWindow, fitWindow, fmtMMDD } from '../src/engine/window';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const [a, b] = process.argv.slice(2);
for (const { sc, d } of [{ sc: DEMO_KAZAKHSTAN, d: kostanay as any }, { sc: DEMO_SENEGAL, d: bambey as any }]) {
  const s = d.series as DailySeries;
  const pack = detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  const soil = effectiveSoil(sc.soil.texture, d.soil);
  for (const w of a && b ? [{ start: a, end: b }] : [{ start: '07-15', end: '11-30' }, defaultWindow(pack)]) {
    const t0 = performance.now();
    const r = fitWindow(s, pack, undefined, w, { awcMmPerM: soil.awcMmPerM });
    console.log(`\n${pack.short} · ${fmtMMDD(w.start)} → ${fmtMMDD(w.end)} (${r.days} d, ${r.seasons} seasons, ${(performance.now() - t0).toFixed(0)} ms) → recommended: ${r.recommended}`);
    for (const f of r.all) console.log(`  ${f.cropId.padEnd(11)} ${f.tag.padEnd(5)} matured ${String(f.matured).padStart(2)}/${f.seasons}  reliable ${String(f.reliable).padStart(2)}  frost ${String(f.frostKills).padStart(2)}  hot ${String(f.tooHot).padStart(2)}  short ${String(f.tooShort).padStart(2)}  cold ${String(f.noSowing).padStart(2)}  severe ${String(f.severeStress).padStart(2)}  median ${fmtMMDD(f.medianMaturity).padEnd(6)} · ${f.reason}`);
  }
}
