// Core data model for Field Shift. Mirrors the schema in 03_Step_by_Step_Implementation_Plan §3.

export type SourceTag =
  | 'farmer'      // reported by the farmer / extension worker
  | 'nasa'        // NASA observation or reanalysis (POWER, GIBS)
  | 'soilgrids'   // ISRIC SoilGrids modeled soil map (non-NASA)
  | 'forecast'    // Open-Meteo numerical forecast (non-NASA)
  | 'rule'        // regional rule pack entry
  | 'modeled'     // computed by Field Shift's models (FAO-56 / FAO-33)
  | 'synthetic';  // illustrative demo value — not a real quote

export type AreaUnit = 'ha' | 'acre' | 'm2';
export type Priority = 'cost' | 'climate' | 'continuity' | 'return' | 'soil';
export type LaborLevel = 'low' | 'medium' | 'high';
export type Tri = 'yes' | 'no' | 'unknown';
export type SoilTexture = 'sand' | 'loamy-sand' | 'sandy-loam' | 'loam' | 'silt-loam' | 'clay-loam' | 'clay' | 'unknown';

export interface LatLon { lat: number; lon: number }

export interface CropSeason {
  id: string;
  cropId: string;
  year: number;               // calendar year of sowing
  seasonId?: string;          // which of the region's seasons (e.g. 'long', 'short', 'kharif', 'rabi')
  plantedOn?: string;         // ISO date
  harvestedOn?: string;       // ISO date
  approximateDate: boolean;
  variety?: string;
  outcome?: 'good' | 'average' | 'poor' | 'failed' | 'unknown';
  yieldTHa?: number | null;   // farmer-reported, optional
  notes?: string;
  residueUse?: 'left' | 'grazed' | 'removed' | 'burned' | 'unknown';
}

export interface FertilizerApplication {
  id: string;
  cropSeasonId: string;
  productId: string;          // key into the fertilizer product library or 'custom'
  productName: string;
  type: 'mineral' | 'organic';
  applicationDate?: string;
  approximateDate: boolean;
  quantity: number | null;    // total product applied
  quantityUnit: 'kg' | 'bag' | 't' | 'L';
  bagMassKg?: number | null;
  treatedAreaHa?: number | null; // null = unknown (never assume whole field)
  n?: number | null;          // label N %  (null = unknown)
  p2o5?: number | null;       // label P2O5 %
  k2o?: number | null;        // label K2O %
  method?: string;
  paidCost?: number | null;
  currency?: string;
  source: 'receipt' | 'recall' | 'unknown';
}

export interface SoilEvidence {
  texture: SoilTexture;       // farmer-known texture
  labPh?: number | null;
  labSocPct?: number | null;
  labDate?: string;
  notes?: string;
}

export interface ConfirmedInflow { id: string; date: string; amount: number; label: string }

export interface PriceOverride { [itemKey: string]: number | null }

export interface FarmScenario {
  id: string;
  name: string;
  regionPackId?: string;      // auto-detected from location if absent
  location: LatLon & { label?: string };
  countryIso2?: string;       // ISO 3166 alpha-2, from reverse geocoding or the farmer
  area: number;
  areaUnit: AreaUnit;
  currency: string;
  availableFunds: number;
  reserve: number;
  confirmedInflows: ConfirmedInflow[];
  firstSeasonYear: number;    // year of the first planned season
  irrigation: Tri;
  irrigationCapacityMm: number; // usable seasonal irrigation water (mm) if irrigation = yes
  laborAvailable: LaborLevel;
  unavailableCrops: string[]; // seed not obtainable
  marketCrops: string[];      // crops the farmer can sell/use (empty = no restriction)
  needsResidue: boolean;      // livestock residue needs
  allowFallow: boolean;       // consider a fallow / rest season as an option
  priority: Priority;
  baselineOverride?: [string, string] | null;
  history: CropSeason[];
  fertilizer: FertilizerApplication[];
  soil: SoilEvidence;
  priceOverrides: PriceOverride;
  synthetic: boolean;         // whole scenario is a demo fixture
  /** Set while funds/reserve are app-generated placeholders (new or custom farm) the farmer has not edited yet. */
  budgetPlaceholder?: BudgetPlaceholder | null;
}

/** Record of a generated starting budget, so the app can tell it apart from a farmer-entered one. */
export interface BudgetPlaceholder {
  funds: number; reserve: number; currency: string;
  key: string;                // pack · currency · area · usual plan the placeholder was computed for
  usualCost: number;          // cash cost of the usual plan it was derived from (scenario currency)
}

// ---------- Regional knowledge ----------

export interface CropDef {
  id: string;
  name: string;
  family: string;             // botanical family
  group: 'cereal' | 'legume' | 'oilseed' | 'tuber' | 'fallow';
  emoji: string;
  // FAO-56 single crop coefficient model
  kc: [number, number, number];      // Kc ini, mid, end (FAO-56 Table 12)
  stages: [number, number, number, number]; // L ini, dev, mid, late (days)
  rootDepthM: number;         // max effective rooting depth (FAO-56 Table 22)
  p: number;                  // depletion fraction (FAO-56 Table 22)
  ky: number;                 // seasonal yield response factor (FAO-33 / analogue)
  /** FAO-33 Table 24 Ky for individual growth periods: vegetative, flowering, yield formation, ripening. */
  kyStages?: [number, number, number, number];
  heatThresholdC: number;     // exploratory Tmax threshold around flowering
  frostSensitive: boolean;
  sowTempC: number;           // 5-day mean T2M needed to sow (temperature-driven sowing)
  tMeanRange: [number, number]; // season mean air temperature range for screening (°C)
  phRange: [number, number];
  minReturnSeasons: number;   // seasons that must pass before the same crop again
  diseaseGroups: string[];    // shared pathogen groups (e.g. sclerotinia)
  labor: LaborLevel;
  residueForLivestock: boolean;
  irrigationRequired: boolean;
  sources: string[];          // evidence ids
  /** Cover / catch crop: grown for soil benefit (green manure, cover), never ranked as a cash crop. */
  cover?: boolean;
  /** Base temperature for growing-degree days (°C), used by the short-window check (engine/window.ts). */
  tbase?: number;
  /** Growing-degree days above `tbase` from sowing to maturity — for green manures, to termination at flowering. */
  gddToMaturity?: number;
  /** Cover crops only: seed rate and an indicative seed price (USD/kg). Seed is their only cost; they earn no revenue. */
  coverSeed?: { kgPerHa: number; usdPerKg: number };
  /** Parameters not yet reviewed by a local agronomist. */
  reviewStatus?: 'demo-unreviewed';
}

export interface RotationRule {
  id: string;
  kind: 'exclude' | 'warn' | 'benefit';
  text: string;
  sources: string[];
  reviewed: boolean;          // locally reviewed by an agronomist?
}

export interface CostItemDef {
  key: string;                // unique within crop (used for overrides)
  category: 'seed' | 'fertilizer' | 'labor' | 'land-prep' | 'protection' | 'irrigation' | 'other';
  label: string;
  qtyPerHa: number;
  unit: string;
  unitPrice: number | null;   // null = price missing
  dueOffsetDays: number;      // relative to sowing (negative = before)
  essential: boolean;
  cash: boolean;              // cash vs non-cash (family labor)
}

export interface CropEconomics {
  attainableYieldTHa: number; // illustrative water-unlimited attainable yield under farmer management
  pricePerT: number | null;   // illustrative farm-gate price
  items: CostItemDef[];
}

export interface SeasonDef {
  id: string;                 // e.g. 'main', 'long', 'short', 'kharif', 'rabi', 'winter', 'spring'
  label: string;
  method: 'rain-onset' | 'temperature' | 'fixed';
  earliest: string;           // MM-DD, or 'auto' (derived from the NASA climatology)
  latest: string;             // MM-DD, or 'auto'
  crops: string[];            // crops that can be sown in this season (may include 'fallow')
  note?: string;
}

export interface RegionPack {
  id: string;
  version: string;
  name: string;
  short: string;
  description: string;
  countries: string[];        // ISO2 codes that select this pack (empty = by bbox only)
  bbox: [number, number, number, number][]; // fallback boxes: minLat, minLon, maxLat, maxLon
  latRange?: [number, number]; // optional restriction inside a country (e.g. Sahel part of Nigeria)
  lonRange?: [number, number]; // optional longitude restriction inside a country (e.g. the US Corn Belt)
  currency: string;           // currency of the economics below
  mode: 'annual' | 'double';  // annual: one crop per year (each crop in its own season); double: two seasons in the same year
  seasons: SeasonDef[];
  crops: string[];
  cropOverrides?: Record<string, Partial<CropDef>>; // regional variety durations, thresholds
  rules: RotationRule[];
  economics: Record<string, CropEconomics>;
  reviewStatus: 'demo-unreviewed' | 'reviewed';
  demoDataset?: string;       // bundled NASA dataset key
  /** Crops for which a same-crop sequence is an accepted local practice (e.g. irrigated rice–rice in paddy systems).
   *  They are penalized (warning + lower rank) instead of excluded by the monoculture rule G-R6. */
  continuousCrops?: string[];
  /** Regionally typical two-season sequence assumed as the "usual plan" when the farmer has entered no history. */
  usualRotation?: [string, string];
  irrigationTypical?: boolean; // most farms here irrigate; rainfed results will look poor
  sources: string[];
}

// ---------- Weather ----------

export interface DailySeries {
  meta: {
    lat: number; lon: number; elevation: number;
    start: string; end: string; // ISO
    retrievedAt: string; query: string; sources: string[];
    fillValue: number; cached: boolean; label: string;
  };
  n: number;
  P: (number | null)[];   // PRECTOTCORR mm/day
  TX: (number | null)[];  // T2M_MAX °C
  TN: (number | null)[];  // T2M_MIN °C
  T: (number | null)[];   // T2M °C
  RH: (number | null)[];  // RH2M %
  WS: (number | null)[];  // WS2M m/s
  RS: (number | null)[];  // ALLSKY_SFC_SW_DWN MJ/m2/day
  GWR: (number | null)[]; // GWETROOT 0-1
  GWT: (number | null)[]; // GWETTOP 0-1
}

export interface SoilProfile {
  source: 'soilgrids' | 'farmer' | 'default';
  clayPct: number | null; sandPct: number | null; siltPct: number | null;
  socPct: number | null; ph: number | null; nitrogenGKg: number | null; cec: number | null; bulkDensity: number | null;
  texture: SoilTexture;
  awcMmPerM: number;      // available water capacity, mm water per m soil
  retrievedAt?: string;
  cached?: boolean;
}

// ---------- Results ----------

export type ReasonCode =
  | 'BUDGET_EXCEEDED' | 'BUDGET_OK' | 'PRICE_MISSING' | 'CASH_TIMING'
  | 'PRIOR_CROP_RULE' | 'RETURN_INTERVAL' | 'DISEASE_GROUP' | 'LEGUME_BENEFIT' | 'FALLOW_BENEFIT'
  | 'MONOCULTURE' | 'SAME_FAMILY' | 'BREAK_CROP' | 'ALTERNATION' | 'BUDGET_PLACEHOLDER' | 'PRICE_IMPLAUSIBLE'
  | 'IRRIGATION_REQUIRED' | 'SEED_UNAVAILABLE' | 'MARKET_CONSTRAINT' | 'LABOR_LIMIT' | 'RESIDUE_NEED'
  | 'CLIMATE_UNSUITABLE' | 'CLIMATE_RISK_HIGH' | 'HEAT_EXPOSURE' | 'FROST_RISK' | 'SOIL_PH'
  | 'SEASON_OVERLAP' | 'HISTORY_INCOMPLETE' | 'CLIMATE_CONTEXT_ONLY' | 'UNREVIEWED_RULES' | 'SYNTHETIC_PRICES'
  | 'OUT_OF_CALENDAR';

export interface Reason {
  code: ReasonCode;
  severity: 'block' | 'warn' | 'info' | 'good';
  text: string;
  refs: string[];             // rule / evidence / input ids
}
