export interface FertProduct { id: string; name: string; type: 'mineral' | 'organic'; n: number | null; p2o5: number | null; k2o: number | null; bagKg: number | null }

// Label analyses (N–P2O5–K2O %). Organic materials have unknown composition unless a lab analysis is entered.
export const FERTILIZERS: FertProduct[] = [
  { id: 'urea', name: 'Urea 46-0-0', type: 'mineral', n: 46, p2o5: 0, k2o: 0, bagKg: 50 },
  { id: 'npk151515', name: 'NPK 15-15-15', type: 'mineral', n: 15, p2o5: 15, k2o: 15, bagKg: 50 },
  { id: 'npk62010', name: 'NPK 6-20-10', type: 'mineral', n: 6, p2o5: 20, k2o: 10, bagKg: 50 },
  { id: 'dap', name: 'DAP 18-46-0', type: 'mineral', n: 18, p2o5: 46, k2o: 0, bagKg: 50 },
  { id: 'ammophos', name: 'Ammophos 12-52-0', type: 'mineral', n: 12, p2o5: 52, k2o: 0, bagKg: 50 },
  { id: 'an', name: 'Ammonium nitrate 34-0-0', type: 'mineral', n: 34, p2o5: 0, k2o: 0, bagKg: 50 },
  { id: 'manure', name: 'Livestock manure', type: 'organic', n: null, p2o5: null, k2o: null, bagKg: null },
  { id: 'compost', name: 'Compost', type: 'organic', n: null, p2o5: null, k2o: null, bagKg: null },
  { id: 'custom', name: 'Other / custom product', type: 'mineral', n: null, p2o5: null, k2o: null, bagKg: null },
];
export const fertById = (id: string) => FERTILIZERS.find((f) => f.id === id);
