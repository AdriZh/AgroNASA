// Builds the bundled offline demo datasets from archived NASA POWER + SoilGrids responses.
// Usage: npx vite-node scripts/build-demo-data.ts <rawDir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compact, parsePower, powerQuery } from '../src/weather/power';
import { parseSoilGrids } from '../src/soil/soil';

const raw = process.argv[2] ?? 'data/raw';
const sites = [
  { key: 'bambey', lat: 14.71, lon: -16.46, label: 'Bambey area, Senegal (archived NASA POWER cell)' },
  { key: 'kostanay', lat: 53.0, lon: 64.0, label: 'Kostanay region, Kazakhstan (archived NASA POWER cell)' },
];
const retrievedAt = process.env.RETRIEVED_AT ?? new Date().toISOString();
for (const s of sites) {
  const json = JSON.parse(readFileSync(join(raw, `${s.key}.json`), 'utf8'));
  const { series, quality } = parsePower(json, powerQuery(s.lat, s.lon, json.header.start.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), json.header.end.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')), retrievedAt, s.label);
  series.meta.cached = true;
  const soilJson = JSON.parse(readFileSync(join(raw, `soil_${s.key}.json`), 'utf8'));
  const soil = parseSoilGrids(soilJson, retrievedAt);
  writeFileSync(`src/data/demo/${s.key}.json`, JSON.stringify({ series: compact(series), soil, quality }));
  console.log(s.key, series.n, 'days', series.meta.start, '→', series.meta.end, quality.missing, soil?.texture, soil?.awcMmPerM.toFixed(0));
}
