// Browser evaluator for the INRAE trial surrogates (gradient-boosted trees exported by ml/export_model.py).
// prediction = exp(log prior of the species mix + base_score + sum of tree leaves).
// Branching mirrors XGBoost exactly: features and thresholds compared as float32, missing (NaN) → default branch.
// Parity with the Python predictions is checked in tests/agrioptima.test.ts.

export interface CompactTree { l: number[]; r: number[]; f: number[]; t: number[]; d: number[] }
export interface TreeModel { base_score: number; trees: CompactTree[]; log_priors: Record<string, number> }
export interface CvScore { r2: number; mae: number }
export interface ModelReport {
  target: string; rows: number; experiments: number; best_params: Record<string, number>;
  cv_grouped_by_experiment: CvScore; baseline_species_mean: CvScore;
}
export interface ModelBundle {
  format: 'agrioptima-trees-v1';
  created_utc: string; warehouse_version: string; source: string;
  feature_columns: string[]; species_columns: string[];
  feature_medians: Record<string, number | null>;
  training_ranges: Record<string, [number, number]>;
  coefficients: {
    ndfa_share: Record<string, number>;
    n_harvest_index: Record<string, number>;
    intercrop_share: Record<string, Record<string, number>>;
    season: Record<string, { sow_doy: number; duration_days: number }>;
  };
  reports: { yield_model: ModelReport; nitrogen_model: ModelReport };
  models: { yield_model: TreeModel; nitrogen_model: TreeModel };
}

let pending: Promise<ModelBundle> | null = null;
/** Code-split: the ~150 kB (gzip) bundle downloads only when a soil-N view is opened. */
export function loadModel(): Promise<ModelBundle> {
  pending ??= import('../../data/agrioptima/model.json').then((m) => validateBundle((m as { default?: unknown }).default ?? m));
  pending.catch(() => { pending = null; }); // allow a retry after a failed chunk download
  return pending;
}

export function validateBundle(raw: unknown): ModelBundle {
  const b = raw as ModelBundle;
  if (!b || b.format !== 'agrioptima-trees-v1' || !Array.isArray(b.feature_columns) || !b.models?.yield_model?.trees?.length || !b.models?.nitrogen_model?.trees?.length) {
    throw new Error('Soil-N model bundle is missing or has an unexpected format');
  }
  return b;
}

const f32 = Math.fround;

/** Sum of leaf values for one row (feature vector in `feature_columns` order, NaN = missing). */
function margin(m: TreeModel, x: Float64Array | number[]): number {
  let s = m.base_score;
  for (const tr of m.trees) {
    let n = 0;
    while (tr.l[n] !== -1) {
      const v = x[tr.f[n]];
      n = Number.isNaN(v) ? (tr.d[n] ? tr.l[n] : tr.r[n]) : f32(v) < f32(tr.t[n]) ? tr.l[n] : tr.r[n];
    }
    s += tr.t[n];
  }
  return s;
}

/** Species-mix key, e.g. "00010000" for sole pea — the same key the Python trainer used. */
export function mixKey(speciesIdx: number[], x: Float64Array | number[]): string {
  let k = '';
  for (const i of speciesIdx) k += x[i] > 0.5 ? '1' : '0';
  return k;
}

const prior = (m: TreeModel, key: string) => m.log_priors[key] ?? m.log_priors.__global__;

/** Stand seed yield (t/ha) and shoot N uptake (kg N/ha) for each row. */
export function predict(b: ModelBundle, rows: (Float64Array | number[])[]): { yieldTHa: Float64Array; nUptake: Float64Array } {
  const yieldTHa = new Float64Array(rows.length), nUptake = new Float64Array(rows.length);
  const ym = b.models.yield_model, nm = b.models.nitrogen_model;
  const speciesIdx = b.species_columns.map((c) => b.feature_columns.indexOf(c));
  rows.forEach((x, i) => {
    const k = mixKey(speciesIdx, x);
    yieldTHa[i] = Math.exp(prior(ym, k) + margin(ym, x));
    nUptake[i] = Math.exp(prior(nm, k) + margin(nm, x));
  });
  return { yieldTHa, nUptake };
}
