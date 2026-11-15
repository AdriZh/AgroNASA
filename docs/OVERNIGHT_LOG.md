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
