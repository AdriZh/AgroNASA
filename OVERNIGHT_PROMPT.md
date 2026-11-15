# Overnight mission: make Field Shift win NASA Space Apps 2026

You are working alone overnight on our hackathon project. The owner is asleep and has **pre-authorized every decision**: you choose what to build, cut, redesign, merge and deploy. Do not stop to ask questions, because nobody will answer until morning. When unsure, pick the option most likely to impress judges, write down why in `docs/OVERNIGHT_LOG.md`, and keep going. **The only goal is to win.**

## Where things stand (checked 2026-11-15)

- Repo: `AdriZh/AgroNASA`. **The latest code is on branch `claude/focused-brahmagupta-m7c1n7`** (commit `f47c0e5`, "Work anywhere on Earth…"). `main` holds only the initial commit. Start from `f47c0e5`, not `main`.
- The app is **Field Shift**: a NASA-informed, budget-aware crop-rotation planner for the Space Apps *Field Shift* challenge. Stack: Vite + React 18 + TypeScript, Recharts, Leaflet, framer-motion, vitest. About 5.6k lines in `src/`.
- What it does: NASA POWER daily weather (2001–2025), SoilGrids soil, GIBS/MODIS NDVI, SMAP, GRACE, EONET, FAOSTAT prices for 240 countries, 14 regional rule packs, FAO-56 water balance, Sivakumar onset, a replay of every past season, a budget/cash-timing check, an animated 12-slide pitch (`#/pitch`), a narrated 30-second video (`public/media/field-shift-30s.mp4`), and a printable report. There are two demo farms: Bambey (Senegal) and Kostanay (Kazakhstan).
- Health: `npm ci && npm test` passes all **37 tests**. `npm run build` succeeds, but the main JS chunk is **1.35 MB** (388 kB gzip) and the two demo JSONs are about 430 kB each.
- **It is not deployed.** `.github/workflows/deploy.yml` deploys to GitHub Pages only on push to `main`, and `main` is empty. Judges need a live URL, so this is the most important gap.
- Read `README.md`, `docs/PITCH.md` (judging-criteria map, demo script, 7-slide/30-s rules) and `docs/review-log.md` first. They are short and hold the team's existing strategy.

## Bugs the owner saw on the Compare page (screenshot of `f47c0e5`, a custom "My farm", Global screening pack)

Fix these early, because they hurt credibility on the screen judges care about most:
- **The status bar says "SoilGrids: unavailable."** SoilGrids is often down or slow. Add a fallback (archived or default soil by texture class, labeled clearly) so the app never looks broken.
- **The top recommendation was "Pearl millet → Pearl millet",** a monoculture, in a *rotation* planner. That kills creativity and validity points. Add a rotation rule: penalize, or exclude by default, the same crop or family twice, and favor legume–cereal sequences. Explain the reason in the card.
- **The budget is unrealistic.** "Spendable 42,222 USD" for 1.5 ha meant every plan was affordable with about 41k of headroom, so the affordability story (the core idea) disappeared. Check the default budget and the currency conversion for new or custom farms. The defaults should create a meaningful trade-off, like the Senegal demo does.
- **Prices look odd.** A cash cost of about 573–848 USD for two seasons is fine, but check that FAOSTAT/USD defaults are sensible across countries.
- **The layout breaks.** "mature ≈ 3 Oct" and "mature ≈ 23 Oct" wrap onto a second line. The "CASH COST (2 SEASONS)" label wraps, and the cards are too dense. Tighten the typography and layout so each card reads in 3 seconds.
- **The four-bullet disclaimer box** dominates the top of the page. Collapse it into a single honest line with an expandable "details" link. Keep the honesty, lose the wall of text.
- **Before the presentation:** open several world locations (Kenya, India, Iowa, Brazil, Ukraine) and check that the plans make agronomic sense, with no nonsense crops for the climate and no monocultures at the top.

## Design overhaul (a top priority, which the owner says currently "looks terrible")

The owner judges the current visual design as poor. Presentation is a scoring criterion, and the look is the first thing judges notice, so treat this as **co-equal with priority 2**:
- **One designer agent leads it.** Use `fable` and pass it the `artifact-design` skill guidance if available. It audits screenshots of every tab at 1440×900 and phone width, then writes a short design direction in `docs/DESIGN.md`:
  - a palette of 1 brand color, 1 accent and neutrals, plus semantic good/warn/bad colors;
  - one type scale with 2 weights, an 8-px spacing grid and a card style;
  - chart styling that matches the UI, and the tone of the experience (calm, trustworthy, "NASA meets field notebook").
- **Then rebuild the UI on that system.** Use CSS variables in `src/styles.css`, consistent components in `src/ui/components/common.tsx` and fewer borders and boxes. Use strong visual hierarchy: one hero number per card (cost vs budget), with everything else secondary or behind "See why." Use real whitespace, align to the grid and give text a sensible maximum width.
- **Make it feel premium:** a striking landing/overview hero (satellite imagery or an animated globe already exist in `OrbitVisual`), smooth but subtle transitions, polished empty and loading states, and a dark mode that works. Check that each page reads in 3 seconds.
- **Keep it consistent.** The pitch slides and the printable report must use the same design system.
- **Verify before and after.** Take before and after Playwright screenshots of each tab and have the judge agent compare them. Iterate until it would honestly rate presentation 9/10.

## Judging criteria (Space Apps)

Influence/Impact, Creativity, Validity (scientific soundness), Relevance (to the challenge and to NASA data), and Presentation. Judges spend **under 2 minutes** per project: a 30-second video or up to 7 slides, a project page and a live link. **Polish of the first 30 seconds matters more than depth on page 6.**

## Priorities (in this order; re-rank only with a written reason)

1. **Ship a live URL.** Set `base` in `vite.config.ts` for GitHub Pages (`/AgroNASA/`), make sure hash routing and asset paths work under that base, then fast-forward or merge the working branch into `main` and push so the Pages workflow runs. Check the Actions run with the GitHub MCP tools. If Pages is not enabled for the repo and you can't enable it, note it in the morning summary as the one thing the owner must click. Also verify the built site with a local `vite preview` and Playwright. Load the app, click both demos, and open every tab. **There must be zero console errors.**
2. **A flawless first impression.** Make the landing view explain the value in 5 seconds: the problem, NASA data, and an affordable plan. Make the demo farm load instantly, with no blank charts, spinners stuck forever, or layout breaks at 1280×720, 1920×1080 and phone width. Take Playwright screenshots (deviceScaleFactor 1 for your own checks) and *look at them*. Fix anything ugly.
3. **Robustness for live judging.** Any network call (POWER, SoilGrids, GIBS, EONET) can fail or be slow on hackathon Wi-Fi. Every one needs a timeout, a graceful fallback to cached or archived data, and an honest "offline/cached" label. Make sure the demo path works with the network fully blocked.
4. **The wow factor (creativity and relevance).** Pick 1–2 high-impact additions you can finish *completely*. Candidates, which you may replace with better ideas:
   - A "what-if climate" slider (drier/wetter or +°C) that re-runs the replay live.
   - A side-by-side "usual plan vs Field Shift plan" money-and-risk story, animated.
   - A one-click shareable farm link (state encoded in the URL hash) so judges can open a prepared scenario.
   - A local-language toggle (French for Senegal, Russian/Kazakh for Kazakhstan) on the key screens.
   - A clearer visual of the NASA data used at the clicked pixel.
   Unfinished features are worse than none, so feature-flag or delete anything half-done before you finish.
5. **Performance.** Code-split heavy pages (Pitch, Video, Evidence, map) with `React.lazy`, lazy-load the demo JSONs, and aim for a first load under 500 kB gzip.
6. **The submission package.** Update `docs/PITCH.md`, the in-app 7-slide submission cut and the README with the live URL, refreshed screenshots and a tight project description (about 150 words, plus a longer version). Check the current Space Apps submission rules on the web and record the date checked. Re-render the 30-second video (`npm run video:frames / video:audio / video:encode`) **only if** the UI changed enough to make the current video misleading and the tooling works here. Otherwise leave it alone.
7. **Validity polish.** Keep every honesty label ("demo-unreviewed", synthetic prices). **Never fabricate reviews, sign-offs, user testimonials, yields or data.** Add tests for anything new; the suite must stay green.

## How to work (budget matters, so be token-efficient)

- **Never `cat` or Read** the big data files (`src/data/demo/*.json`, `src/data/faostat/countries.json`, `data/archive/*.json`, `package-lock.json`, `public/media/*`). Use `head -c`, `jq` or `grep` for what you need.
- Read source files only as needed. Prefer targeted `grep` and line ranges over whole files.
- **You are the orchestrator; use subagents (the Agent tool) as your main way of working.** The owner explicitly authorizes and wants this. Keep your own context lean: plan, delegate, review, merge and verify.
  - **Wave 1 (do it yourself, it's quick):** priority 1 (deploy). Everything else depends on the live URL.
  - **Wave 2 (in parallel, `isolation: "worktree"`, background):** split priorities 2–5 into 3–4 independent agents with non-overlapping files:
    - A: first impression and responsive UI polish.
    - B: network robustness and offline fallbacks.
    - C: the wow feature.
    - D: performance and code-splitting.
    Give each agent a self-contained brief: goal, files it owns, files it must not touch, done criteria (`npm test && npm run build` green, Playwright check, commit on its worktree branch) and "report in under 200 words."
  - **Model choice (token budget is tight):** you, the orchestrator, run on Opus. Use `fable` for **only two agents in the whole night**: the design-lead agent and the final hackathon-judge review. Use `opus` for feature and engineering agents, and `sonnet` or `haiku` for mechanical jobs (screenshots, docs, web checks). Never use Fable for routine coding.
  - **Wave 3:** merge the agent branches one at a time. Run the tests and build after each merge, fix conflicts and push. Then spawn **one fresh-eyes "hackathon judge" agent** (`fable`). It opens the live site with Playwright, takes screenshots, scores the project against the 5 criteria with a 2-minute attention span, and returns its top 5 fixes. Do the fixes (delegating if they're large).
  - **Wave 4:** submission package and docs (priority 6) on a cheap model, then a final verification by you.
  - Don't spawn more than about 4 agents at once, and don't spawn agents for trivial edits. Every agent starts cold and re-reads code, so its brief must say exactly which files to read.
- Work in small, complete increments. After each priority item: run `npm test && npm run build`, commit with a clear message, and push. Something shippable must always be on the branch, in case the session runs out of tokens mid-way.
- Once priority 1 works, keep `main` deployable and fast-forward it after each verified milestone so the live site stays current.
- If something burns more than about 15% of your effort without progress, cut it, log it and move on.
- Don't change the product name or the core concept (affordability-first rotation planning with NASA data); refine it.

## Usage limit: assume you can be cut off at any moment

You cannot see your remaining token budget. When it runs out, you halt mid-step with no warning. So:
- **Create `docs/OVERNIGHT_LOG.md` right after Wave 1, and update, commit and push it after every milestone.** The owner must never wake up to an empty log.
- **Never leave `main` broken.** Only fast-forward `main` to a commit where `npm test && npm run build` passed. Unfinished work stays on your branch or in the agents' worktrees.
- **Push before you start anything long.** That means before spawning a wave of agents or before a big refactor.
- **Stop on your own when the work is done; don't invent endless extra work.** After Wave 4 and one judge-driven fix round, finish the log and end. If you're past Wave 3 and things feel long, skip optional polish and go straight to the final log.
- **Watch for a usage-limit or rate-limit error,** whether on you or on an agent. If you see one, don't retry in a loop: immediately commit, push, update the log with what was unfinished, and stop.

## Before you stop

Write `docs/OVERNIGHT_LOG.md` with these sections:
- **Live URL:** the deployed address, and whether you verified it loads.
- **What changed:** a short list of the changes.
- **Decisions made:** each decision you made on your own, with a one-line reason.
- **What the owner must do manually:** anything only a human can do (for example, enable Pages, upload the video, fill in the submission form), with exact steps.
- **Demo script:** the 90-second live demo script, updated.
- **Known issues:** anything still broken or unfinished.

Commit and push it, and make sure `main` matches your final verified state. Your final chat message should repeat the Live URL and the manual to-do list.
