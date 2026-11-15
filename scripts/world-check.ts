// World sanity check: run the engine for a new 1.5 ha "My farm" at reference locations (and the two demo farms)
// and print the usual plan and the top two options with crops, cash cost, budget and headroom.
//
//   npx vite-node scripts/world-check.ts [cacheDir]
//
// NASA POWER daily data (2001–2025) is read from <cacheDir>/<key>.json (default: .cache/power, git-ignored) and
// fetched with curl when missing (curl honours HTTPS_PROXY). Bambey and Kostanay use the bundled demo datasets.
// SoilGrids is not queried: every new farm uses the texture-default water capacity (as when SoilGrids times out).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DailySeries, FarmScenario } from '../src/domain/types';
import { parsePower, powerQuery } from '../src/weather/power';
import { effectiveSoil } from '../src/soil/soil';
import { detectPack } from '../src/data/regionPacks';
import { cropName } from '../src/data/crops';
import { initialPlaceholder, refreshPlaceholder, runEngine, type PlanResult } from '../src/engine/plan';
import { blankScenario } from '../src/state/AppContext';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const SITES = [
  { key: 'nakuru', label: 'Nakuru, Kenya', lat: -0.4, lon: 35.95, iso2: 'KE' },
  { key: 'karnal', label: 'Karnal, India', lat: 29.75, lon: 76.85, iso2: 'IN' },
  { key: 'iowa', label: 'Ames, Iowa, USA', lat: 42.0, lon: -93.75, iso2: 'US' },
  { key: 'sorriso', label: 'Sorriso, Brazil', lat: -12.6, lon: -55.9, iso2: 'BR' },
  { key: 'kropyvnytskyi', label: 'Kropyvnytskyi, Ukraine', lat: 48.4, lon: 32.5, iso2: 'UA' },
  { key: 'bambey', label: 'Bambey, Senegal', lat: 14.71, lon: -16.46, iso2: 'SN' },
  { key: 'kostanay', label: 'Kostanay, Kazakhstan', lat: 53.0, lon: 64.0, iso2: 'KZ' },
];
const BUNDLED: Record<string, any> = { bambey, kostanay };

function series(key: string, lat: number, lon: number, dir: string): DailySeries {
  if (BUNDLED[key]) return BUNDLED[key].series;
  const file = join(dir, `${key}.json`);
  const query = powerQuery(lat, lon, '2001-01-01', '2025-12-31');
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    console.error(`fetching NASA POWER for ${key}…`);
    execFileSync('curl', ['-sS', '--fail', '--max-time', '300', '-o', file, query], { stdio: 'inherit' });
  }
  return parsePower(JSON.parse(readFileSync(file, 'utf8')), query, new Date().toISOString(), key).series;
}

const fmt = (x: number, cur: string) => `${Math.round(x).toLocaleString('en-US')} ${cur}`;
const title = (p: PlanResult) => `${cropName(p.crops[0])} → ${cropName(p.crops[1])}`;
const flags = (p: PlanResult) => p.reasons.filter((r) => r.severity !== 'info' && !r.code.startsWith('BUDGET')).map((r) => `${r.code}${r.severity === 'block' ? '!' : r.severity === 'good' ? '+' : ''}`).join(' ');

export function check(sc: FarmScenario, s: DailySeries, soilGrid: any) {
  const pack = detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  const soil = effectiveSoil(sc.soil.texture, soilGrid);
  let out = runEngine(sc, s, soil, pack);
  const patch = refreshPlaceholder(sc, out); // what the app does after the first engine run
  if (patch) { sc = { ...sc, ...patch }; out = runEngine(sc, s, soil, pack); }
  return { sc, out };
}

const dir = process.argv[2] ?? '.cache/power';
const rows: string[][] = [];
const scenarios: { name: string; sc: FarmScenario; s: DailySeries; soil: any }[] = [];
for (const site of SITES) {
  let sc = { ...blankScenario({ lat: site.lat, lon: site.lon, label: site.label, iso2: site.iso2 }), area: 1.5 };
  sc = { ...sc, ...initialPlaceholder(sc, detectPack(site.lat, site.lon, site.iso2)) }; // area edited before any engine run
  scenarios.push({ name: `My farm · ${site.label}`, sc, s: series(site.key, site.lat, site.lon, dir), soil: null });
}
{ // Karnal farms are almost all irrigated (rice–wheat system): the same farm with irrigation and family labor
  const k = scenarios.find((x) => x.name.includes('Karnal'))!;
  let sc: FarmScenario = { ...k.sc, irrigation: 'yes', irrigationCapacityMm: 500 };
  sc = { ...sc, ...initialPlaceholder(sc, detectPack(sc.location.lat, sc.location.lon, sc.countryIso2)) };
  scenarios.push({ name: 'My farm · Karnal, irrigated', sc, s: k.s, soil: null });
}
scenarios.push({ name: 'Demo · Bambey', sc: DEMO_SENEGAL, s: (bambey as any).series, soil: (bambey as any).soil });
scenarios.push({ name: 'Demo · Kostanay', sc: DEMO_KAZAKHSTAN, s: (kostanay as any).series, soil: (kostanay as any).soil });

for (const { name, sc: sc0, s, soil } of scenarios) {
  const { sc, out } = check(sc0, s, soil);
  const cur = sc.currency, b = out.baseline.budget;
  console.log(`\n== ${name} · ${out.pack.short} · ${sc.area} ${sc.areaUnit} · funds ${fmt(sc.availableFunds, cur)} − reserve ${fmt(sc.reserve, cur)} = spendable ${fmt(b.cap, cur)}${sc.budgetPlaceholder ? ' (placeholder)' : ''}`);
  for (const p of [out.baseline, ...out.alternatives]) {
    console.log(`  ${(p.isBaseline ? 'Usual' : p.label).padEnd(9)} ${title(p).padEnd(34)} cost ${fmt(p.budget.totalCash, cur).padStart(16)}  headroom ${fmt(p.budget.headroom, cur).padStart(16)}  ${p.budget.status.padEnd(12)} rel ${p.outcome.medianRel.toFixed(2)}  ${flags(p)}`);
  }
  const fit = out.allPlans.filter((p) => p.feasible).length;
  console.log(`  ${out.allPlans.length} screened · ${out.allPlans.filter((p) => p.eligible).length} pass rules · ${fit} fit the budget · prices: ${Object.entries(out.prices).map(([c, p]) => `${c} ${p.perT}`).join(', ')}`);
  rows.push([name, `${title(out.baseline)} (${fmt(b.totalCash, cur)}, ${fmt(b.headroom, cur)})`, ...out.alternatives.map((p) => `${title(p)} (${fmt(p.budget.headroom, cur)})`)]);
}
console.log('\n| Farm | Usual plan (cost, headroom) | Option A (headroom) | Option B (headroom) |\n|---|---|---|---|');
for (const r of rows) console.log(`| ${r[0]} | ${r[1]} | ${r[2] ?? '—'} | ${r[3] ?? '—'} |`);
