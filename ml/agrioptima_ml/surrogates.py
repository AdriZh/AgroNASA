"""Step 2 - Surrogate training & serialization.

Two XGBoost regressors (squared error, max_depth=5, learning_rate=0.08):

* yield_model    : stand seed yield (t/ha)
* nitrogen_model : stand shoot N uptake (kg N/ha); the optimizer turns this
                   into residual soil mineral N via an explicit N balance.

Hyperparameters (n_estimators, min_child_weight, subsample) are picked with
GroupKFold over experiment_id so validation scores reflect unseen sites rather
than leaked plots from the same trial.
"""

from __future__ import annotations

import itertools
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold

from .config import MODEL_DIR
from .data_warehouse import build_training_matrix, load_latest, write_artifact
from .features import FEATURE_COLUMNS

TARGETS = {"yield_model": "yield_t_ha", "nitrogen_model": "n_uptake_kg_ha"}
SPECIES_COLS = [c for c in FEATURE_COLUMNS if c.startswith("sp_")]


def mix_key(sp_matrix: np.ndarray) -> np.ndarray:
    """Species-mix identifier from the multi-hot species block, e.g. '00010000'."""
    return np.array(["".join(str(int(v)) for v in row) for row in sp_matrix])


def fit_priors(keys: np.ndarray, y: np.ndarray, shrink: float = 5.0) -> dict[str, float]:
    """Per-mix mean on log scale, shrunk toward the global mean for sparse mixes."""
    logy = np.log(y)
    g = float(logy.mean())
    s = pd.Series(logy).groupby(keys).agg(["sum", "count"])
    return {k: float((r["sum"] + shrink * g) / (r["count"] + shrink)) for k, r in s.iterrows()} | {"__global__": g}


def prior_for(keys: np.ndarray, priors: dict[str, float]) -> np.ndarray:
    return np.array([priors.get(k, priors["__global__"]) for k in keys])
BASE_PARAMS = dict(objective="reg:squarederror", max_depth=5, learning_rate=0.08, random_state=42, n_jobs=-1)
GRID = {"n_estimators": [150, 300, 500], "min_child_weight": [1, 5], "subsample": [0.8, 1.0]}


def _cv_score(X, y, keys, groups, params: dict, n_splits: int) -> dict:
    """Grouped CV of prior x exp(model residual); priors refit inside each fold."""
    preds = np.zeros_like(y)
    for tr, te in GroupKFold(n_splits=n_splits).split(X, y, groups):
        pri = fit_priors(keys[tr], y[tr])
        m = xgb.XGBRegressor(**BASE_PARAMS, **params)
        m.fit(X[tr], np.log(y[tr]) - prior_for(keys[tr], pri))
        preds[te] = np.exp(prior_for(keys[te], pri) + m.predict(X[te]))
    return {"r2": float(r2_score(y, preds)), "mae": float(mean_absolute_error(y, preds))}


def train_one(df: pd.DataFrame, target: str, n_splits: int = 5) -> tuple[xgb.XGBRegressor, dict]:
    d = df.dropna(subset=[target])
    d = d[d[target] > 0]
    X = d[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
    y = d[target].to_numpy(dtype=np.float64)
    groups = d["experiment_id"].to_numpy()
    keys = mix_key(d[SPECIES_COLS].to_numpy())

    results = []
    for values in itertools.product(*GRID.values()):
        params = dict(zip(GRID.keys(), values))
        results.append((params, _cv_score(X, y, keys, groups, params, n_splits)))
    best_params, best = max(results, key=lambda r: r[1]["r2"])

    # Naive baseline: the species-mix prior alone (no environment).
    base_pred = np.zeros_like(y)
    for tr, te in GroupKFold(n_splits=n_splits).split(X, y, groups):
        base_pred[te] = np.exp(prior_for(keys[te], fit_priors(keys[tr], y[tr])))

    priors = fit_priors(keys, y)
    model = xgb.XGBRegressor(**BASE_PARAMS, **best_params)
    model.fit(X, np.log(y) - prior_for(keys, priors))
    report = {
        "target": target,
        "rows": int(len(d)),
        "experiments": int(len(np.unique(groups))),
        "best_params": best_params,
        "cv_grouped_by_experiment": best,
        "baseline_species_mean": {
            "r2": float(r2_score(y, base_pred)),
            "mae": float(mean_absolute_error(y, base_pred)),
        },
        "log_priors": priors,
    }
    return model, report


def train_and_save(rebuild_warehouse: bool = True, model_dir: Path = MODEL_DIR) -> dict:
    if rebuild_warehouse:
        X, coeffs = build_training_matrix()
        write_artifact(X, coeffs)
    df, wh_meta = load_latest()

    model_dir.mkdir(parents=True, exist_ok=True)
    reports = {}
    for name, target in TARGETS.items():
        print(f"Training {name} on {target} ...")
        model, report = train_one(df, target)
        model.save_model(model_dir / f"{name}.json")
        reports[name] = report
        cv, base = report["cv_grouped_by_experiment"], report["baseline_species_mean"]
        print(
            f"  rows={report['rows']} params={report['best_params']}\n"
            f"  grouped-CV R2={cv['r2']:.3f} MAE={cv['mae']:.2f} "
            f"(species-mean baseline R2={base['r2']:.3f} MAE={base['mae']:.2f})"
        )

    meta = {
        "feature_columns": FEATURE_COLUMNS,
        "warehouse_version": wh_meta["version"],
        "coefficients": wh_meta["coefficients"],
        "reports": reports,
        # Medians used to fill soil covariates the farmer leaves blank.
        "feature_medians": {c: (None if pd.isna(v) else float(v)) for c, v in df[FEATURE_COLUMNS].median().items()},
    }
    (model_dir / "metadata.json").write_text(json.dumps(meta, indent=2))
    return meta


@dataclass
class Surrogates:
    yield_model: xgb.Booster
    nitrogen_model: xgb.Booster
    meta: dict

    def predict(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Stand yield (t/ha) and shoot N uptake (kg N/ha) for each row of X."""
        dm = xgb.DMatrix(X)
        keys = mix_key(X[:, [FEATURE_COLUMNS.index(c) for c in SPECIES_COLS]])
        out = []
        for name, booster in (("yield_model", self.yield_model), ("nitrogen_model", self.nitrogen_model)):
            pri = prior_for(keys, self.meta["reports"][name]["log_priors"])
            out.append(np.exp(pri + booster.predict(dm)))
        return out[0], out[1]


def load_surrogates(model_dir: Path = MODEL_DIR) -> Surrogates:
    if not (model_dir / "metadata.json").exists():
        raise FileNotFoundError(
            f"No trained models in {model_dir}. Run: python -m agrioptima.surrogates"
        )
    boosters = {}
    for name in TARGETS:
        b = xgb.Booster()
        b.load_model(model_dir / f"{name}.json")
        b.feature_names = None  # we pass raw arrays in FEATURE_COLUMNS order
        boosters[name] = b
    meta = json.loads((model_dir / "metadata.json").read_text())
    if meta["feature_columns"] != FEATURE_COLUMNS:
        raise RuntimeError("Saved models were trained on a different feature layout; retrain.")
    return Surrogates(boosters["yield_model"], boosters["nitrogen_model"], meta)


if __name__ == "__main__":
    train_and_save()
