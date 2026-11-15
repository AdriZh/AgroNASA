# Field Shift design spec (v3)

Design direction for the engineering pass. Scope: `src/styles.css`, `src/ui/**`, `index.html`. No engine or data changes.
Audited from 1440 px and 390 px screenshots of every route, both demos.

## 1. Audit: top 10 problems, ranked

1. **Compare: plan cards are unreadable in 3 seconds.** Each card has ~14 competing facts in 4 boxed tiles, two range bars, three grey paragraphs and reason rows. Nothing is the headline. "mature ≈ 30 Sep" wraps to a second line, the "CASH COST (2 SEASONS)" and "DUE BY FIRST SOWING" labels wrap, and tile values ("157,500 XOF / 169,500 XOF") wrap too.
2. **Compare: a four-bullet blue disclaimer box is the first thing on the page**, above the plans. It reads as an error state and pushes the answer down.
3. **Landing/Overview: the hero does not show the product.** A four-line headline with gradient text, a five-line paragraph, four equal-weight buttons and a decorative satellite. The actual answer ("Sesame → Pearl millet fits, 53,000 XOF to spare") sits below the fold after a 15-tile location picker.
4. **Whole app: no single visual system.** Navy "deep space" sidebar, navy gradient hero, pale grey workspace, green/blue gradient buttons, six tinted icon squares and seven chip colors. About 250 hard-coded hex values in TSX (`charts.tsx` 44, `Pitch.tsx` 89, `Scenes.tsx` 65). Dark mode is impossible as built.
5. **Whole app: everything is a card with the same 22 px radius and shadow**, including cards nested in cards (KPI tiles inside cards, tiles inside plan cards). Hierarchy is flat; the page is a wall of rounded boxes.
6. **Charts ignore the UI system.** Saturated default blue/red/amber, hard-coded light gridlines and tooltip, a dual-axis chart (Monthly climatology: mm and °C), an overlapping "median" label in Season rainfall, x-axis ticks colliding, and the Compare cost chart uses red for a category ("protection") and for the budget line.
7. **Resources: price tables are clipped.** The "Unit price" column is cut off at the card edge on desktop in all six crop tables; unit cells wrap to three lines ("10 / person- / day").
8. **Phone (390 px): Compare is 6,860 px tall**, the cost-lines table clips its right columns, hero buttons stack as four full-size rows, and the appbar loses the scenario name.
9. **Type is loud and inconsistent.** Three families, weight 800 with −0.035em tracking on every heading, uppercase micro-labels at 10.5 px, body at 14.5 px, grey `--ink-3` text at about 3:1 contrast.
10. **Evidence, Report, Methods, Pitch: status and provenance are noise.** "NASA data", "Modeled", "Synthetic demo" chips repeat on every row (15 times in one table); the sidebar status block and footer disclaimer repeat the same caveats again. Pitch slides use a different look (gradient text, glass panels) from the app they present.

## 2. Direction

Calm, trustworthy, "NASA meets field notebook". A mission data sheet you could hand to an extension officer.

- **Paper, not space.** One light, slightly green-tinted paper ground and white sheets. No navy shell, no gradients, no glass, no starfields. Dark mode is the same notebook at night, not a different product.
- **Ink and one green.** Near-black green ink for text. Field green is the only brand color: primary action, active nav, "best" plan. Orbit blue is the only accent and means one thing: NASA data and links.
- **Numbers are the content.** Tabular figures everywhere. One big number per card. Units and sources set small in mono, like instrument labels.
- **Honest by placement, not by volume.** One plain caveat line where it applies, details behind a link. Status color only for budget verdicts.
- **Subject details that stay:** grid-cell coordinates in mono (`14.71°N 16.46°W · MERRA-2 cell`), season year tabs, ruled dashed dividers like a ledger, the crop → crop sequence arrow.

## 3. Tokens

Replace the `:root` block in `src/styles.css` with this. Every color in CSS and TSX must come from these tokens (charts read them through a `useTheme()` helper, section 4.10). Old names (`--ink`, `--line`, `--sky`, `--space*`, `--violet`, `--teal`, `--soil`, `--amber`) are deleted, not aliased.

```css
:root {
  color-scheme: light;
  /* neutrals */
  --bg: #f5f7f4;        --surface: #ffffff;    --surface-2: #eef1ec;
  --border: #d9dfd6;    --text: #17211c;       --text-muted: #56635b;
  /* brand + accent */
  --brand: #17603f;     --brand-soft: #e4f3ea; --on-brand: #ffffff;
  --accent: #1f5faf;    --accent-soft: #e9f0fa;
  /* semantic */
  --good: #17703f;      --good-soft: #e4f3ea;
  --warn: #8a5a00;      --warn-soft: #fdf3d7;
  --bad:  #b3261e;      --bad-soft:  #fcebe9;
  /* chart series, fixed order, never cycled */
  --c1: #2a78d6; --c2: #eb6834; --c3: #1baf7a; --c4: #eda100; --c5: #e87ba4; --c6: #008300;
  --c-other: #9aa59e;   --chart-grid: #e6eae3; --chart-axis: #56635b;
  /* type */
  --font: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --w-regular: 400;     --w-strong: 600;
  /* space (8 px scale) */
  --s-1: 4px; --s-2: 8px; --s-3: 16px; --s-4: 24px; --s-5: 32px; --s-6: 48px; --s-7: 64px;
  /* shape */
  --r-sm: 6px; --r: 10px; --r-pill: 999px;
  --shadow: 0 1px 2px rgba(23, 33, 28, .06), 0 4px 12px rgba(23, 33, 28, .05);
  --focus: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
  --measure: 68ch;      --sidebar: 240px;      --page: 1200px;
  --ease: cubic-bezier(.2, .7, .2, 1); --t-fast: 120ms; --t: 200ms;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* dark values below */ } }
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1512;        --surface: #171e1a;    --surface-2: #1f2823;
  --border: #2e3a33;    --text: #e8eee9;       --text-muted: #9ba8a0;
  --brand: #4dbf8b;     --brand-soft: #16301f; --on-brand: #0f1512;
  --accent: #7fb2f0;    --accent-soft: #1a2a40;
  --good: #6fd19c;      --good-soft: #16301f;
  --warn: #e3b341;      --warn-soft: #33290f;
  --bad:  #f0837a;      --bad-soft:  #3a1b18;
  --c1: #3987e5; --c2: #d95926; --c3: #199e70; --c4: #c98500; --c5: #d55181; --c6: #0ca30c;
  --c-other: #6b776f;   --chart-grid: #263029; --chart-axis: #9ba8a0;
  --shadow: 0 1px 2px rgba(0, 0, 0, .4), 0 4px 12px rgba(0, 0, 0, .25);
}
```

The media-query block repeats the `[data-theme="dark"]` values exactly (generate both from one list). `body { background: var(--bg); color: var(--text); }`, no gradient.

**Validated.** Text pairs measured (WCAG): text/bg 15.3, muted/bg 5.9, muted/surface-2 5.5, white on brand 7.6, accent/white 6.3, good/warn/bad on their soft fills 5.3 to 5.7; dark: text/bg 15.7, muted/surface 6.9, on-brand/brand 8.0, semantic on soft 6.1 to 7.6. Chart series pass the dataviz validator in both modes on `--surface` (lightness band, chroma, adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3). In light mode `--c3`, `--c4`, `--c5` are under 3:1 against white, so those series always carry a direct label or legend entry and a 2 px surface gap.

**Type scale.** Inter only (weights 400 and 600); drop Plus Jakarta Sans and weights 500/700/800 from the `index.html` font link. JetBrains Mono 400 for captions with units, coordinates, source IDs. `font-variant-numeric: tabular-nums` on `body`.

| Role | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| display | 40 / 44 px (28 / 32 at ≤640) | 600 | −0.02em | landing headline, slide titles |
| h1 | 28 / 34 px (22 / 28 at ≤640) | 600 | −0.015em | page title |
| h2 | 20 / 28 px | 600 | −0.01em | section title |
| h3 | 16 / 24 px | 600 | 0 | card title |
| body | 15 / 24 px | 400 | 0 | default |
| small | 13 / 20 px | 400 | 0 | secondary rows, table cells |
| caption | 12 / 16 px | 600, uppercase, +0.06em (or mono 400, not uppercase) | | stat labels, table heads, source IDs |
| hero-number | 32 / 36 px (28 / 32 at ≤640) | 600 | −0.02em | the one number per card |

Minimum text size 12 px. Headings get `text-wrap: balance`. Paragraphs cap at `max-width: var(--measure)`.

**Spacing.** Only the scale values. Card padding `--s-4` (`--s-3` at ≤640). Gap between cards `--s-3`. Gap between page sections `--s-6`. Page gutter `--s-5` (`--s-3` at ≤640). Use `gap`, not margins.
**Radii.** `--r` cards, inputs, buttons; `--r-sm` chips inside tables, bars; `--r-pill` badges only. Nothing above 10 px.
**Shadow.** `--shadow` is used only on floating things: tooltip, menu, mobile drawer, the "best" plan card. Cards at rest have a border and no shadow.

## 4. Components

**4.1 Card (one style).** `background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: var(--s-4)`. No hover lift, no gradient, no `.card.flat` variant. **Never nest a bordered box inside a card**; group inside a card with a dashed rule: `border-top: 1px dashed var(--border)` plus `--s-3` padding. Card header: h3 left, at most one source chip right. Delete the tinted `.ic` icon squares; a title may have a 16 px `--text-muted` Lucide icon inline.

**4.2 Hero-number stat.** Caption label above, hero-number below, one `small` muted sub-line. `white-space: nowrap` on the number; the currency code is `small` weight 400 `--text-muted` after the number (`327,000 XOF`). Max one per card. Color is `--text`; only a budget verdict may use `--good` / `--bad`.

**4.3 Secondary stat row.** A definition list, one line per fact: label left (`small`, muted), value right (`small`, weight 600, `nowrap`), rows separated by dashed rules, row height 32 px. Replaces all `.split` tiles and `.kpis` grids inside cards. A top-of-page KPI strip (Evidence) is one card with 3 to 5 columns divided by vertical dashed rules, values at h2 size, not five separate cards.

**4.4 Badges and chips (two styles only).**
- **Status badge** (verdicts): pill, 12 px / 600, 4 × 10 px padding, icon 14 px plus text, `--good`/`--warn`/`--bad` text on the matching soft fill. Texts: "Fits budget", "Over budget", "Cash-timing gap", "Budget not verified".
- **Source chip** (provenance): `--r-sm`, 1 px `--border`, transparent fill, mono 12 px `--text-muted`, optional 12 px icon. One neutral style for NASA, Modeled, Farmer, Synthetic, FAOSTAT, rule IDs. The NASA chip alone uses `--accent` text. Once per card or table header, never per row.
- **Crop icon** (`CropIcon`, owner request): wherever a crop or crop sequence is shown, a 16–22 px `--r-sm` chip with a 20 × 20, 1.5 px-stroke line glyph unique to the crop, coloured by crop group (`--crop-cereal|legume|oilseed|tuber|fallow|cover` on the matching `-soft` fill, light and dark). The only decorative colour exception; it makes cereal ↔ legume ↔ oilseed alternation visible at a glance. Unknown crop ids get a leaf glyph in their group colour. Emoji stay for `<option>` text and the video.

**4.5 Buttons.** Height 40 px (32 px `.sm`), padding 0 16 px, radius `--r`, 14 px / 600, icon 16 px, gap 8 px. Focus: `box-shadow: var(--focus)`. Disabled: 50 % opacity.
- **Primary:** `--brand` fill, `--on-brand` text, no border, no gradient. Hover: `filter: brightness(.92)`. One per view.
- **Secondary:** `--surface` fill, 1 px `--border`, `--text`. Hover: `--surface-2`.
- **Ghost:** no fill or border, `--accent` text (links such as "See why", "details"). Hover: underline.
Delete `.btn.sky`, `.btn.dark`, `.btn.glass`, `.btn.light`, `.btn.lg`, `.btn.danger` (danger = ghost with `--bad` text).

**4.6 Disclaimer pattern.** One line, no box, no fill: 16 px info icon in `--text-muted`, `small` muted text, then a ghost "Details" toggle that expands a `<details>` list below. Sits **under** the page header and above content, max one per page. Compare copy: "Demo results: synthetic prices and an unreviewed rule pack. Climate risk is a replay of past seasons, not a forecast. Details". The four current bullets go inside the expansion. `Callout` keeps `warn` and `bad` tones only, for real blocking states (no feasible plan, engine error, cash-timing gap): soft fill, 1 px border in the same hue at 30 %, `--r`.

**4.7 Tabs / segmented control.** One component for `.tabs` and `.seg`: inline row on `--surface-2`, radius `--r`, 4 px padding; items 32 px tall, 13 px / 600, `--text-muted`; selected item `--surface` fill, `--text`, 1 px `--border`. No icons in tabs. If the row overflows it scrolls horizontally inside its own container with a 24 px fade on the right edge. Evidence's seven tabs become: Climate, Field, This season, Forecast, Layers, Review, Fertilizer.

**4.8 Tables.** No outer border or radius when inside a card. Head: caption style, `--text-muted`, no fill, 1 px solid `--border` bottom. Rows 40 px, 13 px text, dashed bottom rule, no zebra, hover `--surface-2`. Numbers right-aligned, `nowrap`, unit in the header ("Unit price, XOF") not in every cell. Totals row: weight 600 with a solid top rule. Wrapper `overflow-x: auto`; first column sticky at ≤640. Editable cells: the 32 px `.input.sm`, right-aligned, min-width 88 px.

**4.9 Empty and loading states.** Empty: centered in the card, 24 px muted icon, one `body` sentence saying what will appear, one secondary button for the next step. Loading: skeleton blocks shaped like the final layout (`--surface-2`, radius `--r-sm`, opacity pulse 1 → .5 → 1 over 1.2 s; static under reduced motion). Compare loading = three plan-card skeletons (title bar 60 %, hero bar 40 % × 36 px, three 12 px rows). `NasaLoading` keeps its one text line ("Reading 25 years of NASA POWER for Bambey…") above the skeletons. Delete the gradient loading banner and spinner.

**4.10 Charts (Recharts).** Add `useChartTheme()` in `charts.tsx` that reads the tokens with `getComputedStyle` and re-reads on theme change; no hex literals remain in chart code.
- **Grid:** horizontal only, 1 px solid `--chart-grid`, no dashes. Baseline axis 1 px `--border`. No axis lines on Y, no tick marks.
- **Axis text:** 12 px, `--chart-axis`, at most 5 Y ticks, X ticks thinned so none collide (`interval="preserveStartEnd"`, `minTickGap={24}`). Unit goes in the chart subtitle, not on the axis.
- **Marks:** bars radius 3 px on the data end, `maxBarSize={28}`, 2 px surface gap between stacked segments (`stroke: var(--surface)`); lines 2 px, no dots except the last point (r 4 with a 2 px surface ring).
- **Tooltip:** `--surface` fill, 1 px `--border`, `--r`, `--shadow`, 13 px; label `--text-muted`, values `--text` weight 600 with a 8 px series swatch. Text never takes the series color.
- **Legend:** above the plot, left-aligned, 12 px `--text-muted`, 8 px square swatches. Omit it for single-series charts.
- **Reference lines** (budget cap, median, 50 % threshold): 1.5 px dashed `--text`, label in `--text` 12 px placed outside the bars at the right end. Never red.
- **Color assignment, fixed:** rain `--c1`; ET₀ `--c4`; heat/Tmax `--c2`; season 1 `--c3`, season 2 `--c1` (replay); cost categories seed `--c3`, fertilizer `--c1`, labor `--c4`, land-prep `--c2`, protection `--c5`, irrigation `--c6`, other `--c-other`. Semantic red/green are never series colors.
- **No dual axes.** Monthly climatology and Forecast split into two stacked small charts sharing the x-axis (rain + ET₀ in mm; Tmax/Tmin in °C).
- Chart height 220 px in a half-width card, 260 px full width, 180 px on phone. Every chart has a one-line `small` caption stating window and source.

## 5. Page-by-page layout

### 5.1 App shell
- **Sidebar** (240 px, `--surface`, 1 px right border, follows the theme, no dark panel): logo mark (flat `--brand` square, radius `--r`, white glyph) + "Field Shift"; scenario `<select>` styled as a secondary input; nav items 36 px tall, 14 px, `--text-muted`; active = `--brand-soft` fill, `--text`, weight 600 (no left bar, no gradient). Groups: Overview · Plan (1 Farm, 2 Resources, 3 Compare, 4 Evidence, numbered in mono because they are a real sequence) · Share (Report, Methods) · Present (Pitch, Video). Remove the right-hand tail icons.
- **Data status** collapses to one line at the sidebar bottom: green dot + "NASA POWER 2001–2026 · cached" with a ghost "Refresh" icon button; SoilGrids and rule-pack detail move into a popover on click.
- **Appbar** (56 px, `--bg`, 1 px bottom border, no blur): breadcrumb (scenario name truncates, page name never does), spacer, theme toggle (icon button), secondary "Present" button. Delete the region pill (it is in the breadcrumb).
- **Main:** `max-width: var(--page)`, padding `--s-5`. Page header = caption step label ("Step 3 of 4") + h1 + one muted sentence (max `--measure`) + actions right-aligned (one primary, one secondary).
- **Footer disclaimer:** two lines max, 12 px muted, with "Methods & sources" link.

### 5.2 Landing / Overview
Above the fold at 1440 × 900 the judge must see problem, NASA data and an affordable plan. Hero is a plain card on `--surface` with a faint graph-paper background (24 px grid of 1 px `--border` lines at 40 % opacity), two columns 7 / 5:

- **Left:** caption "NASA Space Apps 2026 · Field Shift challenge". Display headline, two lines: **"Which crop next, and can you afford it?"** Body line (max 2 lines): "Field Shift replays 25 years of NASA climate records for your field and ranks the two-season rotations that fit your budget." Buttons: primary "Open Senegal demo", secondary "Kazakhstan demo", ghost "Plan my own field". The video link moves to the Present strip at the page bottom.
- **Right:** a live **result preview** from the Senegal demo, the same plan card as Compare in compact form (sequence, "Fits budget" badge, hero number, budget bar), captioned "Best fit for the Bambey demo farm". `OrbitVisual` shrinks to 160 px tall above it as a header illustration, recolored to tokens (field tiles `--c3`/`--c4`, beam `--accent` at 15 %, orbit ring dashed `--border`, labels as source chips), animation limited to the satellite orbiting once every 20 s.
- **Proof strip** directly under the hero, one card, three columns with dashed dividers, each = caption + h3 + one `small` line: **Problem** "Seasons are not average: rain here ranged 309–976 mm" · **NASA data** "25 seasons of POWER, SMAP, MODIS, IMERG for this grid cell" · **Plan** "36 rotations screened, 21 excluded with reasons, best fit leaves 53,000 XOF".
- Below the fold, in order: "Where is your field?" (search row + presets as a 5-column grid of plain rows: flag, name, crops; no card per preset) · Season rainfall chart (full width, 260 px) · How it works (4 numbered steps in one card, a row with dashed dividers) · Data sources (one two-column table: NASA | Ground truth) · three short statements (does / never claims / private) as one card with three columns · Present strip.
- Delete: hero badges, gradient headline text, starfield, "Current scenario" tile cluster (replaced by the hero preview).

### 5.3 Compare
Order: page header → disclaimer line (4.6) → three plan cards → "Cash cost vs budget" chart and yield table (two columns) → "Why this result" panel → excluded rotations (collapsed).

Plan card anatomy (360 px wide at desktop, three in a row, equal height, actions pinned to the bottom):

```
┌──────────────────────────────────────────────┐
│ BEST FOR LOWEST COST            Fits budget ✓ │  caption (brand) · status badge
│                                              │
│ Sesame  →  Pearl millet                      │  h2, crop emoji 20px, never wraps mid-crop
│                                              │
│ CASH COST                                    │  caption
│ 327,000 XOF                                  │  hero-number (the only one)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░│               │  budget bar 8px, tick = budget
│ 53,000 XOF left of 380,000 budget            │  small; "53,000 XOF left" in --good/600
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │  dashed rule
│ Due before first sowing          54,000 XOF  │  secondary stat rows (4.3)
│ Harvest, typical year         0.7 t + 1.7 t  │
│ Severe water stress        0 of 24 seasons   │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ 2027  sow ≈ 3 Jul  ·  mature ≈ 30 Sep        │  small, one line each, nowrap,
│ 2028  sow ≈ 3 Jul  ·  mature ≈ 30 Sep        │  year in mono
│                                              │
│ See why →                                    │  ghost button, bottom-left
└──────────────────────────────────────────────┘
```

- Card label (top-left caption): "Your usual plan" (`--text-muted`), "Best for lowest cost" (`--brand`), "Option B" (`--text-muted`). The best card gets a 2 px `--brand` border and `--shadow`; the selected card (whose detail is shown below) shows "Showing details ↓" in place of "See why". Delete the floating ribbons and the blue outline.
- Over budget: badge "Over budget", bar fills past the tick in `--bad`, sub-line "74,500 XOF over the 380,000 budget" in `--bad`. Unverified: `--warn`, sub-line "Budget not verified: 2 prices missing".
- Label is "Cash cost" (never "Cash cost (2 seasons)"; the page title already says two seasons). Sowing lines drop the "(typical 26 Jun–21 Jul)" window and the "Rainy season" chip.
- Everything else moves into the "Why this result" panel: season 1/2 split, bad-year/good-year ranges with `RangeBar`, modeled net, sale prices, reason list with rule refs, cash timeline, replay chart, cost-lines table. That panel is one card with a segmented control: Reasons · Cash · Climate replay · Cost lines.
- Cost-lines table: remove the per-row "Synthetic demo" chip; put one source chip in the card header.

### 5.4 Farm
Two columns 7 / 5: map card (380 px; 240 px on phone) with the location search above it; right column "Field" form (area, soil, irrigation) as stacked labelled inputs. Below, full width: "Crop history" as a table (season, crop, outcome, fertilizer), with an "Add season" secondary button and the empty state from 4.9. Unknown values show the word "unknown" in `--text-muted`, not a blank.

### 5.5 Resources
Row 1, two cards: "Budget" (funds, reserve; then a single hero-number stat "Spendable 380,000 XOF" with the formula as its sub-line, replacing the green callout) and "Constraints" (segmented controls, checkboxes in two columns). Row 2: "What matters most" as a 4-option segmented control with the description of the selected option shown beneath (not four cards). Row 3: "Prices and yields" as **one** card with a crop segmented control on top and a single full-width table below (Item · Qty/ha · Unit · Unit price) so nothing clips; the amber warning becomes the disclaimer line.

### 5.6 Evidence
Tabs (4.7) under the header. Climate tab: one KPI strip card (4.3), then a 2-column grid of chart cards, then "Country context" (KPI strip + chart) and "Data provenance" as a secondary stat list with the query URL in mono, wrapped with `overflow-wrap: anywhere`. One NASA source chip per card header.

### 5.7 Report (screen and print)
A single column at `max-width: 760px`, styled as a document: h1 title, mono meta line (place, coordinates, date, rule pack), the best plan card (same component), cost-lines table, risk summary, caveats as a plain list. Print stylesheet: force light tokens (`:root { ...light values }` inside `@media print`), hide shell, `--bg` white, no shadows, 11 pt body, `break-inside: avoid` on cards and tables, page margin 16 mm, charts at 100 % width and 180 px height, links print their URL in mono.

### 5.8 Methods
Single column at `--measure`; h2 sections with body text; formulas in mono blocks on `--surface-2`; sources as a table (ID in mono, name, what it is used for, link). No icon tiles.

### 5.9 Pitch slides and video
Same tokens, same components, scaled. `.slide`: 16:9, `--surface` fill, 1 px `--border`, radius `--r`, padding 64 px, the hero's graph-paper background on the title slide only. Slide type: caption kicker (`--brand`), title at display size (clamp 28 to 56 px), body 20 px, numbers as hero-number at 64 px. Delete `.grad`, `.big` gradient text, `.glass`, the navy backdrop. Stage background `--bg`. Bar: secondary buttons, segmented control for "Full story · 12 / Submission · 7", progress as 12 small `--border` dots with the current one `--brand`. Slides showing product use the real components (plan card, charts), not redrawn mock-ups. `Scenes.tsx` colors come from the same tokens. Slides follow the app theme; the theme toggle is also in the pitch bar.

### 5.10 Phone (390 px)
- Shell: sidebar becomes a drawer (300 px, `--shadow`, scrim `rgb(0 0 0 / .4)`); appbar = menu button, page name, theme toggle, Present as icon-only.
- Gutter 16 px; all grids go to one column at ≤640; two columns from 641 to 1000.
- Landing: headline 28 px, primary button full width, the other two side by side below; result preview follows directly; `OrbitVisual` hidden.
- Compare: plan cards become a horizontal scroll-snap row (`scroll-snap-type: x mandatory`, each card 86 % of viewport width, the best card first) with three position dots; the detail panel's segmented control scrolls horizontally; cost-lines table shows Item, Total, Due only, the rest under a row tap.
- Touch targets ≥ 44 px (nav items, tabs, checkboxes). Tables scroll inside their wrapper; the page body never scrolls sideways.

## 6. Motion

- Durations: `--t-fast` 120 ms for hover, focus and press; `--t` 200 ms for tabs, disclosure and drawer; 300 ms max for page enter. Easing `--ease`. Animate `opacity` and `transform` only.
- Page enter: content fades in with a 4 px rise, once per route, no stagger. Plan cards do not animate individually. Budget bars grow from 0 once on first paint (300 ms).
- Charts: `isAnimationActive={false}` stays.
- Hero: the satellite orbit is the only ambient animation in the app.
- `@media (prefers-reduced-motion: reduce)`: all transitions and animations set to `0.01ms`, orbit paused at its resting frame, skeleton pulse off, framer-motion wrapped with `useReducedMotion()`. Nothing is ever left at `opacity: 0` waiting for a trigger.

## 7. Dark mode

- Default follows the system: no `data-theme` attribute, the `prefers-color-scheme` block applies.
- Toggle in the appbar and pitch bar: an icon button cycling **System → Light → Dark** (icons monitor / sun / moon, `aria-label` "Theme: system"). Light or Dark sets `document.documentElement.dataset.theme`; System removes the attribute.
- Storage key `fieldshift.theme`, values `light` | `dark`, absent = system. Read and write inside `try { … } catch { /* storage unavailable: stay on system */ }`. Apply the stored value in an inline script in `index.html` before first paint to avoid a flash.
- Leaflet: in dark, apply `filter: brightness(.75) contrast(1.1) saturate(.8)` to `.leaflet-tile-pane`; controls use `--surface` and `--border`.
- Print always uses light values. Check every page in both themes before merge.

## 8. Do-not list

- No gradients, glass, blur, glows, starfields or gradient text anywhere.
- No hex, rgb or named colors in TSX or outside the token blocks; no inline `style` colors.
- No card inside a card; no more than one hero number per card; no more than one primary button per view.
- No font weights other than 400 and 600; no text under 12 px; no heading tracking tighter than −0.02em.
- No new chip colors. Status color is for budget verdicts only, never decoration or chart series.
- No dual-axis charts, no red reference lines, no per-row source chips, no legend on single-series charts.
- No boxed multi-bullet disclaimers above content. One line plus "Details".
- No label that wraps in a stat (`nowrap` plus shorter copy), no clipped table columns, no horizontal page scroll at 390 px.
- No radius above 10 px except pills; no shadow on resting cards; no hover lift.
- No em-dash-heavy marketing copy, no emoji as icons (crop emoji in sequences are the one exception).
- No change to engine output, numbers or caveat wording beyond shortening labels listed here.
