"""Train the INRAE surrogates and export them for the browser.

    python ml/export_model.py            # rebuild warehouse, retrain, export
    python ml/export_model.py --no-train # export the models already in ml/artifacts

Writes
  src/data/agrioptima/model.json        compact trees + priors + coefficients + validation report
  tests/fixtures/agrioptima_parity.json feature rows with Python predictions; the TypeScript
                                        evaluator must reproduce them (tests/agrioptima.test.ts)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agrioptima_ml.config import APP_MODEL_PATH, MODEL_DIR, PARITY_FIXTURE_PATH  # noqa: E402
from agrioptima_ml.data_warehouse import load_latest  # noqa: E402
from agrioptima_ml.features import FEATURE_COLUMNS  # noqa: E402
from agrioptima_ml.surrogates import SPECIES_COLS, load_surrogates, train_and_save  # noqa: E402


def _r(x: float, sig: int = 7) -> float:
    return float(f"{x:.{sig}g}")


def compact_trees(model_path: Path) -> dict:
    """XGBoost JSON -> per-tree parallel arrays. Leaves have left == -1 and store their value in `t`."""
    m = json.loads(model_path.read_text())
    learner = m["learner"]
    assert learner["objective"]["name"] == "reg:squarederror"
    base_score = float(learner["learner_model_param"]["base_score"].strip("[]"))
    trees = []
    for t in learner["gradient_booster"]["model"]["trees"]:
        if any(t["split_type"]):
            raise ValueError("categorical splits are not supported by the TS evaluator")
        trees.append({
            "l": t["left_children"],
            "r": t["right_children"],
            "f": t["split_indices"],
            "t": [_r(v, 9) for v in t["split_conditions"]],  # 9 digits round-trip float32 exactly
            "d": t["default_left"],
        })
    return {"base_score": base_score, "trees": trees}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-train", action="store_true")
    a = ap.parse_args()

    meta = json.loads((MODEL_DIR / "metadata.json").read_text()) if a.no_train else train_and_save()
    df, wh = load_latest()

    reports = {}
    models = {}
    for name in ("yield_model", "nitrogen_model"):
        rep = meta["reports"][name]
        models[name] = {
            **compact_trees(MODEL_DIR / f"{name}.json"),
            "log_priors": {k: _r(v) for k, v in rep["log_priors"].items()},
        }
        reports[name] = {k: rep[k] for k in ("target", "rows", "experiments", "best_params", "cv_grouped_by_experiment", "baseline_species_mean")}

    ranges = {c: [_r(float(df[c].min())), _r(float(df[c].max()))] for c in FEATURE_COLUMNS if df[c].notna().any()}
    bundle = {
        "format": "agrioptima-trees-v1",
        "created_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "warehouse_version": wh["version"],
        "source": "Gaudio et al. 2024, INRAE global cereal-legume intercrop dataset v2.0.0 (Zenodo)",
        "feature_columns": FEATURE_COLUMNS,
        "species_columns": SPECIES_COLS,
        "feature_medians": meta["feature_medians"],
        "training_ranges": ranges,
        "coefficients": meta["coefficients"],
        "reports": reports,
        "models": models,
    }
    APP_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    APP_MODEL_PATH.write_text(json.dumps(bundle, separators=(",", ":")))

    # Parity fixture: real training rows (with their NaNs) plus edited copies that hit unseen mixes.
    s = load_surrogates()
    rng = np.random.default_rng(7)
    rows = df.sample(60, random_state=7)[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
    edited = rows[:10].copy()
    edited[:, FEATURE_COLUMNS.index("soil_n_initial")] = rng.uniform(10, 150, 10)
    edited[:, FEATURE_COLUMNS.index("N_amount")] = rng.uniform(0, 180, 10)
    X = np.vstack([rows, edited]).astype(np.float32)
    y, n = s.predict(X)
    fixture = {
        "rows": [[None if np.isnan(v) else float(v) for v in r] for r in X],
        "yield": [float(v) for v in y],
        "n_uptake": [float(v) for v in n],
    }
    PARITY_FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PARITY_FIXTURE_PATH.write_text(json.dumps(fixture))
    kb = APP_MODEL_PATH.stat().st_size / 1024
    print(f"Wrote {APP_MODEL_PATH} ({kb:.0f} KB) and {PARITY_FIXTURE_PATH} ({len(X)} rows)")


if __name__ == "__main__":
    main()
