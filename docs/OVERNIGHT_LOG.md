# Overnight log — 2026-11-15

## Live URL

**https://adrizh.github.io/AgroNASA/** — live and verified. Every push to `main` runs the tests and build, publishes `dist/` to the `gh-pages` branch, then a CI step fetches the live URL until it serves the new `index-*.js` and checks every asset returns HTTP 200 (e.g. runs `43691539548`, `43718370424`). This session itself cannot open `*.github.io` (network policy), so the in-browser checks ran on the identical build locally (Playwright smoke test: both demos, every tab, a custom farm, online and fully offline, 0 console errors).

> ⚠️ **Deadline:** search results for the official 2026 page say submissions close **Sun 15 Nov 2026, 23:59 local time** (judging from 16 Nov). spaceappschallenge.org returned HTTP 503 when checked on 2026-11-15, so this is unverified. **Submit today.**

## What changed

- **Deployed:** GitHub Pages via the `gh-pages` branch, tested + live-verified on every push to `main`.
- **Design system v3** (`docs/DESIGN.md`): calm "NASA meets field notebook" look, light/dark mode with toggle, one hero number per plan card (cash cost vs budget), one-line honest caveat + Details, new landing hero ("Which crop next, and can you afford it?") with a live best-plan card showing cost, NASA-replay risk and the drier & hotter result. Pitch slides and printable report on the same tokens.
- **Rotation validity:** monocultures excluded (MONOCULTURE), same-family warning, break-crop bonus; usual plan always shown and flagged.
- **Budgets & prices:** realistic placeholder budget for new farms (≈ 90 % of the usual plan, labelled "Placeholder budget · set yours"); FAOSTAT price outlier guard; US Corn Belt + Brazil Cerrado packs (16 regional packs + global).
- **Wow feature:** live **What-if climate stress test** (rain −30…+20 %, +0…+3 °C) re-running the NASA replay in ~30–50 ms; **shareable scenario links**.
- **Science:** water-balance root-cause fixes (off-season snow/recharge, deep storage, FAO-33 stage Ky, failed-onset seasons) and a **hindcast against real FAOSTAT national yields** (Kazakhstan wheat r = 0.59; Senegal r ≈ 0.2, honestly labelled) on Evidence and slide 6.
- **Robustness:** timeouts and fallbacks on every network call; SoilGrids offline → typical texture values (amber label); demo farms fully offline.
- **Performance:** code-split; landing first load 527 → ~395 kB gzip.
- **Security:** `docs/SECURITY.md` — npm audit 0 (vite 6 / vitest 4), validated share links/imports/API data, CSP, noopener, least-privilege SHA-pinned workflow.
- **Pitch:** 7-slide cut with live mini-compare (slide 3), risk + stress test on the live result (slide 5), hindcast (slide 6), live URL + QR (slide 7). README with screenshots; copy-paste submission text in `docs/SUBMISSION.md`.
- **Tests:** 37 → 135+, all green.

## Space Apps rules (checked 2026-11-15; official site down, secondary sources)

- Video ≤ 30 s **or** ≤ 7 slides including the title slide, hosted externally (2025 guide; 2020 agrees). 2026 guide reportedly released 13 Nov. Re-check the Project tab before submitting.
- Criteria: Impact, Creativity, Validity, Relevance, Presentation, scored 1–5 each (judging-awards-guide page; definitions from the 2022 guide PDF).

## Decisions made


- **Deploy via `gh-pages` branch, not the Actions Pages artifact.** Pages was not enabled; `actions/deploy-pages` returned 404. Pushing a `gh-pages` branch auto-enabled Pages (the "pages build and deployment" run succeeded at 07:44 UTC). The workflow now tests, builds and force-pushes `dist/` to `gh-pages` on every push to `main`.
- **Kept `base: './'`** instead of `/AgroNASA/`: with hash routing, relative asset paths work on the Pages sub-path and on any other static host, and the built site was verified locally with Playwright (0 console errors, both demos, all tabs).
- **Started from `f47c0e5`** (`claude/focused-brahmagupta-m7c1n7`) and fast-forwarded `main` to it.
- **Adopted the owner's addendum** (relayed from the owner's other session at 07:47 UTC, verified against `OVERNIGHT_ADDENDUM.md` on `claude/focused-cray-1xqvhn`): diagnose-before-retry, security review before final deploy, full audit, honest 1–10 scoring with pivots below 8.
- **Live-URL check method:** this session's network policy blocks `*.github.io`, so "serves the new build" is verified by (a) the `pages build and deployment` run succeeding for the gh-pages commit that the main workflow pushed, and (b) the identical `dist/` passing the Playwright smoke test locally. I did not request a network-policy change because nobody is awake to approve it.

- **Did not re-render the 30-second video.** Its scenes are custom animations, not UI captures, and every number in it (usual plan −74,500 XOF; Option A +53,000 XOF / 0 % severe stress; Option B +42,800 XOF / 4 %) still matches the app after the engine changes, so it is not misleading. Re-rendering would cost time for no accuracy gain.

## Failures and how they were handled

- 07:41 UTC — first Pages deploy (`3247173`) failed: `deploy-pages` → 404 "Ensure GitHub Pages has been enabled". Root cause: Pages disabled for the repo. Fix: published to a `gh-pages` branch (auto-enabled Pages) and switched the workflow to publish there. Runs `43691246641` + `43691281747` green.
- 07:48 UTC — **live URL verified from CI**: the workflow's verify step fetched https://adrizh.github.io/AgroNASA/ and got the new `index-*.js` plus HTTP 200 for every asset (run `43691539548`).

## Merges (in order, tests + build + smoke after each)

1. `41a7fb4` what-if climate stress test + share links — 64 tests, build OK.
2. `de69909` rotation rules (MONOCULTURE block, SAME_FAMILY warn, BREAK_CROP bonus), budget placeholder ≈ 90 % of usual plan, FAOSTAT outlier guard, US Corn Belt + Brazil Cerrado packs — 84 tests, build OK, smoke 0 errors. (`.gitignore` conflict resolved by keeping both lines.)
3. `560bb7e` network hardening (shared `fetchWithTimeout`, SoilGrids → texture-default soil with amber "offline · typical loam values" label, POWER retry, 30 s back-off instead of retry loops) + code-splitting (landing first load 527 → 395 kB gzip; main chunk 389 → 57 kB) — 93 tests, build OK, smoke online 0 errors / offline 0 errors.
   - Merge issues found and fixed: (a) my conflict-resolution regex left one `=======` line in `styles.css` (caught by the CSS minifier warning; removed); (b) two what-if tests failed because FAOSTAT became lazy-loaded and the test fixtures ran the engine before it loaded → the test now awaits `loadFaostat()` first, like the app. Root cause, not a test skip.
- Smoke-script policy: a browser always logs "Failed to load resource" for a third-party 4xx/5xx (e.g. SoilGrids 503, Open-Meteo 429, a gap in the SMAP record). These are listed in `upstream.txt` and handled by visible fallbacks; app errors, page errors and same-origin failures still fail the run.
- ~08:30–12:30 UTC — **account usage limit hit**; the UI-rebuild, security and rules-check agents stopped mid-task. Their work was saved (UI rebuild had committed phases 1–4 in its worktree). All three were resumed after the reset rather than restarted. `main` stayed at the last verified state (`560bb7e`) throughout.
4. `fdb47ba` design system v3 (tokens, light/dark + toggle, hero-number plan cards, one-line caveat + Details, new landing hero with live best-plan card, restyled Farm/Resources/Evidence/Report/Methods/Pitch) — 93 tests, build OK, smoke online/offline 0 errors at 1440, 1280, 390.
- 12:45 UTC — **process slip:** I piped the smoke test through `tail`, so its non-zero exit did not stop the push of `fdb47ba` to `main`. It had reported a blank page. Diagnosis: the local `vite preview` server had died with the earlier worker restart (port 4173 refused connections), so the page was blank because nothing served it, not an app bug. Restarted the server, re-ran (exit 0, 0 errors). No revert needed. Smoke runs now gate on the exit code.
5. `3017b21` security review (see `docs/SECURITY.md`): vite 6.4 / vitest 4.1 (npm audit 0), validated imports/stored scenarios/share links/API shapes, EONET `javascript:` links dropped, CSP meta (no inline scripts), `noopener` everywhere, workflow least-privilege + SHA-pinned — 131 tests, build OK, smoke online/offline exit 0, no CSP violations. Conflicts in 4 UI files (design rewrite vs `rel` edits) resolved by keeping the redesign and applying `noopener noreferrer` globally.

## Judge review #1 (fresh-eyes agent, ~13:00 UTC, judged the local copy of the live build)

| Criterion | Score | Why |
|---|---|---|
| Impact | 6 | real problem, but no farmer/agronomist evidence yet |
| Creativity | 6 | affordability-first replay is fresh; output still reads like a cost table |
| Validity | 5 | Kazakhstan wheat severe-stress 88 % of years (implausible); Senegal millet 0 of 24 despite a 309 mm year; NDVI r = 0.55 is weak validation |
| Relevance | 7 | on-brief, but NASA data barely changes the Senegal answer |
| Presentation | 8 | clean, fast, honest |

Estimated rank: strong local winner / global nominee, not yet a global finalist.

**Pivot decisions (all < 8):**
- Validity → science agent: diagnose the replay's root causes (failed/no-onset seasons, winter soil-water recharge, drought sensitivity) with literature-backed fixes, and **hindcast against real FAOSTAT national yields** (Senegal millet/groundnut, Kazakhstan wheat) with drought-year hits — replaces the NDVI slide.
- Relevance/Creativity/Presentation → pitch agent: put NASA risk + the drier/hotter stress test on the landing card and slides; fix the "SMAP/MODIS/IMERG replayed" overclaim; modeled net on cards (fallow trade-off visible); "placeholder budget" chip so over-budget usual plans don't look staged; live URL + QR on the closing slide.
- Rejected: inventing a team list, farmer quote or pilot evidence (honesty rule). Impact stays capped until the owner adds real interviews — listed as a manual to-do.
6. `174795c` science calibration + hindcast — 135 tests, build OK, offline smoke exit 0.
   - Root causes (from `scripts/diagnose-replay.ts`): pre-season evaporation drained the whole 1.2 m profile for 120 days ignoring autumn recharge/snowmelt (Kazakhstan); water percolating below young roots was discarded instead of stored for later root growth (both); a single season-wide Ky hid flowering/grain-fill dry spells (Senegal); no-onset years were silently sown on the last window day.
   - Fixes (cited R37–R39): off-season from previous harvest with degree-day snowmelt (Hock 2003) and FAO-56 ch. 7 topsoil-only evaporation; FAO-56 ch. 8 deep storage; FAO-33 Table 24 stage-wise Ky; no-onset = failed season.
   - Severe pairs of 24, before → after (drier & hotter): Senegal usual 0 → 2 (5), A 0 → 0 (2), B 1 → 1 (4); Kazakhstan usual wheat→wheat 21 → 9 (16), A fallow→rapeseed 2 → 2 (6), B now fallow→wheat 5 (7). Single wheat seasons 20 % severe incl. 2004, 2010, 2012. Budgets unchanged.
   - Hindcast vs **real FAOSTAT national yields** (bulk download, retrieved 2026-11-15, detrended): Kazakhstan wheat r = 0.59 (n = 24); Senegal millet r = 0.18, groundnut r = 0.20 (n = 24; one grid cell vs a whole country — stated on the card). All four known drought years (SN 2002, 2011; KZ 2010, 2012) fall in the model's driest third. Shown on Evidence and slide 6 (replaces NDVI r = 0.55).
7. `cb902da` pitch & first-impression fixes (risk + stress test on landing card and slides, accurate data claims, modeled net + placeholder chip on cards, live mini-compare slide 3, QR + URL slide 7) and docs refresh (README + screenshots, PITCH.md, SUBMISSION.md) — 135 tests, smoke online/offline exit 0. (A second "blank page" smoke failure had the same harness cause: `npm ci` deleted `node_modules` under the running preview server; restarted, exit 0.)
8. `71ec1ac` slide 6 legibility (compact hindcast chart fits 1280×720), 16 packs on slide 7.

## Judge review #2 (re-score, ~13:30 UTC, Opus — the two Fable slots were spent on design lead + judge #1)

| Criterion | #1 | #2 | Why (#2) |
|---|---|---|---|
| Impact | 6 | 6 | real problem; no user tests yet, synthetic prices |
| Creativity | 6 | 6 | budget-first + live stress test is a good twist, still a planner |
| Validity | 5 | **6** | replay + FAOSTAT hindcast + honest labels; Senegal r ≈ 0.2, packs unreviewed |
| Relevance | 7 | **8** | NASA POWER drives every number; stress test = real adaptation |
| Presentation | 8 | 8 | polished deck, live URL + QR; label inconsistencies |

Estimated rank: roughly top 15–20 % globally — strong for a local prize, borderline global finalist.

**Honest assessment of what is left below 8:** Impact and Creativity are capped by things only the team can supply — real farmer/agronomist conversations, a named pilot partner, dated local prices. I did not fabricate any of these. Validity can rise with a reviewed rule pack and a sub-national yield hindcast (district statistics) — both need human sourcing. The last polish round addresses the judge's remaining presentation/consistency issues (one "Best fit" label + trade-off line, 24-pair denominators, "no harvest income or credit assumed" caption, hindcast labels, what-if reset between farms, slide timing).
9. `47ed665` judge #2 polish (one "Best fit" label + live trade-off line, ≈ 3-significant-figure nets, all plans on the same 24 season pairs, "no harvest income or credit assumed" caption, hindcast labels + "drought years listed before the model was run", what-if resets on farm change except from a share link, faster slide entrances, orbit chips, README) + my fix for a Best-fit card overflow at 1280 px — 137 tests, build OK, smoke online/offline exit 0 at 1440/1280/390.

## What the owner must do manually

1. **Submit before the deadline** (reportedly Sun 15 Nov 2026, 23:59 local — confirm on your team page). On the Space Apps project page:
   - **Live demo / project link:** `https://adrizh.github.io/AgroNASA/`
   - **Repository:** `https://github.com/AdriZh/AgroNASA`
   - **Description:** paste the short and long text from `docs/SUBMISSION.md` (plus the AI-disclosure paragraph if the form asks).
   - **Video or slides (pick one, hosted externally):** either upload `public/media/field-shift-30s.mp4` to YouTube/Vimeo/Drive (public or unlisted) and paste the link, **or** open the live app → *Presentation* → **Submission · 7** → **PDF** and upload the PDF to Drive/Slides and paste the link. Use `public/media/field-shift-poster.jpg` as the thumbnail.
2. **Rehearse the demo once on the live URL** (script below) — first load is fast, but click both demos once so they are cached on the presenting laptop.
3. **Team & evidence (only you can do this):** add real team names to the submission form; if you have spoken to any farmer, extension worker or agronomist, add one dated, attributable sentence to `docs/review-log.md` and the closing slide. This is the single biggest lift for **Impact** — I deliberately did not invent any.
4. **Optional:** in repo Settings → Pages you will see "Deploy from a branch: gh-pages / root" — leave it; the workflow maintains it. Merge or delete the agent branches (`worktree-agent-*`) only if you want a tidy branch list; they are local to my session and were never pushed.

## Demo script (90 s, live URL)

1. **Overview (0–10 s).** "Which crop next, and can you afford it?" The best-fit card already shows cost vs budget, NASA-replay risk and the drier & hotter result. Click **Open Senegal demo**.
2. **Compare (10–35 s).** Usual Groundnut → Pearl millet: **454,500 XOF, 74,500 over** the 380,000 budget (two-season cash, no harvest income or credit assumed). Best fit Sesame → Pearl millet fits with 53,000 left, 0 of 24 season pairs severe. Point at the trade-off line: Option B earns ≈ 31,000 more but carries more stress.
3. **What-if (35–50 s).** Click **Drier & hotter** (−15 % rain, +2 °C): the replay of 24 NASA season pairs re-runs live; the usual plan goes 2 → 5 of 24 severe.
4. **Kazakhstan (50–65 s).** Switch farm → Kazakhstan demo → Compare: wheat → wheat monoculture is flagged and over budget; **Drier & hotter** pushes it 9 → 16 of 24; the fallow-break options hold.
5. **Evidence (65–80 s).** Hindcast: modeled water-limited yield vs **real FAOSTAT national yields**, Kazakhstan wheat r = 0.59, the 2010 and 2012 droughts caught. "One grid cell vs a whole country — we say so."
6. **Close (80–90 s).** **Share** button → link copied (opens the exact scenario). "Works anywhere NASA POWER exists; the demo farms work offline; free to run."

## Known issues

- **Impact evidence is missing:** no user tests, no agronomist review (`docs/review-log.md` is honestly empty); demo prices are synthetic. Needs real people, not code.
- **Senegal hindcast is weak** (millet r = 0.18, groundnut r = 0.20): one NASA grid cell vs Senegal's national yield. Shown honestly; a district-level yield series would be the next step.
- **Steppe soil water at sowing is an upper estimate** (frozen-soil runoff not modelled), which slightly understates the fallow benefit in Kazakhstan.
- **30-second video** was not re-rendered: its numbers still match the app, but it calls the best plan "Option A · best fit" and uses the old visual style.
- **Satellite panels and map tiles** need the network; offline they show an "offline" message (the demo farms' NASA POWER record, plans and charts work fully offline).
- **Third-party APIs** (SoilGrids, Open-Meteo) were intermittently down/rate-limited during testing; the app falls back with labels, but the browser still logs a "Failed to load resource" line for those requests.
- **Framing/headers:** GitHub Pages cannot send security headers, so the CSP is a `<meta>` tag and the site can be framed (see `docs/SECURITY.md`).
- Spaceappschallenge.org was returning 503 when the rules were checked; limits are from the 2025 guide — re-check the Project tab before submitting.

## Late additions (owner relay, 15:20 UTC)

The owner's other session relayed two high-priority items (no matching file on the owner's branch this time; accepted because both are benign, in scope and the icon problem was confirmed in `src/data/crops.ts` — six cereals share 🌾, five legumes share 🫘):
1. Distinct per-crop icons + never a same-crop/same-family repeat at the top of the ranking (alternation preferred, baseline kept).
2. "When is your field free?" — fit short-cycle cash crops, cover/catch crops or fallow into an exact window using the NASA POWER replay (GDD, first frost, water), with "matured in time in X of 25 past seasons".
Both run on side branches; each ships only if complete and verified — otherwise it is cut and logged here. `main` stays at the verified `a929b06` until then.

### Owner relay #3 (17:33 UTC) — plan

Feature freeze **20:00 UTC**; after that only fixes, live re-check and docs. Owner's main complaint: Kazakhstan looks like a dead end (wheat/barley only, same icon). Running in parallel, each merged only if complete and verified:
1. crop icons + alternation ranking (hard stop 19:15);
2. "+ Try my own plan" (any crop per season through the same engine) + "near misses" with the smallest verifiable change + wider Kazakhstan crop list (hard stop 19:40);
3. "When is your field free?" window fitting (hard stop 19:40).
Deferred unless time remains: goal selector (5); intercropping evidence card (6) — likely cut, logged as such.
10. `4110f9a` distinct crop icons (SVG glyph + crop-group colour chip on every screen except the video) and alternation ranking G-R9 (same-crop/same-family pairs always rank below any feasible alternation; ALTERNATION reason) — 151 tests, build OK, smoke offline exit 0 at 1440/390. Demo top-2 unchanged. Team list added to README, submission kit, slide 7, Methods (`f5628b3`).
11. `2d2d3f2` **Try my own plan** (any crop/fallow per season through the same engine via `src/engine/custom.ts`; ranked output byte-identical) + **Near misses** (next rejected rotations with the smallest engine-verified change and a Try-it button) + Kazakhstan steppe list widened (oats, field pea, chickpea; oats/pea use placeholder prices — FAOSTAT has none) — 163 tests, build OK, smoke offline exit 0 at 1440/390. KZ headline unchanged (usual wheat→wheat 3,000,000 KZT over, MONOCULTURE; best fit Fallow→Rapeseed); fitting rotations 17/47 → 34/98.
- 17:59 UTC — push to `main` rejected: a teammate had edited README team names on GitHub (`74869bf`). Fetched, merged (no force-push), and propagated the corrected names to `src/data/team.ts` (slide 7, Methods) and `docs/SUBMISSION.md`.
