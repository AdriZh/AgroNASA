"""Step 1 - Data warehouse & harmonization of the INRAE intercrop dataset.

Builds one training row per (experiment_id, management) plot treatment:

* data_trials      -> soil covariates, initial mineral N, previous crop family
* data_management  -> species/mix, season, mixing pattern, N and irrigation
* data_climate     -> growing-season aggregates between sowing and harvest
* data_traits      -> targets. The table is *long* (variable/value) and
                      intercrops are recorded per component species, so final
                      values are taken at the last measurement date and summed
                      over components to get stand-level totals.

Also derives empirical coefficients (legume N fixation share, N harvest index,
intercrop component shares, season calendars) and writes everything to a
versioned Parquet + JSON artifact.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from .climate import season_features
from .config import LEGUMES, PREVIOUS_CROP_FAMILY, RAW_DATA_DIR, SPECIES, WAREHOUSE_DIR
from .features import FEATURE_COLUMNS, PREV_FAMILIES

KEY = ["experiment_id", "management"]
TARGET_VARS = [
    "biomass_seed",  # t/ha
    "nitrogen_abs_shoot",  # kg N/ha
    "nitrogen_abs_seed",  # kg N/ha
    "nitrogen_abs_shoot_fixation",  # kg N/ha
]


def load_raw(raw_dir: Path = RAW_DATA_DIR) -> dict[str, pd.DataFrame]:
    return {
        name: pd.read_csv(raw_dir / f"data_{name}.csv", low_memory=False)
        for name in ("trials", "management", "traits", "climate")
    }


def _final_traits(traits: pd.DataFrame) -> pd.DataFrame:
    """Final (last-date) value per plot x component species x variable."""
    t = traits[traits["variable"].isin(TARGET_VARS)].copy()
    t["value"] = pd.to_numeric(t["value"], errors="coerce")
    t["measurement_date"] = pd.to_datetime(t["measurement_date"], errors="coerce")
    t = t.dropna(subset=["value"]).sort_values("measurement_date")
    last = t.groupby(KEY + ["species", "variable"], as_index=False).last()
    return last.pivot_table(
        index=KEY + ["species"], columns="variable", values="value", aggfunc="first"
    ).reset_index()


def _climate_block(
    mgmt: pd.DataFrame, climate: pd.DataFrame, coords: pd.DataFrame
) -> pd.DataFrame:
    climate = climate.copy()
    climate["date"] = pd.to_datetime(climate["date"])
    by_exp = {k: g.set_index("date").sort_index() for k, g in climate.groupby("experiment_id")}
    lat = coords.set_index("experiment_id")["plot_lat"].to_dict()
    rows = []
    for _, r in mgmt.iterrows():
        daily = by_exp.get(r["experiment_id"])
        feats = {}
        if daily is not None and pd.notna(r["sow"]) and pd.notna(r["harvest"]):
            feats = season_features(
                daily.loc[r["sow"] : r["harvest"]], lat.get(r["experiment_id"], 45.0)
            )
        rows.append({"experiment_id": r["experiment_id"], "management": r["management"], **feats})
    return pd.DataFrame(rows)


def build_training_matrix(raw_dir: Path = RAW_DATA_DIR) -> tuple[pd.DataFrame, dict]:
    raw = load_raw(raw_dir)
    trials, mgmt, traits, climate = raw["trials"], raw["management"], raw["traits"], raw["climate"]

    # Intercrops have one management row per component species; plot-level
    # fields (mix, season, pattern, N, irrigation, dates) are shared.
    mgmt = mgmt.drop_duplicates(subset=KEY, keep="first").reset_index(drop=True)
    mgmt["sow"] = pd.to_datetime(mgmt["sowing_date"], errors="coerce")
    mgmt["harvest"] = pd.to_datetime(mgmt["harvest_date"], errors="coerce")

    # --- targets: sum components to stand level ---------------------------
    comp = _final_traits(traits)
    comp = comp.merge(mgmt[KEY + ["species_mix", "crop_type"]], on=KEY, how="left")
    expected = mgmt.set_index(KEY)["species_mix"].map(
        lambda m: sum(_mix_has(m, s) for s in SPECIES)
    )
    stand = comp.groupby(KEY).agg(
        yield_t_ha=("biomass_seed", lambda s: s.sum(min_count=1)),
        n_yield_components=("biomass_seed", "count"),
        n_uptake_kg_ha=("nitrogen_abs_shoot", lambda s: s.sum(min_count=1)),
        n_uptake_components=("nitrogen_abs_shoot", "count"),
    )
    stand = stand.join(expected.rename("expected_components"))
    # Only keep stand totals where every component of the mix was measured.
    stand.loc[stand["n_yield_components"] < stand["expected_components"], "yield_t_ha"] = np.nan
    stand.loc[stand["n_uptake_components"] < stand["expected_components"], "n_uptake_kg_ha"] = np.nan
    stand = stand.reset_index()

    # --- features ---------------------------------------------------------
    df = mgmt.merge(trials, on="experiment_id", how="left")
    X = pd.DataFrame(index=df.index)
    for col in ("soil_awc", "soil_pH", "soil_clay", "soil_sand"):
        X[col] = pd.to_numeric(df[col], errors="coerce")
    X["soil_n_initial"] = pd.to_numeric(df["nitrogen_residual"], errors="coerce")
    X["N_amount"] = pd.to_numeric(df["N_amount"], errors="coerce").fillna(0.0)
    X["irrigation_amount"] = pd.to_numeric(df["irrigation_amount"], errors="coerce").fillna(0.0)
    X["is_intercrop"] = (df["crop_type"] == "IC").astype(float)
    X["pattern_within_row"] = (df["mixing_pattern"] == "within_row").astype(float)
    X["pattern_alternate_row"] = (df["mixing_pattern"] == "alternate_row").astype(float)
    X["winter_season"] = (df["crop_season"] == "winter").astype(float)
    for s in SPECIES:
        # species_mix like "wheat_aestivum_pea"; match whole tokens of each species
        X[f"sp_{s}"] = df["species_mix"].map(lambda m, s=s: float(_mix_has(m, s)))
    prev_family = df["previous_crop"].map(lambda p: PREVIOUS_CROP_FAMILY.get(str(p).strip()))
    for f in PREV_FAMILIES:
        X[f"prev_{f}"] = np.where(prev_family.isna(), np.nan, (prev_family == f).astype(float))

    clim = _climate_block(df, climate, trials)
    X = pd.concat([df[KEY], X, clim.drop(columns=KEY)], axis=1)
    X = X.merge(stand[KEY + ["yield_t_ha", "n_uptake_kg_ha"]], on=KEY, how="left")
    X = X[KEY + FEATURE_COLUMNS + ["yield_t_ha", "n_uptake_kg_ha"]]

    coeffs = _empirical_coefficients(comp, mgmt)
    return X, coeffs


def _mix_has(mix: str, species: str) -> bool:
    mix = str(mix)
    if species == "wheat_aestivum" or species == "wheat_turgidum":
        return species in mix
    tokens = mix.replace("wheat_aestivum", "W").replace("wheat_turgidum", "W").split("_")
    return species in tokens


def _empirical_coefficients(comp: pd.DataFrame, mgmt: pd.DataFrame) -> dict:
    """Coefficients derived directly from the trial data."""
    out: dict = {"ndfa_share": {}, "n_harvest_index": {}, "intercrop_share": {}, "season": {}}

    # Share of legume shoot N derived from the atmosphere.
    leg = comp[comp["species"].isin(LEGUMES)].dropna(
        subset=["nitrogen_abs_shoot_fixation", "nitrogen_abs_shoot"]
    )
    leg = leg[leg["nitrogen_abs_shoot"] > 0]
    pooled = float((leg["nitrogen_abs_shoot_fixation"] / leg["nitrogen_abs_shoot"]).clip(0, 1).median()) if len(leg) else 0.7
    for s in LEGUMES:
        sub = leg[leg["species"] == s]
        out["ndfa_share"][s] = (
            float((sub["nitrogen_abs_shoot_fixation"] / sub["nitrogen_abs_shoot"]).clip(0, 1).median())
            if len(sub) >= 5
            else pooled
        )

    # Nitrogen harvest index (seed N / shoot N) -> share of N exported.
    nhi = comp.dropna(subset=["nitrogen_abs_seed", "nitrogen_abs_shoot"])
    nhi = nhi[nhi["nitrogen_abs_shoot"] > 0]
    ratio = (nhi["nitrogen_abs_seed"] / nhi["nitrogen_abs_shoot"]).clip(0, 1)
    pooled_nhi = float(ratio.median()) if len(ratio) else 0.75
    for s in SPECIES:
        r = ratio[nhi["species"] == s]
        out["n_harvest_index"][s] = float(r.median()) if len(r) >= 5 else pooled_nhi

    # Component yield share in intercrops (by species_mix).
    ic = comp[(comp["crop_type"] == "IC")].dropna(subset=["biomass_seed"])
    for mix, g in ic.groupby("species_mix"):
        tot = g.groupby(KEY)["biomass_seed"].transform("sum")
        share = (g["biomass_seed"] / tot.replace(0, np.nan)).groupby(g["species"]).mean()
        out["intercrop_share"][mix] = {k: round(float(v), 3) for k, v in share.dropna().items()}

    # Typical sowing day-of-year and season length.
    m = mgmt.dropna(subset=["sow", "harvest"])
    for season, g in m.groupby("crop_season"):
        out["season"][season] = {
            "sow_doy": int(g["sow"].dt.dayofyear.median()),
            "duration_days": int((g["harvest"] - g["sow"]).dt.days.median()),
        }
    return out


def write_artifact(X: pd.DataFrame, coeffs: dict, out_dir: Path = WAREHOUSE_DIR) -> Path:
    """Write a content-hashed Parquet version and update the `latest` pointer."""
    out_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(pd.util.hash_pandas_object(X, index=False).values.tobytes()).hexdigest()[:10]
    path = out_dir / f"training_matrix_{digest}.parquet"
    X.to_parquet(path, index=False)
    meta = {
        "version": digest,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "rows": int(len(X)),
        "rows_with_yield": int(X["yield_t_ha"].notna().sum()),
        "rows_with_n_uptake": int(X["n_uptake_kg_ha"].notna().sum()),
        "parquet": path.name,
        "coefficients": coeffs,
    }
    (out_dir / "latest.json").write_text(json.dumps(meta, indent=2))
    return path


def load_latest(out_dir: Path = WAREHOUSE_DIR) -> tuple[pd.DataFrame, dict]:
    meta = json.loads((out_dir / "latest.json").read_text())
    return pd.read_parquet(out_dir / meta["parquet"]), meta


if __name__ == "__main__":
    X, coeffs = build_training_matrix()
    path = write_artifact(X, coeffs)
    print(f"Wrote {path} ({len(X)} rows, {X['yield_t_ha'].notna().sum()} with yield)")
    print(json.dumps(coeffs, indent=2))
