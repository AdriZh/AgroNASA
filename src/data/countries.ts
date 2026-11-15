// FAOSTAT country context: currency & exchange rate (PE), producer prices (PP),
// cropland nutrient budget (ESB) and temperature change (ET). Built by scripts/build-faostat.py.
import faostat from './faostat/countries.json';

export interface CountryInfo {
  iso2: string; name: string; m49: string;
  currency?: string; currencyName?: string; lcuPerUsd?: number; fxYear?: number;
  prices: Record<string, { usdPerT: number; year: number }>;
  nutrients?: { nBalanceKgHa?: number; nMineralKgHa?: number; nManureKgHa?: number; nUsePct?: number; pBalanceKgHa?: number };
  nutrientsYear?: number;
  warming?: { meanC: number; from: number; to: number; series: Record<string, number> };
}
const DATA = faostat as unknown as { countries: Record<string, CountryInfo>; globalMedianUsdPerT: Record<string, { usdPerT: number; n: number }>; retrieved: string };

export const COUNTRIES = DATA.countries;
export const FAOSTAT_RETRIEVED = DATA.retrieved;
export const countryInfo = (iso2?: string): CountryInfo | undefined => (iso2 ? DATA.countries[iso2.toUpperCase()] : undefined);
export const countryList = () => Object.values(DATA.countries).filter((c) => c.currency).sort((a, b) => a.name.localeCompare(b.name));

const FX: Record<string, number> = { USD: 1 };
for (const c of Object.values(DATA.countries)) if (c.currency && c.lcuPerUsd && !FX[c.currency]) FX[c.currency] = c.lcuPerUsd;
// Senegal's FAOSTAT rate defines XOF; keep the pack currencies anchored to their reference countries.
if (DATA.countries.SN?.lcuPerUsd) FX.XOF = DATA.countries.SN.lcuPerUsd;
if (DATA.countries.KZ?.lcuPerUsd) FX.KZT = DATA.countries.KZ.lcuPerUsd;

/** Local currency units per USD (FAOSTAT, latest annual), or undefined if unknown. */
export const fxPerUsd = (currency: string) => FX[currency.toUpperCase()];

/** Factor converting an amount in `from` currency into `to` currency; 1 when either is unknown. */
export function fxFactor(from: string, to: string): number {
  if (from === to) return 1;
  const a = fxPerUsd(from), b = fxPerUsd(to);
  return a && b ? b / a : 1;
}

export interface PriceRef { usdPerT: number; year?: number; source: 'faostat-country' | 'faostat-median'; label: string }
/** Farm-gate price: country FAOSTAT producer price if available, else the global median (2018+). */
export function cropPriceUsd(iso2: string | undefined, cropId: string): PriceRef | null {
  const c = countryInfo(iso2);
  const p = c?.prices[cropId];
  if (p) return { usdPerT: p.usdPerT, year: p.year, source: 'faostat-country', label: `FAOSTAT producer price, ${c!.name} ${p.year}` };
  const g = DATA.globalMedianUsdPerT[cropId];
  if (g) return { usdPerT: g.usdPerT, source: 'faostat-median', label: `FAOSTAT global median producer price (${g.n} countries, 2018+)` };
  return null;
}
