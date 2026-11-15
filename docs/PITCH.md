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

## Speaker notes (≈ 2 min live)

| # | Slide | Say (live) |
|---|---|---|
| 1 | Title | “Field Shift, from space to soil. We are Team Minervitos.” |
| 2 | Problem & market | “At Bambey, Senegal, season rain swings 3.2× between years, and farmers pay for seed and fertilizer before they know which year it is. Smallholders face a USD 170 billion yearly finance gap (ISF 2019), and in many countries one extension agent serves over 1,000 farmers (Fabregas et al., Science 2019). 608 million farms, 84% under 2 ha, are the market.” |
| 3 | Solution | “One question: which next plans can I afford, and how do they hold up in a bad year? Here the usual groundnut → millet plan is 74,500 XOF over budget; two alternatives fit, with their NASA-replayed risk.” |
| 4 | How it works | “NASA POWER daily weather since 2001, SoilGrids, FAOSTAT prices and the farmer’s records go into published science: Sivakumar onset, FAO-56 water balance, FAO-66 yield response, a cash check at every due date. A static React + TypeScript app, no backend, 180 automated tests.” |
| 5 | Why better | “Others show what grows; we show what you can afford. The closest tool, E-PICSA, shows rainfall history and budgets but leaves the risk to people. We compute it for every plan, anywhere on Earth, with every number traceable.” |
| 6 | What comes next | “Planned, not built yet: every market in its own language, an AI assistant that explains plans using only the engine’s numbers, voice for farmers who don’t read easily, and a live data dashboard for co-ops, NGOs and ministries. First, a 90-day pilot with an NGO and an agronomist.” |
| 7 | Why us | “Zhamilya and Ruslan build software for start-ups, Francisco brings TUM engineering and agri-PV experience, Iuliia business and venture capital, Ayu taught agricultural education in Laos, Fernando is an astronomy olympiad medallist. Scan the QR to try it.” |

The deck is exactly 7 slides: Title, Problem & market, Solution, How it works, Why better, What comes next, Why us.

## Live demo script (90 s)

1. **Overview (0–8 s).** "Which crop next, and can you afford it?" The best-fit card shows cost vs budget, NASA-replay risk and the drier & hotter result. Click **Open Senegal demo**.
2. **Compare, Senegal (8–25 s).** Usual Groundnut → Pearl millet: **454,500 XOF, 74,500 over** the 380,000 budget (two-season cash, no harvest income or credit assumed). Best fit Sesame → Pearl millet: 53,000 left, 0 of 24 NASA season pairs severe. Click **Drier & hotter** (−15 % rain, +2 °C): usual plan 2 → 5 of 24.
3. **Kazakhstan — the "never a dead end" moment (25–60 s).** Switch to the Kazakhstan demo. Usual Spring wheat → Spring wheat: **3,000,000 KZT over**, flagged as a monoculture, 9 of 24 severe (16 under drier & hotter). Best fit Fallow → Spring rapeseed fits with 11.3 M left. Scroll to **Near misses**: "Spring rapeseed → Oilseed flax — smallest change **+280,000 KZT budget**". Click **Try it** → it loads into **Try my own plan**, evaluated live by the same engine. Change season 2 to Field pea → the card shows its NASA risk honestly. Switch the **ranked by** goal to **soil benefit** → the plans re-rank.
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
