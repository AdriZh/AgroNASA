import type { DailySeries } from '../domain/types';
import { addDays, diffDays, toISO } from '../domain/dates';
import { idbGet, idbSet } from '../state/idb';
import { errorText, fetchJson, NetError } from './net';

/** 25 years × 9 parameters is ~1.3 MB and POWER can take 30+ s to assemble it. */
export const POWER_TIMEOUT_MS = 40_000;

export const POWER_PARAMS = ['PRECTOTCORR', 'T2M_MAX', 'T2M_MIN', 'T2M', 'RH2M', 'WS2M', 'ALLSKY_SFC_SW_DWN', 'GWETROOT', 'GWETTOP'] as const;
const KEY: Record<(typeof POWER_PARAMS)[number], keyof DailySeries> = {
  PRECTOTCORR: 'P', T2M_MAX: 'TX', T2M_MIN: 'TN', T2M: 'T', RH2M: 'RH', WS2M: 'WS', ALLSKY_SFC_SW_DWN: 'RS', GWETROOT: 'GWR', GWETTOP: 'GWT',
};
const PLAUSIBLE: Record<string, [number, number]> = {
  P: [0, 600], TX: [-80, 65], TN: [-90, 50], T: [-85, 55], RH: [0, 100], WS: [0, 60], RS: [0, 45], GWR: [0, 1], GWT: [0, 1],
};

/** MERRA-2 meteorology grid used by POWER: 0.5° lat × 0.625° lon. */
export function powerGridCell(lat: number, lon: number) {
  const dLat = 0.5, dLon = 0.625;
  const cLat = Math.round(lat / dLat) * dLat;
  const cLon = Math.round(lon / dLon) * dLon;
  return { cLat, cLon, south: cLat - dLat / 2, north: cLat + dLat / 2, west: cLon - dLon / 2, east: cLon + dLon / 2 };
}

export function powerQuery(lat: number, lon: number, start: string, end: string): string {
  const s = start.replace(/-/g, ''), e = end.replace(/-/g, '');
  return `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${POWER_PARAMS.join(',')}&community=AG&longitude=${lon.toFixed(2)}&latitude=${lat.toFixed(2)}&start=${s}&end=${e}&format=JSON&time-standard=LST`;
}

export interface QualityReport { records: number; missing: Record<string, number>; implausible: number; duplicates: number }

/** Parse a POWER daily point JSON response into a dense, validated columnar series. */
export function parsePower(json: any, query: string, retrievedAt: string, label: string): { series: DailySeries; quality: QualityReport } {
  const params = json?.properties?.parameter;
  if (!params) throw new Error(json?.messages?.join?.(' ') || json?.message || 'Unexpected NASA POWER response');
  const fill = Number(json?.header?.fill_value ?? -999);
  const first = params.PRECTOTCORR ?? params[Object.keys(params)[0]];
  const keys = Object.keys(first).sort();
  const start = `${keys[0].slice(0, 4)}-${keys[0].slice(4, 6)}-${keys[0].slice(6, 8)}`;
  const lastK = keys[keys.length - 1];
  const end = `${lastK.slice(0, 4)}-${lastK.slice(4, 6)}-${lastK.slice(6, 8)}`;
  const n = diffDays(start, end) + 1;
  const duplicates = keys.length - new Set(keys).size;
  const coords = json?.geometry?.coordinates ?? [];
  const series: DailySeries = {
    meta: {
      lat: Number(coords[1]), lon: Number(coords[0]), elevation: Number(coords[2] ?? 0),
      start, end, retrievedAt, query, sources: json?.header?.sources ?? ['MERRA2'], fillValue: fill, cached: false, label,
    },
    n, P: [], TX: [], TN: [], T: [], RH: [], WS: [], RS: [], GWR: [], GWT: [],
  };
  const missing: Record<string, number> = {};
  let implausible = 0;
  for (const p of POWER_PARAMS) {
    const k = KEY[p];
    const arr: (number | null)[] = new Array(n).fill(null);
    const src = params[p] ?? {};
    let miss = 0;
    for (let i = 0; i < n; i++) {
      const iso = addDays(start, i);
      const v = src[iso.replace(/-/g, '')];
      if (v == null || v === fill || !Number.isFinite(v)) { miss++; continue; }
      const [lo, hi] = PLAUSIBLE[k as string];
      if (v < lo || v > hi) { implausible++; miss++; continue; }
      arr[i] = v;
    }
    (series as any)[k] = arr;
    missing[p] = miss;
  }
  // Trim trailing days where precipitation is still missing (near-real-time lag).
  let last = n - 1;
  while (last > 0 && series.P[last] == null) last--;
  if (last < n - 1) {
    for (const p of POWER_PARAMS) (series as any)[KEY[p]] = (series as any)[KEY[p]].slice(0, last + 1);
    series.n = last + 1;
    series.meta.end = addDays(start, last);
  }
  return { series, quality: { records: keys.length, missing, implausible, duplicates } };
}

/** Compact storage for bundling / caching (nulls → NaN-free sentinel). */
export function compact(series: DailySeries) {
  const enc = (a: (number | null)[]) => a.map((v) => (v == null ? null : Math.round(v * 100) / 100));
  return { ...series, P: enc(series.P), TX: enc(series.TX), TN: enc(series.TN), T: enc(series.T), RH: enc(series.RH), WS: enc(series.WS), RS: enc(series.RS), GWR: enc(series.GWR), GWT: enc(series.GWT) };
}

export interface FetchResult { series: DailySeries; quality?: QualityReport; fromCache: boolean; error?: string }

/** Live NASA POWER fetch with IndexedDB cache keyed by POWER grid cell (no personal data is sent). */
export async function fetchPower(lat: number, lon: number, opts: { force?: boolean; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const cell = powerGridCell(lat, lon);
  const cacheKey = `power:${cell.cLat.toFixed(3)}:${cell.cLon.toFixed(3)}`;
  const cached = await idbGet<DailySeries>(cacheKey);
  const ageDays = cached ? diffDays(cached.meta.retrievedAt.slice(0, 10), toISO(Date.now())) : Infinity;
  if (cached && !opts.force && ageDays < 7) return { series: { ...cached, meta: { ...cached.meta, cached: true } }, fromCache: true };

  const end = toISO(Date.now() - 2 * 86400000);
  const query = powerQuery(lat, lon, '2001-01-01', end);
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const json = await fetchJson(query, { signal: opts.signal, timeoutMs: POWER_TIMEOUT_MS, service: 'NASA POWER' });
      const { series, quality } = parsePower(json, query, new Date().toISOString(), `NASA POWER grid cell ${cell.cLat.toFixed(2)}°, ${cell.cLon.toFixed(3)}°`);
      await idbSet(cacheKey, compact(series));
      return { series, quality, fromCache: false };
    } catch (e: any) {
      lastErr = errorText(e);
      if (e instanceof NetError) {
        if (e.kind === 'aborted') throw e;
        // A 40 s timeout or a client error will not get better by asking again right away.
        if (e.kind === 'timeout' || (e.kind === 'http' && e.status != null && e.status < 500 && e.status !== 429)) break;
        if (e.kind === 'offline' && attempt >= 1) break;
      }
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
  }
  if (cached) return { series: { ...cached, meta: { ...cached.meta, cached: true } }, fromCache: true, error: lastErr };
  throw new Error(lastErr || 'NASA POWER unavailable');
}
