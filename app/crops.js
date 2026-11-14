/* Crop pack v1 — values from FAO-56 (stage lengths, Kc, rooting depth, depletion p) and
   FAO-33 (yield response factor Ky). Values marked "assumed" are not in FAO-33 and need
   agronomist review. tbase/gdd/heat/frost are approximate screening thresholds, not cultivar data.
   value = rough relative market value (1 low, 3 high) — replace with local prices. */
window.CROPS = [
  { id: 'spring_wheat', icon: '🌾', family: 'cereal', legume: false, name: { en: 'Spring wheat', ru: 'Яровая пшеница' },
    stages: [20, 25, 40, 20], kc: [0.3, 1.15, 0.25], root: 1.2, p: 0.55, ky: 1.15, tbase: 0, tsow: 6, gdd: 1300, heat: 32, frost: -4, value: 2 },
  { id: 'barley', icon: '🌾', family: 'cereal', legume: false, name: { en: 'Barley', ru: 'Ячмень' },
    stages: [15, 25, 40, 20], kc: [0.3, 1.15, 0.25], root: 1.1, p: 0.55, ky: 1.0, kyAssumed: true, tbase: 0, tsow: 5, gdd: 1200, heat: 32, frost: -4, value: 1 },
  { id: 'maize', icon: '🌽', family: 'cereal', legume: false, name: { en: 'Maize', ru: 'Кукуруза' },
    stages: [30, 40, 50, 30], kc: [0.3, 1.2, 0.6], root: 1.5, p: 0.55, ky: 1.25, tbase: 10, tsow: 11, gdd: 1400, heat: 35, frost: -1, value: 2 },
  { id: 'sorghum', icon: '🌿', family: 'cereal', legume: false, name: { en: 'Sorghum', ru: 'Сорго' },
    stages: [20, 35, 40, 30], kc: [0.3, 1.0, 0.55], root: 1.5, p: 0.55, ky: 0.9, tbase: 10, tsow: 15, gdd: 1300, heat: 38, frost: 0, value: 1 },
  { id: 'millet', icon: '🌿', family: 'cereal', legume: false, name: { en: 'Pearl millet', ru: 'Просо' },
    stages: [15, 25, 40, 25], kc: [0.3, 1.0, 0.3], root: 1.5, p: 0.55, ky: 0.9, kyAssumed: true, tbase: 10, tsow: 18, gdd: 1200, heat: 40, frost: 1, value: 1 },
  { id: 'pea', icon: '🫛', family: 'legume', legume: true, name: { en: 'Field pea', ru: 'Горох' },
    stages: [15, 25, 35, 15], kc: [0.5, 1.15, 0.3], root: 0.8, p: 0.35, ky: 1.15, tbase: 2, tsow: 5, gdd: 1000, heat: 30, frost: -3, value: 2 },
  { id: 'lentil', icon: '🫘', family: 'legume', legume: true, name: { en: 'Lentil', ru: 'Чечевица' },
    stages: [20, 25, 35, 15], kc: [0.4, 1.1, 0.3], root: 0.8, p: 0.5, ky: 1.0, kyAssumed: true, tbase: 2, tsow: 6, gdd: 1050, heat: 32, frost: -3, value: 3 },
  { id: 'chickpea', icon: '🫘', family: 'legume', legume: true, name: { en: 'Chickpea', ru: 'Нут' },
    stages: [20, 30, 35, 15], kc: [0.4, 1.0, 0.35], root: 1.0, p: 0.5, ky: 0.85, kyAssumed: true, tbase: 5, tsow: 8, gdd: 1000, heat: 35, frost: -2, value: 3 },
  { id: 'soybean', icon: '🫘', family: 'legume', legume: true, name: { en: 'Soybean', ru: 'Соя' },
    stages: [20, 30, 60, 25], kc: [0.4, 1.15, 0.5], root: 1.2, p: 0.5, ky: 0.85, tbase: 10, tsow: 12, gdd: 1200, heat: 35, frost: -1, value: 2 },
  { id: 'groundnut', icon: '🥜', family: 'legume', legume: true, name: { en: 'Groundnut', ru: 'Арахис' },
    stages: [25, 35, 45, 25], kc: [0.4, 1.15, 0.6], root: 0.8, p: 0.5, ky: 0.7, tbase: 10, tsow: 18, gdd: 1500, heat: 38, frost: 1, value: 3 },
  { id: 'cowpea', icon: '🫛', family: 'legume', legume: true, name: { en: 'Cowpea', ru: 'Вигна (коровий горох)' },
    stages: [20, 30, 30, 20], kc: [0.4, 1.05, 0.35], root: 1.0, p: 0.45, ky: 1.0, kyAssumed: true, tbase: 10, tsow: 18, gdd: 1100, heat: 40, frost: 1, value: 2 },
  { id: 'sunflower', icon: '🌻', family: 'aster', legume: false, name: { en: 'Sunflower', ru: 'Подсолнечник' },
    stages: [25, 35, 45, 25], kc: [0.35, 1.1, 0.35], root: 1.5, p: 0.45, ky: 0.95, tbase: 6, tsow: 8, gdd: 1300, heat: 35, frost: -2, value: 2 },
  { id: 'canola', icon: '🌼', family: 'brassica', legume: false, name: { en: 'Spring canola', ru: 'Яровой рапс' },
    stages: [20, 30, 35, 20], kc: [0.35, 1.1, 0.35], root: 1.0, p: 0.6, ky: 1.0, kyAssumed: true, tbase: 5, tsow: 5, gdd: 1000, heat: 29, frost: -4, value: 3 },
  { id: 'flax', icon: '💠', family: 'flax', legume: false, name: { en: 'Flax', ru: 'Лён' },
    stages: [20, 30, 40, 20], kc: [0.35, 1.1, 0.25], root: 1.0, p: 0.5, ky: 1.0, kyAssumed: true, tbase: 5, tsow: 6, gdd: 1100, heat: 30, frost: -3, value: 2 },
];
