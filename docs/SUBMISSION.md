# Field Shift — submission kit (copy-paste)

**Live demo:** https://adrizh.github.io/AgroNASA/  ·  **Repo:** https://github.com/AdriZh/AgroNASA  ·  **Challenge:** Field Shift: Adapting Farms with NASA Data (NASA Space Apps 2026)

## Short description (~150 words)

Every season, smallholders bet their savings on the weather, and the "best" rotation is useless if they cannot pay for it before planting. **Field Shift** is a free web planner that answers one question: *which next two-season crop rotations can I realistically afford, and how do they hold up in a bad year?*

It replays 25 years (2001–2025) of daily **NASA POWER** weather for the farmer's grid cell through the FAO-56 soil-water balance and FAO-66 yield response, so every candidate rotation is tested against 24 real consecutive season pairs. A **drier & hotter stress test** re-runs that replay live. NASA satellite layers (MODIS NDVI, SMAP soil moisture, GPM IMERG, GRACE, EONET) add field context. Plans are ranked only if they fit the farmer's cash, with dated cash-timing checks, sourced rotation rules (no monocultures) and a plain reason for every result. It works anywhere on Earth; the two demo farms work offline.

## Longer description

**Problem.** Rotation advice usually optimises yield and ignores the two things that decide what a smallholder actually plants: cash before sowing and year-to-year rain. At Bambey, Senegal, NASA POWER shows growing-season rain ranging 3.2× (309–976 mm) over 2001–2025; an "average year" hides that, and the usual groundnut → millet plan costs 74,500 XOF more than the demo farmer can spend.

**What it does.** Four steps — farm & history, resources, compare, evidence. Field Shift compares the farmer's usual plan with up to two feasible alternatives and shows, per plan: cash cost against the budget (one big number), money due before the first sowing, modeled harvest range, modeled net, and severe water-stress risk from replaying every past season pair. A what-if panel scales rain and adds warming to the NASA record and re-runs the replay in ~50 ms. Every excluded rotation lists the rule that blocks it. A shareable link encodes the whole scenario.

**NASA data.** NASA POWER daily (PRECTOTCORR, T2M, T2M_MAX/MIN, RH2M, WS2M, ALLSKY_SFC_SW_DWN; GWETROOT/GWETTOP) drives the sowing-date rules, ET₀, water balance and replay. NASA GIBS layers (MODIS NDVI and land cover, SMAP L4, GPM IMERG, MODIS LST, GRACE/GRACE-FO) and NASA EONET give satellite context at the clicked pixel. Non-NASA: ISRIC SoilGrids, FAOSTAT prices and exchange rates (240 countries), Open-Meteo forecast, OpenStreetMap.

**Science.** FAO-56 Penman–Monteith ET₀, FAO-56 single-Kc root-zone balance, FAO-66 Ky yield response, Sivakumar (1988) onset in the tropics, temperature/frost rules in temperate zones; 16 regional rule packs plus a global screening fallback. Deterministic — no LLM in the decision path.

**Honesty.** Demo prices are labelled synthetic; rule packs are labelled "demo-unreviewed" until a local agronomist signs off; risk is a replay of past seasons, not a forecast; we never claim yields, causes or doses.

**Built with.** React + TypeScript, Recharts, Leaflet; automated tests (engine, science reference cases, security); static site on GitHub Pages; strict Content-Security-Policy; all farm data stays in the browser.

**Next.** A 90-day pilot with farmers and an extension agronomist in one region; replace synthetic prices with dated local quotes; reviewed rule packs.

## AI disclosure (if the form asks)

AI assistance (Claude) was used for research synthesis, documents and code. Recommendations are produced by fixed, published rules and models — no AI in the decision path. NASA does not endorse this project.
