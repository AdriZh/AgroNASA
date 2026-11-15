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
| 5 | Live result | “At Bambey the usual groundnut→millet plan costs 454,500 XOF, 74,500 over the 380,000 budget, with 2 of 24 season pairs severe (5 if drier and hotter). Sesame→cowpea costs 353,250, leaves 26,750, has 0 of 24 severe (2 drier and hotter) and the highest expected profit, about 744,000 XOF. Sesame→millet costs 327,000, leaves 53,000, 0 of 24 (2), about 684,000.” | “Usual plan over budget → two that fit, ranked by discounted expected profit, with risk and reasons.” |
| 6 | Hindcast | “We checked the model against real FAOSTAT national yields, detrended. Kazakhstan wheat r = 0.59 over 24 years; Senegal millet 0.18 and groundnut 0.20, weak because one grid cell is compared with a whole country. All four known drought years, Senegal 2002 and 2011 and Kazakhstan 2010 and 2012, fall in the model’s driest third. 135 automated tests also reproduce the archived NASA query and the FAO-56 textbook example.” | “Checked against real harvests: known drought years land in the driest third.” |
| 7 | Impact | “Works anywhere POWER exists, demo farms fully offline, near-zero cost. Next: a 90-day pilot with farmers and a local agronomist.” | “Global, offline, free — pilot next.” |

The table above follows the 7-slide submission cut (Title, Problem, Solution, Data fusion, Live result, Hindcast, Impact). The full 12-slide story adds: Cash gap, Who it serves, Science 1 (sowing date), Science 2 (soil-water bucket), Decision funnel.

## Live demo script (90 s)

1. **Overview (0–8 s).** "Which crop next, and can you afford it?" The best-fit card shows cost vs budget, NASA-replay risk and the drier & hotter result. Click **Open Senegal demo**.
2. **Compare, Senegal (8–25 s).** Usual Groundnut → Pearl millet: **454,500 XOF, 74,500 over** the 380,000 budget (two-season cash, no harvest income or credit assumed). Best fit Sesame → Cowpea: 26,750 left, 0 of 24 NASA season pairs severe, **expected profit ≈ 744,000 XOF** (shown on every card, with bad and good year). Click **Drier & hotter** (−15 % rain, +2 °C): usual plan 2 → 5 of 24.
3. **Kazakhstan — the "never a dead end" moment (25–60 s).** Switch to the Kazakhstan demo. Usual Spring wheat → Spring wheat: **3,000,000 KZT over**, flagged as a monoculture, 9 of 24 severe (16 under drier & hotter). Best fit Chickpea → Fallow fits with 9.0 M left and the highest expected profit (≈ 51 M KZT). Scroll to **Near misses**: "Chickpea → Oilseed flax — smallest change **+2,560,000 KZT budget**". Click **Try it** → it loads into **Try my own plan**, evaluated live by the same engine. Change season 2 to Field pea → the card shows its NASA risk honestly. Open **Why this result**: the ranking value is the plan's discounted cash flows (each cost from its due date, each harvest from its sale date) plus the farmer's adjustments, line by line. Back in Senegal, drag **Crops I know** to the top → the familiar Sesame → Pearl millet becomes Best fit.
   - *Optional (+15 s, if time):* scroll to **When is your field free?** → preset **Skipped the main season · 15 Jul → 30 Nov**: in Kostanay every cash crop is killed by autumn frost (0–7 of 25 seasons) and mustard green manure matures 25/25 → "soil benefit, little or no cash"; switch to the Senegal demo, same window → millet, sorghum, sesame, cowpea mature 25/25. Same window, different answers — driven by NASA data.
4. **Evidence (60–78 s).** Hindcast: modeled water-limited yield vs **real FAOSTAT national yields** — Kazakhstan wheat r = 0.59, the 2010 and 2012 droughts caught. "One grid cell vs a whole country — we say so."
5. **Close (78–90 s).** **Share** → link copied (opens this exact scenario). "Any place NASA POWER covers; demo farms work offline; free to run."

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
