import type { CropDef } from '../domain/types';

// Crop parameters. Kc, stage lengths, rooting depth and p: FAO-56 Tables 11, 12, 22 (R8), with stage
// lengths shortened to the short-cycle varieties typical of each demo region. Ky: FAO-66 (R18) where
// published; values marked "analogue" borrow from a similar crop and need local review.
// Heat thresholds are exploratory screening values around flowering (R30), not injury thresholds.

export const CROPS: Record<string, CropDef> = {
  millet: {
    id: 'millet', name: 'Pearl millet', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.0, 0.3], stages: [15, 25, 35, 15], rootDepthM: 1.2, p: 0.55, ky: 1.0,
    heatThresholdC: 40, frostSensitive: true, sowTempC: 16, tMeanRange: [21, 34], phRange: [5.0, 8.0],
    minReturnSeasons: 0, diseaseGroups: ['striga-host'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R3'],
  },
  sorghum: {
    id: 'sorghum', name: 'Sorghum', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.0, 0.55], stages: [20, 30, 40, 20], rootDepthM: 1.2, p: 0.55, ky: 0.9,
    heatThresholdC: 38, frostSensitive: true, sowTempC: 15, tMeanRange: [20, 33], phRange: [5.5, 8.5],
    minReturnSeasons: 0, diseaseGroups: ['striga-host'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18'],
  },
  maize: {
    id: 'maize', name: 'Maize', family: 'Poaceae', group: 'cereal', emoji: '🌽',
    kc: [0.3, 1.2, 0.6], stages: [20, 30, 35, 15], rootDepthM: 1.0, p: 0.55, ky: 1.25,
    heatThresholdC: 35, frostSensitive: true, sowTempC: 10, tMeanRange: [17, 32], phRange: [5.5, 7.5],
    minReturnSeasons: 0, diseaseGroups: ['striga-host'], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R30'],
  },
  groundnut: {
    id: 'groundnut', name: 'Groundnut', family: 'Fabaceae', group: 'legume', emoji: '🥜',
    kc: [0.4, 1.15, 0.6], stages: [20, 25, 30, 15], rootDepthM: 0.7, p: 0.5, ky: 0.7,
    heatThresholdC: 35, frostSensitive: true, sowTempC: 16, tMeanRange: [20, 32], phRange: [5.5, 7.5],
    minReturnSeasons: 1, diseaseGroups: ['groundnut-pests'], labor: 'high', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R3'],
  },
  cowpea: {
    id: 'cowpea', name: 'Cowpea', family: 'Fabaceae', group: 'legume', emoji: '🫘',
    kc: [0.4, 1.05, 0.6], stages: [15, 20, 30, 15], rootDepthM: 0.8, p: 0.45, ky: 1.0,
    heatThresholdC: 36, frostSensitive: true, sowTempC: 16, tMeanRange: [20, 33], phRange: [5.5, 7.5],
    minReturnSeasons: 0, diseaseGroups: [], labor: 'medium', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R3', 'R32'],
  },
  sesame: {
    id: 'sesame', name: 'Sesame', family: 'Pedaliaceae', group: 'oilseed', emoji: '🌱',
    kc: [0.35, 1.1, 0.25], stages: [15, 25, 35, 15], rootDepthM: 1.0, p: 0.6, ky: 0.9,
    heatThresholdC: 40, frostSensitive: true, sowTempC: 18, tMeanRange: [22, 34], phRange: [5.5, 8.0],
    minReturnSeasons: 1, diseaseGroups: [], labor: 'high', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8'],
  },
  wheat: {
    id: 'wheat', name: 'Spring wheat', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.15, 0.25], stages: [15, 25, 40, 20], rootDepthM: 1.2, p: 0.55, ky: 1.15,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 8, tMeanRange: [10, 24], phRange: [5.5, 8.2],
    minReturnSeasons: 0, diseaseGroups: ['cereal-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R18', 'R28', 'R30'],
  },
  barley: {
    id: 'barley', name: 'Spring barley', family: 'Poaceae', group: 'cereal', emoji: '🌾',
    kc: [0.3, 1.15, 0.25], stages: [15, 25, 35, 15], rootDepthM: 1.0, p: 0.55, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 7, tMeanRange: [9, 24], phRange: [6.0, 8.5],
    minReturnSeasons: 0, diseaseGroups: ['cereal-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R28'],
  },
  flax: {
    id: 'flax', name: 'Oilseed flax', family: 'Linaceae', group: 'oilseed', emoji: '🌼',
    kc: [0.35, 1.1, 0.25], stages: [20, 25, 35, 15], rootDepthM: 1.0, p: 0.5, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 9, tMeanRange: [11, 24], phRange: [5.5, 7.8],
    minReturnSeasons: 4, diseaseGroups: ['fusarium-flax'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R28', 'R31'],
  },
  rapeseed: {
    id: 'rapeseed', name: 'Spring rapeseed', family: 'Brassicaceae', group: 'oilseed', emoji: '🌼',
    kc: [0.35, 1.05, 0.35], stages: [20, 25, 35, 15], rootDepthM: 1.0, p: 0.6, ky: 1.0,
    heatThresholdC: 30, frostSensitive: false, sowTempC: 8, tMeanRange: [11, 23], phRange: [5.8, 8.0],
    minReturnSeasons: 3, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R29'],
  },
  sunflower: {
    id: 'sunflower', name: 'Sunflower', family: 'Asteraceae', group: 'oilseed', emoji: '🌻',
    kc: [0.35, 1.0, 0.35], stages: [20, 30, 40, 20], rootDepthM: 1.2, p: 0.45, ky: 0.95,
    heatThresholdC: 35, frostSensitive: true, sowTempC: 10, tMeanRange: [15, 30], phRange: [6.0, 8.0],
    minReturnSeasons: 4, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18', 'R29'],
  },
  lentil: {
    id: 'lentil', name: 'Lentil', family: 'Fabaceae', group: 'legume', emoji: '🫘',
    kc: [0.4, 1.1, 0.3], stages: [15, 25, 35, 20], rootDepthM: 0.7, p: 0.5, ky: 1.0,
    heatThresholdC: 32, frostSensitive: false, sowTempC: 7, tMeanRange: [11, 25], phRange: [6.0, 8.2],
    minReturnSeasons: 2, diseaseGroups: ['pulse-root-rot'], labor: 'low', residueForLivestock: true, irrigationRequired: false,
    sources: ['R8', 'R28', 'R32'],
  },
  soybean: {
    id: 'soybean', name: 'Soybean', family: 'Fabaceae', group: 'legume', emoji: '🫘',
    kc: [0.4, 1.15, 0.5], stages: [15, 25, 40, 20], rootDepthM: 0.8, p: 0.5, ky: 0.85,
    heatThresholdC: 35, frostSensitive: true, sowTempC: 12, tMeanRange: [17, 30], phRange: [5.8, 7.5],
    minReturnSeasons: 1, diseaseGroups: ['sclerotinia'], labor: 'low', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18', 'R32'],
  },
  potato: {
    id: 'potato', name: 'Potato', family: 'Solanaceae', group: 'tuber', emoji: '🥔',
    kc: [0.5, 1.15, 0.75], stages: [25, 30, 40, 25], rootDepthM: 0.5, p: 0.35, ky: 1.1,
    heatThresholdC: 30, frostSensitive: true, sowTempC: 8, tMeanRange: [12, 23], phRange: [4.8, 7.0],
    minReturnSeasons: 3, diseaseGroups: ['solanaceae'], labor: 'high', residueForLivestock: false, irrigationRequired: false,
    sources: ['R8', 'R18'],
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
export const cropEmoji = (id: string) => CROPS[id]?.emoji ?? '🌱';
