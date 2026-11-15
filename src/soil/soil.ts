// Soil context from ISRIC SoilGrids 2.0 (250 m modeled soil map, non-NASA) or the farmer's known texture.
import type { SoilProfile, SoilTexture } from '../domain/types';
import { idbGet, idbSet } from '../state/idb';
import { fetchJson, isNetDown, NetError } from '../weather/net';

/** FAO-56 Table 19 mid-range total available water (θFC − θWP) by texture, mm water per m soil. */
export const TEXTURE_AWC: Record<SoilTexture, number> = {
  sand: 80, 'loamy-sand': 90, 'sandy-loam': 120, loam: 150, 'silt-loam': 160, 'clay-loam': 150, clay: 160, unknown: 140,
};
export const TEXTURE_LABEL: Record<SoilTexture, string> = {
  sand: 'Sand', 'loamy-sand': 'Loamy sand', 'sandy-loam': 'Sandy loam', loam: 'Loam', 'silt-loam': 'Silt loam', 'clay-loam': 'Clay loam', clay: 'Clay', unknown: 'Unknown',
};

/** Simplified USDA texture classification from sand/clay %. */
export function textureClass(sand: number, clay: number): SoilTexture {
  const silt = 100 - sand - clay;
  if (clay >= 40) return 'clay';
  if (clay >= 27 && sand <= 45) return 'clay-loam';
  if (sand >= 85 && silt + 1.5 * clay < 15) return 'sand';
  if (sand >= 70 && silt + 2 * clay < 30) return 'loamy-sand';
  if (sand >= 43 || (clay < 7 && silt < 50)) return clay >= 20 ? 'clay-loam' : 'sandy-loam';
  if (silt >= 50 && clay < 27) return 'silt-loam';
  return 'loam';
}

/** Saxton & Rawls (2006) pedotransfer: available water (θ33 − θ1500) in mm per m. */
export function saxtonRawlsAwc(sandPct: number, clayPct: number, omPct: number): number {
  const S = sandPct / 100, C = clayPct / 100, OM = Math.min(omPct, 8);
  const t1500t = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031;
  const t1500 = t1500t + (0.14 * t1500t - 0.02);
  const t33t = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299;
  const t33 = t33t + (1.283 * t33t * t33t - 0.374 * t33t - 0.015);
  return Math.max(40, Math.min(250, (t33 - t1500) * 1000));
}

const DEPTH_W: Record<string, number> = { '0-5cm': 5, '5-15cm': 10, '15-30cm': 15, '30-60cm': 30 };

export function parseSoilGrids(json: any, retrievedAt: string): SoilProfile | null {
  const layers: any[] = json?.properties?.layers ?? [];
  const get = (name: string): number | null => {
    const l = layers.find((x) => x.name === name);
    if (!l) return null;
    const f = l.unit_measure?.d_factor ?? 1;
    let sum = 0, w = 0;
    for (const d of l.depths ?? []) {
      const v = d.values?.mean;
      const wt = DEPTH_W[d.label] ?? 0;
      if (v == null || !wt) continue;
      sum += (v / f) * wt; w += wt;
    }
    return w ? sum / w : null;
  };
  const clay = get('clay'), sand = get('sand'), silt = get('silt');
  if (clay == null || sand == null) return null;
  // d_factor already converts to the target unit (%)
  const clayPct = clay, sandPct = sand, siltPct = silt != null ? silt : 100 - clayPct - sandPct;
  const socGKg = get('soc');
  const socPct = socGKg != null ? socGKg / 10 : null;
  return {
    source: 'soilgrids', clayPct, sandPct, siltPct, socPct,
    ph: get('phh2o'), nitrogenGKg: get('nitrogen'), cec: get('cec'), bulkDensity: get('bdod'),
    texture: textureClass(sandPct, clayPct),
    awcMmPerM: saxtonRawlsAwc(sandPct, clayPct, (socPct ?? 0.5) * 1.724),
    retrievedAt,
  };
}

export function soilGridsQuery(lat: number, lon: number) {
  const props = ['clay', 'sand', 'silt', 'soc', 'phh2o', 'nitrogen', 'cec', 'bdod'].map((p) => `property=${p}`).join('&');
  const depths = ['0-5cm', '5-15cm', '15-30cm', '30-60cm'].map((d) => `depth=${d}`).join('&');
  return `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}&${props}&${depths}&value=mean`;
}

export const SOILGRIDS_TIMEOUT_MS = 12_000;
/** After SoilGrids times out or is unreachable, skip it for a while so switching farms stays instant. */
const SOILGRIDS_BACKOFF_MS = 3 * 60_000;
let soilGridsDownUntil = 0;
export const resetSoilGridsBackoff = () => { soilGridsDownUntil = 0; };

/**
 * SoilGrids is slow (~5–20 s) and masks urban/water cells; try the point, then two nearby points when the
 * point is masked. Network failures (timeout, offline, HTTP) throw a NetError so the caller can fall back to
 * typical values for the texture class; a masked area returns null.
 */
export async function fetchSoil(lat: number, lon: number, opts: { force?: boolean; signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<SoilProfile | null> {
  const key = `soil:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const hit = await idbGet<SoilProfile>(key);
  if (hit) return { ...hit, cached: true };
  if (!opts.force && Date.now() < soilGridsDownUntil) throw new NetError('SoilGrids', 'offline', 'SoilGrids offline (skipped after a recent failure)');
  const tries: [number, number][] = [[0, 0], [0.02, 0.02], [-0.02, -0.02]];
  for (const [dLat, dLon] of tries) {
    let json: any;
    try {
      json = await fetchJson(soilGridsQuery(lat + dLat, lon + dLon), { timeoutMs: SOILGRIDS_TIMEOUT_MS, service: 'SoilGrids', signal: opts.signal, fetchImpl: opts.fetchImpl });
    } catch (e) {
      if (isNetDown(e) || (e instanceof NetError && e.kind === 'http' && (e.status ?? 500) >= 500)) soilGridsDownUntil = Date.now() + SOILGRIDS_BACKOFF_MS;
      throw e;
    }
    const prof = parseSoilGrids(json, new Date().toISOString());
    if (prof) { soilGridsDownUntil = 0; await idbSet(key, prof); return prof; }
  }
  return null;
}

/**
 * Typical topsoil composition per USDA texture class (near the class centroid of the texture triangle, with
 * common cropland organic matter), used when SoilGrids cannot be reached. AWC comes from Saxton & Rawls (2006)
 * like a SoilGrids profile, so the model treats both paths the same way. The farmer can override the texture.
 */
export const TYPICAL_TEXTURE: Record<Exclude<SoilTexture, 'unknown'>, { sand: number; clay: number; omPct: number }> = {
  sand: { sand: 92, clay: 3, omPct: 0.5 },
  'loamy-sand': { sand: 82, clay: 6, omPct: 1 },
  'sandy-loam': { sand: 65, clay: 10, omPct: 1.5 },
  loam: { sand: 42, clay: 20, omPct: 2.5 },
  'silt-loam': { sand: 20, clay: 15, omPct: 2.5 },
  'clay-loam': { sand: 32, clay: 34, omPct: 2.5 },
  clay: { sand: 22, clay: 50, omPct: 2.5 },
};

/** Default soil properties for a texture class ("unknown" → loam). Source "default"; no chemistry is invented. */
export function typicalSoil(texture: SoilTexture = 'loam'): SoilProfile {
  const t = texture === 'unknown' ? 'loam' : texture;
  const c = TYPICAL_TEXTURE[t];
  return {
    source: 'default', texture: t,
    sandPct: c.sand, clayPct: c.clay, siltPct: 100 - c.sand - c.clay, socPct: Math.round((c.omPct / 1.724) * 100) / 100,
    ph: null, nitrogenGKg: null, cec: null, bulkDensity: null,
    awcMmPerM: saxtonRawlsAwc(c.sand, c.clay, c.omPct),
  };
}

/** Which soil water capacity drives the model: farmer texture > SoilGrids > typical loam (Saxton & Rawls). */
export function effectiveSoil(farmerTexture: SoilTexture, grid: SoilProfile | null): SoilProfile {
  if (farmerTexture !== 'unknown') {
    return {
      ...(grid ?? { clayPct: null, sandPct: null, siltPct: null, socPct: null, ph: null, nitrogenGKg: null, cec: null, bulkDensity: null }),
      source: 'farmer', texture: farmerTexture, awcMmPerM: TEXTURE_AWC[farmerTexture],
    } as SoilProfile;
  }
  if (grid) return grid;
  return typicalSoil('loam');
}
