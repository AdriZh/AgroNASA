# Overnight log — 2026-11-15

## Live URL

https://adrizh.github.io/AgroNASA/  (work in progress — final status below)

## Decisions made (running)

- **Deploy via `gh-pages` branch, not the Actions Pages artifact.** Pages was not enabled; `actions/deploy-pages` returned 404. Pushing a `gh-pages` branch auto-enabled Pages (the "pages build and deployment" run succeeded at 07:44 UTC). The workflow now tests, builds and force-pushes `dist/` to `gh-pages` on every push to `main`.
- **Kept `base: './'`** instead of `/AgroNASA/`: with hash routing, relative asset paths work on the Pages sub-path and on any other static host, and the built site was verified locally with Playwright (0 console errors, both demos, all tabs).
- **Started from `f47c0e5`** (`claude/focused-brahmagupta-m7c1n7`) and fast-forwarded `main` to it.
- **Adopted the owner's addendum** (relayed from the owner's other session at 07:47 UTC, verified against `OVERNIGHT_ADDENDUM.md` on `claude/focused-cray-1xqvhn`): diagnose-before-retry, security review before final deploy, full audit, honest 1–10 scoring with pivots below 8.
- **Live-URL check method:** this session's network policy blocks `*.github.io`, so "serves the new build" is verified by (a) the `pages build and deployment` run succeeding for the gh-pages commit that the main workflow pushed, and (b) the identical `dist/` passing the Playwright smoke test locally. I did not request a network-policy change because nobody is awake to approve it.

## Failures and how they were handled

- 07:41 UTC — first Pages deploy (`3247173`) failed: `deploy-pages` → 404 "Ensure GitHub Pages has been enabled". Root cause: Pages disabled for the repo. Fix: published to a `gh-pages` branch (auto-enabled Pages) and switched the workflow to publish there. Runs `43691246641` + `43691281747` green.
- 07:48 UTC — **live URL verified from CI**: the workflow's verify step fetched https://adrizh.github.io/AgroNASA/ and got the new `index-*.js` plus HTTP 200 for every asset (run `43691539548`).

## Merges (in order, tests + build + smoke after each)

1. `41a7fb4` what-if climate stress test + share links — 64 tests, build OK.
2. `de69909` rotation rules (MONOCULTURE block, SAME_FAMILY warn, BREAK_CROP bonus), budget placeholder ≈ 90 % of usual plan, FAOSTAT outlier guard, US Corn Belt + Brazil Cerrado packs — 84 tests, build OK, smoke 0 errors. (`.gitignore` conflict resolved by keeping both lines.)
3. `560bb7e` network hardening (shared `fetchWithTimeout`, SoilGrids → texture-default soil with amber "offline · typical loam values" label, POWER retry, 30 s back-off instead of retry loops) + code-splitting (landing first load 527 → 395 kB gzip; main chunk 389 → 57 kB) — 93 tests, build OK, smoke online 0 errors / offline 0 errors.
   - Merge issues found and fixed: (a) my conflict-resolution regex left one `=======` line in `styles.css` (caught by the CSS minifier warning; removed); (b) two what-if tests failed because FAOSTAT became lazy-loaded and the test fixtures ran the engine before it loaded → the test now awaits `loadFaostat()` first, like the app. Root cause, not a test skip.
- Smoke-script policy: a browser always logs "Failed to load resource" for a third-party 4xx/5xx (e.g. SoilGrids 503, Open-Meteo 429, a gap in the SMAP record). These are listed in `upstream.txt` and handled by visible fallbacks; app errors, page errors and same-origin failures still fail the run.
