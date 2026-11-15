// 16-day numerical forecast from Open-Meteo (non-NASA; ECMWF/GFS/ICON blend). Planning context only.
import { fetchJson } from './net';

export interface ForecastDay { date: string; rain: number; tmax: number; tmin: number; et0: number; rainProb: number | null }
export interface Forecast { days: ForecastDay[]; retrievedAt: string; source: string }

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_probability_max&forecast_days=16&timezone=auto`;
  const j = await fetchJson(url, { timeoutMs: 10_000, service: 'Open-Meteo' });
  const d = j?.daily;
  if (!d || !Array.isArray(d.time)) throw new Error('Open-Meteo returned no forecast for this point');
  // untrusted payload: dates must look like dates and values must be finite numbers (or fall back)
  const at = (k: string, i: number): number | null => { const v = Array.isArray(d[k]) ? d[k][i] : null; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
  const days: ForecastDay[] = [];
  d.time.slice(0, 32).forEach((t: unknown, i: number) => {
    if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return;
    const tmax = at('temperature_2m_max', i), tmin = at('temperature_2m_min', i);
    if (tmax == null || tmin == null) return;
    days.push({ date: t, rain: at('precipitation_sum', i) ?? 0, tmax, tmin, et0: at('et0_fao_evapotranspiration', i) ?? 0, rainProb: at('precipitation_probability_max', i) });
  });
  if (!days.length) throw new Error('Open-Meteo returned no forecast for this point');
  return { days, retrievedAt: new Date().toISOString(), source: 'Open-Meteo Forecast API' };
}

export interface GeoHit { label: string; lat: number; lon: number; iso2?: string }
export async function geocode(q: string): Promise<GeoHit[]> {
  const j = await fetchJson(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' }, timeoutMs: 8_000, service: 'Place search' });
  const hits: GeoHit[] = [];
  for (const x of (Array.isArray(j) ? j : []).slice(0, 20) as any[]) {
    const lat = Number(x?.lat), lon = Number(x?.lon), cc = x?.address?.country_code;
    if (typeof x?.display_name !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    hits.push({ label: x.display_name.slice(0, 200), lat, lon, iso2: typeof cc === 'string' && /^[a-z]{2}$/i.test(cc) ? cc.toUpperCase() : undefined });
  }
  return hits;
}

/** Short place name and country for a point (Nominatim reverse geocoding at district level). */
export async function reversePlace(lat: number, lon: number): Promise<{ label: string; iso2?: string } | null> {
  const j = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&addressdetails=1&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, { headers: { 'Accept-Language': 'en' }, timeoutMs: 8_000, service: 'Reverse geocoder' });
  const a = j?.address;
  if (!a || typeof a !== 'object') return null;
  const pick = (...ks: string[]) => ks.map((k) => a[k]).find((v) => typeof v === 'string' && v.trim());
  const place = pick('village', 'town', 'city', 'municipality', 'hamlet', 'suburb', 'county', 'district');
  const region = pick('state', 'region', 'province', 'county');
  const country = pick('country');
  const label = [place, region !== place ? region : undefined, country].filter(Boolean).join(', ').slice(0, 160);
  const cc = a.country_code;
  return label ? { label, iso2: typeof cc === 'string' && /^[a-z]{2}$/i.test(cc) ? cc.toUpperCase() : undefined } : null;
}

/** ISO 3166 alpha-2 country code for a point (OpenStreetMap Nominatim reverse geocoding, country level). */
export async function reverseCountry(lat: number, lon: number): Promise<string | null> {
  const j = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { headers: { 'Accept-Language': 'en' }, timeoutMs: 8_000, service: 'Reverse geocoder' });
  const cc = j?.address?.country_code;
  return typeof cc === 'string' && /^[a-z]{2}$/i.test(cc) ? cc.toUpperCase() : null;
}
