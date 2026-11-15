# ml/ — INRAE soil-N / rotation models

Offline training for the **Multi-year & soil N** layer. The web app does not run Python. It loads the exported
trees from `src/data/agrioptima/model.json` and evaluates them in the browser (`src/engine/agrioptima/model.ts`).

## Data

Gaudio et al. (2024), *A global dataset gathering 37 field experiments involving cereal–legume intercrops and their
corresponding sole crops*, v2.0.0, INRAE, CC-BY 4.0 — https://doi.org/10.5281/zenodo.14160885

Put the four CSVs (`data_trials.csv`, `data_management.csv`, `data_traits.csv`, `data_climate.csv`) in
`ml/raw_data/` (git-ignored), or point `INRAE_DATA_DIR` at them.

## Run

```bash
pip install -r ml/requirements.txt
python ml/export_model.py          # build warehouse → train (grouped CV) → export bundle + parity fixture
npm test                           # TS evaluator must reproduce the Python predictions
```

## Pipeline

1. `agrioptima_ml/data_warehouse.py` builds one row per plot treatment (experiment × management). Steps:
   - The traits table is long format, so it's pivoted, and the final measurement of each variable is kept.
   - Intercrop components are summed into stand totals.
   - Intercrops have one management row per species, so those rows are de-duplicated.
   - Growing-season climate is aggregated between sowing and harvest, with Hargreaves PET. The same definitions are used in `src/engine/agrioptima/climate.ts`.
   - Empirical coefficients are derived: N fixation share, N harvest index, intercrop yield shares and season calendars.
   - The result is written as a content-hashed Parquet file.
2. `agrioptima_ml/surrogates.py` trains `exp(log species-mix prior + XGBoost residual)` for seed yield and shoot N uptake. Hyperparameters are chosen by 5-fold CV grouped by experiment, so the scores are for unseen sites.
3. `export_model.py` converts the trees to compact arrays, with thresholds kept at float32 precision. It writes the app bundle and `tests/fixtures/agrioptima_parity.json`.
