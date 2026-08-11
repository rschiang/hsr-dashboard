# Dashboard redesign — mockup layout, transit type, trackwork block

## Context

Restyle and rearrange the CAHSR Merced–Bakersfield dashboard to match `design/mockup.png`:
a scrollable page (≥180vh) whose first screen is a top bar (title, subtitle, last-updated,
GitHub link) over a full-bleed grayscale-terrain map on the left, a stacked metric rail
(big number + sparkline + legend) on the right, and a full-bleed status strip at the bottom that
keeps its mileposts and station names but drops the per-label footnote crosses; everything else
(per-package detail table, segment detail, data gaps, notes, sources) moves one scroll below into
a footnote region. Type moves to Public Sans. Superscript
`source` words become subtle numeric footnote markers that jump to the source list. One new
data item: a **trackwork** metric block, grounded in the 2026 Final Business Plan.

Data semantics do not change: no metric is re-derived, no unknown is filled in, and the three
ROW parcel series (acquired / delivered to design-builder / railroad) stay distinct.

## Grounded facts (verified this session)

- `src/App.tsx` (568 ln) renders `main.app-shell` → `div.dashboard-column` containing
  `header.summary-header`, `PackageBands`, `DataGapDisclosure`, `StripChart`, `SegmentDetail`,
  `TimeScrubber`, `AlignmentMap`; `<Legend />` is a sibling aside. Helpers already present and
  reused below: `sumPackages(snapshot, key)`, `CVSR_PACKAGES`, `PACKAGE_BAND_METRICS`,
  `groupCvsrGaps`/`groupTranscriptions`/`groupRevisions`, `GAP_LABELS`, `GAP_METRIC_LABELS`,
  `ReportLink`, `SnapshotReportLink`, `DataGapDisclosure`, `PackageBands`.
- `src/index.css` `:root` holds `--ink #172b32`, `--muted`, `--paper #f4f1e8`, `--panel`,
  `--line`, `--accent #d95f02`, `--green`, `--sans: Inter…`, `--serif: Iowan Old Style…`.
  `--serif` is referenced only in `src/App.css` at lines 40, 85, 212, 265, 299, 488.
- `SourceLink` is never called with an explicit `label` prop anywhere — dropping `label` is safe.
  Callsites: `App.tsx` 269/277/285/362/374/480/482/484/486/487, `SegmentDetail.tsx`
  47/53/59/61/68/74, `StripChart.tsx` 281/282/283/290, `Legend.tsx` 40/43.
- `src/lib/mileposts.ts` `iosMileToOfficialMp` (lines 41–43) returns `mp = 124 + iosMile` on all
  three subdivisions — C is `124 + iosMile`, S is `124 + iosMile`, and D is `295 + iosMile − 171`,
  which is also `124 + iosMile`. The published milepost and iosMile are the same number at a
  constant +124 offset over the whole route. `formatOfficialMp` (line 46) joins them as `"C 124"`
  and is imported by `StripChart.tsx:6` **and** `scripts/build-segments.ts:10` (used at
  85/86/139/140/196/197/228/229) — the script keeps it.
- `sparklineLabel` (`src/lib/cvsr-series.ts`) is used only by `App.tsx:535`; no test imports it.
  `buildCvsrSeries` is covered by `src/lib/cvsr-series.test.ts` — its signature must not change.
- `STATUS_COLORS` (`src/lib/status.ts:31`) already matches the mockup swatches
  (`#d9d9d9 #f0f0f0 #e6ab02 #d95f02 #66a61e #1b9e77 #1f78b4 #6a3d9a`) — do not change them.
- `AlignmentMap.tsx` uses `style: 'https://tiles.openfreemap.org/styles/positron'`, center
  `[-119.73, 36.35]`, zoom `6.55`, `NavigationControl` at `'top-left'`, `customAttribution`
  with 4 entries, layers `alignment-casing` + `alignment-status`, and renders a visible
  `.map-title` block (`AlignmentMap.tsx:153-159`).
- AWS Terrain Tiles `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
  verified reachable (HTTP 200, `image/png`) — keyless MapLibre `raster-dem`, `encoding: 'terrarium'`.
- `@fontsource-variable/public-sans` latest is `5.3.0` on the npm registry (verified).
- Repo `https://github.com/rschiang/hsr-dashboard`; Vite `base: '/hsr-dashboard/'`.
- **Trackwork source**, from `data/raw/2026-Final-Business-Plan-060126-A11Y.pdf` (text extracted
  this session): *Exhibit D.0: Merced – Bakersfield Timeline for Major Scope Items* lists, under
  the **119-Mile Central Valley Segment (CVS)**, `Track & Systems Design & Construction —
  NOT STARTED`. The CEO letter section *Looking Ahead: Anticipated 2026 Milestones* states
  "the Authority has entered a new era of construction: laying track across the Central Valley"
  and "the track laying phase can commence". **No month is published** — the mockup's
  "SEP 2026" is not sourced, so the chip reads `Upcoming 2026`. No track-mileage denominator is
  published either, so the block shows a bare `0 mi` with no total (as the mockup does).

## Approach

Steps 1–2 are prerequisites for everything else. Steps 3, 4, 5, 6, 6b, and 8 are independent of
each other and may be done in any order after 1–2. Step 7 needs 3, 5, 6, 6b, and 8 in place
because it assembles their components into the page shell; step 9 runs last.

### Step 1 — Type, tokens, page shell primitives

1. `npm install @fontsource-variable/public-sans@5.3.0` (adds it to `dependencies`).
2. `src/main.tsx`: add `import '@fontsource-variable/public-sans';` as the first import line,
   before `import './index.css'`.
3. `src/index.css` `:root` — replace the token block with:
   ```css
   --ink: #14181c;
   --muted: #6b7378;
   --faint: #9aa2a7;
   --paper: #ffffff;
   --panel: #fbfaf8;
   --line: #e3e1dc;
   --accent: #d95f02;
   --cp1: #14181c;
   --cp2-3: #1f5fa8;
   --cp4: #1b9e77;
   --sans: 'Public Sans Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
   ```
   Delete `--serif`. Run `grep -rn "var(--green)" src` — if it returns nothing, delete `--green`
   too; if it returns hits, keep the token untouched.
4. `src/index.css`: change `html, body, #root` to `height: auto; min-height: 100%;` and delete the
   `@media (max-width: 900px)` block that duplicated that. Add:
   ```css
   .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
   ```
5. `src/App.css`: delete the six `font-family: var(--serif);` declarations at lines 40, 85, 212,
   265, 299, 488 (the surrounding rules keep their other properties and inherit `--sans`).
6. `index.html`: `<title>Tracking On — CA HSR Construction Dashboard</title>`.

### Step 2 — Numeric footnote citations

Rewrite `src/components/Citation.tsx`. The marker is a superscript numeral in `--faint` that
links to the matching `<li>` in the source list; the outbound URL lives only on that `<li>`.
Numbering is the 1-based position in the `SOURCES` object, so **new sources must be appended
last** (step 5 does exactly that) to keep existing numbers stable.

```tsx
import { SOURCES, type SourceId } from '../data/sources';

const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

export function sourceNumber(sourceId: SourceId): number {
  return SOURCE_IDS.indexOf(sourceId) + 1;
}

export function SourceLink({ sourceId, title }: { sourceId: SourceId; title?: string }) {
  const source = SOURCES[sourceId];
  return (
    <a
      className="fn-ref"
      href={`#fn-${sourceId}`}
      title={title ?? `${source.publisher}, ${source.title} (${source.date})`}
    >
      <sup>{sourceNumber(sourceId)}</sup>
    </a>
  );
}
```

`SourcesList` keeps its current markup but each `<li>` gains `id={`fn-${id}`}` and iterates
`SOURCE_IDS` so the rendered order matches the numbering.

`App.tsx` `ReportLink` (currently `<sup className="source-link">…report…</sup>`) becomes an
external-link glyph in the same style — there is no footnote entry for a per-gap report URL:
```tsx
<a className="fn-ref" href={gap.reportUrl} target="_blank" rel="noreferrer" title={gap.detail}><sup>↗</sup></a>
```
`SnapshotReportLink` keeps its worded link text; it renders inside the below-fold package table,
not inline in prose.

`src/App.css`: delete the `.source-link` rules (lines 53–64) and add:
```css
.fn-ref { color: var(--faint); text-decoration: none; font-variant-numeric: tabular-nums; }
.fn-ref:hover, .fn-ref:focus-visible { color: var(--accent); }
.fn-ref sup { padding-left: 1px; font-size: 0.68em; font-weight: 700; }
.sources-list li { scroll-margin-top: 24px; }
.sources-list li:target { background: #fdf1e5; }
```

### Step 3 — Top bar

Replace `header.summary-header` (and its `.title-block` / `.headline-metrics` children — the two
headline metrics are superseded by the rail) with:

```tsx
<header className="topbar">
  <h1>Tracking On</h1>
  <p className="topbar-meta">
    <span>CA HSR Construction Dashboard</span>
    <span>Last updated {new Date(data.segments.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
    <a href="https://github.com/rschiang/hsr-dashboard" target="_blank" rel="noreferrer" aria-label="Source code on GitHub">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
    </a>
  </p>
</header>
```

Also update the two `load-state` early returns in `App.tsx` (lines 233–238) to use the new
title: `<h1>Tracking On</h1>` with the eyebrow text unchanged.

CSS (replace `.summary-header`, `.title-block*`, `.headline-metrics*` rules):
```css
.topbar { flex: 0 0 auto; padding: 20px 26px 14px; background: var(--paper); }
.topbar h1 { font-size: clamp(30px, 3.4vw, 44px); font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
.topbar-meta { display: flex; align-items: center; gap: 18px; margin-top: 8px; font-size: 13px; font-weight: 600; }
.topbar-meta a { display: inline-flex; color: var(--muted); }
.topbar-meta a:hover { color: var(--ink); }
.topbar-meta svg { fill: currentColor; }
```

### Step 4 — Map: grayscale terrain, full-bleed

In `src/components/AlignmentMap.tsx`:

1. Inside `map.on('load')`, **before** `map.addSource('alignment', …)`, add the DEM + hillshade
   under the label layers:
   ```ts
   map.addSource('terrain-dem', {
     type: 'raster-dem',
     tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
     tileSize: 256,
     maxzoom: 13,
     encoding: 'terrarium',
   });
   const firstSymbol = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
   map.addLayer({
     id: 'terrain-hillshade',
     type: 'hillshade',
     source: 'terrain-dem',
     paint: {
       'hillshade-exaggeration': 0.45,
       'hillshade-shadow-color': '#6d7276',
       'hillshade-highlight-color': '#ffffff',
       'hillshade-accent-color': '#9aa0a4',
     },
   }, firstSymbol);
   ```
2. Immediately after, neutralize the basemap's remaining colour. Positron is already near-gray;
   this only flattens water and vegetation so the hillshade is the only relief cue:
   ```ts
   const GRAY_PREFIXES = ['landcover', 'landuse', 'park', 'wood', 'grass', 'sand', 'beach', 'pier', 'aeroway'];
   for (const layer of map.getStyle().layers ?? []) {
     const gray = layer.id.startsWith('waterway') ? '#dfe1e2'
       : layer.id.startsWith('water') ? '#e4e6e7'
       : GRAY_PREFIXES.some((prefix) => layer.id.startsWith(prefix)) ? '#efeeec'
       : null;
     if (gray === null) continue;
     if (layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', gray);
     else if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-color', gray);
   }
   ```
   This runs before the alignment layers are added, so it can never repaint them. If OpenFreeMap
   renames its layers the loop matches nothing and the map degrades to plain positron + hillshade —
   acceptable; do not hard-code a style JSON to work around it.
3. Add a fifth `customAttribution` entry:
   `'Hillshade: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">AWS Terrain Tiles</a>'`.
4. Move `NavigationControl` to `'bottom-left'` (the top-left corner now abuts the top bar).
5. Replace the visible `.map-title` block (lines 153–159) with a screen-reader heading:
   `<h2 id="map-heading" className="sr-only">Central Valley alignment</h2>`.
   Delete the `.map-title` CSS rules; change `.map-section` to `position: relative;` only
   (drop its fixed height / grid rules) and `.map-section > .map-container { position: absolute; inset: 0; }`
   stays.
6. Leave `center`/`zoom` at `[-119.73, 36.35]` / `6.55` — that is the mockup framing.

### Step 5 — Metric rail (incl. the new trackwork block)

**5a. `src/data/sources.ts`** — append **after** `business_plan_2026` (last position, so no
existing footnote number shifts):
```ts
business_plan_2026_schedule: {
  title: '2026 Final Business Plan, Exhibit D.0: Merced – Bakersfield Timeline for Major Scope Items',
  date: '2026-06-01',
  publisher: 'California High-Speed Rail Authority',
  url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf',
},
```

**5b. Rewrite `src/components/Sparkline.tsx`** to take multiple series. Keep the existing
run-splitting logic verbatim (contiguous published runs drawn as separate paths, never bridged)
and apply it per series. New API:

```tsx
export type SparklineSeries = { id: string; points: Array<CvsrSeriesPoint | null>; color: string };

export function Sparkline({ series, selectedIndex, label }: {
  series: SparklineSeries[];
  selectedIndex: number | null;
  label: string;
}): React.ReactElement
```

- `<svg className="sparkline" viewBox="0 0 240 44" width="100%" height="44" preserveAspectRatio="none" role="img" aria-label={label}>` with `<title>{label}</title>`.
- `xAt(i) = 2 + i * (236 / (n - 1))` (`0` when `n <= 1`); `yAt(p) = 40 - p.ratio * 34`.
- Every stroked element carries `vectorEffect="non-scaling-stroke"` — `preserveAspectRatio="none"`
  would otherwise smear stroke width.
- A series whose points are **all null** renders one dashed baseline instead of paths:
  `<line x1="2" x2="238" y1="40" y2="40" stroke={color} strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />`.
  This is the trackwork block's rendering — a dashed floor, never an invented trend.
- A run of length 1 stays a `<circle r="1">`; do **not** give circles `vectorEffect`, and place
  them with `xAt`/`yAt` as today.
- Selected-month marker: a vertical rule on the whole chart rather than a dot, because
  `preserveAspectRatio="none"` distorts circles:
  `<line x1={x} x2={x} y1="2" y2="42" stroke="var(--accent)" strokeWidth="1" strokeDasharray={exact ? undefined : '2 2'} vectorEffect="non-scaling-stroke" />`
  where `x = xAt(selectedIndex)` when `selectedIndex !== null` and `0 <= selectedIndex < n`, and
  `exact` is `series[0].points[selectedIndex] !== null` (falls back to `false` when `series` is empty).
  Render nothing when `selectedIndex` is `null` or out of range.

**5c. New `src/components/MetricBlock.tsx`** — no existing equivalent:
```tsx
export function MetricBlock({ label, value, unit, chip, packages, series, selectedIndex, ariaLabel }: {
  label: string;
  value: string;                 // pre-formatted: "87.1 / 119", "1,080 / 1,080", "0", or "—"
  unit?: string;                 // "mi"
  chip?: React.ReactNode;        // e.g. <>Upcoming 2026 <SourceLink … /></>
  packages?: Array<{ cp: string; percent: string }>;   // percent pre-formatted: "100%" or "—"
  series: SparklineSeries[];
  selectedIndex: number | null;
  ariaLabel: string;
}): React.ReactElement
```
```html
<section class="metric-block">
  <div class="metric-head">
    <h3>{label}</h3>
    {chip && <span class="metric-chip">{chip}</span>}
    {packages && <ul class="metric-packages">{…<li><b>{cp}</b>: {percent}</li>}</ul>}
  </div>
  <p class="metric-value">{value}{unit && <span class="metric-unit">{unit}</span>}</p>
  <Sparkline series={series} selectedIndex={selectedIndex} label={ariaLabel} />
</section>
```

**5d. New `MetricRail` component inside `src/App.tsx`** (sits next to `PackageBands`; it reads
the same snapshot and reuses `sumPackages`, `CVSR_PACKAGES`, and `buildCvsrSeries`).

Metric definitions — a module-level `RAIL_METRICS` array, in this exact order:

| label | value key | total key | unit | value format |
|---|---|---|---|---|
| `Guideway complete` | `guidewayMilesComplete` | `guidewayMilesTotal` | `mi` | `v.toFixed(1) + ' / ' + t.toFixed(0)` |
| `Structures complete` | `structuresComplete` | `structuresTotal` | — | `v + ' / ' + t` |
| `ROW parcels acquired` | `parcelsAcquired` | `parcelsAcquisitionTotal` | — | `v.toLocaleString() + ' / ' + t.toLocaleString()` |
| `ROW delivered to DB` | `parcelsDelivered` | `parcelsTotal` | — | `v.toLocaleString() + ' / ' + t.toLocaleString()` |
| `Railroad ROW parcels` | `railroadParcelsAcquired` | `railroadParcelsTotal` | — | `v.toLocaleString() + ' / ' + t.toLocaleString()` |
| `Utilities relocated` | `utilitiesRelocated` | `utilitiesTotal` | — | `v.toLocaleString() + ' / ' + t.toLocaleString()` |

Rules for those six:
- Aggregate = `sumPackages(displayCvsrSnapshot, valueKey)` / `sumPackages(displayCvsrSnapshot, totalKey)`.
  `sumPackages` already returns `undefined` when any package is missing the field — in that case
  the block's `value` is `'—'`. Never partially sum.
- `packages`: one entry per `CVSR_PACKAGES` id; `percent` = `Math.round(v / t * 100) + '%'` from
  `displayCvsrSnapshot.perPackage[cp]`, or `'—'` when either side is missing or `t <= 0`.
- `series`: `CVSR_PACKAGES.map((cp) => ({ id: cp, points: buildCvsrSeries(snapshots, inventory.expectedMonths, cp, valueKey, totalKey), color: cp === 'CP1' ? 'var(--cp1)' : cp === 'CP2-3' ? 'var(--cp2-3)' : 'var(--cp4)' }))`.
  Memoise the whole map with `useMemo` keyed on `[inventory.expectedMonths, snapshots]`, exactly
  as the current `PackageBands` `series` memo does — then delete that memo from `PackageBands`.
- `selectedIndex` = `inventory.expectedMonths.indexOf(selectedMonth)`, or `null` when `< 0`.
- `ariaLabel` = `CVSR_PACKAGES.map((cp) => sparklineLabel(label, cp, points[cp])).join('; ')`
  using the existing `sparklineLabel` from `src/lib/cvsr-series.ts`.
- When `selectedMonth < inventory.coverageStart`, render `value: '—'` and all package percents
  `'—'` (mirrors the existing `beforeCoverage` handling); the sparklines still render.

The **trackwork block** is rendered first, above the six, hand-built rather than table-driven:
```tsx
<MetricBlock
  label="Track installed"
  value="0"
  unit="mi"
  chip={<>Upcoming 2026 <SourceLink sourceId="business_plan_2026_schedule" /></>}
  series={[{ id: 'track', points: inventory.expectedMonths.map(() => null), color: 'var(--cp1)' }]}
  selectedIndex={null}
  ariaLabel="Track installed: zero miles. The 2026 Final Business Plan reports Track and Systems design and construction for the 119-mile Central Valley Segment as not started, and the Authority publishes no monthly track-installation series."
/>
```
No denominator: the Authority publishes no track-mileage total, and reusing the 119-mile guideway
total would substitute a related measure for a missing one. No `packages` list. `selectedIndex`
is `null` so no replay marker is drawn on a series that does not exist.

CSS:
```css
.metric-rail { display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding: 14px 20px 16px; border-left: 1px solid var(--line); background: var(--paper); }
.metric-block { display: grid; gap: 2px; }
.metric-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.metric-head h3 { margin: 0; font-size: 11.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
.metric-chip { font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); }
.metric-packages { margin: 0; padding: 0; list-style: none; text-align: right; font-size: 10.5px; font-weight: 700; line-height: 1.35; color: var(--muted); font-variant-numeric: tabular-nums; }
.metric-value { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1.05; }
.metric-unit { margin-left: 1px; font-size: 15px; font-weight: 700; letter-spacing: 0; }
.sparkline { display: block; width: 100%; height: 44px; overflow: visible; }
.sparkline-run { fill: none; stroke-width: 1.25; }
```
`.sparkline-run` must no longer hard-code a stroke colour — the colour comes from the per-series
`stroke` attribute. Delete the old `.sparkline` width/height rules and `.sparkline-point` stays.

### Step 6 — Status strip: full-bleed, one-row axis, no footnote crosses

**What declutter means here:** the `†` cross after every tick label and every station name goes
away — all eighteen-plus of them pointed at just two sources, which are cited once in the footer
— the strip goes edge to edge, and the two stacked label rows collapse into one. The mileposts
and the station names **stay**; they are the only geographic reference the strip has.

**Why the ruler prints the published milepost and drops iosMile.** `iosMileToOfficialMp`
(`src/lib/mileposts.ts:41-43`) is `mp = 124 + iosMile` on every subdivision — C (`124 + iosMile`),
S (`124 + iosMile`), and D (`295 + iosMile − 171`, which is also `124 + iosMile`). The current
`0 / C 124`, `10 / C 134`, … labels therefore print the same number twice at a constant offset,
which is exactly what forced the every-other-tick label thinning. The published subdivision
milepost is the coordinate the Authority and the TS1 alignment tables use, so that is what the
public axis shows; iosMile is this dashboard's internal centerline coordinate and stays where it
is actionable — per segment in the strip tooltip and the selected-segment panel, both of which
already print `0.00–4.12 ios mi · C 124–C 128.1`, where the offset is visible side by side.

In `src/components/StripChart.tsx`:

1. Swap the import `formatOfficialMp` → `iosMileToOfficialMp` (same module, `src/lib/mileposts.ts`):
   the axis needs the `{ subdivision, mp }` parts, not the joined string.
2. Remove the `SOURCES` import, the two `<a href={SOURCES….url}>` wrappers around the tick labels
   and the station labels, and the literal `†` in both label strings. `SourceLink` stays — the
   tooltip uses it.
3. Keep the `STATIONS` const (5 entries) and its per-station `note`, which stays as the `<title>`
   on each station label.
4. `CP_BOUNDARIES`: delete `{ label: 'Oswell', mile: 175 }`. The mockup header shows five labels
   and the axis end is already named by the ruler's final `D 299`.
5. Delete the `.strip-toolbar` block (eyebrow + `h2` + axis toggle), the `.axis-caption` text, and
   the `.model-caption` paragraph. Drop the `onAxisModeChange` prop from the signature (keep
   `axisMode`); the toggle moves to `App.tsx` (step 7) and the caption to `NotesList` (step 7).
6. Module-level geometry constants, replacing every magic number in the file:
   ```ts
   const HEADER_H = 26;      // CP label band
   const TICK_TOP = 28;      // named-structure ticks
   const TICK_BOTTOM = 36;
   const BAND_TOP = 38;
   const BAND_H = 50;
   const AXIS_Y = 88;        // BAND_TOP + BAND_H
   const LABEL_Y = 106;      // shared baseline for milepost AND station labels
   const CHART_H = 112;
   ```
7. Full bleed: `const plotLeft = 0; const plotRight = width;` and
   `viewBox={`0 0 ${width} ${CHART_H}`}`.
8. Re-anchor the drawing: CP rule `y1={4} y2={AXIS_Y}`; CP label `x={x + 7} y={18}`; structure
   tick `y1={TICK_TOP} y2={TICK_BOTTOM}`; band rect `y={BAND_TOP} height={BAND_H}`; hover marker
   `y1={2} y2={AXIS_Y}`; axis hairline `x1={0} x2={width} y1={AXIS_Y} y2={AXIS_Y}`.
9. Sub-pixel segments keep the existing notch fix in the new geometry:
   `<line x1={x} x2={x} y1={BAND_TOP} y2={AXIS_Y} strokeWidth="3" stroke={STATUS_COLORS[status]} />`
   plus the transparent hit `<rect x={x - 3} y={BAND_TOP} width="6" height={BAND_H} />` carrying
   `interactionProps(segment, index)` and the `ref`. Wide bands still use the true width.

**One-row axis with two ranks.** Replace the `axisTicks` label block and the separate `STATIONS`
label row with a single placement pass. Stations outrank mileposts: a milepost *label* is dropped
when it would collide, but its *tick mark* is always drawn.

```ts
const MILE_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 175];
const CHAR_W = 6.2;

type AxisLabel = { x: number; text: string; anchor: 'start' | 'middle' | 'end'; box: [number, number] };

const place = (x: number, text: string): AxisLabel => {
  const w = text.length * CHAR_W + 8;
  if (x <= 24) return { x: 2, text, anchor: 'start', box: [2, 2 + w] };
  if (x >= width - 24) return { x: width - 2, text, anchor: 'end', box: [width - 2 - w, width - 2] };
  return { x, text, anchor: 'middle', box: [x - w / 2, x + w / 2] };
};
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] + 6 && b[0] < a[1] + 6;
```

Pass order — deterministic, no judgment left open:
1. Place all five `STATIONS` labels at `xForMile(station.mile)`. They are always kept; reserve
   their boxes.
2. Place `MILE_TICKS` in the order `[0, 175, 10, 20, 30, …, 170]` — the two endpoints claim space
   first so the axis always reads its full extent. Keep a milepost label only when its box
   `overlaps` nothing already kept.
3. Render in axis order. Every entry in `MILE_TICKS` draws a tick
   `<line x1={x} x2={x} y1={AXIS_Y} y2={AXIS_Y + 5} className="axis-line" />` whether or not its
   label survived.

Label text, computed **after** suppression so a dropped tick can never swallow a subdivision
change: for each kept milepost in axis order take `const { subdivision, mp } =
iosMileToOfficialMp(mile)` and print `` `${subdivision} ${mp}` `` when it is the first kept label
or its `subdivision` differs from the previous kept label's, otherwise the bare `` `${mp}` ``.
The route crosses C→S between iosMile 20 and 30 and S→D at 171, so exactly three labels carry a
letter: `C 124`, `S 154`, `D 299`.

Station rendering keeps its marker and joins the shared baseline:
```tsx
<path d={`M ${x - 4} ${AXIS_Y} L ${x + 4} ${AXIS_Y} L ${x} ${AXIS_Y + 7} Z`} className="station-marker" />
<text x={label.x} y={LABEL_Y} textAnchor={label.anchor} className="station-label">
  {station.name}<title>{station.note}</title>
</text>
```
Milepost labels use the same `y={LABEL_Y}` with `className="axis-label"`. The two ranks are told
apart by weight and colour, not by row — that is what buys the single row.

**Difficulty mode keeps the same geographic labels.** Delete the `0 %…100 %` tick branch outright.
`xForMile` already maps mile → x in both modes, so the milepost ticks simply bunch up where the
difficulty model concentrates effort, which makes the distortion legible; a "cumulative share of
modelled effort" percentage is not a location reference and had no business replacing one. The
`axisMode` prop is still required by `xForMile` and the segment rects.

10. Tooltip: it now sits above a 112 px strip. Replace the `top` positioning with a bottom anchor
    so it floats over the map instead of clipping —
    `style={{ left: Math.min(width - 312, Math.max(8, tooltip.x + 12)), bottom: CHART_H + 6 }}` —
    and drop `top`. Its content is unchanged.

CSS in `src/App.css` — `.axis-line`, `.axis-label`, `.station-marker`, `.station-label` are
**kept and restyled**, not deleted:
```css
.strip-band { flex: 0 0 auto; border-top: 1px solid var(--line); background: var(--panel); }
.strip-canvas { position: relative; width: 100%; min-height: 112px; }
.strip-canvas svg { display: block; width: 100%; height: 112px; overflow: visible; }
.axis-line { stroke: #c8ccce; stroke-width: 0.8; }
.axis-label { fill: var(--muted); font: 400 10.5px var(--sans); font-variant-numeric: tabular-nums; }
.station-label { fill: var(--ink); font: 700 11px var(--sans); }
.station-marker { fill: var(--ink); }
.cp-label { fill: var(--faint); font: 700 11px var(--sans); letter-spacing: 0.06em; text-transform: uppercase; }
.cp-rule { stroke: #d6d3cc; stroke-dasharray: 2 3; stroke-width: 0.7; }
```
Delete `.strip-section`, `.strip-toolbar`, `.axis-caption`, `.model-caption`.

### Step 6b — Replay scrubber: no layout shift while scrubbing

`.time-scrubber` is currently one grid row,
`grid-template-columns: auto minmax(180px, 1fr) auto auto auto` (`src/App.css:345-354`), whose
last two columns are the `.tier-badge` — its text swings between `Scheduled replay`,
`Observed replay`, and `Mixed observed + scheduled` — and the `.report-gap-badge`, which appears
and disappears per month. Both resize as you scrub, which resizes the `minmax(180px, 1fr)` track
under the pointer and makes the thumb jump. The fix: the track's width must depend on nothing
that changes with the selected date.

Restructure the markup returned by `src/components/TimeScrubber.tsx` into two rows — the controls
row holds only fixed-width neighbours, the status row holds everything variable. No prop, state,
or logic changes: the play/`requestAnimationFrame` effect and the `index` memo stay exactly as
they are.

```tsx
<div className="time-scrubber">
  <div className="scrubber-row">
    <button type="button" className="play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause replay' : 'Play replay'}>
      {playing ? 'Pause' : 'Play'}
    </button>
    <input type="range" min={0} max={Math.max(0, dates.length - 1)} value={index} onChange={(event) => onDateChange(dates[Number(event.currentTarget.value)])} aria-label="Progress date" />
    <time dateTime={date}>{date.slice(0, 7)}</time>
  </div>
  <div className="scrubber-status">
    <span className={`tier-badge provenance-${provenance}`}>{provenanceLabel}</span>
    {reportGap && (
      <span className="report-gap-badge" title={reportGap.detail}>
        Report gap
        {reportGap.reportUrl && <>{' · '}<a href={reportGap.reportUrl} target="_blank" rel="noreferrer">report</a></>}
      </span>
    )}
  </div>
</div>
```

CSS — replace the `.time-scrubber` rule (`src/App.css:345-354`) and the `.time-scrubber input` /
`.time-scrubber time` rules (367–373) with:
```css
.time-scrubber { display: grid; gap: 4px; }
.scrubber-row { display: grid; grid-template-columns: 58px minmax(0, 1fr) 54px; align-items: center; gap: 10px; }
.scrubber-row input { width: 100%; margin: 0; accent-color: var(--accent); }
.scrubber-row time { color: var(--ink); font: 700 12px var(--sans); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.scrubber-status { display: flex; align-items: center; gap: 8px; min-height: 18px; }
```
Three load-bearing numbers: the `58px` column pins `.play-button` so `Play`↔`Pause` cannot move
the track's left edge (change its `min-width: 52px` to `width: 100%`); the `54px` column plus
`tabular-nums` pins `<time>` so the month cannot move the right edge; and
`.scrubber-status { min-height: 18px }` reserves the badge row so a gap badge appearing or
vanishing never reflows the row above it. Delete the `.time-scrubber`, `.tier-badge`, and
`.report-gap-badge` overrides inside the old `@media (max-width: 900px)` block — the two-row grid
needs none of them.

The strip controls row that hosts it (step 7):
```css
.strip-controls { display: flex; align-items: flex-start; gap: 14px; padding: 8px 12px 4px; }
.strip-controls .time-scrubber { flex: 1 1 auto; min-width: 0; }
.strip-controls .axis-toggle { flex: 0 0 auto; }
```

### Step 7 — Page shell, scrubber row, below-fold region

Rewrite the `App` return (the `main.app-shell` / `div.dashboard-column` wrapper goes away):

```tsx
<div className="page">
  <div className="screen">
    <header className="topbar">…</header>
    <div className="viewport-grid">
      <AlignmentMap … />
      <aside className="metric-rail" aria-label="Program metrics">
        <MetricRail … />
        <Legend />
      </aside>
    </div>
    <section className="strip-band" aria-labelledby="strip-heading">
      <h2 id="strip-heading" className="sr-only">Construction status by mile</h2>
      <div className="strip-controls">
        <TimeScrubber dates={dates} date={date} onDateChange={setDate} provenance={derived.provenance} reportGap={selectedCvsrGaps.find((gap) => gap.metric === 'snapshot')} />
        <div className="axis-toggle" role="group" aria-label="Segment width scale">
          <button type="button" className={axisMode === 'distance' ? 'active' : ''} onClick={() => setAxisMode('distance')}>Distance</button>
          <button type="button" className={axisMode === 'difficulty' ? 'active' : ''} onClick={() => setAxisMode('difficulty')}>Difficulty</button>
        </div>
      </div>
      <StripChart … axisMode={axisMode} … />
    </section>
  </div>
  <section className="below-fold">
    <SegmentDetail … />
    <PackageBands … />
    <DataGapDisclosure … />
    <NotesList />
    <SourcesList />
  </section>
</div>
```

`SourcesList` is now imported into `App.tsx` from `./components/Citation`.

`PackageBands` keeps every existing behaviour — six metrics × three packages, `GAP_LABELS`,
`GAP_METRIC_LABELS`, the `acquisitionAudit` "March 9 audit" rendering, the
`Delivered to DB — not reported` string, the transcribed/revised markers and their titles, and
the `.package-report-status` header. Two changes only: add `<h2>Package detail</h2>` above
`.package-report-status`, and **delete its `<Sparkline>` usage plus the `series` `useMemo`** and
the now-unused `buildCvsrSeries` / `sparklineLabel` / `CvsrSeriesPoint` imports it owned — the
rail carries the trends, so the table is the numbers view.

New `src/components/Notes.tsx` — no existing equivalent; this is where every marking stripped
from the strip and the legend is consolidated:
```tsx
export function NotesList() {
  return (
    <section className="notes-list" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes</h2>
      <ul>…</ul>
    </section>
  );
}
```
Exactly seven `<li>` items, each opening with a bolded lead-in:
1. **Strip axis.** "The ruler under the strip is the published subdivision milepost — C, S, then
   D `<SourceLink sourceId="ts1_alignment" />` — and the named marks are the five station sites
   `<SourceLink sourceId="arcgis_stations" />`. This dashboard's internal iosMile coordinate is
   the published milepost minus 124 over the whole route, so it is not repeated on the axis; it
   is shown per segment, next to the published station range, in the strip tooltip and the
   selected-segment panel. The dashed rules are construction-package boundaries."
2. **Structure marks.** "Ticks above the band mark named structures. Structures narrower than the
   pixel grid are drawn as fixed-width marks at their true position and are not to scale."
3. **Difficulty scale.** Move the current `.model-caption` string from `StripChart.tsx`
   **verbatim** (including its `<SourceLink sourceId="business_plan_2026" />`), minus the
   sentence about notches, which is item 2.
4. **Guideway complete.** `OFFICIAL_DEFINITIONS.guideway` verbatim + `<SourceLink sourceId="cvsr" />`.
5. **Structure complete.** `OFFICIAL_DEFINITIONS.structure` verbatim + `<SourceLink sourceId="cvsr" />`.
6. **Granularity.** The existing "Granularity matters." sentence moved verbatim from `Legend.tsx`.
7. **Track installation.** "Exhibit D.0 of the 2026 Final Business Plan lists Track & Systems
   Design & Construction for the 119-mile Central Valley Segment as NOT STARTED, and the
   Authority's 2026 milestones say the track-laying phase can commence in 2026. No monthly
   track-installation series and no track-mileage total are published, so the block shows a bare
   zero over a dashed baseline rather than a reported trend.
   `<SourceLink sourceId="business_plan_2026_schedule" />`"

CSS for the shell (replace `.app-shell`, `.dashboard-column`, and both existing media queries):
```css
.page { display: flex; flex-direction: column; background: var(--paper); }
.screen { display: flex; flex-direction: column; height: 100vh; min-height: 620px; }
.viewport-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; flex: 1 1 auto; min-height: 0; }
.below-fold { display: grid; gap: 22px; min-height: 80vh; max-width: 1120px; padding: 34px 26px 72px; }
.notes-list h2, .sources-list h2, .package-bands h2, .segment-detail h2 { font-size: 15px; font-weight: 750; letter-spacing: -0.01em; }
.notes-list ul { margin: 9px 0 0; padding-left: 17px; }
.notes-list li { margin-bottom: 8px; color: #556265; font-size: 12px; line-height: 1.45; }
.notes-list b { color: var(--ink); }
.sources-list { border-top: 1px solid var(--line); padding-top: 14px; }

@media (max-width: 1024px) {
  .screen { height: auto; }
  .viewport-grid { grid-template-columns: 1fr; }
  .map-section { min-height: 60vh; }
  .metric-rail { border-left: 0; border-top: 1px solid var(--line); overflow: visible; }
  .strip-band { overflow-x: auto; }
  .strip-canvas { min-width: 720px; }
  .package-bands { overflow-x: auto; }
  .package-band { min-width: 860px; }
}
```
`.screen { height: 100vh }` + `.below-fold { min-height: 80vh }` gives the required ≥180vh page.

### Step 8 — Legend as a rail panel

`src/components/Legend.tsx`: keep only the eight-swatch list and its two `OFFICIAL_DEFINITIONS`
row tooltips. Delete the eyebrow, the `h2`, both `.definition` paragraphs, the
`.granularity-note` (all moved into `NotesList`), the `.legend-zero` "0%" spans, and the
`<SourcesList />` call. The file then imports only `STATUS_COLORS, STATUS_LABELS,
OFFICIAL_DEFINITIONS` and the `AlignmentStatus` type — drop the `./Citation` import entirely.

```tsx
<aside className="legend-panel" aria-label="Alignment status legend">
  <ul className="legend-items">…</ul>
</aside>
```

CSS: replace the `.legend-panel` rules with
```css
.legend-panel { margin-top: auto; padding: 10px 12px; background: rgba(240,238,233,0.9); border: 1px solid var(--line); border-radius: 3px; }
.legend-items { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
.legend-items li { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted); }
.legend-swatch { width: 16px; height: 8px; border: 1px solid rgba(20,24,28,0.12); }
```
Keep `.legend-swatch.hatched`. Delete `.definition`, `.granularity-note`, `.legend-zero`.

### Step 9 — Sweep dead CSS

After steps 3–8, delete from `src/App.css` every rule whose selector no longer appears in
`src/`. Verify with `grep -rn "<selector>" src --include=*.tsx` per candidate; the expected
casualties are `.app-shell`, `.dashboard-column`, `.summary-header`, `.title-block`,
`.headline-metrics*`, `.source-link`, `.strip-section`, `.strip-toolbar`, `.axis-caption`,
`.model-caption`, `.map-title`, `.definition`, `.granularity-note`, `.legend-zero`. `.eyebrow`
stays (used by `SegmentDetail` and the load states). `.axis-line`, `.axis-label`,
`.station-marker`, and `.station-label` are **retained and restyled** — the strip still draws all
four.

## Critical files & anchors

- `src/App.tsx` — `App()` return (262–350) is replaced wholesale by the step-7 shell;
  `PackageBands` (438–565) and `DataGapDisclosure` (399–436) survive nearly intact and move
  below the fold. `sumPackages` (129–142) is the aggregate helper the rail reuses.
- `src/components/StripChart.tsx` — the axis and station block (lines 238–296) is re-anchored and
  rewritten as one label pass, not deleted; `interactionProps` (112–157) and the tooltip survive
  unchanged apart from the positioning tweak.
- `src/components/Sparkline.tsx` — the run-splitting loop (22–32) is the piece to preserve
  verbatim while generalising to N series.
- `src/data/sources.ts` — append-only; footnote numbers are positional, so inserting anywhere
  but the end silently renumbers every marker on the page.
- `src/App.css` — the single stylesheet; ~60% of it is rewritten across steps 3–9.

## Verification

Working directory `.`; no env vars or fixtures needed
(`public/data/*.json` are committed).

1. `npm run lint` → clean. `npm test` → 48 tests, 48 pass (no lib signatures changed).
   `npm run build` → succeeds; the pre-existing >500 kB chunk warning is expected.
2. Serve: `npm run dev -- --host 127.0.0.1` → `http://127.0.0.1:5173/hsr-dashboard/`.
   Note: `tab.click()` on the strip's SVG `[role=listitem]` rects times out — dispatch
   `new MouseEvent('click', { bubbles: true, cancelable: true, view: window })` inside
   `tab.evaluate` instead.
3. **Layout**: in the console,
   `document.querySelector('.screen').getBoundingClientRect().height === window.innerHeight`
   → `true`, and `document.body.scrollHeight / window.innerHeight >= 1.8` → `true`.
4. **Type**: `getComputedStyle(document.querySelector('.topbar h1')).fontFamily` contains
   `Public Sans`; `getComputedStyle(document.querySelector('.topbar h1')).fontWeight === '800'`.
5. **Trackwork (new behaviour)**: the first `.metric-block` shows `TRACK INSTALLED`, value `0`
   with unit `mi`, and the chip `Upcoming 2026`. Its sparkline contains exactly one
   `line[stroke-dasharray="2 3"]` and zero `path` elements. The chip's `a.fn-ref` href is
   `#fn-business_plan_2026_schedule`; clicking it scrolls to a `<li id="fn-business_plan_2026_schedule">`
   whose link text is `2026 Final Business Plan, Exhibit D.0: Merced – Bakersfield Timeline for
   Major Scope Items`, and the marker's number equals
   `Object.keys(SOURCES).indexOf('business_plan_2026_schedule') + 1` (= 20).
6. **Footnote markers**: `document.querySelectorAll('sup.source-link, .source-link').length === 0`
   and every `a.fn-ref[href^="#fn-"]` resolves —
   `[...document.querySelectorAll('a.fn-ref[href^="#fn-"]')].every((a) => document.getElementById(a.hash.slice(1)) !== null)` → `true`.
7. **Strip axis (new behaviour)**: inside `.strip-canvas svg` —
   - `svg.getAttribute('viewBox')` ends with ` 112`; a wide band rect has `y="38" height="50"`.
   - `[...svg.querySelectorAll('.cp-label')].map((t) => t.textContent)` equals
     `['M2M / CVY', 'CP1', 'CP2–3', 'CP4', 'LGA']`.
   - `[...svg.querySelectorAll('.station-label')].map((t) => t.textContent.trim())` equals
     `['Merced', 'Madera', 'Fresno', 'Kings/Tulare', 'Bakersfield']`.
   - `svg.textContent.includes('†')` → `false` and `svg.querySelectorAll('a').length === 0`.
   - The kept `.axis-label` texts begin with `C 124`, end with `D 299`, and exactly three contain
     a letter (`C 124`, `S 154`, `D 299`); the rest are bare numbers.
   - No label collides, at the default width and after resizing the window to 900 px and 1600 px:
     ```js
     const b = [...svg.querySelectorAll('.axis-label, .station-label')].map((t) => t.getBoundingClientRect());
     b.every((x, i) => b.every((y, j) => i === j || x.right <= y.left || y.right <= x.left));
     ```
     → `true`.
   - Switch to **Difficulty**: the same five station labels are still present, the milepost ticks
     are unevenly spaced, and no `%` label appears anywhere.
7b. **Scrubber stability (new behaviour)**: with
    `const w = () => document.querySelector('.scrubber-row input').getBoundingClientRect().width;`
    step the scrubber through `2019-08` → `2019-09` → `2020-01` → `2026-04`, which crosses both a
    `.tier-badge` text change and a `.report-gap-badge` appearing and vanishing. `w()` must be
    byte-identical at every step. Press Play and confirm `w()` is unchanged while the button reads
    `Pause`.
8. **Terrain map**: `map.getLayer('terrain-hillshade')` is defined (or, from the DOM, take a
   screenshot) — the Sierra Nevada and Coast Ranges read as gray relief and water/vegetation are
   neutral gray, while the alignment keeps its `STATUS_COLORS` hues. Confirm the attribution
   control lists `AWS Terrain Tiles`.
9. **Replay unbroken**: drag the scrubber to `2022-03`, then `2022-04`; the Golden State Boulevard
   Viaduct segment flips *Under construction* → *Structure complete*. Set `2024-01` and confirm
   one hatched (`url(#no-data-hatch)`) span is visible.
10. **Rail agrees with the table**: at the latest month, the rail's `GUIDEWAY COMPLETE` numerator
    equals the sum of the three CP guideway values shown in the below-fold *Package detail* table,
    and `ROW PARCELS ACQUIRED`, `ROW DELIVERED TO DB`, and `RAILROAD ROW PARCELS` are three
    distinct blocks with three distinct values.
11. **Selection round-trip**: click a segment in the strip; the below-fold *Selected segment*
    panel updates and its `a.fn-ref` markers jump to the source list.

## Assumptions & contingencies

- Title `Tracking On` and subtitle `CA HSR Construction Dashboard` are taken literally from the
  mockup.
- The mockup's `UPCOMING SEP 2026` is not sourced; the 2026 Final Business Plan gives only the
  year, so the chip reads `Upcoming 2026`. If a month is later found in an Authority document,
  change only the chip string and the `NotesList` item 7 wording.
- The mockup draws no alignment overlay on the map; that is a mockup omission. The map keeps its
  `alignment-casing`/`alignment-status` layers and hover/select sync with the strip.
- If the AWS terrarium tiles 403 or fail to load, delete the `terrain-dem` source, the
  `terrain-hillshade` layer, and the AWS attribution entry, and ship the grayed positron base —
  do **not** substitute a provider that needs an API key.
- If `npm install @fontsource-variable/public-sans@5.3.0` is unavailable, add
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` plus the Google Fonts
  `Public Sans:wght@400..800` stylesheet to `index.html`; leave the `--sans` token spelling
  (`'Public Sans Variable', …`) unchanged and append `'Public Sans'` before the fallbacks.
- Rail width is fixed at 340px and stacks below 1024px; the map, not the rail, absorbs the
  remaining width.
