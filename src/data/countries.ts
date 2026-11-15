// FAOSTAT country context: currency & exchange rate (PE), producer prices (PP),
// cropland nutrient budget (ESB) and temperature change (ET). Built by scripts/build-faostat.py.
export interface CountryInfo {
  iso2: string; name: string; m49: string;
  currency?: string; currencyName?: string; lcuPerUsd?: number; fxYear?: number;
  prices: Record<string, { usdPerT: number; year: number }>;
  nutrients?: { nBalanceKgHa?: number; nMineralKgHa?: number; nManureKgHa?: number; nUsePct?: number; pBalanceKgHa?: number };
  nutrientsYear?: number;
  warming?: { meanC: number; from: number; to: number; series: Record<string, number> };
}
type FaoData = { countries: Record<string, CountryInfo>; globalMedianUsdPerT: Record<string, { usdPerT: number; n: number }>; retrieved: string };

// The FAOSTAT table (~230 kB) is code-split out of the main bundle and loaded once at startup, in parallel
// with the app (see loadFaostat / AppContext). Until it arrives every lookup below returns "unknown".
let DATA: FaoData = { countries: {}, globalMedianUsdPerT: {}, retrieved: '' };
const FX: Record<string, number> = { USD: 1 };
let loaded: Promise<void> | null = null;
let ready = false;

function install(d: FaoData) {
  DATA = d;
  for (const c of Object.values(DATA.countries)) if (c.currency && c.lcuPerUsd && !FX[c.currency]) FX[c.currency] = c.lcuPerUsd;
  // Senegal's FAOSTAT rate defines XOF; keep the pack currencies anchored to their reference countries.
  if (DATA.countries.SN?.lcuPerUsd) FX.XOF = DATA.countries.SN.lcuPerUsd;
  if (DATA.countries.KZ?.lcuPerUsd) FX.KZT = DATA.countries.KZ.lcuPerUsd;
  ready = true;
}

/** Load the FAOSTAT country table (idempotent; a failed chunk load can be retried). */
export function loadFaostat(): Promise<void> {
  if (!loaded) {
    loaded = Promise.all([import('./faostat/countries.json'), import('./faostat/grown.json')]).then(([m, g]: any[]) => {
      GROWN = (g.default ?? g) as GrownData;
      install((m.default ?? m) as FaoData);
    });
    loaded.catch(() => { loaded = null; });
  }
  return loaded;
}
export const faostatReady = () => ready;

// FAOSTAT QCL harvested area (element 5312) per country and crop, built by scripts/build-faostat-grown.py:
// only crops "commonly grown" in the country (5-year mean ≥ 1,000 ha and ≥ 0.5% of the area of Field Shift crops).
type GrownData = { years: [number, number]; rule: string; countries: Record<string, Record<string, number>> };
let GROWN: GrownData = { years: [0, 0], rule: '', countries: {} };
/** Commonly grown in the country per FAOSTAT: mean harvested area (ha) and its years, or null. */
export function commonlyGrown(iso2: string | undefined, cropId: string): { ha: number; years: [number, number]; country: string } | null {
  const ha = iso2 ? GROWN.countries[iso2]?.[cropId] : undefined;
  return ha ? { ha, years: GROWN.years, country: DATA.countries[iso2!]?.name ?? iso2! } : null;
}

export const countries = () => DATA.countries;
export const faostatRetrieved = () => DATA.retrieved;
export const countryInfo = (iso2?: string): CountryInfo | undefined => (iso2 ? DATA.countries[iso2.toUpperCase()] : undefined);
export const countryList = () => Object.values(DATA.countries).filter((c) => c.currency).sort((a, b) => a.name.localeCompare(b.name));

/** Local currency units per USD (FAOSTAT, latest annual), or undefined if unknown. */
export const fxPerUsd = (currency: string) => FX[currency.toUpperCase()];

/** Factor converting an amount in `from` currency into `to` currency; 1 when either is unknown. */
export function fxFactor(from: string, to: string): number {
  if (from === to) return 1;
  const a = fxPerUsd(from), b = fxPerUsd(to);
  return a && b ? b / a : 1;
}

/**
 * Plausibility band for FAOSTAT country producer prices, as a factor around the 2018+ global median.
 * FAOSTAT's USD/t series converts local prices at official exchange rates, so a few entries are off by an
 * order of magnitude (e.g. hyperinflation years, unit or LCU/USD mix-ups: beans at 71 USD/t, millet at 40 USD/t).
 * Outside the band the country price is not used; the global median is, and the label says so.
 */
export const PRICE_PLAUSIBLE_FACTOR = 3;

/** Crops priced with another FAOSTAT item (winter and spring types share one producer-price series). */
const PRICE_ALIAS: Record<string, string> = { winterrapeseed: 'rapeseed' };

export interface PriceRef { usdPerT: number; year?: number; source: 'faostat-country' | 'faostat-median'; label: string; replaced?: { usdPerT: number; year: number } }
/** Farm-gate price: country FAOSTAT producer price if available and plausible, else the global median (2018+). */
export function cropPriceUsd(iso2: string | undefined, cropId: string): PriceRef | null {
  cropId = PRICE_ALIAS[cropId] ?? cropId;
  const c = countryInfo(iso2);
  const p = c?.prices[cropId];
  const g = DATA.globalMedianUsdPerT[cropId];
  const implausible = !!(p && g && (p.usdPerT > g.usdPerT * PRICE_PLAUSIBLE_FACTOR || p.usdPerT < g.usdPerT / PRICE_PLAUSIBLE_FACTOR));
  if (p && !implausible) return { usdPerT: p.usdPerT, year: p.year, source: 'faostat-country', label: `FAOSTAT producer price, ${c!.name} ${p.year}` };
  if (g) {
    const label = implausible
      ? `FAOSTAT global median producer price (${g.n} countries, 2018+) — ${c!.name}'s ${p!.year} value (${Math.round(p!.usdPerT)} USD/t) is >${PRICE_PLAUSIBLE_FACTOR}× off and not used`
      : `FAOSTAT global median producer price (${g.n} countries, 2018+)`;
    return { usdPerT: g.usdPerT, source: 'faostat-median', label, ...(implausible ? { replaced: { usdPerT: p!.usdPerT, year: p!.year } } : {}) };
  }
  return null;
}
