import type { FarmScenario } from '../domain/types';

// Synthetic demonstration farms. Histories, budgets and prices are illustrative — not real farmers.

export const DEMO_SENEGAL: FarmScenario = {
  id: 'demo-bambey', name: 'Demo · Groundnut-basin smallholder (Bambey, Senegal)', synthetic: true,
  location: { lat: 14.71, lon: -16.46, label: 'Bambey, Diourbel, Senegal' }, countryIso2: 'SN',
  area: 1.5, areaUnit: 'ha', currency: 'XOF',
  availableFunds: 420000, reserve: 40000, confirmedInflows: [], firstSeasonYear: 2027,
  irrigation: 'no', irrigationCapacityMm: 0, laborAvailable: 'high',
  unavailableCrops: [], marketCrops: [], needsResidue: true, allowFallow: false, priority: 'cost', baselineOverride: null,
  history: [
    { id: 'h1', cropId: 'millet', year: 2024, plantedOn: '2024-07-08', harvestedOn: '2024-10-05', approximateDate: true, outcome: 'good', residueUse: 'grazed' },
    { id: 'h2', cropId: 'groundnut', year: 2025, plantedOn: '2025-07-03', harvestedOn: '2025-10-01', approximateDate: true, outcome: 'average', residueUse: 'removed' },
    { id: 'h3', cropId: 'millet', year: 2026, plantedOn: '2026-07-10', harvestedOn: '2026-10-07', approximateDate: true, outcome: 'poor', residueUse: 'grazed', notes: 'Patchy emergence after the first rains' },
  ],
  fertilizer: [
    { id: 'f1', cropSeasonId: 'h1', productId: 'npk151515', productName: 'NPK 15-15-15', type: 'mineral', applicationDate: '2024-07-20', approximateDate: true, quantity: 2, quantityUnit: 'bag', bagMassKg: 50, treatedAreaHa: 1.5, n: 15, p2o5: 15, k2o: 15, paidCost: 30000, currency: 'XOF', source: 'recall' },
    { id: 'f2', cropSeasonId: 'h1', productId: 'urea', productName: 'Urea 46-0-0', type: 'mineral', applicationDate: '2024-08-15', approximateDate: true, quantity: 1, quantityUnit: 'bag', bagMassKg: 50, treatedAreaHa: 1.0, n: 46, p2o5: 0, k2o: 0, paidCost: 15000, currency: 'XOF', source: 'recall' },
    { id: 'f3', cropSeasonId: 'h2', productId: 'npk62010', productName: 'NPK 6-20-10', type: 'mineral', applicationDate: '2025-07-05', approximateDate: false, quantity: 150, quantityUnit: 'kg', treatedAreaHa: 1.5, n: 6, p2o5: 20, k2o: 10, paidCost: 37500, currency: 'XOF', source: 'receipt' },
    { id: 'f4', cropSeasonId: 'h3', productId: 'manure', productName: 'Livestock manure', type: 'organic', applicationDate: '2026-06-20', approximateDate: true, quantity: 2, quantityUnit: 't', treatedAreaHa: null, n: null, p2o5: null, k2o: null, paidCost: null, source: 'recall' },
  ],
  soil: { texture: 'unknown' },
  priceOverrides: {},
};

export const DEMO_KAZAKHSTAN: FarmScenario = {
  id: 'demo-kostanay', name: 'Demo · Family grain farm (Kostanay, Kazakhstan)', synthetic: true,
  location: { lat: 53.0, lon: 64.0, label: 'Kostanay region, Kazakhstan' }, countryIso2: 'KZ',
  area: 200, areaUnit: 'ha', currency: 'KZT',
  availableFunds: 33000000, reserve: 3000000,
  confirmedInflows: [{ id: 'in1', date: '2027-06-15', amount: 4000000, label: 'Confirmed state input subsidy' }],
  firstSeasonYear: 2027,
  irrigation: 'no', irrigationCapacityMm: 0, laborAvailable: 'medium',
  unavailableCrops: [], marketCrops: [], needsResidue: false, allowFallow: true, priority: 'climate', baselineOverride: null,
  history: [
    { id: 'k1', cropId: 'wheat', year: 2024, plantedOn: '2024-05-18', harvestedOn: '2024-09-05', approximateDate: false, outcome: 'good', residueUse: 'left' },
    { id: 'k2', cropId: 'wheat', year: 2025, plantedOn: '2025-05-20', harvestedOn: '2025-09-08', approximateDate: false, outcome: 'average', residueUse: 'left' },
    { id: 'k3', cropId: 'wheat', year: 2026, plantedOn: '2026-05-16', harvestedOn: '2026-09-02', approximateDate: false, outcome: 'poor', residueUse: 'left' },
  ],
  fertilizer: [
    { id: 'kf1', cropSeasonId: 'k2', productId: 'ammophos', productName: 'Ammophos 12-52-0', type: 'mineral', applicationDate: '2025-05-20', approximateDate: false, quantity: 8000, quantityUnit: 'kg', treatedAreaHa: 200, n: 12, p2o5: 52, k2o: 0, paidCost: 2560000, currency: 'KZT', source: 'receipt' },
    { id: 'kf2', cropSeasonId: 'k3', productId: 'ammophos', productName: 'Ammophos 12-52-0', type: 'mineral', applicationDate: '2026-05-16', approximateDate: false, quantity: 6000, quantityUnit: 'kg', treatedAreaHa: 150, n: 12, p2o5: 52, k2o: 0, paidCost: 1920000, currency: 'KZT', source: 'receipt' },
  ],
  soil: { texture: 'unknown' },
  priceOverrides: {},
};

export const DEMOS = [DEMO_SENEGAL, DEMO_KAZAKHSTAN];
