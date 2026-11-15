# Overnight log — 2026-11-15

## Live URL

https://adrizh.github.io/AgroNASA/  (work in progress — final status below)

> ⚠️ **Deadline:** search results for the official 2026 page say submissions close **Sun 15 Nov 2026, 23:59 local time** (judging from 16 Nov). spaceappschallenge.org returned HTTP 503 when checked on 2026-11-15, so this is unverified. **Submit today.**

## Space Apps rules (checked 2026-11-15; official site down, secondary sources)

- Video ≤ 30 s **or** ≤ 7 slides including the title slide, hosted externally (2025 guide; 2020 agrees). 2026 guide reportedly released 13 Nov. Re-check the Project tab before submitting.
- Criteria: Impact, Creativity, Validity, Relevance, Presentation, scored 1–5 each (judging-awards-guide page; definitions from the 2022 guide PDF).

## Decisions made (running)

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
