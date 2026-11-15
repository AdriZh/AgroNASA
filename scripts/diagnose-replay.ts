// Per-year diagnostic of the historical replay for both demo farms (science QA, not shipped to the app).
// Usage: npx vite-node scripts/diagnose-replay.ts [cropId…]
// Prints, for every replayed season: sowing date (and whether a rule actually fired), season rain, ETc, ETa,
// ETa/ETc, water-stress (Ks < 1) days, plant-available soil water at sowing vs TAW, and Ya/Ym; then the
// usual plan and options A/B with severe-stress season pairs, on the record and at the −15% rain / +2 °C what-if.
import { DEMOS } from '../src/state/demo';
import { detectPack } from '../src/data/regionPacks';
import { effectiveSoil } from '../src/soil/soil';
import { cropFor } from '../src/data/crops';
import { replayCrop, resolveSeasons } from '../src/engine/replay';
import { runEngine } from '../src/engine/plan';
import { stressTest } from '../src/engine/whatif';

const only = process.argv.slice(2);
for (const sc of DEMOS) {
  const key = sc.id === 'demo-bambey' ? 'bambey' : 'kostanay';
  const d = (await import(`../src/data/demo/${key}.json`)).default as any;
  const pack = detectPack(sc.location.lat, sc.location.lon);
  const soil = effectiveSoil(sc.soil.texture, d.soil);
  const w = resolveSeasons(pack, d.series)[0];
  const crops = only.length ? only : key === 'bambey' ? ['millet', 'groundnut'] : ['wheat'];
  console.log(`\n=== ${sc.name} · soil AWC ${soil.awcMmPerM.toFixed(0)} mm/m (${soil.source}, ${soil.texture}, sand ${soil.sandPct} clay ${soil.clayPct}) · window ${w.method} ${w.earliest}..${w.latest}`);
  for (const id of crops) {
    const crop = cropFor(pack, id);
    const r = replayCrop(d.series, w, crop, soil, { on: false, capMm: 0 });
    console.log(`\n-- ${crop.name}: Kc ${crop.kc.join('/')} stages ${crop.stages.join('/')} root ${crop.rootDepthM} m p ${crop.p} Ky ${crop.ky}`);
    console.log('year  sowing      rule  rain   ET0   ETc   ETa  ETa/ETc  Ks<1d  SW0/TAW(mm)  Ya/Ym  falseStarts');
    for (const y of r.years) {
      const ratio = y.etcMm > 0 ? y.etaMm / y.etcMm : 0;
      console.log(
        `${y.year}  ${y.sowing}  ${y.sowingDetected ? 'yes ' : 'NO  '} ${y.rainMm.toFixed(0).padStart(4)}  ${y.et0Mm.toFixed(0).padStart(4)}  ${y.etcMm.toFixed(0).padStart(4)}  ${y.etaMm.toFixed(0).padStart(4)}   ${ratio.toFixed(2)}    ${String(y.stressDays).padStart(3)}    ${y.swSowingMm.toFixed(0).padStart(4)}/${y.tawMm.toFixed(0)}     ${y.relYield.toFixed(2)}   ${y.falseStarts}${y.failed ? '  FAILED: ' + y.failed : ''}`,
      );
    }
    const sev = r.years.filter((y) => y.relYield < 0.5 || y.failed).length;
    console.log(`severe (Ya/Ym<0.5 or failed): ${sev} of ${r.years.length} · median Ya/Ym ${r.medianRel.toFixed(2)} · pSevere ${(r.pSevere * 100).toFixed(0)}% · no-onset ${(r.pNoOnset * 100).toFixed(0)}%`);
  }
  const out = runEngine(sc, d.series, soil, pack);
  const wi = stressTest(sc, d.series, soil, pack, out, { rainScale: 0.85, dT: 2 });
  console.log('\nplan             id                    severe pairs: record -> what-if (−15% rain, +2 °C)   median Ya/Ym');
  for (const p of wi.plans) {
    const f = (k: 0 | 1) => `${Math.round(p.severe[k] * p.pairs[k])}/${p.pairs[k]}`;
    console.log(`${p.label.padEnd(16)} ${p.id.padEnd(22)} ${f(0).padStart(5)} -> ${f(1).padEnd(36)} ${p.medianRel[0].toFixed(2)} -> ${p.medianRel[1].toFixed(2)}`);
  }
}
