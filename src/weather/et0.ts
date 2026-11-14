// FAO-56 reference evapotranspiration (Allen et al., 1998), daily time step.
import type { DailySeries } from '../domain/types';
import { addDays, doy } from '../domain/dates';

const SIGMA = 4.903e-9; // MJ K-4 m-2 day-1

export function extraterrestrialRadiation(latDeg: number, dayOfYear: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * dayOfYear) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * dayOfYear) / 365 - 1.39);
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

const esat = (t: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));

/** FAO-56 Penman–Monteith (eq. 6). Returns mm/day. */
export function et0PenmanMonteith(tmax: number, tmin: number, rhMean: number, u2: number, rs: number, latDeg: number, dayOfYear: number, elevM: number): number {
  const t = (tmax + tmin) / 2;
  const delta = (4098 * esat(t)) / (t + 237.3) ** 2;
  const pAtm = 101.3 * ((293 - 0.0065 * elevM) / 293) ** 5.26;
  const gamma = 0.000665 * pAtm;
  const es = (esat(tmax) + esat(tmin)) / 2;
  const ea = (rhMean / 100) * es;
  const ra = extraterrestrialRadiation(latDeg, dayOfYear);
  const rso = (0.75 + 2e-5 * elevM) * ra;
  const rns = 0.77 * rs;
  const ratio = rso > 0 ? Math.min(1, rs / rso) : 0.5;
  const rnl = SIGMA * (((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0))) * (1.35 * ratio - 0.35);
  const rn = rns - rnl;
  const et0 = (0.408 * delta * rn + gamma * (900 / (t + 273)) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2));
  return Math.max(0, et0);
}

/** FAO-56 eq. 52 Hargreaves fallback when humidity/wind/radiation are missing. */
export function et0Hargreaves(tmax: number, tmin: number, latDeg: number, dayOfYear: number): number {
  const ra = extraterrestrialRadiation(latDeg, dayOfYear);
  return Math.max(0, 0.0023 * ((tmax + tmin) / 2 + 17.8) * Math.sqrt(Math.max(tmax - tmin, 0)) * 0.408 * ra);
}

const cache = new WeakMap<DailySeries, Float64Array>();

/** ET0 for every day of a series (memoized). Uses PM when inputs exist, else Hargreaves, else NaN. */
export function et0Series(s: DailySeries): Float64Array {
  const hit = cache.get(s);
  if (hit) return hit;
  const out = new Float64Array(s.n);
  for (let i = 0; i < s.n; i++) {
    const tx = s.TX[i], tn = s.TN[i];
    if (tx == null || tn == null) { out[i] = NaN; continue; }
    const d = doy(addDays(s.meta.start, i));
    const rh = s.RH[i], ws = s.WS[i], rs = s.RS[i];
    out[i] = rh != null && ws != null && rs != null
      ? et0PenmanMonteith(tx, tn, rh, ws, rs, s.meta.lat, d, s.meta.elevation)
      : et0Hargreaves(tx, tn, s.meta.lat, d);
  }
  cache.set(s, out);
  return out;
}
