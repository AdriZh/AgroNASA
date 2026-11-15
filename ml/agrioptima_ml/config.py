"""Training-time configuration for the INRAE soil-N / rotation surrogates.

Runtime agronomic priors (pre-crop factors, N balance, emissions) live in the
TypeScript engine: src/engine/agrioptima/params.ts.
"""

from __future__ import annotations

import os
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = ML_DIR.parent
RAW_DATA_DIR = Path(os.environ.get("INRAE_DATA_DIR", ML_DIR / "raw_data"))
ARTIFACT_DIR = ML_DIR / "artifacts"
WAREHOUSE_DIR = ARTIFACT_DIR / "warehouse"
MODEL_DIR = ARTIFACT_DIR / "models"
# Compact model bundle loaded by the web app, and the Python/TypeScript parity fixture.
APP_MODEL_PATH = REPO_DIR / "src" / "data" / "agrioptima" / "model.json"
PARITY_FIXTURE_PATH = REPO_DIR / "tests" / "fixtures" / "agrioptima_parity.json"

# INRAE species in the training corpus (multi-hot feature block; intercrops light up two).
SPECIES = [
    "wheat_aestivum",
    "wheat_turgidum",
    "barley",
    "pea",
    "fababean",
    "lentil",
    "chickpea",
    "lupin",
]
LEGUMES = {"pea", "fababean", "lentil", "chickpea", "lupin"}

# Free-text previous_crop values in data_trials.csv -> crop family.
PREVIOUS_CROP_FAMILY = {
    "wheat": "cereal", "winter_wheat": "cereal", "durum_wheat": "cereal",
    "barley": "cereal", "winter_barley": "cereal", "spring_barley": "cereal",
    "maize": "cereal", "sorghum": "cereal",
    "clover_grass": "legume", "red clover": "legume",
    "sunflower": "oilseed", "mustard": "oilseed",
    "ray_grass": "grass",
}
