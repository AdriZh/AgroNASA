# Overnight log — 2026-11-15

## Live URL

https://adrizh.github.io/AgroNASA/  (work in progress — final status below)

## Decisions made (running)

- **Deploy via `gh-pages` branch, not the Actions Pages artifact.** Pages was not enabled; `actions/deploy-pages` returned 404. Pushing a `gh-pages` branch auto-enabled Pages (the "pages build and deployment" run succeeded at 07:44 UTC). The workflow now tests, builds and force-pushes `dist/` to `gh-pages` on every push to `main`.
- **Kept `base: './'`** instead of `/AgroNASA/`: with hash routing, relative asset paths work on the Pages sub-path and on any other static host, and the built site was verified locally with Playwright (0 console errors, both demos, all tabs).
- **Started from `f47c0e5`** (`claude/focused-brahmagupta-m7c1n7`) and fast-forwarded `main` to it.
