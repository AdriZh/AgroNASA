import type { AreaUnit, FertilizerApplication } from './types';

export const AREA_TO_HA: Record<AreaUnit, number> = { ha: 1, acre: 0.40468564224, m2: 0.0001 };

export function toHectares(value: number, unit: AreaUnit): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Area must be a positive number');
  return value * AREA_TO_HA[unit];
}

// Fertilizer label conventions (N–P2O5–K2O). Elemental conversion factors per FAO / extension practice.
export const P2O5_TO_P = 0.4364;
export const K2O_TO_K = 0.8301;

export interface NormalizedApplication {
  productKg: number | null;      // total product mass, kg
  rateKgHa: number | null;       // product kg per treated ha
  nKgHa: number | null;          // applied N (label arithmetic), not plant-available N
  p2o5KgHa: number | null;
  k2oKgHa: number | null;
  flags: string[];
}

/** Normalize a fertilizer record. Unknowns stay null — never become zero. */
export function normalizeApplication(a: FertilizerApplication): NormalizedApplication {
  const flags: string[] = [];
  let productKg: number | null = null;
  if (a.quantity == null || !Number.isFinite(a.quantity)) {
    flags.push('Quantity unknown');
  } else if (a.quantityUnit === 'kg') productKg = a.quantity;
  else if (a.quantityUnit === 't') productKg = a.quantity * 1000;
  else if (a.quantityUnit === 'bag') {
    if (a.bagMassKg && a.bagMassKg > 0) productKg = a.quantity * a.bagMassKg;
    else flags.push('Bag mass unknown — cannot convert bags to kg');
  } else if (a.quantityUnit === 'L') {
    flags.push('Litres need product density/concentration before mass conversion');
  }

  let rateKgHa: number | null = null;
  if (productKg != null) {
    if (a.treatedAreaHa && a.treatedAreaHa > 0) rateKgHa = productKg / a.treatedAreaHa;
    else flags.push('Treated area unknown — rate per ha not computed (whole field is not assumed)');
  }

  const nut = (pct: number | null | undefined) =>
    rateKgHa == null || pct == null || !Number.isFinite(pct) ? null : (rateKgHa * pct) / 100;

  if (a.type === 'organic' && (a.n == null || a.p2o5 == null)) flags.push('Organic material composition unknown — no nutrient credit assumed');
  else if (a.n == null && a.p2o5 == null && a.k2o == null) flags.push('Product analysis unknown');
  if (a.approximateDate) flags.push('Date approximate');

  return { productKg, rateKgHa, nKgHa: nut(a.n), p2o5KgHa: nut(a.p2o5), k2oKgHa: nut(a.k2o), flags };
}

export function round(x: number, d = 2): number {
  const f = 10 ** d;
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Money handled in integer minor units (cents/tiyn/centimes) to avoid binary-float comparisons. */
export const toMinor = (x: number) => Math.round(x * 100);
export const fromMinor = (m: number) => m / 100;

export function fmtMoney(x: number | null | undefined, currency: string): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 0 : 2;
  return `${x < 0 ? '−' : ''}${abs.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${currency}`;
}

/** Modeled amounts (net, revenue) rounded to 3 significant figures with "≈": "≈ 704,000 XOF". Cost lines stay exact. */
export function fmtApprox(x: number | null | undefined, currency: string): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  const r = abs === 0 ? 0 : Number(abs.toPrecision(3));
  return `≈ ${x < 0 && r !== 0 ? '−' : ''}${r.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
}

export function fmtNum(x: number | null | undefined, d = 1): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
