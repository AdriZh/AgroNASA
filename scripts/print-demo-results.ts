import { runEngine } from '../src/engine/plan';
import { DEMOS } from '../src/state/demo';
import { detectPack } from '../src/data/regionPacks';
import { reviewSeason } from '../src/engine/review';
import { effectiveSoil } from '../src/soil/soil';
for (const sc of DEMOS) {
  const key = sc.id === 'demo-bambey' ? 'bambey' : 'kostanay';
  const d = (await import(`../src/data/demo/${key}.json`)).default as any;
  const pack = detectPack(sc.location.lat, sc.location.lon);
  const soil = effectiveSoil(sc.soil.texture, d.soil);
  const t = Date.now();
  const out = runEngine(sc, d.series, soil, pack);
  console.log('\n==', sc.name, pack.id, Date.now() - t, 'ms', out.window);
  for (const [k, r] of Object.entries(out.risks)) console.log(k.padEnd(10), 'n', r.years.length, 'med', r.medianRel.toFixed(2), 'p20', r.p20Rel.toFixed(2), 'sev', r.pSevere.toFixed(2), 'heat', r.pHeat.toFixed(2), 'frost', r.pFrost.toFixed(2), 'sow', r.medianSowing, 'Tm', r.meanSeasonT?.toFixed(1), 'tOOR', r.tempOutOfRange.toFixed(2), 'rain', r.medianRain.toFixed(0));
  const show = (p: any) => console.log(p.label.padEnd(14), p.id.padEnd(22), p.budget.status, Math.round(p.budget.totalCash), 'head', Math.round(p.budget.headroom), 'rel', p.outcome.medianRel?.toFixed(2), 'sev', p.outcome.pSevereAny?.toFixed(2), 'net', p.outcome.net && Math.round(p.outcome.net.median), '|', p.reasons.map((r: any) => r.code + ':' + r.severity).join(','));
  show(out.baseline); out.alternatives.forEach(show);
  console.log('feasible', out.allPlans.filter(p => p.feasible).length, 'excluded', out.excluded.length);
  for (const h of sc.history) { const r = reviewSeason(sc, h, d.series, out.window, soil); console.log(h.year, h.cropId, r?.statements.map(s => s.text).join('\n   ')); }
}
