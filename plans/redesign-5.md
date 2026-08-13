# CSS color tokens

## Context

Every color in the dashboard must be reachable as a CSS custom property on `:root` in `src/index.css`, so the design team can restyle the page by editing one block and never opens a `.tsx`. Today 12 color tokens exist there, while 32 literals sit inline in `src/App.css` and 20 more are hard-coded in TypeScript (`src/lib/status.ts`, `src/components/AlignmentMap.tsx`, `src/components/StripChart.tsx`). End state: `src/index.css` `:root` is the only place in `src/` where a color literal appears; CSS, SVG attributes and MapLibre paint all read from tokens.

Naming follows the functional grouping the app already implies (`--ink`, `--paper`, `--accent`, `--cp1`), so a token names a role, not a hue. Values that are byte-identical and semantically the same role collapse into one token; every visually distinct value keeps its own token, because the current values were contrast-tuned (`plans/amendment-2.md:258-261` records measured ratios for `#5f6d70`, `#a04302`, `#556265`). Exactly one merge changes a rendered pixel — see Step 2, row `.legend-swatch.hatched`.

## Approach

Step 1 must land first (later steps reference the tokens). Steps 2 and 3 are independent of each other. Step 4 depends on Steps 1 and 3, and must land as one unit — it deletes `STATUS_COLORS` and updates all three consumers in the same edit, so `tsc` stays green.

### Step 1 — Define the full palette on `:root` (`src/index.css`)

Replace lines 2-13 (the current 12 color tokens) with the block below, keeping the rest of `:root` (`--sans`, `--space-*`, layout, radii, and the `color`/`background`/`font-family` declarations at lines 32-37) untouched and after it. `--ink --muted --faint --paper --panel --line --accent --m2m --cp1 --cp2-3 --cp4 --lga` keep their exact names and values — they have ~50 references across `src/App.css`, `src/App.tsx:275-277`, `src/components/StripChart.tsx:20-24` and `src/components/Sparkline.tsx:126`; renaming them is churn with no benefit. Group comments are part of the deliverable: they are the map the design team reads.

```css
  /* Ink — text on light surfaces, darkest to faintest */
  --ink: #14181c;
  --prose: #556265;
  --label: #5f6d70;
  --muted: #6b7378;
  --faint: #9aa2a7;

  /* Surfaces */
  --paper: #ffffff;
  --panel: #fbfaf8;
  --panel-scrim: rgba(255, 255, 255, 0.96);
  --panel-sunken: #ebe7dc;
  --on-dark: #ffffff;

  /* Lines, edges, shadows */
  --line: #e3e1dc;
  --line-strong: #aeb6b5;
  --line-swatch: rgba(20, 24, 28, 0.12);
  --shadow-control: rgba(20, 24, 28, 0.18);
  --shadow-tooltip: rgba(23, 43, 50, 0.25);

  /* Accent and attention */
  --accent: #d95f02;
  --accent-ink: #a04302;
  --accent-wash: #fdf1e5;
  --warning-ink: #7a3c13;

  /* Construction packages, north to south */
  --m2m: #ff6a1c;
  --cp1: #769826;
  --cp2-3: #427ab5;
  --cp4: #f62477;
  --lga: #a8a492;

  /* Segment status palette — legend swatches, strip chart, map alignment */
  --status-not-started: #d9d9d9;
  --status-no-data: #f0f0f0;
  --status-no-data-hatch: #b7b7b7;
  --status-preconstruction: #e6ab02;
  --status-under-construction: #d95f02;
  --status-structure-complete: #66a61e;
  --status-guideway-complete: #1b9e77;
  --status-track-laid: #1f78b4;
  --status-systems-installed: #6a3d9a;

  /* Strip chart and sparkline furniture */
  --chart-axis: #c8ccce;
  --chart-rule: #d6d3cc;
  --chart-gap: #c3c8c6;
  --chart-mark: #172b32;
  --chart-mark-selected: #101c21;

  /* Tooltip (dark surface) */
  --tooltip-surface: rgba(23, 43, 50, 0.97);
  --tooltip-ink: #e9efef;
  --tooltip-muted: #bdc9ca;
  --tooltip-link: #f1be94;
  --tooltip-line: rgba(255, 255, 255, 0.2);

  /* Basemap tint — MapLibre paint, resolved in TS via src/lib/tokens.ts */
  --map-water: #e4e6e7;
  --map-waterway: #dfe1e2;
  --map-land: #efeeec;
  --map-relief-shadow: #6d7276;
  --map-relief-highlight: #ffffff;
  --map-relief-accent: #9aa0a4;
```

Deliberate non-merges, do not "simplify" them:
- `--accent` and `--status-under-construction` are both `#d95f02`. They stay separate: one is the UI action color (play button, scrubber `accent-color`, `.fn-ref:hover`), the other is a data category. Coupling them would make a button restyle rewrite the map.
- `--map-relief-highlight` and `--paper` are both `#ffffff`. Separate for the same reason: page background and hillshade highlight are unrelated knobs.
- `transparent` (`src/App.css:73`, `:169`, `:227`; `src/components/StripChart.tsx:250`) and `currentColor` (`src/App.css:18`) are keywords, not palette values — leave them literal.
- Vendor `maplibre-gl/dist/maplibre-gl.css` (imported at `src/components/AlignmentMap.tsx:5`) is out of scope; its control colors are not tokenized.

### Step 2 — Replace every literal in `src/App.css` (32 sites)

Mechanical, one declaration each; line numbers are from the current file, re-read before editing. Change only the color value in each declaration — no other property, selector or shorthand ordering changes.

| Line | Selector | Current | Replace with |
| --- | --- | --- | --- |
| 8 | `.notes-list li` `color` | `#556265` | `var(--prose)` |
| 22 | `.eyebrow` `color` | `#5f6d70` | `var(--label)` |
| 35 | `.sources-list li:target` `background` | `#fdf1e5` | `var(--accent-wash)` |
| 45 | `.rail-report-status.stale` `color` | `#7a3c13` | `var(--warning-ink)` |
| 55 | `.metric-status` `color` | `#7a3c13` | `var(--warning-ink)` |
| 56 | `.metric-packages .revised` `text-decoration: underline wavy` | `#a04302` | `var(--accent-ink)` |
| 60 | `.sparkline-gap` `stroke` | `#c3c8c6` | `var(--chart-gap)` |
| 66 | `.axis-toggle` `border` | `#aeb6b5` | `var(--line-strong)` |
| 68 | `.axis-toggle` `background` | `white` | `var(--paper)` |
| 79 | `.axis-toggle button.active` `color` | `white` | `var(--on-dark)` |
| 82 | `.cp-rule` `stroke` | `#d6d3cc` | `var(--chart-rule)` |
| 86 | `.strip-segment.hovered` `stroke` | `#172b32` | `var(--chart-mark)` |
| 87 | `.strip-segment.selected` `stroke` | `#101c21` | `var(--chart-mark-selected)` |
| 89 | `.structure-tick` `stroke` | `#172b32` | `var(--chart-mark)` |
| 90 | `.hover-marker` `stroke` | `#172b32` | `var(--chart-mark)` |
| 91 | `.axis-line` `stroke` | `#c8ccce` | `var(--chart-axis)` |
| 103 | `.segment-tooltip` `color` | `#e9efef` | `var(--tooltip-ink)` |
| 104 | `.segment-tooltip` `background` | `rgba(23, 43, 50, 0.97)` | `var(--tooltip-surface)` |
| 105 | `.segment-tooltip` `border` | `rgba(255,255,255,0.2)` | `var(--tooltip-line)` |
| 107 | `.segment-tooltip` `box-shadow` | `0 10px 32px rgba(23,43,50,0.25)` | `0 10px 32px var(--shadow-tooltip)` |
| 112 | `.segment-tooltip strong` `color` | `white` | `var(--on-dark)` |
| 113 | `.segment-tooltip > span` `color` | `#bdc9ca` | `var(--tooltip-muted)` |
| 114 | `.segment-tooltip > a` `color` | `#f1be94` | `var(--tooltip-link)` |
| 121 | `.segment-detail` `background` | `rgba(255,255,255,0.96)` | `var(--panel-scrim)` |
| 160 | `.segment-detail a` `color` | `#a04302` | `var(--accent-ink)` |
| 170 | `.segment-detail button` `border` | `#aeb6b5` | `var(--line-strong)` |
| 188 | `.play-button` `color` | `white` | `var(--on-dark)` |
| 213 | `.map-layer-switch .axis-toggle` `box-shadow` | `0 1px 6px rgba(20,24,28,0.18)` | `0 1px 6px var(--shadow-control)` |
| 222 | `.legend-swatch` `border` | `rgba(20,24,28,0.12)` | `var(--line-swatch)` |
| 227 | `.legend-swatch.hatched` gradient stripe | `#aeb7b5` | `var(--status-no-data-hatch)` |
| 231 | `.sources-list li` `color` | `#556265` | `var(--prose)` |
| 249 | `.load-state code` `background` | `#ebe7dc` | `var(--panel-sunken)` |

Row 227 is the one intentional pixel change: the legend's diagonal "no data" stripe goes `#aeb7b5` → `#b7b7b7`, matching the strip chart's hatch stripe (`src/components/StripChart.tsx:211`, `#b7b7b7`). Both stripes render the same status over the same `--status-no-data` fill, so they become one token; the delta is 9/255 on one channel. If a byte-for-byte legend is required instead, add `--legend-hatch: #aeb7b5` next to `--status-no-data-hatch` and use it here only.

Line 175 (`white-space: nowrap`) and line 185 (`white-space`) are not colors — a naive `white` search will hit them.

### Step 3 — `src/lib/tokens.ts` (new file)

No existing helper reads custom properties (`grep -rn "getComputedStyle" src` returns nothing), so this is new. MapLibre cannot take `var()`: it parses paint colors with its own `parseCssColor` (hex / rgb / hsl / named only — `node_modules/@maplibre/maplibre-gl-style-spec/dist/index.mjs:3291`, reached from `Color.parse`), and an unparseable value is a `color expected` validation error. So map paint resolves tokens through the cascade at layer-creation time, while DOM styles and SVG presentation attributes keep using `var()` — verified working in this app today: `.cp-label` `fill={boundary.color}` with `var(--m2m)` computes to `rgb(255, 106, 28)`, and `.sparkline-run` `stroke="var(--cp1)"` computes to `rgb(118, 152, 38)`.

```ts
/**
 * Every color in the UI is a CSS custom property on `:root` in `src/index.css`, so the
 * design team restyles the page without touching TypeScript. DOM styles and SVG
 * presentation attributes take `var(--token)` directly; MapLibre parses paint colors
 * with its own CSS color parser, which does not understand `var()`, so map paint has to
 * read the resolved value out of the cascade instead.
 *
 * The value is read when the caller runs — for the map, when a layer is created. A token
 * edited afterwards (CSS hot update, devtools) repaints the strip chart and legend at
 * once but leaves the map on the values it captured until the map is re-created.
 */
export function resolveColor(token: `--${string}`): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (value === '') throw new Error(`CSS color token ${token} is not defined on :root`);
  return value;
}
```

Throwing on a missing token is deliberate: a renamed or deleted token already breaks the strip chart visibly (an invalid `var()` in a presentation attribute drops `fill` to its initial black), so there is no silent mode to protect, and the thrown message names the token. The throw happens inside the map's `load` handler, so the rest of the page still renders.

### Step 4 — Status palette from CSS, single unit

All four files change together: removing `STATUS_COLORS` breaks its three consumers, which `grep -rn "STATUS_COLORS" src` lists exactly (`AlignmentMap.tsx:7,140-147`, `Legend.tsx:1,30`, `StripChart.tsx:4,210,230,240`). No test references it (`npm test` runs `src/lib/status.test.ts` and four others; none mention colors).

**4a. `src/lib/status.ts`** — replace `STATUS_COLORS` (lines 30-39) with:

```ts
/**
 * Status colors live on `:root` in `src/index.css`. DOM styles and SVG attributes use
 * `STATUS_COLOR_VARS`; MapLibre paint needs a resolved literal, so it looks the token
 * name up through `resolveColor` (`src/lib/tokens.ts`).
 */
export const STATUS_COLOR_TOKENS: Record<AlignmentStatus, `--${string}`> = {
  not_started: '--status-not-started',
  no_data: '--status-no-data',
  preconstruction: '--status-preconstruction',
  under_construction: '--status-under-construction',
  structure_complete: '--status-structure-complete',
  guideway_complete: '--status-guideway-complete',
  track_laid: '--status-track-laid',
  systems_installed: '--status-systems-installed',
};

export const STATUS_COLOR_VARS = Object.fromEntries(
  Object.entries(STATUS_COLOR_TOKENS).map(([status, token]) => [status, `var(${token})`]),
) as Record<AlignmentStatus, string>;
```

Keep `ALIGNMENT_STATUSES` and `STATUS_LABELS` as they are. The single `as` cast is the price of deriving the vars record from the token record; do not hand-write a second literal record that can drift.

**4b. `src/components/Legend.tsx`** — import `STATUS_COLOR_VARS` instead of `STATUS_COLORS` (line 1); line 30 becomes `style={{ backgroundColor: STATUS_COLOR_VARS[status] }}`.

**4c. `src/components/StripChart.tsx`** — import `STATUS_COLOR_VARS` instead of `STATUS_COLORS` (line 4); then
- line 210: `<rect width="6" height="6" fill={STATUS_COLOR_VARS.no_data} />`
- line 211: `stroke="var(--status-no-data-hatch)"` (was `"#b7b7b7"`)
- line 230: `const fill = status === 'no_data' ? 'url(#no-data-hatch)' : STATUS_COLOR_VARS[status];`
- line 240: `stroke={STATUS_COLOR_VARS[status]}`

**4d. `src/components/AlignmentMap.tsx`** — line 7 imports `STATUS_COLOR_TOKENS` from `../lib/status`; add `import { resolveColor } from '../lib/tokens';`. Inside the `map.on('load')` callback (line 71) declare once, above the hillshade layer:

```ts
      const statusColor = (status: AlignmentStatus): string => resolveColor(STATUS_COLOR_TOKENS[status]);
```

`AlignmentStatus` is already imported as a type at line 6. Then:
- lines 86-88: `'hillshade-shadow-color': resolveColor('--map-relief-shadow')`, `'hillshade-highlight-color': resolveColor('--map-relief-highlight')`, `'hillshade-accent-color': resolveColor('--map-relief-accent')`.
- basemap flattening (lines 109-118): hoist the three tints above the `for` loop so the loop over ~100 style layers does not call `getComputedStyle` per layer —
  ```ts
      const waterwayTint = resolveColor('--map-waterway');
      const waterTint = resolveColor('--map-water');
      const landTint = resolveColor('--map-land');
  ```
  and the ternary becomes `layer.id.startsWith('waterway') ? waterwayTint : layer.id.startsWith('water') ? waterTint : GRAY_PREFIXES.some(...) ? landTint : null`. Keep the existing comment at lines 105-108 and the `GRAY_PREFIXES` list unchanged.
- line 126: `'line-color': resolveColor('--chart-mark'),`
- lines 138-148: keep the explicit `match` shape, swapping each value for `statusColor('preconstruction')`, `statusColor('under_construction')`, `statusColor('structure_complete')`, `statusColor('guideway_complete')`, `statusColor('track_laid')`, `statusColor('systems_installed')`, `statusColor('not_started')`, and the fallback `statusColor('no_data')`. Do not rebuild this array with a spread over `ALIGNMENT_STATUSES` — MapLibre's expression types reject the widened array without a cast, and the explicit list is the pattern already in the file.

## Critical files & anchors

- `src/index.css:1-38` — the `:root` block Step 1 rewrites; the trailing `color`/`background`/`font-family` declarations must stay inside `:root`, after the token list.
- `src/components/AlignmentMap.tsx:71-150` — the `map.on('load')` body; the only place resolved (non-`var()`) colors are required.
- `src/lib/status.ts:19-50` — `ALIGNMENT_STATUSES` / `STATUS_COLORS` / `STATUS_LABELS` sit adjacent; only the middle one is replaced.
- `src/components/StripChart.tsx:203-275` — SVG `<defs>` hatch pattern plus the segment fill/stroke paths, i.e. all four status-color reads in one render.

## Verification

Run from the repo root.

1. `npm run lint && npm run build` — oxlint plus `tsc -b && vite build`, both must pass. `npm test` (five `tsx --test` suites) must stay green; none touch colors, so a failure means an unrelated edit slipped in.
2. Completeness check — search `src` for `#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(` and confirm every hit is inside the `:root` block of `src/index.css`. That block must define exactly 49 color tokens: 43 hex plus 6 `rgba(` (`--panel-scrim`, `--line-swatch`, `--shadow-control`, `--shadow-tooltip`, `--tooltip-surface`, `--tooltip-line`). Any hit in `src/App.css`, `src/lib/**`, or `src/components/**` is a missed site. `transparent` / `currentColor` keywords are expected to remain.
3. Runtime no-regression check — `npm run dev`, open the app (dev server serves it at the `/hsr-dashboard/` base), and evaluate in the page console:

```js
const cs = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : `MISSING ${sel}`; };
({
  legendSwatches: [...document.querySelectorAll('.legend-swatch')].map(el => getComputedStyle(el).backgroundColor),
  stripFills: [...document.querySelectorAll('.strip-segment')].slice(0, 3).map(el => getComputedStyle(el).fill),
  cpLabels: [...document.querySelectorAll('.cp-label')].map(el => getComputedStyle(el).fill),
  hatchFill: getComputedStyle(document.querySelector('#no-data-hatch rect')).fill,
  hatchStroke: getComputedStyle(document.querySelector('#no-data-hatch line')).stroke,
  legendHatch: cs('.legend-swatch.hatched', 'backgroundImage'),
  axisLine: cs('.axis-line', 'stroke'), cpRule: cs('.cp-rule', 'stroke'),
  tick: cs('.structure-tick', 'stroke'), gap: cs('.sparkline-gap', 'stroke'),
  toggle: [cs('.axis-toggle', 'borderTopColor'), cs('.axis-toggle', 'backgroundColor')],
  toggleActive: [cs('.axis-toggle button.active', 'color'), cs('.axis-toggle button.active', 'backgroundColor')],
  play: [cs('.play-button', 'color'), cs('.play-button', 'backgroundColor')],
  prose: [cs('.notes-list li', 'color'), cs('.sources-list li', 'color')],
  swatchBorder: cs('.legend-swatch', 'borderTopColor'), switchShadow: cs('.map-layer-switch .axis-toggle', 'boxShadow'),
})
```

Baseline measured on the current code at 1512×950 — every value below must come back identical except `legendHatch`:

- `legendSwatches` → `["rgb(217, 217, 217)","rgb(240, 240, 240)","rgb(230, 171, 2)","rgb(217, 95, 2)","rgb(102, 166, 30)","rgb(27, 158, 119)","rgb(31, 120, 180)","rgb(106, 61, 154)"]` (proves `var()` resolves through the inline `style` in `Legend.tsx`)
- `stripFills` → `["rgb(217, 217, 217)","url(\"#no-data-hatch\")","rgb(217, 95, 2)"]`
- `cpLabels` → `["rgb(255, 106, 28)","rgb(118, 152, 38)","rgb(66, 122, 181)","rgb(246, 36, 119)","rgb(168, 164, 146)"]`
- `hatchFill` → `rgb(240, 240, 240)`; `hatchStroke` → `rgb(183, 183, 183)`
- `legendHatch` → **changes** from `repeating-linear-gradient(45deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 3px, rgb(174, 183, 181) 3px, rgb(174, 183, 181) 4px)` to the same string with `rgb(183, 183, 183)`
- `axisLine` → `rgb(200, 204, 206)`; `cpRule` → `rgb(214, 211, 204)`; `tick` → `rgb(23, 43, 50)`; `gap` → `rgb(195, 200, 198)`
- `toggle` → `["rgb(174, 182, 181)", "rgb(255, 255, 255)"]`; `toggleActive` → `["rgb(255, 255, 255)", "rgb(20, 24, 28)"]`; `play` → `["rgb(255, 255, 255)", "rgb(217, 95, 2)"]`
- `prose` → `["rgb(85, 98, 101)", "rgb(85, 98, 101)"]`; `swatchBorder` → `rgba(20, 24, 28, 0.12)`; `switchShadow` → `rgba(20, 24, 28, 0.18) 0px 1px 6px 0px`

4. Hover and selection states (not in the default DOM) — hover the first wide `.strip-segment` (the leftmost segment is ~294 px wide at 1512 px viewport), then click it. Expected: `.segment-tooltip` `color rgb(233, 239, 239)`, `backgroundColor rgba(23, 43, 50, 0.97)`, `borderTopColor rgba(255, 255, 255, 0.2)`, `boxShadow rgba(23, 43, 50, 0.25) 0px 10px 32px 0px`, `strong` `rgb(255, 255, 255)`, `> span` `rgb(189, 201, 202)`; `.strip-segment.hovered` stroke `rgb(23, 43, 50)`; after the click `.strip-segment.selected` stroke `rgb(16, 28, 33)`, `.segment-detail` background `rgba(255, 255, 255, 0.96)`, `.segment-detail a` `rgb(160, 67, 2)`, `.segment-detail button` `borderTopColor rgb(174, 182, 181)`, `.eyebrow` `rgb(95, 109, 112)`.
5. Map proof (Step 4d is the only step that can fail silently) — with the map visible, confirm the alignment renders in the status palette (orange/green/blue over the gray basemap) and that the console has **no** MapLibre `color expected` / `Invalid color` error and no `CSS color token … is not defined` throw. Then toggle to Satellite and back; the map must still paint. A screenshot of the map pane before/after the change is the record.
6. Design-team workflow proof (exercises the new capability, not just parity) — in the page console run `document.documentElement.style.setProperty('--status-under-construction', '#0000ff')`. Every under-construction strip segment and its legend swatch must turn blue immediately with no reload; the map keeps its captured color until reload, which is the documented behavior of `resolveColor`. Then edit `--accent: #0055ff` in `src/index.css` and save: Vite's CSS hot update must recolor the play button and scrubber without a page reload. Revert both.
7. Rules whose elements do not render in the default state — `.metric-status`, `.rail-report-status.stale`, `.sources-list li:target`, `.load-state code`, `.segment-tooltip > a` (the tooltip is plain text today, so this rule is currently dead). Verify by token existence plus source inspection: `['--warning-ink','--accent-wash','--panel-sunken','--tooltip-link'].map(t => getComputedStyle(document.documentElement).getPropertyValue(t).trim())` → `["#7a3c13","#fdf1e5","#ebe7dc","#f1be94"]`. For `:target`, navigating to `#fn-ts1_alignment` must tint that source row with `--accent-wash`.

## Assumptions & contingencies

- **Functional grouping, one visible change.** Tokens are merged only where value and role are identical (`#172b32` ×4 → `--chart-mark`, `#7a3c13` ×2 → `--warning-ink`, `#a04302` ×2 → `--accent-ink`, `#556265` ×2 → `--prose`, `white` ×3 → `--on-dark` plus the toggle surface → `--paper`), and the two "no data" hatch grays are unified on `#b7b7b7`. If a byte-for-byte-identical render is required, add `--legend-hatch: #aeb7b5` and use it at `src/App.css:227`; nothing else in the plan changes.
- **Single light theme, tokens on `:root` only.** No `prefers-color-scheme` block, no `[data-theme]` scoping, no second file: `src/index.css` already owns `:root` and a `tokens.css` would add an import-order question for no gain. If the design team later wants dark mode, the token block is the hook.
- **CSS is applied before the map reads it.** `src/main.tsx:4` imports `./index.css` before rendering `App`, and the production build emits a blocking `<link>`, so `getComputedStyle` inside `map.on('load')` sees the tokens. If a future change lazy-loads the stylesheet and `resolveColor` throws at map load, resolve the tokens once in `main.tsx` after mount and pass them into `AlignmentMap` as a prop rather than reintroducing hex literals.
- **CP tokens stay domain-named.** `--m2m --cp1 --cp2-3 --cp4 --lga` are already tokens referenced from `src/App.tsx:275-277` and `src/components/StripChart.tsx:20-24` as `var(...)` strings; they are left exactly as they are.
