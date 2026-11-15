import { useState } from 'react';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { geocode, type GeoHit } from '../../weather/forecast';
import { detectPack } from '../../data/regionPacks';

export interface Place { label: string; lat: number; lon: number; iso2?: string }

/** One example farming location per regional pack — each pin verified as cropland in MODIS IGBP land cover (2024). */
export const WORLD_PRESETS: (Place & { flag: string; system: string })[] = [
  { label: 'Bambey, Senegal', lat: 14.71, lon: -16.46, iso2: 'SN', flag: '🇸🇳', system: 'Millet · groundnut' },
  { label: 'Kano, Nigeria', lat: 12.1, lon: 8.3, iso2: 'NG', flag: '🇳🇬', system: 'Sorghum · cowpea' },
  { label: 'Nakuru, Kenya', lat: -0.4, lon: 35.95, iso2: 'KE', flag: '🇰🇪', system: 'Maize · beans, 2 seasons' },
  { label: 'Debre Zeit, Ethiopia', lat: 8.8, lon: 39.05, iso2: 'ET', flag: '🇪🇹', system: 'Teff · wheat · pulses' },
  { label: 'Lilongwe Plain, Malawi', lat: -14.0, lon: 33.7, iso2: 'MW', flag: '🇲🇼', system: 'Maize · groundnut' },
  { label: 'Karnal, India', lat: 29.75, lon: 76.85, iso2: 'IN', flag: '🇮🇳', system: 'Kharif · Rabi' },
  { label: 'Can Tho, Vietnam', lat: 10.1, lon: 105.6, iso2: 'VN', flag: '🇻🇳', system: 'Rice · wet & dry season' },
  { label: 'Shijiazhuang, China', lat: 38.0, lon: 115.2, iso2: 'CN', flag: '🇨🇳', system: 'Maize → winter wheat' },
  { label: 'Settat, Morocco', lat: 33.05, lon: -7.5, iso2: 'MA', flag: '🇲🇦', system: 'Winter wheat · chickpea' },
  { label: 'Fergana, Uzbekistan', lat: 40.45, lon: 71.6, iso2: 'UZ', flag: '🇺🇿', system: 'Cotton · wheat (irrigated)' },
  { label: 'Kostanay, Kazakhstan', lat: 53.3, lon: 63.4, iso2: 'KZ', flag: '🇰🇿', system: 'Spring wheat · break crops' },
  { label: 'Kropyvnytskyi, Ukraine', lat: 48.4, lon: 32.5, iso2: 'UA', flag: '🇺🇦', system: 'Wheat · sunflower · maize' },
  { label: 'Ames, Iowa, USA', lat: 42.0, lon: -93.75, iso2: 'US', flag: '🇺🇸', system: 'Corn · soybean' },
  { label: 'Sorriso, Brazil', lat: -12.6, lon: -55.9, iso2: 'BR', flag: '🇧🇷', system: 'Soy → safrinha maize' },
  { label: 'Northam, Australia', lat: -31.6, lon: 116.9, iso2: 'AU', flag: '🇦🇺', system: 'Wheat · canola · lupin' },
];

export function LocationSearch({ onPick }: { onPick: (p: Place) => void; compact?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const search = async () => {
    if (!q.trim()) return;
    setErr(null); setBusy(true);
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) { onPick({ lat: Number(m[1]), lon: Number(m[2]), label: `${Number(m[1]).toFixed(3)}, ${Number(m[2]).toFixed(3)}` }); setBusy(false); return; }
    try { const r = await geocode(q); setHits(r); if (!r.length) setErr('No place found — try a district or town name, or type coordinates like “-0.3, 36.07”.'); }
    catch (e: any) { setErr(`Search unavailable (${e.message}). Click the map, use GPS, or type coordinates like “-0.3, 36.07”.`); }
    setBusy(false);
  };
  const gps = () => {
    if (!navigator.geolocation) { setErr('GPS not available in this browser.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onPick({ lat: Number(p.coords.latitude.toFixed(4)), lon: Number(p.coords.longitude.toFixed(4)), label: 'My location' }); },
      () => { setBusy(false); setErr('Location permission denied.'); },
    );
  };
  return (
    <div>
      <div className="row">
        <div className="input-icon">
          <Search aria-hidden />
          <input className="input" placeholder="Search any village, district or region — or type lat, lon" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} aria-label="Search location" />
        </div>
        <button className="btn" onClick={search} disabled={busy}>{busy ? <Loader2 className="spin" /> : null}Search</button>
        <button className="btn" onClick={gps} title="Use device GPS"><Crosshair /> GPS</button>
      </div>
      {err && <p className="mini warn-t" style={{ marginTop: 8 }}>{err}</p>}
      {hits.length > 0 && (
        <div className="stack-sm" style={{ marginTop: 8 }}>
          {hits.map((h) => (
            <button key={`${h.lat},${h.lon}`} className="btn sm" style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => { onPick({ lat: Number(h.lat.toFixed(4)), lon: Number(h.lon.toFixed(4)), label: h.label.split(',').slice(0, 3).join(','), iso2: h.iso2 }); setHits([]); setQ(''); }}>
              <MapPin /> <span>{h.label}</span> <span className="chip" style={{ marginLeft: 'auto' }}>{detectPack(h.lat, h.lon, h.iso2).short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PresetGrid({ onPick }: { onPick: (p: Place) => void }) {
  return (
    <div className="preset-grid">
      {WORLD_PRESETS.map((p) => (
        <button key={p.label} className="preset" onClick={() => onPick(p)} title={`${p.label} · ${detectPack(p.lat, p.lon, p.iso2).name}`}>
          <span className="flag" aria-hidden>{p.flag}</span>
          <span><b>{p.label.split(',')[0]}</b><small>{p.system}</small></span>
        </button>
      ))}
    </div>
  );
}
