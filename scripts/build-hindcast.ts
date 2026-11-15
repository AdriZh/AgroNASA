// Precompute the modeled water-limited yield index (Ya/Ym) per year for the hindcast, so the Evidence page and the
// pitch do not need to load the demo weather snapshots. tests/hindcast.test.ts recomputes it from the engine and
// fails if this file drifts from the model.
// Usage: npx vite-node scripts/build-hindcast.ts
import { writeFileSync } from 'node:fs';
import { HINDCAST_CASES, hindcast } from '../src/data/hindcast/hindcast';
import { modeledIndex } from '../src/data/hindcast/modelIndex';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const DATA = { bambey, kostanay } as const;
const series: Record<string, { year: number; relYield: number }[]> = {};
for (const c of HINDCAST_CASES) series[c.key] = modeledIndex(c, DATA[c.demo] as never);
writeFileSync('src/data/hindcast/modeled.json', JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  note: 'Ya/Ym from replayCrop at the demo NASA POWER grid cell, rainfed, demo soil, sowing from the region pack rule. Regenerate with scripts/build-hindcast.ts.',
  series,
}, null, 1) + '\n');
for (const c of HINDCAST_CASES) {
  const h = hindcast(c, series[c.key]);
  console.log(c.key.padEnd(13), 'n', h.n, 'r', h.r.toFixed(2), h.hits.map((x) => `${x.year}:${x.hit ? 'hit' : 'miss'}(rank ${x.modelRank}, national ${x.nationalBelowTrend ? 'below' : 'above'} trend)`).join(' '));
}
