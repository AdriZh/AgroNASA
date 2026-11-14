# Fieldwise v2: improvement plan and build guide

NASA Space Apps 2026 · Challenge 6 "Field Shift" · team working document

## 1. What we are building (one sentence)

A farmer picks their field, and Fieldwise uses 25 years of NASA weather to show **which crops to plant, when to plant them, and a 3-year rotation plan**, each with a simple "good years out of 10" score and an outlook for next season that starts from today's soil moisture.

## 2. What v1 (the ChatGPT prototype) did, and what changes

| Area | Fieldwise v1 | Fieldwise v2 (this repo, `app/`) |
|---|---|---|
| NASA data | POWER rain + temperature, only the **last 2 years** replayed | POWER 2001 to last week (25+ seasons): rain, temperature, **root-zone soil moisture, solar radiation, humidity, wind** |
| Water model | 30 cm bucket, rain-capture coefficients, made-up demand curve | FAO-56 Penman–Monteith evaporation + daily FAO-56 soil-water balance + FAO-33 yield response |
| "Prediction" | none (two replays) | **Next-season outlook**: today's NASA soil moisture + every past weather year replayed → "good in 18 of 26 seasons" |
| Planting date | fixed "1st of month" typed by user | **Best sowing date found automatically** from the NASA record (frost, heat, rain) |
| Region | Iowa only (USDA soil = US only) | Anywhere: NASA POWER and SoilGrids are global; 3 ready examples (Kazakhstan, Senegal, Iowa) |
| Inputs | 16 number fields (AWC mm/mm, N price, heat units…) | 4 taps: last crop, crops I can grow and sell, soil type by touch, what matters most |
| Output | $ margin tables, formulas | 3 plan cards with traffic lights, a growing calendar, 10-year pictogram, plain reasons |
| Language | English | English + Russian (structure ready for Kazakh, French, Wolof) |
| Low literacy | text-heavy | icons + words, large buttons (52 px+), **read-aloud button**, colour never used alone |
| Offline | needs network | demo locations bundled; app runs with no network after loading |

Kept from v1: the 3-step flow, comparing "keep as now" against alternatives, the honest "not a forecast" labels.

Dropped for now: money in dollars. Prices are not reliable for any pilot region yet, so v2 shows a relative **income** rating (crop value 1–3 × expected harvest). Real local prices are step 6 in the build list.

## 3. How NASA data is used

| NASA parameter (POWER, daily) | What the farmer sees | How it is used inside |
|---|---|---|
| `PRECTOTCORR` rain | Monthly rain bars, wettest months, driest and wettest year | Daily soil-water balance |
| `T2M`, `T2M_MAX`, `T2M_MIN` | Last spring frost, first autumn frost, hot days, warming trend | Sowing-date search, growing degree days, frost damage, heat at flowering |
| `GWETROOT` root-zone soil wetness | "Soil now is drier/wetter than normal" gauge | Starting soil water of each season; today's anomaly drives the next-season outlook |
| `ALLSKY_SFC_SW_DWN`, `RH2M`, `WS2M` | (hidden) | FAO-56 reference evaporation (crop water demand) |

Plus ISRIC SoilGrids (sand, clay, organic carbon) → plant-available water (Saxton & Rawls 2006). The farmer can override it by touch ("falls apart in your hand / holds shape / sticky").

### What "prediction" means here, honestly

1. **Next-season outlook (built).** Start from NASA's current soil moisture, then run the planned crop through every past weather year. This is the standard "ensemble from history" method (like ESP in hydrology). We say "in 18 of 26 past weathers", never "it will rain 300 mm".
2. **What-if climate (built).** Buttons for +2 °C and −20 % rain re-run everything.
3. **Next steps for real forecasts (not built):**
   - NASA GMAO **GEOS-S2S** seasonal forecasts: weight the past years that look like the forecast season.
   - NASA **NEX-GDDP-CMIP6** downscaled climate projections for 2030–2050 plans.
   - **SMAP L4** soil moisture (9 km) and **IMERG** rain (10 km) for sharper "soil now" and rain; these need a free Earthdata login.
   - **HLS / MODIS NDVI** greenness to detect the crop calendar and bare months on the actual field.

### Update (v2.1): the forecast formula, and what changed after review

- **Forecast formula (built).** For the first crop of the selected plan, `ŷ = ȳ + Σ βᵢ·zᵢ`: ridge regression of the season outcome index on NASA predictors observed the same number of days before sowing in each past year: root-zone soil moisture (`GWETROOT`), profile soil moisture (`GWETPROF`), 90-day precipitation (`PRECTOTCORR`) and snow depth (`SNODP`). Coefficients are constrained to the physical sign (more water can't lower a water-limited outcome). Skill is measured by leave-one-year-out cross-validation as `1 − MSE/MSE(climatology)`. The forecast is shown only if skill > 0.1; otherwise the app shows the historical range.
- **Skill by lead time.** At the Akmola pilot, skill for spring wheat rises from about 0.1 six months before sowing to about 0.3 at 3 months and about 0.4 at sowing. The app plots this, so judges can see it is an honest, validated forecast.
- **NASA climate projections.** POWER has a beta projection API (NEX-GDDP-CMIP6, SSP1-2.6/2-4.5/3-7.0). It returned values for a test point in Virginia but only missing values (−999) for Kazakhstan and Senegal on 14 Nov 2026, so the app uses +2 °C and −20 % rain scenarios instead.
- **Review points adopted.** Baseline = the farmer's usual rotation (last two seasons), not continuous monoculture. Irrigation asked as Yes / No / Not sure, and irrigation water need is reported for typical and dry years. Data availability is shown per variable (radiation lags about 2 days). Professional chart style: hairline grids, real axes, tables with tabular figures, no emoji.
- **Review points not adopted, and why.** Fertiliser application records and money budgets: no verified local price data for any pilot region, and long forms lose low-tech users. The plan keeps a relative income index and says "confirm prices locally". Open-Meteo 16-day forecasts: not NASA data and not needed for a plan made months before sowing.

## 4. Design rules for farmers who rarely use apps

1. **One question per card.** Big text (18 px), big buttons, nothing to type except optional coordinates.
2. **Pictures and words together.** Every crop has an icon. Every rating has an icon, a word (High/Medium/Low) and bars, so it works without colour and without reading numbers.
3. **Count years, not percentages.** "Good harvest in 7 of 10 years" with 10 circles (✓ ~ ✕).
4. **Calendar, not tables.** Months across, years down; green = crop in field, brown hatched = bare soil, blue = snow.
5. **Listen button.** Reads the plan aloud in the chosen language (browser speech, no internet needed once loaded).
6. **Share to the agronomist.** "Copy plan" produces a short text for WhatsApp or SMS.
7. **Always say what to check locally:** seed, buyers and price, last herbicide, local pests.

## 5. Build list for the rest of the hackathon

Status: steps 1–4 are done in this repository. Owners are suggestions.

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | Engine: FAO-56 water balance, sowing search, rotations, outlook (`app/engine.js`) | data | ✅ runs < 1 s per site |
| 2 | Crop pack, 14 crops (`app/crops.js`) | agronomy | ✅ values from FAO-56/33; assumed values flagged |
| 3 | 3-step UI, calendar, outlook, what-if, read-aloud, EN/RU (`app/`) | front end | ✅ works on phone and desktop, light and dark |
| 4 | Bundled NASA data for 3 example fields (`tools/build_presets.py`) | data | ✅ 2001 → 9 Nov 2026 |
| 5 | **Choose the pilot region and check the crop list** with an agronomist or farmer | whole team | crop list, sowing windows and rotation rules signed off |
| 6 | Local prices → real income in tenge / CFA instead of the 1–3 value | business | dated prices for the 5–8 pilot crops |
| 7 | Deploy to GitHub Pages and test live NASA download from a phone | front end | public link works signed-out |
| 8 | Test with 3 people (farmer, student, older relative): can they say what the plan is? | design | notes written, fixes made |
| 9 | Kazakh (or French/Wolof) translation, checked by a native speaker | design | strings in `app/i18n.js` |
| 10 | 30-second video or 7 slides; AI-use declaration | story | submitted before 23:59 |

If time runs short, cut in this order: 9, 6, live download (keep bundled examples).

### 30-second demo script

1. (0–5 s) "Farmers plant the same crop every year, and dry years wipe them out."
2. (5–12 s) Tap Akmola → NASA shows rain, frost dates, and that the soil is drier than normal now.
3. (12–22 s) Tap last crop: wheat → "Make my plan" → three plans; wheat-every-year gives a good harvest in 1 of 10 years; the new plan gives 4 of 10, with healthier soil.
4. (22–30 s) Calendar and next-season outlook, press 🔊 Listen. "25 years of NASA data, in a farmer's language."

## 6. How to run and deploy

```bash
# refresh the bundled NASA data (needs internet)
python3 tools/build_presets.py
# open locally
python3 -m http.server -d app 8000   # then open http://localhost:8000
```

GitHub Pages: repository Settings → Pages → deploy from branch, folder `/app` (or copy `app/` to `docs/`). Live NASA download works from a normal website because NASA POWER allows browser requests.

## 7. Limits to state in the pitch

- NASA POWER is about 50 km per pixel: it describes the district, not one field.
- The yield score is water- and temperature-limited only; pests, nitrogen and prices are not modelled.
- Rotation effects (+10 % after a legume, −10 % same family, −15 % same crop) are simplified screening rules.
- Ky for lentil, chickpea, cowpea, millet, barley, canola and flax is assumed; an agronomist must check it.
- Results replay past weather. They are not a forecast and not advice to follow without local review.
