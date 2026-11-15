import type { CostItemDef, CropEconomics, RegionPack, RotationRule, SeasonDef } from '../domain/types';
import { CROPS } from './crops';

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
  { id: 'G-R6', kind: 'exclude', text: 'Same crop in two consecutive seasons (monoculture) is excluded from rotation options. Where a pack lists the crop as an accepted continuous practice (e.g. irrigated rice–rice), it is only warned and ranked below true rotations. The usual plan is always shown, flagged.', sources: ['R31'], reviewed: false },
  { id: 'G-R7', kind: 'warn', text: 'Consecutive crops of the same botanical family or sharing a pest/disease group (e.g. millet → sorghum, both Striga hosts) give a weak break; ranked below rotations that change family.', sources: ['R31', 'R32'], reviewed: false },
  { id: 'G-R8', kind: 'benefit', text: 'A grain legume after a cereal breaks cereal pest and disease cycles and fixes its own nitrogen; legume ↔ cereal alternation is favored in the ranking.', sources: ['R32', 'R31'], reviewed: false },
  { id: 'G-R9', kind: 'benefit', text: 'Alternating crop groups (cereal ↔ legume ↔ oilseed ↔ tuber), including across the boundary from last season, ranks above same-group sequences. The best-ranked option is never a same-crop or same-family succession while any feasible alternation exists.', sources: ['R31', 'R32'], reviewed: false },
];

export const SENEGAL: RegionPack = {
  id: 'sn-groundnut-basin', version: '1.1.0-demo', name: 'West African Sahel & Sudan savanna — rainfed (Bambey demo)', short: 'West Africa · Sahel',
  description: 'One rainfed cropping season per year (June–October) from Senegal to Chad. Sowing follows the agronomic rain onset. Crops and rules draw on Bambey rotation research (R3) and FAO-56; input costs are synthetic, crop prices from FAOSTAT.',
  countries: ['SN', 'GM', 'GW', 'ML', 'BF', 'NE', 'TD', 'MR', 'NG', 'GH', 'TG', 'BJ', 'CM', 'SD'], latRange: [10.3, 17.8],
  bbox: [[10.3, -17.6, 17.8, 24]], currency: 'XOF', mode: 'annual',
  seasons: [{ id: 'rainy', label: 'Rainy season', method: 'rain-onset', earliest: '06-01', latest: '08-20', crops: ['millet', 'groundnut', 'cowpea', 'sorghum', 'maize', 'sesame', 'fallow'] }],
  crops: ['millet', 'groundnut', 'cowpea', 'sorghum', 'maize', 'sesame', 'fallow'],
  // Groundnut → millet is the classic groundnut-basin sequence (the Bambey demo farm's own history).
  usualRotation: ['groundnut', 'millet'],
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
  id: 'kz-north-steppe', version: '1.2.0-demo', name: 'Northern Kazakhstan & South Siberian steppe — rainfed (Kostanay demo)', short: 'Kazakhstan · Steppe',
  description: 'One short rainfed season per year (May–September) on chernozem/chestnut soils. Sowing follows soil warming; wheat dominates and break crops or fallow are the key rotation decision (R28). Prices are synthetic.',
  countries: ['KZ'], latRange: [48.3, 56.5],
  bbox: [[48.3, 50.0, 57.0, 90.0]], currency: 'KZT', mode: 'annual',
  seasons: [{ id: 'spring', label: 'Spring–summer season', method: 'temperature', earliest: '05-12', latest: '06-05', crops: ['wheat', 'barley', 'oats', 'flax', 'rapeseed', 'sunflower', 'lentil', 'pea', 'chickpea', 'fallow'] }],
  crops: ['wheat', 'barley', 'oats', 'flax', 'rapeseed', 'sunflower', 'lentil', 'pea', 'chickpea', 'fallow'],
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
    // break crops widened in v1.2 (oats, field pea, chickpea): synthetic per-ha templates in the same style, demo-unreviewed
    oats: econ(2.0, 65000, [
      ['seed', 'Oat seed', 120, 'kg', 130, -5], ['fertilizer', 'Ammophos 12-52', 40, 'kg', 320, 0], ['protection', 'Herbicide', 1, 'ha', 9000, 25],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 15000, 90], ['other', 'Grain transport', 1, 'ha', 5000, 95],
    ]),
    pea: econ(1.6, 115000, [
      ['seed', 'Field pea seed', 220, 'kg', 220, -5], ['protection', 'Rhizobium inoculant', 1, 'ha', 2500, -1], ['protection', 'Herbicide', 1, 'ha', 12000, 20],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 15000, 85], ['other', 'Transport', 1, 'ha', 5000, 90],
    ]),
    chickpea: econ(1.0, 190000, [
      ['seed', 'Chickpea seed', 110, 'kg', 450, -5], ['protection', 'Rhizobium inoculant', 1, 'ha', 2500, -1], ['protection', 'Herbicide', 1, 'ha', 12000, 20],
      ['land-prep', 'Fuel & machinery: sowing', 1, 'ha', 18000, 0], ['labor', 'Harvest (combine service)', 1, 'ha', 15000, 100], ['other', 'Transport', 1, 'ha', 5000, 105],
    ]),
    fallow: econ(0, null, [['protection', 'Chemical fallow: herbicide passes', 2, 'pass', 9000, 30], ['land-prep', 'Fuel & machinery', 1, 'ha', 5000, 30]]),
  },
  reviewStatus: 'demo-unreviewed', demoDataset: 'kostanay',
  sources: ['R8', 'R28', 'R29'],
};


// ---------------------------------------------------------------------------
// World coverage: generic per-crop input templates (USD/ha, mid-input farming), scaled per region
// by `costFactor` and converted to local currency with FAOSTAT exchange rates at run time.
// Crop sale prices are taken from FAOSTAT producer prices (see data/countries.ts), not from here.
// ---------------------------------------------------------------------------
type T = [CostItemDef['category'], string, number, string, number, number | 'harvest'];
const USD_TEMPLATES: Record<string, T[]> = {
  maize: [['seed', 'Maize seed (hybrid/OPV)', 25, 'kg', 3, -7], ['fertilizer', 'NPK compound', 150, 'kg', 0.7, 0], ['fertilizer', 'Urea top-dress', 100, 'kg', 0.6, 30], ['land-prep', 'Land preparation', 1, 'ha', 60, -10], ['protection', 'Weed & pest control', 1, 'ha', 30, 25], ['labor', 'Hired labor', 1, 'ha', 80, 20], ['labor', 'Harvest & shelling', 1, 'ha', 50, 'harvest']],
  sorghum: [['seed', 'Sorghum seed', 8, 'kg', 2, -7], ['fertilizer', 'NPK compound', 100, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Hired labor', 1, 'ha', 60, 20], ['labor', 'Harvest', 1, 'ha', 40, 'harvest']],
  millet: [['seed', 'Millet seed', 5, 'kg', 2, -7], ['fertilizer', 'NPK compound', 80, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 40, -10], ['labor', 'Hired labor', 1, 'ha', 50, 20], ['labor', 'Harvest', 1, 'ha', 35, 'harvest']],
  wheat: [['seed', 'Wheat seed', 150, 'kg', 0.5, -5], ['fertilizer', 'DAP / NPK', 100, 'kg', 0.8, 0], ['fertilizer', 'Urea', 80, 'kg', 0.6, 30], ['protection', 'Herbicide & fungicide', 1, 'ha', 40, 30], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 50, 'harvest']],
  winterwheat: [['seed', 'Winter wheat seed', 180, 'kg', 0.5, -5], ['fertilizer', 'DAP / NPK', 100, 'kg', 0.8, 0], ['fertilizer', 'Urea / AN (spring)', 120, 'kg', 0.6, 150], ['protection', 'Herbicide & fungicide', 1, 'ha', 50, 170], ['land-prep', 'Machinery & fuel', 1, 'ha', 75, 0], ['labor', 'Harvest', 1, 'ha', 55, 'harvest']],
  barley: [['seed', 'Barley seed', 140, 'kg', 0.45, -5], ['fertilizer', 'DAP / NPK', 80, 'kg', 0.8, 0], ['protection', 'Herbicide', 1, 'ha', 25, 25], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 45, 'harvest']],
  soybean: [['seed', 'Soybean seed', 70, 'kg', 1.2, -7], ['protection', 'Rhizobium inoculant', 1, 'ha', 8, -1], ['fertilizer', 'P & K fertilizer', 80, 'kg', 0.8, 0], ['protection', 'Herbicide', 1, 'ha', 35, 20], ['land-prep', 'Land preparation', 1, 'ha', 60, -10], ['labor', 'Harvest', 1, 'ha', 50, 'harvest']],
  groundnut: [['seed', 'Groundnut seed', 110, 'kg', 1.5, -7], ['fertilizer', 'P & K fertilizer', 100, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Hired labor', 1, 'ha', 90, 20], ['labor', 'Lifting & harvest', 1, 'ha', 90, 'harvest']],
  cowpea: [['seed', 'Cowpea seed', 25, 'kg', 1.5, -7], ['fertilizer', 'P fertilizer', 60, 'kg', 0.7, 0], ['protection', 'Insecticide sprays', 2, 'spray', 15, 40], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Harvest', 1, 'ha', 60, 'harvest']],
  sesame: [['seed', 'Sesame seed', 4, 'kg', 4, -7], ['fertilizer', 'NPK compound', 50, 'kg', 0.7, 0], ['land-prep', 'Land preparation', 1, 'ha', 40, -10], ['labor', 'Weeding & thinning', 1, 'ha', 60, 20], ['labor', 'Harvest & threshing', 1, 'ha', 50, 'harvest']],
  sunflower: [['seed', 'Sunflower hybrid seed', 6, 'kg', 8, -5], ['fertilizer', 'NPK compound', 80, 'kg', 0.7, 0], ['protection', 'Herbicide', 1, 'ha', 35, 20], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 55, 'harvest']],
  potato: [['seed', 'Seed potato', 2000, 'kg', 0.5, -5], ['fertilizer', 'NPK compound', 400, 'kg', 0.7, 0], ['protection', 'Fungicide program', 1, 'ha', 250, 30], ['land-prep', 'Machinery & fuel', 1, 'ha', 120, -5], ['labor', 'Hired labor & harvest', 1, 'ha', 400, 'harvest']],
  bean: [['seed', 'Bean seed', 70, 'kg', 1.5, -7], ['fertilizer', 'P fertilizer', 60, 'kg', 0.7, 0], ['protection', 'Pest & disease control', 2, 'spray', 15, 35], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Weeding', 1, 'ha', 60, 20], ['labor', 'Harvest', 1, 'ha', 60, 'harvest']],
  chickpea: [['seed', 'Chickpea seed', 80, 'kg', 1.2, -7], ['fertilizer', 'P fertilizer', 50, 'kg', 0.8, 0], ['protection', 'Herbicide / pod-borer control', 1, 'ha', 25, 40], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Harvest', 1, 'ha', 50, 'harvest']],
  lentil: [['seed', 'Lentil seed', 70, 'kg', 1.2, -5], ['protection', 'Rhizobium inoculant', 1, 'ha', 5, -1], ['protection', 'Herbicide', 1, 'ha', 30, 20], ['land-prep', 'Machinery & fuel', 1, 'ha', 60, 0], ['labor', 'Harvest', 1, 'ha', 45, 'harvest']],
  rice: [['seed', 'Rice seed', 60, 'kg', 1.0, -10], ['fertilizer', 'NPK compound', 150, 'kg', 0.7, 0], ['fertilizer', 'Urea', 120, 'kg', 0.6, 30], ['protection', 'Weed & pest control', 1, 'ha', 40, 30], ['land-prep', 'Puddling / land preparation', 1, 'ha', 90, -7], ['labor', 'Transplanting & weeding', 1, 'ha', 150, 0], ['labor', 'Harvest & threshing', 1, 'ha', 80, 'harvest']],
  cotton: [['seed', 'Cotton seed', 20, 'kg', 4, -7], ['fertilizer', 'NPK compound', 150, 'kg', 0.7, 0], ['fertilizer', 'Urea', 100, 'kg', 0.6, 40], ['protection', 'Insecticide sprays', 6, 'spray', 15, 60], ['land-prep', 'Land preparation', 1, 'ha', 60, -10], ['labor', 'Weeding & thinning', 1, 'ha', 150, 25], ['labor', 'Picking', 1, 'ha', 150, 'harvest']],
  pigeonpea: [['seed', 'Pigeon pea seed', 15, 'kg', 1.5, -7], ['fertilizer', 'P fertilizer', 50, 'kg', 0.7, 0], ['protection', 'Pod-borer control', 2, 'spray', 15, 90], ['land-prep', 'Land preparation', 1, 'ha', 40, -10], ['labor', 'Weeding', 1, 'ha', 50, 25], ['labor', 'Harvest', 1, 'ha', 60, 'harvest']],
  mustard: [['seed', 'Mustard seed', 5, 'kg', 3, -5], ['fertilizer', 'NPK compound', 100, 'kg', 0.7, 0], ['fertilizer', 'Urea', 60, 'kg', 0.6, 30], ['protection', 'Aphid control', 1, 'ha', 20, 45], ['land-prep', 'Land preparation', 1, 'ha', 50, -7], ['labor', 'Harvest', 1, 'ha', 40, 'harvest']],
  teff: [['seed', 'Teff seed', 25, 'kg', 1.2, -5], ['fertilizer', 'DAP / NPS', 100, 'kg', 0.8, 0], ['fertilizer', 'Urea', 50, 'kg', 0.6, 30], ['land-prep', 'Oxen ploughing (several passes)', 1, 'ha', 60, -15], ['labor', 'Hand weeding', 1, 'ha', 90, 25], ['labor', 'Harvest & threshing', 1, 'ha', 80, 'harvest']],
  fababean: [['seed', 'Faba bean seed', 150, 'kg', 0.8, -5], ['fertilizer', 'P fertilizer', 50, 'kg', 0.8, 0], ['protection', 'Disease control', 1, 'ha', 20, 40], ['land-prep', 'Land preparation', 1, 'ha', 50, -10], ['labor', 'Harvest', 1, 'ha', 50, 'harvest']],
  flax: [['seed', 'Flax seed', 45, 'kg', 1, -5], ['fertilizer', 'NPK compound', 40, 'kg', 0.8, 0], ['protection', 'Herbicide', 1, 'ha', 30, 25], ['land-prep', 'Machinery & fuel', 1, 'ha', 60, 0], ['labor', 'Harvest', 1, 'ha', 50, 'harvest']],
  winterrapeseed: [['seed', 'Winter rapeseed hybrid seed', 5, 'kg', 10, -5], ['fertilizer', 'NPK compound (autumn)', 100, 'kg', 0.7, 0], ['fertilizer', 'Ammonium nitrate (spring)', 150, 'kg', 0.6, 160], ['protection', 'Insecticide', 1, 'ha', 25, 180], ['protection', 'Herbicide & fungicide', 1, 'ha', 45, 20], ['land-prep', 'Machinery & fuel', 1, 'ha', 75, 0], ['labor', 'Harvest', 1, 'ha', 55, 'harvest']],
  rapeseed: [['seed', 'Rapeseed hybrid seed', 6, 'kg', 9, -5], ['fertilizer', 'Ammonium nitrate', 80, 'kg', 0.6, 0], ['protection', 'Insecticide', 1, 'ha', 20, 10], ['protection', 'Herbicide', 1, 'ha', 25, 25], ['land-prep', 'Machinery & fuel', 1, 'ha', 70, 0], ['labor', 'Harvest', 1, 'ha', 50, 'harvest']],
  fallow: [['other', 'Weed / cover management', 1, 'ha', 15, 30]],
};

function usdEcon(cropId: string, factor: number, yieldTHa: number, stages?: number[]): CropEconomics {
  const days = (stages ?? CROPS[cropId].stages).reduce((a, b) => a + b, 0);
  return {
    attainableYieldTHa: yieldTHa, pricePerT: null,
    items: USD_TEMPLATES[cropId].map(([category, label, qtyPerHa, unit, price, due], k) => ({
      key: `${category}-${k}`, category, label, qtyPerHa, unit, unitPrice: Math.round(price * factor * 100) / 100,
      dueOffsetDays: due === 'harvest' ? days - 5 : due, essential: true, cash: true,
    })),
  };
}

function pack(p: Omit<RegionPack, 'economics' | 'crops' | 'currency' | 'reviewStatus' | 'version'> & { costFactor: number; yields: Record<string, number>; fallbackPricesUsd?: Record<string, number> }): RegionPack {
  const crops = [...new Set(p.seasons.flatMap((s) => s.crops))];
  const economics: Record<string, CropEconomics> = {};
  for (const c of crops) {
    economics[c] = usdEcon(c, p.costFactor, c === 'fallow' ? 0 : p.yields[c] ?? 2, p.cropOverrides?.[c]?.stages);
    economics[c].pricePerT = p.fallbackPricesUsd?.[c] ?? null; // used only when FAOSTAT has no price for the crop
  }
  const { costFactor: _cf, yields: _y, fallbackPricesUsd: _fp, ...rest } = p;
  return { ...rest, version: '1.0.0-demo', crops, currency: 'USD', economics, reviewStatus: 'demo-unreviewed' };
}

const S = (id: string, label: string, method: SeasonDef['method'], earliest: string, latest: string, crops: string[], note?: string): SeasonDef => ({ id, label, method, earliest, latest, crops, note });
const BIMODAL_RULES: RotationRule[] = [...GENERIC_RULES, { id: 'G-R5', kind: 'exclude', text: 'Two seasons in one year: the first crop must be harvested before the second is sown.', sources: ['R8'], reviewed: false }];

export const EAST_AFRICA = pack({
  id: 'ea-bimodal', name: 'East African bimodal highlands & plains (Kenya, Uganda, Tanzania, Rwanda, Burundi)', short: 'East Africa · bimodal',
  description: 'Two rainy seasons a year: the long rains (March–May) and the short rains (October–December). Each season gets its own NASA rain-onset date.',
  countries: ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS'], bbox: [[-12, 28, 5.5, 42]], mode: 'double',
  seasons: [
    S('long', 'Long rains', 'rain-onset', '02-20', '04-30', ['maize', 'bean', 'sorghum', 'soybean', 'groundnut', 'potato', 'cowpea', 'fallow']),
    S('short', 'Short rains', 'rain-onset', '09-25', '11-20', ['bean', 'maize', 'sorghum', 'cowpea', 'groundnut', 'potato', 'fallow']),
  ],
  cropOverrides: { maize: { stages: [20, 30, 35, 20] }, bean: { stages: [15, 25, 30, 15] } },
  rules: BIMODAL_RULES, costFactor: 0.65, yields: { maize: 4.0, bean: 1.5, sorghum: 2.5, soybean: 2.0, groundnut: 1.5, potato: 18, cowpea: 1.2 },
  sources: ['R8', 'R18', 'R19', 'R32'],
});

export const ETHIOPIA = pack({
  id: 'et-highlands', name: 'Ethiopian & Eritrean highlands — Meher season', short: 'Ethiopia · highlands',
  description: 'Main Meher season (June–September) with teff, wheat, barley, maize and pulses; sowing at the NASA rain onset.',
  countries: ['ET', 'ER'], bbox: [[3.5, 33, 15, 48]], mode: 'annual',
  seasons: [S('meher', 'Meher (main) season', 'rain-onset', '05-25', '07-31', ['teff', 'wheat', 'barley', 'maize', 'sorghum', 'fababean', 'chickpea', 'fallow'])],
  cropOverrides: { wheat: { stages: [20, 30, 45, 25], tMeanRange: [10, 25] }, barley: { stages: [15, 30, 40, 20], tMeanRange: [8, 24] } },
  rules: GENERIC_RULES, costFactor: 0.5, fallbackPricesUsd: { teff: 650 }, yields: { teff: 1.8, wheat: 3.0, barley: 2.5, maize: 4.0, sorghum: 2.5, fababean: 2.0, chickpea: 1.8 },
  sources: ['R8', 'R18', 'R19', 'R32'],
});

export const SOUTHERN_AFRICA = pack({
  id: 'sa-summer-rain', name: 'Southern Africa — summer rainfall (Zambia, Malawi, Zimbabwe, Mozambique, South Africa…)', short: 'Southern Africa',
  description: 'One summer rainy season (November–March); sowing at the NASA rain onset.',
  countries: ['ZA', 'ZW', 'ZM', 'MW', 'MZ', 'BW', 'NA', 'LS', 'SZ', 'AO', 'MG'], bbox: [[-35, 11, -8, 41]], mode: 'annual',
  seasons: [S('summer', 'Summer rains', 'rain-onset', '10-25', '12-31', ['maize', 'sorghum', 'groundnut', 'bean', 'soybean', 'sunflower', 'cowpea', 'cotton', 'fallow'])],
  rules: GENERIC_RULES, costFactor: 0.75, yields: { maize: 4.5, sorghum: 2.5, groundnut: 1.5, bean: 1.4, soybean: 2.2, sunflower: 1.8, cowpea: 1.0, cotton: 1.5 },
  sources: ['R8', 'R18', 'R19'],
});

export const SOUTH_ASIA = pack({
  id: 'sas-kharif-rabi', name: 'South Asia — Kharif (monsoon) & Rabi (winter) seasons', short: 'South Asia · Kharif/Rabi',
  description: 'Kharif crops sown at the monsoon onset (June–July), Rabi crops sown in November on stored moisture or irrigation.',
  countries: ['IN', 'PK', 'BD', 'NP', 'BT', 'LK'], bbox: [[5, 60, 37, 98]], mode: 'double',
  seasons: [
    S('kharif', 'Kharif (monsoon)', 'rain-onset', '06-01', '07-31', ['rice', 'maize', 'cotton', 'soybean', 'pigeonpea', 'groundnut', 'millet', 'sorghum', 'fallow']),
    S('rabi', 'Rabi (winter)', 'fixed', '10-25', '11-30', ['wheat', 'chickpea', 'mustard', 'lentil', 'barley', 'potato', 'fallow'], 'Rabi usually depends on residual soil water or irrigation'),
  ],
  cropOverrides: { wheat: { stages: [20, 30, 50, 30], tMeanRange: [12, 26] }, chickpea: { stages: [20, 30, 45, 25] }, cotton: { stages: [30, 45, 50, 35] }, pigeonpea: { stages: [20, 30, 40, 20] }, rice: { stages: [20, 25, 40, 20] } },
  rules: BIMODAL_RULES, costFactor: 0.7, yields: { rice: 4.5, maize: 3.5, cotton: 1.6, soybean: 1.4, pigeonpea: 1.2, groundnut: 1.6, millet: 1.6, sorghum: 1.5, wheat: 3.8, chickpea: 1.3, mustard: 1.4, lentil: 1.1, barley: 2.8, potato: 22 },
  sources: ['R8', 'R18', 'R19', 'R32'],
});

export const SE_ASIA = pack({
  id: 'sea-wet-dry', name: 'Southeast Asia — wet & dry seasons', short: 'Southeast Asia',
  description: 'Wet-season crops sown at the monsoon onset; dry-season crops sown after the rains, usually with irrigation.',
  countries: ['TH', 'VN', 'KH', 'LA', 'MM', 'PH', 'ID', 'MY', 'TL'], bbox: [[-11, 92, 24, 141]], mode: 'double',
  seasons: [
    S('wet', 'Wet season', 'rain-onset', '04-15', '06-30', ['rice', 'maize', 'soybean', 'groundnut', 'fallow']),
    S('dry', 'Dry season', 'fixed', '11-10', '12-31', ['rice', 'maize', 'soybean', 'groundnut', 'fallow'], 'Dry season usually needs irrigation'),
  ],
  // Irrigated rice–rice double cropping is the dominant lowland practice (e.g. Mekong Delta): penalized, not excluded.
  continuousCrops: ['rice'],
  rules: BIMODAL_RULES, costFactor: 0.8, yields: { rice: 5.0, maize: 4.5, soybean: 1.6, groundnut: 2.0 },
  sources: ['R8', 'R18', 'R19'],
});

export const EAST_ASIA = pack({
  id: 'eas-temperate', name: 'East Asia — North China Plain double cropping (China, Korea, Japan, Mongolia)', short: 'East Asia',
  description: 'Summer crop sown with the monsoon rains in June, followed by winter wheat sown in October and harvested in early June.',
  countries: ['CN', 'MN', 'KR', 'KP', 'JP', 'TW'], bbox: [[18, 73, 54, 146]], mode: 'double',
  seasons: [
    S('summer', 'Summer (monsoon)', 'rain-onset', '06-01', '07-15', ['maize', 'soybean', 'groundnut', 'sorghum', 'rice', 'potato', 'fallow']),
    S('winter', 'Winter wheat', 'fixed', '10-01', '10-25', ['winterwheat', 'fallow']),
  ],
  cropOverrides: { winterwheat: { stages: [30, 140, 40, 20] }, maize: { stages: [15, 30, 40, 15] } },
  rules: BIMODAL_RULES, costFactor: 1.0, yields: { maize: 7.0, soybean: 2.2, rice: 7.0, potato: 20, groundnut: 4.0, sorghum: 4.5, winterwheat: 6.0 },
  sources: ['R8', 'R18', 'R19'],
});

export const MENA = pack({
  id: 'mena-winter', name: 'Mediterranean & West Asia — winter rainfall (Morocco → Iran, Türkiye)', short: 'Mediterranean · MENA',
  description: 'Rainfed winter crops sown at the autumn rain onset (October–December) and harvested in late spring.',
  countries: ['MA', 'DZ', 'TN', 'LY', 'EG', 'TR', 'SY', 'IQ', 'IR', 'JO', 'LB', 'IL', 'PS', 'AF', 'CY'], bbox: [[27, -13, 42, 64]], mode: 'annual',
  seasons: [S('winter', 'Winter (autumn rains)', 'rain-onset', '10-15', '12-31', ['winterwheat', 'barley', 'chickpea', 'lentil', 'fababean', 'fallow'])],
  cropOverrides: { winterwheat: { stages: [30, 120, 40, 30], tMeanRange: [6, 20] }, barley: { stages: [25, 100, 35, 25], tMeanRange: [6, 20], frostSensitive: false }, chickpea: { stages: [25, 70, 45, 25], tMeanRange: [7, 22] }, lentil: { stages: [25, 70, 40, 25], tMeanRange: [7, 22] }, fababean: { stages: [25, 70, 45, 25], tMeanRange: [7, 22] } },
  rules: GENERIC_RULES, costFactor: 0.9, yields: { winterwheat: 3.0, barley: 2.5, chickpea: 1.4, lentil: 1.2, fababean: 2.0 },
  sources: ['R8', 'R18', 'R19', 'R28'],
});

export const CENTRAL_ASIA = pack({
  id: 'cas-irrigated', name: 'Central Asia — irrigated south (Uzbekistan, Tajikistan, Turkmenistan, Kyrgyzstan, S. Kazakhstan)', short: 'Central Asia · irrigated',
  description: 'Hot dry summers: cotton, maize and rice depend on irrigation; winter wheat is sown in October.',
  countries: ['UZ', 'TJ', 'TM', 'KG', 'KZ'], latRange: [35, 48.3], bbox: [[35, 50, 48.3, 81]], mode: 'annual',
  seasons: [
    S('summer', 'Summer (irrigated)', 'temperature', '04-01', '05-20', ['cotton', 'maize', 'rice', 'soybean', 'sunflower', 'fallow'], 'Most summer crops here are irrigated'),
    S('winter', 'Winter (autumn-sown)', 'fixed', '10-01', '10-31', ['winterwheat', 'barley']),
  ],
  cropOverrides: { barley: { stages: [30, 120, 40, 25], tMeanRange: [3, 20] } },
  irrigationTypical: true,
  rules: GENERIC_RULES, costFactor: 0.8, yields: { cotton: 2.8, maize: 6.0, rice: 5.5, soybean: 2.0, sunflower: 2.0, winterwheat: 5.0, barley: 3.0 },
  sources: ['R8', 'R18', 'R28'],
});

export const EUROPE = pack({
  id: 'eu-temperate', name: 'Europe & Black Sea — temperate (Ukraine, Russia west, EU)', short: 'Europe · Black Sea',
  description: 'Winter wheat sown in autumn; maize, sunflower, soybean and spring barley sown when the soil warms in spring.',
  countries: ['UA', 'MD', 'RO', 'BG', 'RS', 'HU', 'PL', 'BY', 'LT', 'LV', 'EE', 'CZ', 'SK', 'AT', 'DE', 'FR', 'BE', 'NL', 'LU', 'DK', 'GB', 'IE', 'SE', 'NO', 'FI', 'CH', 'SI', 'HR', 'BA', 'ME', 'MK', 'AL', 'XK', 'ES', 'PT', 'IT', 'GR'],
  bbox: [[35, -10, 60, 50]], mode: 'annual',
  seasons: [
    S('spring', 'Spring–summer', 'temperature', '03-25', '05-31', ['maize', 'sunflower', 'soybean', 'barley', 'potato', 'fallow']),
    S('winter', 'Winter (autumn-sown)', 'fixed', '09-20', '10-20', ['winterwheat', 'winterrapeseed']),
  ],
  cropOverrides: { barley: { stages: [15, 30, 40, 15] } },
  // Winter wheat → sunflower is the dominant sequence of the Ukrainian / Black Sea steppe.
  usualRotation: ['winterwheat', 'sunflower'],
  rules: GENERIC_RULES, costFactor: 1.2, yields: { maize: 7.0, sunflower: 2.6, soybean: 2.6, barley: 4.5, potato: 30, winterwheat: 5.5, winterrapeseed: 3.0 },
  sources: ['R8', 'R18', 'R29'],
});

export const CORN_BELT = pack({
  id: 'na-corn-belt', name: 'US Corn Belt — rainfed maize–soybean (Iowa, Illinois, Indiana, Ohio, Missouri, east Nebraska, south Minnesota)', short: 'US Corn Belt',
  description: 'Humid continental summer-crop belt: maize and soybean sown when the soil warms in spring, grain sorghum on drier western and southern fringes, winter wheat as the occasional third crop. Dryland pulses, canola and flax of the Plains and Prairies are not screened here (humid-season disease, no local market).',
  countries: ['US'], latRange: [36.5, 46.5], lonRange: [-98, -80], bbox: [[36.5, -98, 46.5, -80]], mode: 'annual',
  seasons: [
    S('spring', 'Spring–summer', 'temperature', '04-15', '06-05', ['maize', 'soybean', 'sorghum', 'fallow']),
    S('winter', 'Winter (autumn-sown)', 'fixed', '09-25', '10-25', ['winterwheat']),
  ],
  // Maize → soybean is the dominant Corn Belt rotation (≈ two-thirds of Iowa cropland alternates the two).
  usualRotation: ['maize', 'soybean'],
  rules: GENERIC_RULES, costFactor: 1.6, yields: { maize: 11, soybean: 3.4, sorghum: 5.5, winterwheat: 4.5 },
  sources: ['R8', 'R18', 'R31'],
});

export const NORTH_AMERICA = pack({
  id: 'na-temperate', name: 'North America — Corn Belt, Great Plains & Prairies', short: 'North America',
  description: 'Spring-sown maize, soybean, spring wheat and canola; winter wheat sown in September–October.',
  countries: ['US', 'CA'], bbox: [[25, -125, 60, -66]], mode: 'annual',
  seasons: [
    S('spring', 'Spring–summer', 'temperature', '04-01', '06-10', ['maize', 'soybean', 'wheat', 'sunflower', 'sorghum', 'barley', 'rapeseed', 'lentil', 'fallow']),
    S('winter', 'Winter (autumn-sown)', 'fixed', '09-15', '10-20', ['winterwheat']),
  ],
  rules: GENERIC_RULES, costFactor: 1.6, yields: { maize: 11, soybean: 3.4, wheat: 3.2, sunflower: 2.0, sorghum: 4.5, barley: 4.0, rapeseed: 2.5, lentil: 1.6, winterwheat: 4.0 },
  sources: ['R8', 'R18'],
});

export const SOUTH_AMERICA_TROPICAL = pack({
  id: 'sam-cerrado-safrinha', name: 'Tropical South America — soybean + safrinha (Brazilian Cerrado & centre-west, Paraguay north, Bolivia lowlands)', short: 'Brazil · Cerrado safrinha',
  description: 'Hot humid summer: soybean (or maize, bean, cotton, upland rice) sown at the spring rain onset, then a second (safrinha) crop of maize, sorghum, bean or sunflower on the tail of the rains. Sunflower is only grown as a second crop here.',
  countries: ['BR', 'PY', 'BO'], latRange: [-24, 5], bbox: [[-24, -75, 5, -34]], mode: 'double',
  seasons: [
    S('summer', 'Summer crop', 'rain-onset', '09-15', '12-15', ['soybean', 'maize', 'bean', 'cotton', 'rice', 'fallow']),
    S('second', 'Second crop (safrinha)', 'fixed', '01-25', '03-10', ['maize', 'sorghum', 'bean', 'sunflower', 'fallow'], 'Second crop relies on the tail of the rainy season'),
  ],
  cropOverrides: { soybean: { stages: [15, 25, 45, 20] } },
  usualRotation: ['soybean', 'maize'],
  rules: BIMODAL_RULES, costFactor: 1.1, yields: { soybean: 3.4, maize: 6.0, bean: 1.6, cotton: 1.8, rice: 6.0, sunflower: 2.0, sorghum: 3.5 },
  sources: ['R8', 'R18', 'R19'],
});

export const SOUTH_AMERICA = pack({
  id: 'sam-summer-safrinha', name: 'South America — Southern Cone summer crop + second crop (Argentina, Uruguay, southern Brazil & Paraguay)', short: 'South America',
  description: 'Main summer crop sown at the spring rain onset (September–December), followed by a second (safrinha) crop sown in January–March.',
  countries: ['BR', 'AR', 'PY', 'UY', 'BO'], bbox: [[-45, -75, 5, -34]], mode: 'double',
  seasons: [
    S('summer', 'Summer crop', 'rain-onset', '09-15', '12-15', ['soybean', 'maize', 'bean', 'cotton', 'rice', 'sunflower', 'fallow']),
    S('second', 'Second crop (safrinha)', 'fixed', '01-25', '03-10', ['maize', 'sorghum', 'bean', 'sunflower', 'fallow'], 'Second crop relies on the tail of the rainy season'),
  ],
  cropOverrides: { soybean: { stages: [15, 25, 45, 20] } },
  rules: BIMODAL_RULES, costFactor: 1.1, yields: { soybean: 3.4, maize: 6.0, bean: 1.6, cotton: 1.8, rice: 6.0, sunflower: 2.0, sorghum: 3.5 },
  sources: ['R8', 'R18', 'R19'],
});

export const AUSTRALIA = pack({
  id: 'au-winter-grain', name: 'Australia — winter grain belt', short: 'Australia',
  description: 'Wheat, barley, canola and pulses sown at the autumn "break" (April–June).',
  countries: ['AU', 'NZ'], bbox: [[-45, 110, -10, 180]], mode: 'annual',
  seasons: [S('winter', 'Winter (autumn break)', 'rain-onset', '04-10', '06-30', ['wheat', 'barley', 'rapeseed', 'chickpea', 'lentil', 'fababean', 'fallow'])],
  cropOverrides: { wheat: { stages: [20, 50, 50, 30], tMeanRange: [8, 22] }, barley: { stages: [20, 45, 45, 25], tMeanRange: [8, 22] }, rapeseed: { stages: [25, 50, 45, 25], tMeanRange: [8, 22] }, chickpea: { stages: [25, 50, 45, 25] }, lentil: { stages: [25, 50, 40, 25] }, fababean: { stages: [25, 50, 45, 25] } },
  rules: GENERIC_RULES, costFactor: 1.2, yields: { wheat: 2.6, barley: 2.8, rapeseed: 1.4, chickpea: 1.4, lentil: 1.3, fababean: 2.0 },
  sources: ['R8', 'R18', 'R19'],
});

export const GLOBAL = pack({
  id: 'global-screening', name: 'Global screening — no regional pack', short: 'Global screening',
  description: 'Fallback anywhere else: the season is derived from the NASA climatology at the location and a generic crop library is screened. Treat every result as a demonstration.',
  countries: [], bbox: [[-90, -180, 90, 180]], mode: 'annual',
  seasons: [S('main', 'Main season', 'rain-onset', 'auto', 'auto', ['maize', 'sorghum', 'millet', 'wheat', 'barley', 'soybean', 'groundnut', 'cowpea', 'bean', 'sunflower', 'potato', 'rice', 'cotton', 'fallow'])],
  rules: GENERIC_RULES, costFactor: 1.0, yields: { maize: 4, sorghum: 2.5, millet: 1.5, wheat: 3, barley: 3, soybean: 2.2, groundnut: 1.8, cowpea: 1.2, bean: 1.5, sunflower: 2, potato: 20, rice: 4.5, cotton: 1.5 },
  sources: ['R8', 'R18', 'R19', 'R31', 'R32'],
});

export const PACKS: RegionPack[] = [SENEGAL, EAST_AFRICA, ETHIOPIA, SOUTHERN_AFRICA, SOUTH_ASIA, SE_ASIA, EAST_ASIA, MENA, CENTRAL_ASIA, KAZAKHSTAN, EUROPE, CORN_BELT, NORTH_AMERICA, SOUTH_AMERICA_TROPICAL, SOUTH_AMERICA, AUSTRALIA, GLOBAL];

const inBox = (lat: number, lon: number, [a, b, c, d]: [number, number, number, number]) => lat >= a && lat <= c && lon >= b && lon <= d;
const inLat = (p: RegionPack, lat: number, lon?: number) => (!p.latRange || (lat >= p.latRange[0] && lat <= p.latRange[1])) && (!p.lonRange || lon == null || (lon >= p.lonRange[0] && lon <= p.lonRange[1]));

/** Pick the regional pack: by country (if known) and latitude band, else by bounding box, else global screening. */
export function detectPack(lat: number, lon: number, iso2?: string): RegionPack {
  if (iso2) {
    const byCountry = PACKS.find((p) => p.countries.includes(iso2) && inLat(p, lat, lon));
    if (byCountry) return byCountry;
  }
  for (const p of PACKS) {
    if (p.id === GLOBAL.id) continue;
    if (iso2 && p.countries.length && !p.countries.includes(iso2) && !(iso2 === 'RU' && (p.id === EUROPE.id || p.id === KAZAKHSTAN.id))) continue;
    if (p.bbox.some((b) => inBox(lat, lon, b)) && inLat(p, lat, lon)) return p;
  }
  return GLOBAL;
}
export const packById = (id?: string) => PACKS.find((p) => p.id === id);

/** Irrigation water cost: pumping energy per mm per ha (1 mm·ha = 10 m³), in USD; converted with FX. */
export const IRRIGATION_USD_PER_MM_HA = 0.45;
