// Agronomic priors for the soil-N / multi-year rotation layer. Every number here is an editable,
// order-of-magnitude prior (sources in data/sources.ts: R42–R45); none is fitted to the farmer's field.

/** Field Shift crop id → INRAE trial species. Crops not listed are outside the trial data. */
export const SPECIES_OF: Record<string, string> = {
  wheat: 'wheat_aestivum',
  winterwheat: 'wheat_aestivum',
  barley: 'barley',
  pea: 'pea',
  fababean: 'fababean',
  lentil: 'lentil',
  chickpea: 'chickpea',
};
export const LEGUME_SPECIES = new Set(['pea', 'fababean', 'lentil', 'chickpea', 'lupin']);

/** Cereal–legume mixtures with trial data (INRAE species_mix), as Field Shift crop pairs. */
export const INTERCROPS: [string, string][] = [
  ['wheat', 'pea'], ['wheat', 'lentil'],
  ['winterwheat', 'pea'], ['winterwheat', 'lentil'],
  ['barley', 'pea'], ['barley', 'fababean'],
];
export const intercropId = (a: string, b: string) => `${a}+${b}`;

/**
 * Balance-sheet N rule (COMIFER-style): total mineral-N requirement = expected yield × N need per tonne of grain;
 * fertilizer = max(0, requirement − soil mineral N at sowing). The expected yield is Field Shift's regional level,
 * so the rate scales with the region (≈40 kg N/ha for 1.3 t/ha steppe wheat, ≈200 for 7 t/ha European wheat).
 * Legumes get none. A mixture's cereal is sown at reduced density, so it needs a share of the sole-cereal rate.
 */
export const N_PER_T_GRAIN: Record<string, number> = { wheat: 30, winterwheat: 30, barley: 25 };
export const INTERCROP_CEREAL_N_SHARE = 0.6;

export type Family = 'cereal' | 'legume' | 'intercrop' | 'fallow' | 'other';

export const MONOCULTURE_FACTOR = 0.85; // same crop twice running
/** Yield multiplier for a family (columns) after the previous family (rows). Preissel et al. 2015 (R44). */
export const PRECROP_YIELD_FACTOR: Record<Family, Partial<Record<Family, number>>> = {
  legume: { cereal: 1.12, legume: 0.85, intercrop: 1.02 },
  intercrop: { cereal: 1.06, legume: 0.96, intercrop: 1.0 },
  cereal: { cereal: 0.95, legume: 1.0, intercrop: 1.0 },
  fallow: { cereal: 1.05, legume: 1.0, intercrop: 1.0 },
  other: { cereal: 1.03, legume: 1.0, intercrop: 1.0 },
};
/** Annual change of a soil-organic-matter index (1 = baseline) by family. */
export const SOM_DELTA: Record<Family, number> = { cereal: -0.02, legume: 0.01, intercrop: 0.006, fallow: 0.005, other: -0.01 };
export const SOM_YIELD_SENSITIVITY = 0.6;
export const SOM_BOUNDS: [number, number] = [0.5, 1.2];
/** kg N-equivalent per point of SOM index, to fold SOM change into the soil term of the utility. */
export const SOM_INDEX_TO_KG_N = 600;

// Soil mineral-N balance (kg N/ha) between seasons.
export const N_CARRYOVER = 0.55;
export const BELOWGROUND_N_FACTOR = 0.3;
export const RESIDUE_N_AVAILABLE: Record<Family, number> = { cereal: 0.05, legume: 0.35, intercrop: 0.2, fallow: 0, other: 0.1 };
export const BASE_MINERALIZATION = 25;
export const SOIL_N_BOUNDS: [number, number] = [5, 250];
export const DEFAULT_SOIL_N = 50;

// Emissions (kg CO2e): synthetic N manufacture ≈ 4 + field N2O (IPCC 2019 EF1 1 % + indirect) ≈ 5.8 (R45).
export const EMISSIONS_PER_KG_N = 9.8;
export const FIELD_OPS_EMISSIONS: Record<Family, number> = { cereal: 160, legume: 140, intercrop: 160, fallow: 40, other: 150 };

/** Fallback price of fertilizer N when the regional template has no urea / AN line (USD per kg N). */
export const DEFAULT_N_PRICE_USD = 1.3;
/** Extra cash cost of an intercrop over its components' shared operations: grain separation (USD/ha). */
export const INTERCROP_SEPARATION_USD = 40;
/** Seed of each intercrop component is sown at ~60 % of its sole-crop rate (replacement/additive designs). */
export const INTERCROP_SEED_SHARE = 0.6;

/** Search size cap: rows evaluated across the rotation tree (keeps a phone under ~0.5 s). */
export const MAX_TREE_ROWS = 30_000;
