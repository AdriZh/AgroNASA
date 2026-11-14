# Archived source data

| File | What it is |
|---|---|
| `04_NASA_POWER_Bambey_2001_2025.json` | Raw NASA POWER response for the planning pack's D1 query (PRECTOTCORR, T2M_MAX, T2M_MIN; 14.71 N, 16.46 W; 2001–2025; LST). Byte-identical size to the team's Drive copy (450,047 bytes). Used by the regression tests. |
| `soil_bambey.json`, `soil_kostanay.json` | Raw ISRIC SoilGrids 2.0 responses (0–60 cm) for the two demo points. |

The bundled app datasets in `src/data/demo/*.json` were built with `npm run data` from full POWER responses
(9 parameters, 2001-01-01 → 2026-11-11) retrieved 14 Nov 2026. To refresh, download the queries printed on the
Evidence → Climate record tab into `data/raw/{bambey,kostanay}.json` and `data/raw/soil_{bambey,kostanay}.json`, then run `npm run data`.
