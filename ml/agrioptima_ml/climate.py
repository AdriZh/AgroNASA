"""Growing-season climate features shared by training and inference.

Both the INRAE `data_climate.csv` table and the live NASA POWER feed provide
daily T2M / T2M_MIN / T2M_MAX / PRECTOTCORR / ALLSKY_SFC_SW_DWN, so the same
function turns either into the climate block of the feature vector. PET is
recomputed with Hargreaves-Samani in both cases so train/inference agree.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

CLIMATE_FEATURES = [
    "gs_mean_temp_c",
    "gs_precip_mm",
    "gs_pet_mm",
    "gs_water_balance_mm",
    "gs_gdd",
    "gs_heat_days",
    "gs_radiation",
]


def hargreaves_pet(
    tmin: np.ndarray, tmax: np.ndarray, doy: np.ndarray, lat_deg: float
) -> np.ndarray:
    """Hargreaves-Samani reference evapotranspiration (mm/day)."""
    lat = np.deg2rad(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    decl = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(lat) * np.tan(decl), -1.0, 1.0))
    ra = (24 * 60 / np.pi) * 0.0820 * dr * (
        ws * np.sin(lat) * np.sin(decl) + np.cos(lat) * np.cos(decl) * np.sin(ws)
    )  # MJ m-2 day-1
    tmean = (tmax + tmin) / 2
    pet = 0.0023 * 0.408 * ra * (tmean + 17.8) * np.sqrt(np.clip(tmax - tmin, 0, None))
    return np.clip(pet, 0, None)


def season_features(daily: pd.DataFrame, lat: float) -> dict[str, float]:
    """Aggregate a daily frame (DatetimeIndex) covering one growing season.

    Expects columns T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, ALLSKY_SFC_SW_DWN.
    """
    if daily.empty:
        return {k: np.nan for k in CLIMATE_FEATURES}
    doy = daily.index.dayofyear.to_numpy()
    pet = hargreaves_pet(
        daily["T2M_MIN"].to_numpy(float), daily["T2M_MAX"].to_numpy(float), doy, lat
    )
    t = daily["T2M"].to_numpy(float)
    precip = float(daily["PRECTOTCORR"].sum())
    return {
        "gs_mean_temp_c": float(np.nanmean(t)),
        "gs_precip_mm": precip,
        "gs_pet_mm": float(np.nansum(pet)),
        "gs_water_balance_mm": precip - float(np.nansum(pet)),
        "gs_gdd": float(np.nansum(np.clip(t, 0, None))),
        "gs_heat_days": float((daily["T2M_MAX"] > 30).sum()),
        "gs_radiation": float(daily["ALLSKY_SFC_SW_DWN"].mean()),
    }
