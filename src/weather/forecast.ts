// 16-day numerical forecast from Open-Meteo (non-NASA; ECMWF/GFS/ICON blend). Planning context only.
export interface ForecastDay { date: string; rain: number; tmax: number; tmin: number; et0: number; rainProb: number | null }
export interface Forecast { days: ForecastDay[]; retrievedAt: string; source: string }

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,precipitation_probability_max&forecast_days=16&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const j = await res.json();
  const d = j.daily;
  const days: ForecastDay[] = d.time.map((t: string, i: number) => ({
    date: t, rain: d.precipitation_sum[i] ?? 0, tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i],
    et0: d.et0_fao_evapotranspiration[i] ?? 0, rainProb: d.precipitation_probability_max?.[i] ?? null,
  }));
  return { days, retrievedAt: new Date().toISOString(), source: 'Open-Meteo Forecast API' };
}

export interface GeoHit { label: string; lat: number; lon: number; iso2?: string }
export async function geocode(q: string): Promise<GeoHit[]> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const j = await res.json();
  return j.map((x: any) => ({ label: x.display_name, lat: Number(x.lat), lon: Number(x.lon), iso2: x.address?.country_code ? String(x.address.country_code).toUpperCase() : undefined }));
}

/** ISO 3166 alpha-2 country code for a point (OpenStreetMap Nominatim reverse geocoding, country level). */
export async function reverseCountry(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Reverse geocoder HTTP ${res.status}`);
  const j = await res.json();
  return j?.address?.country_code ? String(j.address.country_code).toUpperCase() : null;
}
