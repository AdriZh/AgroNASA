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

export interface GeoHit { label: string; lat: number; lon: number }
export async function geocode(q: string): Promise<GeoHit[]> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const j = await res.json();
  return j.map((x: any) => ({ label: x.display_name, lat: Number(x.lat), lon: Number(x.lon) }));
}
