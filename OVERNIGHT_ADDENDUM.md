# Addendum from the owner (applies on top of OVERNIGHT_PROMPT.md)

## 1. When something fails (CI, deploy, tests, an agent, the network, git)
- **Diagnose before you retry.** Read the actual logs: GitHub Actions job logs via the GitHub MCP tools, and test or build output. Fix the root cause, never the symptom. Never skip, disable or delete a test to get green.
- **Retry once with a fix.** If it fails again, try a different approach. Give up on a sub-goal after 2–3 real attempts, log it and move on.
- **Check deploys.** The first deploy run (`3247173`) failed, and you switched to publishing through the `gh-pages` branch, which now succeeds. After every push to `main`, confirm that the workflow passed *and* that the live URL actually serves the new build with no 404 assets. If a deploy breaks, revert `main` to the last good commit first, then debug.
- **Retire failed agents.** If an agent fails or returns broken work, don't merge it. Rerun it with a sharper brief or do the job yourself. Never merge a worktree branch without running the tests and build on the result.
- **Handle git problems carefully.** On a rejected push or conflict, fetch, rebase onto origin and resolve. Don't force-push `main`.
- **Log every failure and how you handled it** in `docs/OVERNIGHT_LOG.md`.

## 2. Security review (required before the final deploy)
Do this yourself or with one `opus` agent, then fix everything you find:
- **No secrets** in the repo or its git history, `dist/`, the GitHub Actions config or the client bundle. Search for keys, tokens and `.env` files.
- **Run `npm audit`** and fix high and critical findings without breaking the build.
- **No XSS.** Check every `dangerouslySetInnerHTML`, `innerHTML` and URL-hash/state parsing, plus any user-entered text (farm names, notes) rendered into the page or the PDF/report. Validate and limit the size of anything decoded from the URL or IndexedDB.
- **External fetches use HTTPS only,** with timeouts. Don't trust their response shapes: validate them and never `eval` them.
- **Add a Content-Security-Policy `<meta>` tag** allowing only the hosts actually used, and use `rel="noopener noreferrer"` on external links.
- **Tighten the GitHub Actions workflow.** Use least-privilege `permissions`, pin actions to tags, and put no untrusted input in `run:` lines.
- **Record the results** in a short "Security" section in the README or `docs/`. Judges reward it.

## 3. Every part must be the best: a full audit
Audit every part, not only the app:
- the app (every tab, both demos, three or more world locations);
- the science and methods page;
- the README / project page;
- the 7-slide deck;
- the 30-second video;
- the printable report;
- the tests;
- performance and accessibility (keyboard navigation, contrast, alt text);
- mobile.

For each part, ask whether it is the strongest version a winning team would submit. If not, improve it or cut it.

## 4. Evaluate our chances and pivot if needed
- **Score the project.** After the judge agent's review, score it honestly (1–10) on each Space Apps criterion: Impact, Creativity, Validity, Relevance and Presentation. Estimate where it would rank against typical winning projects, then write the scores and the reasoning in the log.
- **Act on any score below 8.** Decide by yourself what would raise it most, even if that means a bold change: a different headline feature, a sharper story, a different hero demo, a reworked pitch, or cutting weak parts. You have full authority to change anything except the core challenge fit and honesty (no fabricated data, reviews or testimonials).
- **Re-score after changes.** Stop once every criterion reaches 8 or more, or once further work stops paying off.

**The main goal is to win.** Use your judgment; every decision is yours.
