import type { CostItemDef, CropEconomics, RegionPack, RotationRule } from '../domain/types';

// ⚠️ All prices and yields below are SYNTHETIC DEMO VALUES with plausible orders of magnitude.
// They are not quotes. The farmer/extension worker must replace them with dated local prices.
// Rule packs are "demo-unreviewed" until a local agronomist signs the review log (docs/review-log.md).

type I = [CostItemDef['category'], string, number, string, number | null, number, boolean?, boolean?];
// [category, label, qty/ha, unit, unit price, due offset days vs sowing, essential=true, cash=true]
function items(rows: I[]): CostItemDef[] {
  return rows.map(([category, label, qtyPerHa, unit, unitPrice, dueOffsetDays, essential = true, cash = true], k) => ({
    key: `${category}-${k}`, category, label, qtyPerHa, unit, unitPrice, dueOffsetDays, essential, cash,
  }));
}
const econ = (attainableYieldTHa: number, pricePerT: number | null, rows: I[]): CropEconomics => ({ attainableYieldTHa, pricePerT, items: items(rows) });

const GENERIC_RULES: RotationRule[] = [
  { id: 'G-R1', kind: 'exclude', text: 'Same crop may not return before its minimum break (return interval) has passed.', sources: ['R31'], reviewed: false },
  { id: 'G-R2', kind: 'exclude', text: 'Two consecutive crops sharing a major soil-borne pathogen group (e.g. Sclerotinia hosts) are not allowed.', sources: ['R29', 'R31'], reviewed: false },
  { id: 'G-R3', kind: 'benefit', text: 'A grain legume before a cereal can supply residual N and break cereal pest cycles.', sources: ['R32', 'R3'], reviewed: false },
  { id: 'G-R4', kind: 'warn', text: 'Three or more consecutive cereal seasons (including history) increase pest, weed and fertility pressure.', sources: ['R31', 'R32'], reviewed: false },
];

export const SENEGAL: RegionPack = {
  id: 'sn-groundnut-basin', version: '1.0.0-demo', name: 'Senegal groundnut basin — rainfed (Bambey demo)', short: 'Senegal · Sahel',
  description: 'One rainfed cropping season per year (June–October). Sowing follows the agronomic rain onset. Crops and rules draw on Bambey rotation research (R3) and FAO-56; prices are synthetic.',
  bbox: [12.3, -17.6, 16.8, -11.3], currency: 'XOF', sowingMethod: 'rain-onset', seasonLabel: 'rainy season',
  earliestSowing: '06-01', latestSowing: '08-20',
  crops: ['millet', 'groundnut', 'cowpea', 'sorghum', 'maize', 'sesame', 'fallow'],
  rules: [
    ...GENERIC_RULES,
    { id: 'SN-R1', kind: 'benefit', text: 'Cowpea–millet rotation studied at Bambey (2020–2022): prior legume, variety and residue management affected millet.', sources: ['R3'], reviewed: false },
    { id: 'SN-R2', kind: 'exclude', text: 'Groundnut after groundnut is excluded (soil-borne pests and diseases; at least one season break).', sources: ['R31'], reviewed: false },
    { id: 'SN-R3', kind: 'warn', text: 'Maize in the ~600 mm Bambey zone is water-sensitive (high Ky); check modeled stress and irrigation.', sources: ['R18', 'D1'], reviewed: false },
  ],
  economics: {
    millet: econ(1.2, 200000, [
      ['seed', 'Souna millet seed', 5, 'kg', 600, -7], ['fertilizer', 'NPK 15-15-15', 100, 'kg', 300, 0], ['fertilizer', 'Urea 46%', 50, 'kg', 300, 30],
      ['land-prep', 'Animal-traction land preparation', 1, 'ha', 15000, -10], ['labor', 'Hired weeding labor', 10, 'person-day', 2500, 20],
      ['labor', 'Family labor (non-cash)', 15, 'person-day', 2500, 30, false, false], ['labor', 'Harvest & threshing', 8, 'person-day', 2500, 85], ['other', 'Bags & transport', 1, 'lot', 5000, 90],
    ]),
    groundnut: econ(1.3, 305000, [
      ['seed', 'Groundnut seed (shelled)', 120, 'kg', 450, -7], ['fertilizer', 'NPK 6-20-10', 150, 'kg', 250, 0], ['protection', 'Seed treatment', 1, 'ha', 1500, -1],
      ['land-prep', 'Animal-traction land preparation', 1, 'ha', 15000, -10], ['labor', 'Hired weeding labor', 15, 'person-day', 2500, 20],
      ['labor', 'Family labor (non-cash)', 15, 'person-day', 2500, 30, false, false], ['labor', 'Lifting, drying & threshing', 15, 'person-day', 2500, 85], ['other', 'Bags & transport', 1, 'lot', 7000, 90],
    ]),
    cowpea: econ(0.8, 350000, [
      ['seed', 'Cowpea seed', 25, 'kg', 700, -7], ['fertilizer', 'NPK 6-20-10', 100, 'kg', 250, 0], ['protection', 'Insecticide sprays', 2, 'spray', 6000, 40],
      ['land-prep', 'Animal-traction land preparation', 1, 'ha', 15000, -10], ['labor', 'Hired weeding labor', 12, 'person-day', 2500, 20],
      ['labor', 'Harvest (pod picking)', 10, 'person-day', 2500, 70], ['other', 'Storage bags (hermetic)', 1, 'lot', 6000, 80],
    ]),
    sorghum: econ(1.2, 200000, [
      ['seed', 'Sorghum seed', 8, 'kg', 600, -7], ['fertilizer', 'NPK 15-15-15', 100, 'kg', 300, 0], ['fertilizer', 'Urea 46%', 50, 'kg', 300, 30],
      ['land-prep', 'Animal-traction land preparation', 1, 'ha', 15000, -10], ['labor', 'Hired weeding labor', 10, 'person-day', 2500, 20],
      ['labor', 'Harvest & threshing', 10, 'person-day', 2500, 100], ['other', 'Bags & transport', 1, 'lot', 5000, 105],
    ]),
    maize: econ(2.5, 175000, [
      ['seed', 'Improved maize seed', 25, 'kg', 1200, -7], ['fertilizer', 'NPK 15-15-15', 150, 'kg', 300, 0], ['fertilizer', 'Urea 46%', 100, 'kg', 300, 30],
      ['protection', 'Fall armyworm control', 1, 'ha', 8000, 25], ['land-prep', 'Tractor land preparation', 1, 'ha', 20000, -10],
      ['labor', 'Hired weeding labor', 12, 'person-day', 2500, 20], ['labor', 'Harvest & shelling', 10, 'person-day', 2500, 95], ['other', 'Bags & transport', 1, 'lot', 8000, 100],
    ]),
    sesame: econ(0.5, 600000, [
      ['seed', 'Sesame seed', 4, 'kg', 1500, -7], ['fertilizer', 'NPK 15-15-15', 50, 'kg', 300, 0], ['land-prep', 'Animal-traction land preparation', 1, 'ha', 15000, -10],
      ['labor', 'Hired weeding & thinning', 14, 'person-day', 2500, 20], ['labor', 'Harvest, stooking & threshing', 12, 'person-day', 2500, 85], ['other', 'Bags & transport', 1, 'lot', 4000, 90],
    ]),
    fallow: econ(0, null, [['other', 'Boundary / grazing management', 1, 'lot', 2000, 0]]),
  },
  reviewStatus: 'demo-unreviewed', demoDataset: 'bambey',
  sources: ['R3', 'R4', 'R8', 'R14', 'R15', 'R19', 'D1'],
};

export const KAZAKHSTAN: RegionPack = {
  id: 'kz-north-steppe', version: '1.0.0-demo', name: 'Northern Kazakhstan steppe — rainfed (Kostanay demo)', short: 'Kazakhstan · Steppe',
  description: 'One short rainfed season per year (May–September) on chernozem/chestnut soils. Sowing follows soil warming; wheat dominates and break crops or fallow are the key rotation decision (R28). Prices are synthetic.',
  bbox: [48.5, 59.0, 55.6, 80.0], currency: 'KZT', sowingMethod: 'temperature', seasonLabel: 'spring–summer season',
  earliestSowing: '05-12', latestSowing: '06-05',
  crops: ['wheat', 'barley', 'flax', 'rapeseed', 'sunflower', 'lentil', 'fallow'],
  rules: [
    ...GENERIC_RULES,
    { id: 'KZ-R1', kind: 'benefit', text: 'Wheat after fallow or a break crop (pulse/oilseed) benefits from stored moisture and interrupted cereal disease cycles.', sources: ['R28'], reviewed: false },
    { id: 'KZ-R2', kind: 'exclude', text: 'Flax needs a ≥4-season break ("flax sickness", Fusarium).', sources: ['R31'], reviewed: false },
    { id: 'KZ-R3', kind: 'exclude', text: 'Sunflower and rapeseed share Sclerotinia; neither follows the other.', sources: ['R29'], reviewed: false },
  ],
  economics: {
    wheat: econ(2.0, 100000, [
      ['seed', 'Spring wheat seed', 150, 'kg', 150, -5], ['fertilizer', 'Ammophos 12-52', 50, 'kg', 320, 0], ['protection', 'Herbicide (pre/post)', 1, 'ha', 9000, 25],
      ['protection', 'Fungicide', 1, 'ha', 6000, 50], ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0],
      ['labor', 'Harvest (combine service)', 1, 'ha', 15000, 100], ['other', 'Grain transport & drying', 1, 'ha', 6000, 105],
    ]),
    barley: econ(2.2, 80000, [
      ['seed', 'Barley seed', 140, 'kg', 140, -5], ['fertilizer', 'Ammophos 12-52', 50, 'kg', 320, 0], ['protection', 'Herbicide', 1, 'ha', 9000, 25],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 15000, 90], ['other', 'Grain transport', 1, 'ha', 5000, 95],
    ]),
    flax: econ(1.0, 180000, [
      ['seed', 'Oilseed flax seed', 45, 'kg', 400, -5], ['fertilizer', 'Ammophos 12-52', 40, 'kg', 320, 0], ['protection', 'Herbicide (broadleaf)', 1, 'ha', 11000, 25],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 16000, 95], ['other', 'Transport', 1, 'ha', 5000, 100],
    ]),
    rapeseed: econ(1.1, 190000, [
      ['seed', 'Spring rapeseed (hybrid)', 6, 'kg', 3500, -5], ['fertilizer', 'Ammonium nitrate 34%', 80, 'kg', 220, 0], ['protection', 'Insecticide (flea beetle)', 1, 'ha', 8000, 10],
      ['protection', 'Herbicide', 1, 'ha', 10000, 25], ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 16000, 95],
    ]),
    sunflower: econ(1.2, 180000, [
      ['seed', 'Sunflower seed (hybrid)', 6, 'kg', 3000, -5], ['fertilizer', 'Ammophos 12-52', 50, 'kg', 320, 0], ['protection', 'Herbicide', 1, 'ha', 12000, 20],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 20000, 0], ['labor', 'Harvest (combine + header)', 1, 'ha', 18000, 115], ['other', 'Transport & drying', 1, 'ha', 8000, 120],
    ]),
    lentil: econ(1.1, 160000, [
      ['seed', 'Lentil seed', 70, 'kg', 400, -5], ['protection', 'Rhizobium inoculant', 1, 'ha', 2500, -1], ['protection', 'Herbicide', 1, 'ha', 12000, 20],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 15000, 95], ['other', 'Transport', 1, 'ha', 5000, 100],
    ]),
    fallow: econ(0, null, [['protection', 'Chemical fallow: herbicide passes', 2, 'pass', 9000, 30], ['land-prep', 'Fuel & machinery', 1, 'ha', 5000, 30]]),
  },
  reviewStatus: 'demo-unreviewed', demoDataset: 'kostanay',
  sources: ['R8', 'R28', 'R29'],
};

export const GLOBAL: RegionPack = {
  id: 'global-screening', version: '1.0.0-demo', name: 'Global screening — no reviewed local pack', short: 'Global screening',
  description: 'Fallback for locations outside reviewed packs: climate screening of a generic crop library with NASA POWER and generic rotation principles. Treat every result as a demonstration until a local pack exists.',
  bbox: [-90, -180, 90, 180], currency: 'USD', sowingMethod: 'rain-onset', seasonLabel: 'main season',
  earliestSowing: 'auto', latestSowing: 'auto',
  crops: ['maize', 'sorghum', 'millet', 'wheat', 'barley', 'soybean', 'groundnut', 'cowpea', 'sunflower', 'potato', 'fallow'],
  rules: GENERIC_RULES,
  economics: {
    maize: econ(4, 200, [['seed', 'Maize seed', 25, 'kg', 3, -7], ['fertilizer', 'NPK compound', 150, 'kg', 0.7, 0], ['fertilizer', 'Urea', 100, 'kg', 0.6, 30], ['land-prep', 'Land preparation', 1, 'ha', 60, -10], ['protection', 'Crop protection', 1, 'ha', 30, 25], ['labor', 'Hired labor', 1, 'ha', 80, 20], ['labor', 'Harvest', 1, 'ha', 50, 100]]),
    sorghum: econ(2.5, 180, [['seed', 'Sorghum seed', 8, 'kg', 2, -7], ['fertilizer', 'NPK compound', 100, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Hired labor', 1, 'ha', 60, 20], ['labor', 'Harvest', 1, 'ha', 40, 105]]),
    millet: econ(1.5, 200, [['seed', 'Millet seed', 5, 'kg', 2, -7], ['fertilizer', 'NPK compound', 80, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 40, -10], ['labor', 'Hired labor', 1, 'ha', 50, 20], ['labor', 'Harvest', 1, 'ha', 35, 85]]),
    wheat: econ(3, 220, [['seed', 'Wheat seed', 150, 'kg', 0.5, -5], ['fertilizer', 'NPK / DAP', 100, 'kg', 0.8, 0], ['fertilizer', 'Urea', 80, 'kg', 0.6, 30], ['protection', 'Herbicide & fungicide', 1, 'ha', 40, 30], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 50, 100]]),
    barley: econ(3, 180, [['seed', 'Barley seed', 140, 'kg', 0.45, -5], ['fertilizer', 'NPK / DAP', 80, 'kg', 0.8, 0], ['protection', 'Herbicide', 1, 'ha', 25, 25], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 45, 90]]),
    soybean: econ(2.2, 420, [['seed', 'Soybean seed', 70, 'kg', 1.2, -7], ['protection', 'Inoculant', 1, 'ha', 8, -1], ['fertilizer', 'P & K fertilizer', 80, 'kg', 0.8, 0], ['protection', 'Herbicide', 1, 'ha', 35, 20], ['land-prep', 'Land preparation', 1, 'ha', 60, -10], ['labor', 'Harvest', 1, 'ha', 50, 115]]),
    groundnut: econ(1.8, 700, [['seed', 'Groundnut seed', 110, 'kg', 1.5, -7], ['fertilizer', 'P & K fertilizer', 100, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Hired labor', 1, 'ha', 90, 20], ['labor', 'Lifting & harvest', 1, 'ha', 90, 85]]),
    cowpea: econ(1.2, 600, [['seed', 'Cowpea seed', 25, 'kg', 1.5, -7], ['fertilizer', 'P fertilizer', 60, 'kg', 0.7, 0], ['protection', 'Insecticide', 2, 'spray', 15, 40], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Harvest', 1, 'ha', 60, 75]]),
    sunflower: econ(2, 450, [['seed', 'Sunflower hybrid seed', 6, 'kg', 8, -5], ['fertilizer', 'NPK compound', 80, 'kg', 0.7, 0], ['protection', 'Herbicide', 1, 'ha', 35, 20], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 55, 115]]),
    potato: econ(20, 180, [['seed', 'Seed potato', 2000, 'kg', 0.5, -5], ['fertilizer', 'NPK compound', 400, 'kg', 0.7, 0], ['protection', 'Fungicide program', 1, 'ha', 250, 30], ['land-prep', 'Machinery & fuel', 1, 'ha', 120, -5], ['labor', 'Hired labor & harvest', 1, 'ha', 400, 110]]),
    fallow: econ(0, null, [['other', 'Weed / cover management', 1, 'ha', 15, 30]]),
  },
  reviewStatus: 'demo-unreviewed',
  sources: ['R8', 'R18', 'R19', 'R31', 'R32'],
};

export const PACKS: RegionPack[] = [SENEGAL, KAZAKHSTAN, GLOBAL];

export function detectPack(lat: number, lon: number): RegionPack {
  for (const p of PACKS) {
    if (p.id === GLOBAL.id) continue;
    const [a, b, c, d] = p.bbox;
    if (lat >= a && lat <= c && lon >= b && lon <= d) return p;
  }
  return GLOBAL;
}
export const packById = (id?: string) => PACKS.find((p) => p.id === id);

/** Irrigation water cost (synthetic): pumping energy per mm per ha (1 mm·ha = 10 m³). */
export const IRRIGATION_COST_PER_MM_HA: Record<string, number> = { XOF: 250, KZT: 120, USD: 0.5 };
