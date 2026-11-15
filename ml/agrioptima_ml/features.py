"""Single source of truth for the surrogate feature vector layout."""

from __future__ import annotations

from .climate import CLIMATE_FEATURES
from .config import SPECIES

SOIL_FEATURES = ["soil_awc", "soil_pH", "soil_clay", "soil_sand", "soil_n_initial"]
MANAGEMENT_FEATURES = [
    "N_amount",
    "irrigation_amount",
    "is_intercrop",
    "pattern_within_row",
    "pattern_alternate_row",
    "winter_season",
]
SPECIES_FEATURES = [f"sp_{s}" for s in SPECIES]
PREV_FAMILIES = ["cereal", "legume", "oilseed", "grass"]
PREV_FEATURES = [f"prev_{f}" for f in PREV_FAMILIES]

FEATURE_COLUMNS = (
    SOIL_FEATURES + MANAGEMENT_FEATURES + CLIMATE_FEATURES + SPECIES_FEATURES + PREV_FEATURES
)
FEATURE_INDEX = {c: i for i, c in enumerate(FEATURE_COLUMNS)}
