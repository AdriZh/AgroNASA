// Modeled water-limited yield index for a hindcast case: the app's own replay (no tuning) at the demo grid cell.
import type { DailySeries, SoilProfile } from '../../domain/types';
import { DEMOS } from '../../state/demo';
import { detectPack } from '../regionPacks';
import { cropFor } from '../crops';
import { effectiveSoil } from '../../soil/soil';
import { replayCrop, resolveSeasons } from '../../engine/replay';
import type { HindcastCase } from './hindcast';

export function modeledIndex(c: HindcastCase, snap: { series: DailySeries; soil: SoilProfile | null }) {
  const sc = DEMOS.find((d) => d.id === (c.demo === 'bambey' ? 'demo-bambey' : 'demo-kostanay'))!;
  const pack = detectPack(sc.location.lat, sc.location.lon);
  const soil = effectiveSoil(sc.soil.texture, snap.soil);
  const w = resolveSeasons(pack, snap.series)[0];
  const r = replayCrop(snap.series, w, cropFor(pack, c.cropId), soil, { on: false, capMm: 0 });
  return r.years.map((y) => ({ year: y.year, relYield: +y.relYield.toFixed(4) }));
}
