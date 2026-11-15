# Field Shift — pitch kit

## Assets

| Asset | Where | Notes |
|---|---|---|
| 30-second video | `public/media/field-shift-30s.mp4` · in-app *30-second video* | 1080p30, narrated, captions burned in, −14 LUFS |
| Presentation | in-app *Presentation* (`#/pitch`) | 12 animated slides or the 7-slide submission cut; **PDF** button exports one slide per page |
| Poster frame | `public/media/field-shift-poster.jpg` | thumbnail for the submission page |

Slides on the problem, cash gap, sowing science, decision funnel and live result use **live data from whichever farm is selected** — pick the Senegal or Kazakhstan demo before presenting.

### Video script (as narrated)

| Time | Scene | Narration |
|---|---|---|
| 0.0 s | Hook — Earth & satellite | “Every season, farmers bet their savings on the weather.” |
| 3.4 s | NASA POWER rain bars, Bambey 2001–2025 | “Near Bambey, Senegal, NASA records show season rain swinging from three hundred to nearly a thousand millimetres.” |
| 10.2 s | Cash gap bar vs spendable line | “And the usual plan often costs more than the cash on hand.” |
| 13.6 s | Data fusion: NASA tiles + farmer tiles → engine | “Field Shift fuses twenty-five years of NASA Earth data with what farmers know: their crops, soil and budget.” |
| 20.1 s | 25-season replay grid + plan cards | “It replays every past season to find rotations they can actually afford, and explains why.” |
| 26.2 s | Logo close | “Field Shift. From space to soil.” |

The Space Apps submission guide (checked 14 Nov 2026) allows **a video ≤ 30 s or a deck of ≤ 7 slides** including the title.
Re-check the current guide before submitting.

## Speaker notes (≈ 2 min live, one line per slide for a 30 s video)

| # | Slide | Say (live) | 30-second video line |
|---|---|---|---|
| 1 | Title | “Field Shift turns 25 years of NASA Earth data plus what a farmer already knows into two-season rotation plans they can actually afford.” | “Field Shift: NASA climate history + your budget → rotation plans you can afford.” |
| 2 | Problem | “At Bambey, Senegal, NASA POWER shows season rainfall from 309 to 976 mm — 3.2×. An average year hides that. And an agronomically ideal plan you can’t fund before planting isn’t a plan.” | “Rain varies 3× year to year; cash is tight.” |
| 3 | Solution | “Four short steps: farm & history, resources, compare, evidence. One question: which plans can I realistically consider and afford?” | “Enter your field, history and budget.” |
| 4 | Data fusion | “NASA POWER daily weather and soil wetness, GIBS satellite layers; plus farmer records, SoilGrids soil, local prices, rule packs and a 16-day forecast. The engine is published science: FAO-56, FAO-66, Sivakumar onset.” | “NASA POWER, SMAP, MODIS, IMERG + SoilGrids + your records.” |
| 5 | Live result | “At Bambey the usual groundnut→millet plan costs 454,500 XOF, 74,500 over the 380,000 budget, with 2 of 24 season pairs severe (5 if drier and hotter). Sesame→millet costs 327,000, leaves 53,000 and has 0 of 24 severe (2 drier and hotter). Sesame→sorghum costs 337,200, leaves 42,800, 1 of 24 (4).” | “Usual plan over budget → two that fit, with risk and reasons.” |
| 6 | Hindcast | “We checked the model against real FAOSTAT national yields, detrended. Kazakhstan wheat r = 0.59 over 24 years; Senegal millet 0.18 and groundnut 0.20, weak because one grid cell is compared with a whole country. All four known drought years, Senegal 2002 and 2011 and Kazakhstan 2010 and 2012, fall in the model’s driest third. 135 automated tests also reproduce the archived NASA query and the FAO-56 textbook example.” | “Checked against real harvests: known drought years land in the driest third.” |
| 7 | Impact | “Works anywhere POWER exists, demo farms fully offline, near-zero cost. Next: a 90-day pilot with farmers and a local agronomist.” | “Global, offline, free — pilot next.” |

The table above follows the 7-slide submission cut (Title, Problem, Solution, Data fusion, Live result, Hindcast, Impact). The full 12-slide story adds: Cash gap, Who it serves, Science 1 (sowing date), Science 2 (soil-water bucket), Decision funnel.

## Live demo script (90 s)

1. **Overview** hero: one line on rain swinging 309 to 976 mm → click **Senegal demo**.
2. **Compare** (one hero number per card): usual Groundnut→Millet 454,500 XOF, **74,500 over** the 380,000 budget; Best fit 327,000 (53,000 left, 0 of 24 severe); Option B 337,200 (42,800 left, 1 of 24).
3. **What-if → “Drier & hotter”** (−15 % rain, +2 °C): the usual plan goes from 2 to 5 of 24 severe; Best fit goes to 2. The replay re-runs live in ~30–50 ms.
4. Switch to the **Kazakhstan demo** (Kostanay, 200 ha), **Drier & hotter**: the wheat monoculture (over budget, flagged as a monoculture) jumps **9 → 16 of 24** severe; the fallow break holds (Fallow→Rapeseed 2 → 6, Fallow→Wheat 5 → 7). The fallow trades income for lower cost and risk; modeled net is on the cards.
5. **Evidence → hindcast vs FAOSTAT harvests**: Kazakhstan wheat r = 0.59, Senegal weak (r ≈ 0.2) and why; all four known drought years in the driest third.
6. **Share** button: the scenario is in the URL, so anyone opens the same view.

## Prepared links

Share links can be made on the spot with the **Share** button (top bar). Make one for each demo farm, with and without Drier & hotter, before presenting. The live app is https://adrizh.github.io/AgroNASA/. The closing slide carries a QR code to it.

## Judging criteria map

| Criterion | Where Field Shift answers it |
|---|---|
| **Influence** | Smallholders choosing rotations under rain and cash uncertainty; global coverage via NASA POWER; offline & free to run. |
| **Creativity** | Affordability-first rotation comparison with coherent historical replay of *pairs* of seasons, cash-timing checks and reason codes — not another yield dashboard. |
| **Validity** | Hindcast vs real FAOSTAT yields (Kazakhstan wheat r = 0.59; all four known drought years in the driest third); calibration citations (FAO-56, FAO-33 stage-wise Ky, FAO-66, Hock 2003 snowmelt, Sivakumar 1988, Saxton & Rawls 2006); 135 automated tests, archived queries, evidence register; no causal or yield guarantees; labeled synthetic values. |
| **Relevance** | Directly answers the Field Shift brief: rotation exploration with NASA observations, local soil/crop information and farmer priorities. |
| **Presentation** | Live URL (https://adrizh.github.io/AgroNASA/) plus a QR on the closing slide, built-in 7-slide pitch with live data, printable report, 90-second demo path. |
