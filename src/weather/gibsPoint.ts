// Point values from NASA GIBS imagery. GIBS publishes a colormap (RGB → data value) for every layer and
// serves lossless PNG tiles, so the exact data value at the field pixel can be decoded in the browser:
//   MODIS Terra NDVI 16-day (MOD13, ~250 m → 305 m tile pixel), MODIS IGBP land cover (MCD12Q1),
//   SMAP L4 root-zone soil moisture (~9 km), GRACE/GRACE-FO mascon water-storage anomaly.
// Values are quantized to the colormap bins (e.g. NDVI 0.005, SMAP 0.003 m³/m³, GRACE 0.25 cm).
import { idbGet, idbSet } from '../state/idb';

const GIBS = 'https://gibs.earthdata.nasa.gov';

export interface CmEntry { rgb: [number, number, number]; value: number | null; label?: string; nodata: boolean }

/** Parse a GIBS v1.3 colormap XML (regex-based so it also runs outside the browser). */
export function parseColormap(xml: string): CmEntry[] {
  const out: CmEntry[] = [];
  const re = /<ColorMapEntry\s+([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const a = m[1];
    const rgb = (a.match(/rgb="([\d,]+)"/)?.[1] ?? '0,0,0').split(',').map(Number) as [number, number, number];
    const nodata = /nodata="true"/.test(a);
    const v = a.match(/\svalue="([^"]+)"/)?.[1];
    const sv = a.match(/sourceValue="([^"]+)"/)?.[1];
    out.push({ rgb, value: nodata ? null : rangeMid(v ?? sv ?? ''), nodata, label: a.match(/label="([^"]+)"/)?.[1] });
  }
  return out;
}

/** "[a,b)" → midpoint; "[a]" or "a" → a; "[-INF,b)" → b; "[a,INF)" → a. */
export function rangeMid(s: string): number | null {
  const t = s.replace(/[[\]()]/g, '');
  const parts = t.split(',').map((x) => x.trim());
  if (parts.length === 1) { const n = Number(parts[0]); return Number.isFinite(n) ? n : null; }
  const [a, b] = parts.map((x) => (/inf/i.test(x) ? NaN : Number(x)));
  if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  if (Number.isFinite(a)) return a;
  if (Number.isFinite(b)) return b;
  return null;
}

export function lookup(entries: CmEntry[], r: number, g: number, b: number): CmEntry | null {
  let best: CmEntry | null = null, bd = Infinity;
  for (const e of entries) {
    const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - g) ** 2 + (e.rgb[2] - b) ** 2;
    if (d < bd) { bd = d; best = e; if (d === 0) break; }
  }
  return bd <= 12 ? best : null; // tolerate rounding, never guess a far colour
}

/** Web-Mercator tile and pixel for a point. */
export function tilePixel(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return { tx: Math.floor(x), ty: Math.floor(y), px: Math.floor((x % 1) * 256), py: Math.floor((y % 1) * 256) };
}

export interface GibsLayerDef { id: string; layer: string; level: number; colormap: string; unit: string }
export const POINT_LAYERS: Record<string, GibsLayerDef> = {
  ndvi: { id: 'ndvi', layer: 'MODIS_Terra_L3_NDVI_16Day', level: 9, colormap: 'MODIS_L3_NDVI', unit: 'NDVI' },
  landcover: { id: 'landcover', layer: 'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual', level: 8, colormap: 'MODIS_IGBP_Land_Cover_Type', unit: 'class' },
  smap: { id: 'smap', layer: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', level: 6, colormap: 'SMAP_Analyzed_Soil_Moisture', unit: 'm³/m³' },
  grace: { id: 'grace', layer: 'GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI', level: 6, colormap: 'GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI', unit: 'cm' },
};

export const IGBP: Record<number, string> = {
  1: 'Evergreen needleleaf forest', 2: 'Evergreen broadleaf forest', 3: 'Deciduous needleleaf forest', 4: 'Deciduous broadleaf forest', 5: 'Mixed forest',
  6: 'Closed shrubland', 7: 'Open shrubland', 8: 'Woody savanna', 9: 'Savanna', 10: 'Grassland', 11: 'Permanent wetland', 12: 'Cropland',
  13: 'Urban / built-up', 14: 'Cropland / natural vegetation mosaic', 15: 'Snow & ice', 16: 'Barren', 17: 'Water',
};

/** One date per year from the GIBS GRACE/GRACE-FO record (closest to mid-year; 2017–18 gap between missions). */
export const GRACE_DATES = ['2002-05-02', '2003-05-01', '2004-06-01', '2005-06-01', '2006-06-01', '2007-06-01', '2008-06-01', '2009-06-01', '2010-06-01', '2011-05-01', '2012-06-01', '2013-06-01', '2014-06-01', '2015-06-29', '2016-06-01', '2017-05-02', '2018-06-01', '2019-06-01', '2020-06-01', '2021-06-01', '2022-06-01'];

/** MODIS 16-day composite start dates for a year (day 1, 17, 33, … 353). */
export function ndviDates(year: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= 353; d += 16) out.push(new Date(Date.UTC(year, 0, d)).toISOString().slice(0, 10));
  return out;
}

const cmCache = new Map<string, Promise<CmEntry[]>>();
function colormap(name: string): Promise<CmEntry[]> {
  if (!cmCache.has(name)) cmCache.set(name, fetch(`${GIBS}/colormaps/v1.3/${name}.xml`).then((r) => { if (!r.ok) throw new Error(`colormap ${r.status}`); return r.text(); }).then(parseColormap));
  return cmCache.get(name)!;
}

async function readPixels(url: string, px: number, py: number, radius: number): Promise<[number, number, number, number][] | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) return null;
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' } as ImageBitmapOptions);
  const canvas: OffscreenCanvas | HTMLCanvasElement = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0);
  const x0 = Math.max(0, px - radius), y0 = Math.max(0, py - radius);
  const w = Math.min(255, px + radius) - x0 + 1, h = Math.min(255, py + radius) - y0 + 1;
  const d = ctx.getImageData(x0, y0, w, h).data;
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
  return out;
}

export interface PointValue { date: string; value: number | null; label?: string }

/** Value of a GIBS layer at a point on a date (median of the 3×3 pixel neighbourhood for continuous layers). Cached in IndexedDB. */
export async function pointValue(def: GibsLayerDef, lat: number, lon: number, date: string): Promise<PointValue> {
  const { tx, ty, px, py } = tilePixel(lat, lon, def.level);
  const key = `gibs:${def.id}:${def.level}/${ty}/${tx}/${px}/${py}:${date}`;
  const hit = await idbGet<PointValue>(key);
  if (hit) return hit;
  const url = `${GIBS}/wmts/epsg3857/best/${def.layer}/default/${date}/GoogleMapsCompatible_Level${def.level}/${def.level}/${ty}/${tx}.png`;
  const [cm, px9] = await Promise.all([colormap(def.colormap), readPixels(url, px, py, def.id === 'ndvi' ? 1 : 0)]);
  let result: PointValue = { date, value: null };
  if (px9) {
    const vals: { v: number; label?: string }[] = [];
    for (const [r, g, b, a] of px9) {
      if (a === 0) continue;
      const e = lookup(cm, r, g, b);
      if (e && !e.nodata && e.value != null) vals.push({ v: e.value, label: e.label });
    }
    if (vals.length) {
      const sorted = vals.map((x) => x.v).sort((a, b) => a - b);
      const value = sorted[Math.floor(sorted.length / 2)];
      result = { date, value, label: def.id === 'landcover' ? IGBP[Math.round(value)] : undefined };
    }
  }
  await idbSet(key, result);
  return result;
}

/** Run tasks with limited concurrency, reporting progress. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>, onProgress?: (done: number, total: number) => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); } catch { out[i] = undefined as R; }
      onProgress?.(++done, items.length);
    }
  }));
  return out;
}

// ---------- NASA EONET natural events ----------
export interface EonetEvent { id: string; title: string; category: string; date: string; lat: number; lon: number; km: number; link: string; source?: string }

function haversineKm(a: number, b: number, c: number, d: number) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function fetchEonet(lat: number, lon: number, radiusDeg = 3, days = 730): Promise<EonetEvent[]> {
  const bbox = [lon - radiusDeg, lat + radiusDeg, lon + radiusDeg, lat - radiusDeg].map((v) => v.toFixed(2)).join(',');
  const res = await fetch(`https://eonet.gsfc.nasa.gov/api/v3/events?bbox=${bbox}&days=${days}&status=all&limit=200`);
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const j = await res.json();
  const out: EonetEvent[] = [];
  for (const e of j.events ?? []) {
    const g = (e.geometry ?? []).slice(-1)[0];
    if (!g || g.type !== 'Point') continue;
    const [elon, elat] = g.coordinates;
    out.push({ id: e.id, title: e.title, category: e.categories?.[0]?.title ?? 'Event', date: String(g.date).slice(0, 10), lat: elat, lon: elon, km: Math.round(haversineKm(lat, lon, elat, elon)), link: e.sources?.[0]?.url ?? e.link, source: e.sources?.[0]?.id });
  }
  return out.filter((e) => e.km <= 300).sort((a, b) => b.date.localeCompare(a.date));
}
