import type { CropDef } from '../domain/types';

// Crop parameters. Kc, stage lengths, rooting depth and p: FAO-56 Tables 11, 12, 22 (R8), with stage
// lengths shortened to the short-cycle varieties typical of each demo region. Ky: FAO-66 (R18) where
// published; values marked "analogue" borrow from a similar crop and need local review.
// kyStages: FAO-33 (Doorenbos & Kassam 1979, Table 24; R37) Ky for the vegetative, flowering, yield-formation
// and ripening periods ("—" in the table → 0). Only crops listed in that table carry them; pearl millet uses the
// sorghum values as an analogue (FAO-33 lists no millet). Other crops keep the seasonal Ky.
// Heat thresholds are exploratory screening values around flowering (R30), not injury thresholds.
// tMeanRange: season-mean air temperature tolerance used for screening (FAO ECOCROP-style absolute limits, R34).

export const CROPS: Record<string, CropDef> = {
  millet: {
    id: 'millet', name: 'Pearl millet', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.0, 0.3], stages: [15, 25, 35, 15], rootDepthM: 1.2, p: 0.55, ky: 1.0, kyStages: [0.2, 0.55, 0.45, 0.2],
    heatThresholdC: 40, frostSensitive: true, sowTempC: 16, tMeanRange: [18, 36], phRange: [5.0, 8.0],
    minReturnSeasons: 0, diseaseGroups: ['striga-host'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R3'],
  },
  sorghum: {
    id: 'sorghum', name: 'Sorghum', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.0, 0.55], stages: [20, 30, 40, 20], rootDepthM: 1.2, p: 0.55, ky: 0.9, kyStages: [0.2, 0.55, 0.45, 0.2],
    heatThresholdC: 38, frostSensitive: true, sowTempC: 15, tMeanRange: [15, 35], phRange: [5.5, 8.5],
    minReturnSeasons: 0, diseaseGroups: ['striga-host'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18'],
  },
  maize: {
    id: 'maize', name: 'Maize', family: 'Poaceae', group: 'cereal', emoji: '🌽',
    kc: [0.3, 1.2, 0.6], stages: [20, 30, 35, 15], rootDepthM: 1.0, p: 0.55, ky: 1.25, kyStages: [0.4, 1.5, 0.5, 0.2],
    heatThresholdC: 35, frostSensitive: true, sowTempC: 10, tMeanRange: [13, 33], phRange: [5.5, 7.5],
    minReturnSeasons: 0, diseaseGroups: ['striga-host'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R30'],
  },
  groundnut: {
    id: 'groundnut', name: 'Groundnut', family: 'Fabaceae', group: 'legume', emoji: '🥜',
    kc: [0.4, 1.15, 0.6], stages: [20, 25, 30, 15], rootDepthM: 0.7, p: 0.5, ky: 0.7, kyStages: [0.2, 0.8, 0.6, 0],
    heatThresholdC: 35, frostSensitive: true, sowTempC: 16, tMeanRange: [17, 34], phRange: [5.5, 7.5],
    minReturnSeasons: 1, diseaseGroups: ['groundnut-pests'], labor: 'high', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R3'],
  },
  cowpea: {
    id: 'cowpea', name: 'Cowpea', family: 'Fabaceae', group: 'legume', emoji: '🫘',
    kc: [0.4, 1.05, 0.6], stages: [15, 20, 30, 15], rootDepthM: 0.8, p: 0.45, ky: 1.0,
    heatThresholdC: 36, frostSensitive: true, sowTempC: 16, tMeanRange: [17, 35], phRange: [5.5, 7.5],
    minReturnSeasons: 0, diseaseGroups: [], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R3', 'R32'],
  },
  sesame: {
    id: 'sesame', name: 'Sesame', family: 'Pedaliaceae', group: 'oilseed', emoji: '🌱',
    kc: [0.35, 1.1, 0.25], stages: [15, 25, 35, 15], rootDepthM: 1.0, p: 0.6, ky: 0.9,
    heatThresholdC: 40, frostSensitive: true, sowTempC: 18, tMeanRange: [18, 35], phRange: [5.5, 8.0],
    minReturnSeasons: 1, diseaseGroups: [], labor: 'high', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8'],
  },
  wheat: {
    id: 'wheat', name: 'Spring wheat', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.15, 0.25], stages: [15, 25, 40, 20], rootDepthM: 1.2, p: 0.55, ky: 1.15, kyStages: [0.2, 0.6, 0.5, 0],
    heatThresholdC: 32, frostSensitive: false, sowTempC: 8, tMeanRange: [8, 26], phRange: [5.5, 8.2],
    minReturnSeasons: 0, diseaseGroups: ['cereal-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R28', 'R30'],
  },
  barley: {
    id: 'barley', name: 'Spring barley', family: 'Poaceae', group: 'cereal', emoji: '🍺',
    kc: [0.3, 1.15, 0.25], stages: [15, 25, 35, 15], rootDepthM: 1.0, p: 0.55, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 7, tMeanRange: [7, 26], phRange: [6.0, 8.5],
    minReturnSeasons: 0, diseaseGroups: ['cereal-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R28'],
  },
  flax: {
    id: 'flax', name: 'Oilseed flax', family: 'Linaceae', group: 'oilseed', emoji: '🪻',
    kc: [0.35, 1.1, 0.25], stages: [20, 25, 35, 15], rootDepthM: 1.0, p: 0.5, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 9, tMeanRange: [9, 26], phRange: [5.5, 7.8],
    minReturnSeasons: 4, diseaseGroups: ['fusarium-flax'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R28', 'R31'],
  },
  rapeseed: {
    id: 'rapeseed', name: 'Spring rapeseed', family: 'Brassicaceae', group: 'oilseed', emoji: '🌼',
    kc: [0.35, 1.05, 0.35], stages: [20, 25, 35, 15], rootDepthM: 1.0, p: 0.6, ky: 1.0,
    heatThresholdC: 30, frostSensitive: false, sowTempC: 8, tMeanRange: [8, 25], phRange: [5.8, 8.0],
    minReturnSeasons: 3, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R29'],
  },
  sunflower: {
    id: 'sunflower', name: 'Sunflower', family: 'Asteraceae', group: 'oilseed', emoji: '🌻',
    kc: [0.35, 1.0, 0.35], stages: [20, 30, 40, 20], rootDepthM: 1.2, p: 0.45, ky: 0.95, kyStages: [0.25, 1.0, 0.8, 0],
    heatThresholdC: 35, frostSensitive: true, sowTempC: 10, tMeanRange: [13, 32], phRange: [6.0, 8.0],
    minReturnSeasons: 4, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18', 'R29'],
  },
  lentil: {
    id: 'lentil', name: 'Lentil', family: 'Fabaceae', group: 'legume', emoji: '🍲',
    kc: [0.4, 1.1, 0.3], stages: [15, 25, 35, 20], rootDepthM: 0.7, p: 0.5, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 7, tMeanRange: [9, 27], phRange: [6.0, 8.2],
    minReturnSeasons: 2, diseaseGroups: ['pulse-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R28', 'R32'],
  },
  soybean: {
    id: 'soybean', name: 'Soybean', family: 'Fabaceae', group: 'legume', emoji: '🫛',
    kc: [0.4, 1.15, 0.5], stages: [15, 25, 40, 20], rootDepthM: 0.8, p: 0.5, ky: 0.85, kyStages: [0.2, 0.8, 1.0, 0],
    heatThresholdC: 35, frostSensitive: true, sowTempC: 12, tMeanRange: [14, 32], phRange: [5.8, 7.5],
    minReturnSeasons: 1, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18', 'R32'],
  },
  potato: {
    id: 'potato', name: 'Potato', family: 'Solanaceae', group: 'tuber', emoji: '🥔',
    kc: [0.5, 1.15, 0.75], stages: [25, 30, 40, 25], rootDepthM: 0.5, p: 0.35, ky: 1.1, kyStages: [0.45, 0.8, 0.7, 0.2],
    heatThresholdC: 30, frostSensitive: true, sowTempC: 8, tMeanRange: [8, 24], phRange: [4.8, 7.0],
    minReturnSeasons: 3, diseaseGroups: ['solanaceae'], labor: 'high', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18'],
  },
  bean: {
    id: 'bean', name: 'Common bean', family: 'Fabaceae', group: 'legume', emoji: '🫘',
    kc: [0.4, 1.15, 0.35], stages: [15, 25, 35, 15], rootDepthM: 0.7, p: 0.45, ky: 1.15, kyStages: [0.2, 1.1, 0.75, 0.2],
    heatThresholdC: 32, frostSensitive: true, sowTempC: 12, tMeanRange: [12, 28], phRange: [5.5, 7.5],
    minReturnSeasons: 1, diseaseGroups: ['bean-root-rot'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R32'],
  },
  chickpea: {
    id: 'chickpea', name: 'Chickpea', family: 'Fabaceae', group: 'legume', emoji: '🧆',
    kc: [0.4, 1.0, 0.35], stages: [20, 30, 45, 25], rootDepthM: 0.9, p: 0.5, ky: 0.9,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 8, tMeanRange: [10, 28], phRange: [6.0, 8.5],
    minReturnSeasons: 2, diseaseGroups: ['pulse-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R32'],
  },
  rice: {
    id: 'rice', name: 'Rice (paddy)', family: 'Poaceae', group: 'cereal', emoji: '🍚',
    kc: [1.05, 1.2, 0.9], stages: [25, 25, 40, 20], rootDepthM: 0.5, p: 0.2, ky: 1.1,
    heatThresholdC: 35, frostSensitive: true, sowTempC: 15, tMeanRange: [17, 34], phRange: [5.0, 7.5],
    minReturnSeasons: 0, diseaseGroups: [], labor: 'high', residueForLivestock: true, irrigationRequired: true,
    sources: ['R8', 'R18'],
  },
  cotton: {
    id: 'cotton', name: 'Cotton', family: 'Malvaceae', group: 'oilseed', emoji: '🧶',
    kc: [0.35, 1.15, 0.6], stages: [30, 50, 55, 45], rootDepthM: 1.2, p: 0.65, ky: 0.85,
    heatThresholdC: 38, frostSensitive: true, sowTempC: 16, tMeanRange: [18, 34], phRange: [5.8, 8.0],
    minReturnSeasons: 1, diseaseGroups: ['cotton-wilt'], labor: 'high', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18'],
  },
  winterwheat: {
    id: 'winterwheat', name: 'Winter wheat', family: 'Poaceae', group: 'cereal', emoji: '🍞',
    kc: [0.4, 1.15, 0.25], stages: [40, 150, 45, 30], rootDepthM: 1.5, p: 0.55, ky: 1.0, kyStages: [0.2, 0.6, 0.5, 0],
    heatThresholdC: 32, frostSensitive: false, sowTempC: -99, tMeanRange: [3, 20], phRange: [5.5, 8.2],
    minReturnSeasons: 0, diseaseGroups: ['cereal-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R30'],
  },
  winterrapeseed: {
    id: 'winterrapeseed', name: 'Winter rapeseed', family: 'Brassicaceae', group: 'oilseed', emoji: '🌼',
    kc: [0.35, 1.05, 0.35], stages: [40, 150, 45, 25], rootDepthM: 1.2, p: 0.6, ky: 1.0,
    heatThresholdC: 30, frostSensitive: false, sowTempC: -99, tMeanRange: [3, 20], phRange: [5.8, 8.0],
    minReturnSeasons: 3, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R29'],
  },
  pigeonpea: {
    id: 'pigeonpea', name: 'Pigeon pea', family: 'Fabaceae', group: 'legume', emoji: '🌿',
    kc: [0.4, 1.0, 0.4], stages: [20, 35, 50, 25], rootDepthM: 1.5, p: 0.55, ky: 0.9,
    heatThresholdC: 38, frostSensitive: true, sowTempC: 18, tMeanRange: [18, 34], phRange: [5.0, 8.0],
    minReturnSeasons: 1, diseaseGroups: ['fusarium-pulse'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R32'],
  },
  mustard: {
    id: 'mustard', name: 'Mustard / rapeseed', family: 'Brassicaceae', group: 'oilseed', emoji: '🌼',
    kc: [0.35, 1.0, 0.35], stages: [20, 30, 40, 20], rootDepthM: 1.0, p: 0.6, ky: 1.0,
    heatThresholdC: 30, frostSensitive: false, sowTempC: 8, tMeanRange: [8, 26], phRange: [5.8, 8.2],
    minReturnSeasons: 2, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R29'],
  },
  teff: {
    id: 'teff', name: 'Teff', family: 'Poaceae', group: 'cereal', emoji: '🫓',
    kc: [0.3, 1.0, 0.3], stages: [15, 25, 40, 20], rootDepthM: 0.6, p: 0.55, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 12, tMeanRange: [11, 28], phRange: [5.0, 8.0],
    minReturnSeasons: 0, diseaseGroups: [], labor: 'high', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8'],
  },
  fababean: {
    id: 'fababean', name: 'Faba bean', family: 'Fabaceae', group: 'legume', emoji: '🫘',
    kc: [0.5, 1.15, 0.3], stages: [20, 30, 45, 25], rootDepthM: 0.7, p: 0.45, ky: 1.0,
    heatThresholdC: 30, frostSensitive: false, sowTempC: 6, tMeanRange: [7, 25], phRange: [6.0, 8.5],
    minReturnSeasons: 2, diseaseGroups: ['pulse-root-rot'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R32'],
  },
  fallow: {
    id: 'fallow', name: 'Fallow / rest', family: '—', group: 'fallow', emoji: '🟫',
    kc: [0.3, 0.3, 0.3], stages: [30, 30, 30, 20], rootDepthM: 0.3, p: 0.5, ky: 0,
    heatThresholdC: 99, frostSensitive: false, sowTempC: -99, tMeanRange: [-50, 60], phRange: [0, 14],
    minReturnSeasons: 0, diseaseGroups: [], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R28'],
  },
};

export const cropName = (id: string) => CROPS[id]?.name ?? id;

/** A crop as grown in a region: library parameters merged with the pack's variety overrides. */
export function cropFor(pack: { cropOverrides?: Record<string, Partial<CropDef>> } | undefined, id: string): CropDef {
  const base = CROPS[id];
  const o = pack?.cropOverrides?.[id];
  return o ? { ...base, ...o } : base;
}
export const cropEmoji = (id: string) => CROPS[id]?.emoji ?? '🌱';
