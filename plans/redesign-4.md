# Dashboard refinements — legend in topbar, package palette, abbreviation tooltips, satellite basemap, footer

## Context

Five independent UI refinements to the Merced–Bakersfield dashboard (`src/App.tsx`, `src/App.css`,
`src/index.css`, `src/components/`):

1. The status legend moves out of the metric rail into the right end of the topbar, rendered as tiny
   colour squares whose meaning appears on hover.
2. The construction-package palette is replaced (CP1 stops being near-black) and gains `--m2m`/`--lga`,
   which are consumed by the strip chart's package labels.
3. Abbreviations (`M2M`, `CVY`, `CP1`, `CP2-3`, `CP4`, `LGA`, `CVSR`) get explanatory hover tooltips.
4. The map gets a tiny two-button overlay switch between the vector basemap and USGS satellite imagery.
5. A gray footer carries the LLM disclaimer and the Unlicense link.

Steps 1–5 are independent and may be done in any order. No data, fetch-script, or metric-derivation
changes.

## Grounded facts (verified this session against the working tree, commit `de90644`, branch `main`)

- `src/App.tsx:153-241` is the loaded render: `main.page` → `div.screen` (`header.topbar`,
  `div.viewport-grid`, `section.strip-band`) → `section.below-fold` (`NotesList`, `SourcesList`).
  Lines 137-142 are two early `return`s rendering `main.load-state` for error/loading; those branches
  render no topbar, rail, or below-fold, so steps 1 and 5 never touch them.
- `header.topbar` (`src/App.tsx:156-168`) holds `h1` then `p.topbar-meta`, whose children are two
  `<span>`s (subtitle, "Last updated …") and the GitHub `<a>`. CSS `src/App.css:12-17`:
  `.topbar { flex: 0 0 auto; padding: 20px 26px 14px; }`,
  `.topbar-meta { display: flex; align-items: center; gap: 18px; margin-top: 8px; font-size: 13px; font-weight: 600; }`.
- `<Legend />` is rendered once, as the last child of `aside.metric-rail` (`src/App.tsx:203`), imported
  at `src/App.tsx:16`. `src/components/Legend.tsx` maps 8 `VISIBLE_STATUSES` to
  `li > span.legend-swatch + span` and sets `title` only for `guideway_complete`/`structure_complete`
  (from `OFFICIAL_DEFINITIONS`). CSS `src/App.css:215-221`: `.legend-panel` is a bordered, tinted box
  with `margin-top: auto`; `.legend-items` is `display: grid; gap: 3px`; `.legend-swatch` is
  `width: 16px; height: 8px; border: 1px solid rgba(20,24,28,0.12)`; `.legend-swatch.hatched` adds the
  45° repeating gradient. `.metric-rail` is `display: flex; flex-direction: column; gap: 14px` — it has
  no rule that depends on the legend, so removing the child is inert.
- `src/lib/status.ts:41-55` — `STATUS_LABELS` values: `Not started`, `No alignment-resolved data`,
  `Preconstruction`, `Under construction`, `Structure complete`, `Guideway complete`, `Track laid`,
  `Systems installed`. `OFFICIAL_DEFINITIONS.structure` / `.guideway` are the two long sentences.
  `STATUS_COLORS` is a separate 8-value phase palette (`#d9d9d9` … `#6a3d9a`) and is **not** touched by
  step 2.
- `src/index.css:1-19` `:root` defines `--ink --muted --faint --paper --panel --line --accent --cp1
  --cp2-3 --cp4 --sans`. Current values: `--cp1: #14181c`, `--cp2-3: #1f5fa8`, `--cp4: #1b9e77`.
  There is no `--m2m` or `--lga`.
- The only consumers of the CP vars (`grep -rn "\-\-cp1\|\-\-cp2-3\|\-\-cp4" src`): `CP_COLORS` at
  `src/App.tsx:269-273` (feeds `SparklineSeries.color` for the four rail metrics) and
  `src/App.tsx:337` (`trackSeries`, one all-null series). `Sparkline`'s all-null branch renders
  `<line className="sparkline-gap">` with no `stroke`, so `trackSeries`'s `color` is already inert —
  the `SparklineSeries` type still requires the field, so leave the literal alone.
- `src/components/StripChart.tsx:19-25` — `CP_BOUNDARIES = [{ label: 'M2M / CVY', mile: 0 },
  { label: 'CP1', mile: 34 }, { label: 'CP2–3', mile: 65 } (en dash), { label: 'CP4', mile: 131 },
  { label: 'LGA', mile: 152 }]`. Rendered at lines 214-222 as one `<g>` per boundary holding
  `line.cp-rule` and `text.cp-label` at `x + 7, y = 18`. `.cp-label` (`src/App.css:84`) sets
  `fill: var(--faint)`; a CSS rule beats an SVG presentation attribute, so a per-boundary `fill=`
  attribute only works once that declaration is removed.
- `src/components/MetricBlock.tsx:23,36-44` — `packages?: Array<{ cp: string; percent: string;
  revisedTitle?: string }>`, rendered as `<li><b>{cp}</b>: …`. Callsite `src/App.tsx:365` maps
  `CVSR_PACKAGES` (`['CP1','CP2-3','CP4'] as const satisfies readonly CvsrPackageId[]`,
  `src/App.tsx:30`).
- `src/data/types.ts:3` `ConstructionPackage = 'M2M' | 'CP1' | 'CP2-3' | 'CP4' | 'LGA'`;
  `types.ts:85` `CvsrPackageId = 'CP1' | 'CP2-3' | 'CP4'`. `public/data/segments.json` `cp` values are
  exactly `{ M2M: 1, CP1: 29, 'CP2-3': 72, CP4: 3, LGA: 1 }`.
- `src/components/SegmentDetail.tsx:38-39` renders `<dd>{segment.cp} · {STATUS_LABELS[…]}</dd>`.
  `src/components/StripChart.tsx:299` renders `{tooltip.segment.cp}` inside `.segment-tooltip`, which
  is `pointer-events: none` (`src/App.css:107`) — tooltips there are unreachable, so step 3 skips it.
- `grep -rn "abbr\|footer" src` → no matches: both are new. `.sr-only` exists (`src/index.css:41`).
- The literal `CVSR` appears in the rail status line at `src/App.tsx:395` ("Before the published CVSR
  series (starts …)"), `:397` ("CVSR data through …"), `:399` ("CVSR data through …"), `:401`
  ("… · last CVSR {snapshot.dataMonth}"). `GAP_LABELS`/`GAP_METRIC_LABELS`
  (`src/lib/cvsr-gaps.ts:65-78`) contain no abbreviations.
- Abbreviation expansions, grounded: `M2M` = "Merced to Madera extension"
  (`scripts/build-segments.ts:246` label, matches `segments.json`); `LGA` = "Locally Generated
  Alternative" from `Fresno–Bakersfield Locally Generated Alternative (FB–LGA)`
  (`src/data/ts1-alignment.ts:52`), the segment label being "Poplar Avenue to Bakersfield extension"
  (`build-segments.ts:247`); `CVY` = "Central Valley Wye" — the Authority's own abbreviation, e.g.
  board item `brdmtg_091020_Item12_Exhibit_A_CVY_Draft_Supplemental_Record_of_Decision.pdf`
  (hsr.ca.gov) for the Merced-to-Fresno Central Valley Wye section, which is the `CVY` section in
  `ts1-alignment.ts:33-34` ("… along SR 152 to Road 11 Wye"); `CVSR` = "Central Valley Status Report"
  (`README.md:5,44`, `src/data/sources.ts:75`).
- `src/components/AlignmentMap.tsx:42-155` — one init effect keyed `[data, onHover, onSelect]`
  (adding a state dep would rebuild the map). Style `https://tiles.openfreemap.org/styles/positron`;
  `attributionControl.customAttribution` is a static 5-item array. Inside `map.on('load')`: adds
  `terrain-dem` raster-dem, computes
  `const firstSymbol = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id`, adds
  `terrain-hillshade` with `map.addLayer(layer, firstSymbol)`, greys landcover/water paint, then adds
  the `alignment` GeoJSON source and the `alignment-casing` / `alignment-status` line layers, then sets
  `readyRef.current = true`. Late-arriving props use the `statusesRef` mirror pattern
  (`AlignmentMap.tsx:37-38`) plus effects that bail on `!readyRef.current` (lines 157-161).
- Verified live this session (HTTP 200, `image/jpeg`, 21–33 kB) over Fresno at z10/z13/z16:
  `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`
  (note ArcGIS order: `{z}/{y}/{x}`). Public-domain federal imagery, no key, no referrer restriction.
- `.axis-toggle` (`src/App.css:64-80`) is the existing pill-switch pattern: flex, 1px `#aeb6b5` border,
  `border-radius: 999px`, white background, `button { padding: 4px 11px; font-size: 12px; font-weight: 750; color: var(--muted); border: 0; background: transparent; cursor: pointer }`,
  `button.active { color: white; background: var(--ink) }`. Its markup
  (`src/App.tsx:215-218`) is `div.axis-toggle[role=group][aria-label]` + two buttons toggled by an
  `active` class (no `aria-pressed`).
- `.map-pane` is `position: relative` and already hosts `.map-overlay` at `top: 12px; right: 12px;
  z-index: 3` (`src/App.css:199-210`); the MapLibre `NavigationControl` sits `bottom-left`
  (`AlignmentMap.tsx:61`). Top-left is free.
- `LICENSE.md` exists at the repo root and is the Unlicense ("This is free and unencumbered software
  released into the public domain."). `.github/workflows` publishes only `dist` to GitHub Pages with
  `base: '/hsr-dashboard/'` (`vite.config.ts`), so a relative `LICENSE.md` href would 404 on the
  deployed site — the footer must use the absolute GitHub blob URL.

## Approach

### Step 1 — Legend moves to the right end of the topbar as tiny swatches

**1a. `src/App.tsx` — markup.** Change `p.topbar-meta` (line 158) to `div.topbar-meta` (a `<ul>` inside
a `<p>` is invalid phrasing content; `div` has no UA margin, and `.topbar-meta` already sets
`margin-top: 8px`, so nothing shifts). Move `<Legend />` from the metric rail (delete line 203, keeping
`<MetricRail … />`) to be the **last child** of `div.topbar-meta`, after the GitHub `<a>`. The
`src/App.tsx:16` import stays.

**1b. `src/components/Legend.tsx` — swatch-only items.** Keep the `aside.legend-panel[aria-label]`
wrapper and the `ul.legend-items` / `li` / `span.legend-swatch` structure. Two changes: the visible
text span becomes screen-reader-only, and every item always carries a `title`, since the tooltip is now
the only way to read the legend:

```tsx
{VISIBLE_STATUSES.map((status) => {
  const definition = status === 'guideway_complete'
    ? OFFICIAL_DEFINITIONS.guideway
    : status === 'structure_complete'
      ? OFFICIAL_DEFINITIONS.structure
      : undefined;
  return (
    <li key={status} title={definition ? `${STATUS_LABELS[status]} — ${definition}` : STATUS_LABELS[status]}>
      <span className={`legend-swatch ${status === 'no_data' ? 'hatched' : ''}`} style={{ backgroundColor: STATUS_COLORS[status] }} />
      <span className="sr-only">{STATUS_LABELS[status]}</span>
    </li>
  );
})}
```

**1c. `src/App.css`.** Add `flex-wrap: wrap;` to `.topbar-meta` (line 14) so the extra child cannot
overflow a narrow topbar, and replace the three legend rules (lines 215-218) — `.legend-swatch.hatched`
(219-221) stays byte-identical:

```css
.legend-panel { flex: 0 0 auto; margin-left: auto; }
.legend-items { display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; list-style: none; }
.legend-items li { display: block; cursor: help; }
.legend-swatch { display: block; width: 11px; height: 11px; border: 1px solid rgba(20,24,28,0.12); border-radius: 2px; }
```

The old `.legend-items li { display: flex; … font-size: 11px; color: var(--muted) }` rule is deleted
along with the panel's padding/background/border/`margin-top: auto`, which existed only for the rail.

### Step 2 — Package palette (independent of every other step)

**2a. `src/index.css:9-11`.** Replace the three CP vars and add two, keeping the block's declaration
order (`--m2m` before `--cp1`, `--lga` after `--cp4`, i.e. north-to-south along the alignment):

```css
  --m2m: #ff6a1c;
  --cp1: #769826;
  --cp2-3: #427ab5;
  --cp4: #f62477;
  --lga: #a8a492;
```

No other file changes for the sparklines: `CP_COLORS` (`src/App.tsx:269-273`) already resolves
`var(--cp1|--cp2-3|--cp4)`.

**2b. `src/components/StripChart.tsx` — the strip package labels consume `--m2m`/`--lga`.** Extend
`CP_BOUNDARIES` (lines 19-25) with a `color` per entry so the two new vars are live and the five
package bands are identifiable by colour; the `label` strings and `mile` values stay byte-identical:

```tsx
const CP_BOUNDARIES = [
  { label: 'M2M / CVY', mile: 0, color: 'var(--m2m)' },
  { label: 'CP1', mile: 34, color: 'var(--cp1)' },
  { label: 'CP2–3', mile: 65, color: 'var(--cp2-3)' },
  { label: 'CP4', mile: 131, color: 'var(--cp4)' },
  { label: 'LGA', mile: 152, color: 'var(--lga)' },
] as const;
```

In the render (line 219) pass it through: `<text x={x + 7} y={18} className="cp-label" fill={boundary.color}>`.
For that attribute to win, delete `fill: var(--faint);` from `.cp-label` (`src/App.css:84`) — a CSS
declaration overrides an SVG presentation attribute. The rest of the rule
(`font: 700 11px var(--sans); letter-spacing: 0.06em; text-transform: uppercase;`) stays.
`.cp-rule` keeps its neutral `#d6d3cc` stroke: colouring the vertical rules as well would compete with
the status fills inside the band.

### Step 3 — `<abbr>` tooltips over package and report abbreviations

**3a. New file `src/components/Abbr.tsx`** (no existing registry or component covers this — `grep -rn
"abbr" src` is empty). Registry plus a one-element component in one file, mirroring how
`src/components/Citation.tsx` holds the citation components:

```tsx
import type { ConstructionPackage } from '../data/types';

export type Abbreviation = ConstructionPackage | 'CVY' | 'CVSR';

/** Expansions verified against Authority documents; see README source list. */
export const ABBREVIATIONS: Record<Abbreviation, string> = {
  M2M: 'Merced to Madera extension',
  CVY: 'Central Valley Wye',
  CP1: 'Construction Package 1',
  'CP2-3': 'Construction Packages 2 and 3',
  CP4: 'Construction Package 4',
  LGA: 'Locally Generated Alternative (Fresno–Bakersfield)',
  CVSR: 'Central Valley Status Report',
};

export function Abbr({ children }: { children: Abbreviation }) {
  return <abbr title={ABBREVIATIONS[children]}>{children}</abbr>;
}
```

Typing `children` as `Abbreviation` makes an unexpanded abbreviation a compile error rather than a
silent empty `title`.

**3b. Rail package cells — `src/components/MetricBlock.tsx`.** Tighten the prop type
`packages?: Array<{ cp: string; … }>` (line 23) to `cp: CvsrPackageId` (`import type { CvsrPackageId }
from '../data/types';`) — `CvsrPackageId` is a subset of `ConstructionPackage`, so `Abbr` accepts it,
and the only callsite already maps `CVSR_PACKAGES`. Then wrap the label: `<b><Abbr>{cp}</Abbr></b>`
(line 38), leaving the `:{' '}`, percent, and `.revised` span untouched.

**3c. Segment detail — `src/components/SegmentDetail.tsx:39`.** `<dd><Abbr>{segment.cp}</Abbr> · {STATUS_LABELS[status ?? segment.currentStatus]}</dd>`.
`segment.cp` is `ConstructionPackage`, so all five keys are covered. Do **not** touch
`StripChart.tsx:299` (`.segment-tooltip` is `pointer-events: none`; an `abbr` there can never be
hovered).

**3d. Strip package labels — `src/components/StripChart.tsx`.** `<abbr>` is HTML and illegal inside
SVG, so use the SVG descriptive `<title>` element as a child of the `text.cp-label` added in step 2b
(hovering the label text shows it). Add a `title` string to each `CP_BOUNDARIES` entry — the first
boundary names two abbreviations, so it is spelled out rather than looked up:

```tsx
  { label: 'M2M / CVY', mile: 0, color: 'var(--m2m)', title: 'M2M — Merced to Madera extension · CVY — Central Valley Wye' },
  { label: 'CP1', mile: 34, color: 'var(--cp1)', title: 'CP1 — Construction Package 1' },
  { label: 'CP2–3', mile: 65, color: 'var(--cp2-3)', title: 'CP2–3 — Construction Packages 2 and 3' },
  { label: 'CP4', mile: 131, color: 'var(--cp4)', title: 'CP4 — Construction Package 4' },
  { label: 'LGA', mile: 152, color: 'var(--lga)', title: 'LGA — Locally Generated Alternative (Fresno–Bakersfield)' },
```

and render `<text x={x + 7} y={18} className="cp-label" fill={boundary.color}><title>{boundary.title}</title>{boundary.label}</text>`.
Keep the strings literal here instead of importing `ABBREVIATIONS`: the strip labels use an en dash
(`CP2–3`) while the data ids use a hyphen (`CP2-3`), and keying a lookup on display text would need a
second alias table.

**3e. Rail status line — `src/App.tsx:393-403`.** Replace each bare `CVSR` literal with
`<Abbr>CVSR</Abbr>`: line 395 `Before the published <Abbr>CVSR</Abbr> series (starts {inventory.coverageStart})`,
lines 397 and 399 `<Abbr>CVSR</Abbr> data through …`, line 401 `· last <Abbr>CVSR</Abbr> {snapshot.dataMonth}`.
Import `Abbr` in `src/App.tsx`. Leave `NotesList`/`SourcesList` prose alone — those sections already
spell the report name out in full.

**3f. `src/App.css` — one rule for every `abbr`.** Add next to `.fn-ref` (after line 31):

```css
abbr[title] { text-decoration: underline dotted; text-decoration-thickness: from-font; text-underline-offset: 2px; cursor: help; }
```

Element selector, not a class: every abbreviation in the app should read the same, and the rule
inherits colour/weight from its context (`.metric-packages`, `.segment-detail`, `.rail-report-status`).

### Step 4 — Satellite basemap switch

**4a. `src/App.tsx` — state and control.** Add `const [satellite, setSatellite] = useState(false);`
beside the other view state (near line 53), pass `satellite={satellite}` to `<AlignmentMap>`
(line 172-179), and render the switch as a sibling of `.map-overlay` inside `div.map-pane`, before it:

```tsx
<div className="map-layer-switch">
  <div className="axis-toggle" role="group" aria-label="Basemap">
    <button type="button" className={satellite ? '' : 'active'} onClick={() => setSatellite(false)}>Map</button>
    <button type="button" className={satellite ? 'active' : ''} onClick={() => setSatellite(true)}>Satellite</button>
  </div>
</div>
```

This reuses `.axis-toggle` verbatim (same pill, same `active` convention, no `aria-pressed`, matching
`src/App.tsx:215-218`); do not invent a checkbox/slider variant.

**4b. `src/App.css`.** Add after `.map-overlay` (ends line 210):

```css
.map-layer-switch { position: absolute; z-index: 3; top: 12px; left: 12px; }
.map-layer-switch .axis-toggle { box-shadow: 0 1px 6px rgba(20,24,28,0.18); }
.map-layer-switch button { padding: 3px 9px; font-size: 11px; }
```

**4c. `src/components/AlignmentMap.tsx`.** Add `satellite: boolean` to the props object and type. Mirror
the existing `statusesRef` pattern for late/early toggles — the init effect must **not** gain a
`satellite` dependency (it would tear down and rebuild the map on every toggle):

```tsx
const satelliteRef = useRef(satellite);
satelliteRef.current = satellite;
```

Inside `map.on('load')`, immediately after the `terrain-hillshade` `addLayer` call and before the
landcover grey loop, add the imagery source and layer with the same `firstSymbol` anchor, so imagery
paints above the vector fills, lines, and hillshade but below the OSM place labels (and below the
`alignment-*` layers, which are added later and therefore on top):

```tsx
map.addSource('usgs-imagery', {
  type: 'raster',
  tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  maxzoom: 16,
});
map.addLayer({
  id: 'usgs-imagery',
  type: 'raster',
  source: 'usgs-imagery',
  // Hidden until asked for: the raster must never fetch tiles on first paint.
  layout: { visibility: satelliteRef.current ? 'visible' : 'none' },
  paint: { 'raster-opacity': 1 },
}, firstSymbol);
```

Then a new effect, copying the shape of the `statuses` effect at lines 157-161:

```tsx
useEffect(() => {
  const map = mapRef.current;
  if (!map || !readyRef.current) return;
  map.setLayoutProperty('usgs-imagery', 'visibility', satellite ? 'visible' : 'none');
}, [satellite]);
```

Attribution: append one static entry to the existing `customAttribution` array (lines 52-58), after the
hillshade line — `'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noreferrer">USGS National Map</a>'`.
It shows unconditionally, exactly like the hillshade credit already does; per-layer attribution
switching is not worth an extra control lifecycle.

Edge cases: `maxzoom: 16` makes MapLibre overzoom the z16 tile past that level instead of requesting
404s (the service stops at 16); a tile fetch that fails leaves the vector basemap visible underneath,
which is the desired degradation and needs no error handling.

### Step 5 — Footer

**5a. `src/App.tsx`.** Add as the last child of `main.page`, after `section.below-fold` (closing tag on
line 239):

```tsx
<footer className="page-footer">
  <p>
    Visualized with large language model, may contain errors. Released to the public under{' '}
    <a href="https://github.com/rschiang/hsr-dashboard/blob/main/LICENSE.md" target="_blank" rel="noreferrer">The Unlicense</a>.
  </p>
</footer>
```

The absolute blob URL is required: GitHub Pages publishes only `dist/` under `/hsr-dashboard/`, so a
relative `LICENSE.md` href would 404. The two `main.load-state` early returns (lines 137-142) get no
footer — they render a bare error/loading card.

**5b. `src/App.css`.** Add after the `.sources-list` rules (ends line 227):

```css
.page-footer { max-width: 1120px; padding: 0 26px 30px; color: var(--faint); font-size: 11.5px; line-height: 1.45; }
.page-footer a { color: var(--muted); font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.page-footer a:hover { color: var(--ink); }
```

`--faint` (`#9aa2a7`) is the tertiary gray; the horizontal padding matches `.below-fold`
(`padding: 34px 26px 72px`), whose own bottom padding supplies the gap above the footer.

## Critical files & anchors

- `src/App.tsx` — `header.topbar` (156-168), `<Legend/>` in the rail (203), `div.map-pane` (171-192),
  `main.page` close (239), rail status line (393-403): steps 1a, 3e, 4a, 5a all land here.
- `src/components/AlignmentMap.tsx` — the single init effect (42-155) and the `statusesRef` +
  `readyRef` guards (37-38, 157-161): the pattern step 4c must copy rather than re-plumb.
- `src/components/StripChart.tsx` — `CP_BOUNDARIES` (19-25) and its render `<g>` (214-222): both step
  2b and step 3d edit exactly these.
- `src/App.css` — `.topbar-meta` (14), `.cp-label` (84), `.map-overlay` (199-210), `.legend-*`
  (215-221), `.sources-list` tail (222-227).

## Verification

No env vars or fixtures needed (`public/data/*.json` are committed).

1. `npm run lint` → clean. `npm test` → 48/48 (no `src/lib` change). `npm run build` → succeeds; the
   pre-existing >500 kB chunk warning is expected.
2. `grep -rn "legend-panel" src/App.tsx` → no match (the legend now renders from the header, so the
   only occurrence is `src/components/Legend.tsx` plus `src/App.css`).
3. Serve: `npm run dev -- --host 127.0.0.1` → `http://127.0.0.1:5173/hsr-dashboard/`, viewport
   1440×900. **Use `tab.evaluate`, not `tab.screenshot`/`page.screenshot`: screenshots hang once
   MapLibre has initialised.** Wait for load with
   `await wait(() => tab.evaluate(() => document.querySelectorAll('.metric-block').length >= 4))`.
   Scrubber ticks, when a step needs one: 91 ticks over the committed data (index 0 = `2018-11`,
   index 7 = `2019-06`, index 90 = `Current`); drive by index with
   ```js
   const setIndex = (i) => tab.evaluate((idx) => {
     const input = document.querySelector('.scrubber-row input');
     Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(idx));
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.dispatchEvent(new Event('change', { bubbles: true }));
   }, i);
   ```
4. **Step 1 — legend in the topbar.** `document.querySelector('.topbar .legend-panel')` non-null and
   `document.querySelector('.metric-rail .legend-panel')` is `null`;
   `document.querySelectorAll('.legend-items li').length === 8`; every `li` has a non-empty `title`,
   and the `Guideway complete` item's title starts `Guideway complete — Guideway Completion`; each
   `li`'s only visible child is an 11×11 swatch
   (`getBoundingClientRect()` → `{width: 11, height: 11}` on `.legend-swatch`) with the label text
   present but clipped (`li .sr-only` non-null); the legend is flush right inside the meta row:
   `Math.abs(document.querySelector('.topbar-meta').getBoundingClientRect().right - document.querySelector('.legend-panel').getBoundingClientRect().right) < 1`.
   `document.querySelector('.topbar-meta').tagName === 'DIV'`.
5. **Step 2 — palette.** `['--m2m','--cp1','--cp2-3','--cp4','--lga'].map((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim())`
   → `['#ff6a1c','#769826','#427ab5','#f62477','#a8a492']`. In the `Guideway complete` block the three
   `.sparkline-run` computed strokes are `rgb(118, 152, 38)`, `rgb(66, 122, 181)`, `rgb(246, 36, 119)`
   in that order. `[...document.querySelectorAll('.cp-label')].map((t) => getComputedStyle(t).fill)`
   → `['rgb(255, 106, 28)','rgb(118, 152, 38)','rgb(66, 122, 181)','rgb(246, 36, 119)','rgb(168, 164, 146)']`.
6. **Step 3 — abbreviations.** `[...document.querySelectorAll('.metric-packages abbr[title]')].length === 12`
   (3 packages × 4 metric blocks) and the first reads `CP1` with
   `title === 'Construction Package 1'`; `getComputedStyle(that).textDecorationStyle === 'dotted'` and
   `.cursor === 'help'`. `[...document.querySelectorAll('.cp-label title')].map((t) => t.textContent)`
   → the five strings from step 3d, first one containing both `Merced to Madera extension` and
   `Central Valley Wye`. On the rail status line at `setIndex(7)`,
   `document.querySelector('.rail-report-status abbr[title="Central Valley Status Report"]')` is
   non-null. Open the segment detail (dispatch
   `new MouseEvent('click', { bubbles: true, cancelable: true, view: window })` on a wide
   `rect.strip-segment` — plain `tab.click` does not reach those rects) and assert
   `document.querySelector('.segment-detail dd abbr').title` is one of the five package expansions.
7. **Step 4 — satellite switch (new behaviour, end to end).** Register a response listener, then toggle:
   ```js
   const hits = [];
   page.on('response', (r) => { if (r.url().includes('basemap.nationalmap.gov')) hits.push(r.status()); });
   await new Promise((r) => setTimeout(r, 1500));
   const before = hits.length;
   await tab.click('.map-layer-switch button:nth-of-type(2)');
   await wait(() => hits.length > before, { timeout: 20000 });
   ```
   → `hits.length > before` and every recorded status `=== 200`; the Satellite button now has
   class `active` and the Map button does not. Click `Map` again → `active` flips back and no error
   appears in `document.querySelector('.load-state')` (still `null`, i.e. the map did not remount).
   Also assert the map was not rebuilt by the toggle: `document.querySelectorAll('.maplibregl-canvas').length === 1`
   and the attribution now includes `USGS National Map`
   (`document.querySelector('.maplibregl-ctrl-attrib').textContent.includes('USGS National Map')`).
8. **Step 5 — footer.** `document.querySelector('.page-footer').textContent.trim()` ===
   `'Visualized with large language model, may contain errors. Released to the public under The Unlicense.'`;
   its `a[href]` is `https://github.com/rschiang/hsr-dashboard/blob/main/LICENSE.md`;
   `getComputedStyle(document.querySelector('.page-footer')).color === 'rgb(154, 162, 167)'`; the footer
   is the last element child of `main.page`.
9. **Unbroken.** `[...document.querySelectorAll('a.fn-ref[href^="#fn-"]')].every((a) => document.getElementById(a.hash.slice(1)) !== null)`
   → `true`; at the last tick `Guideway complete` still reads `87.1 / 119mi` and `Utilities relocated`
   `1,720 / 1,826`; `document.querySelectorAll('.metric-block').length === 5`.

## Assumptions & contingencies

- The legend's hover popup is the native `title` tooltip, matching every other explanatory tooltip in
  this codebase (`.metric-packages .revised`, `SnapshotReportLink`, the old legend definitions). No
  custom popover component is introduced.
- `--m2m` and `--lga` are consumed by the strip-chart package labels (step 2b). That is the only place
  in the UI that names all five packages, and leaving the two new vars unreferenced would be dead CSS.
  If the coloured labels read as too loud against the status band, keep the colours and drop
  `text-transform: uppercase` from `.cp-label` rather than reverting to `var(--faint)`.
- Satellite imagery is USGS `USGSImageryOnly` (public domain, keyless, verified live this session).
  Esri's `World_Imagery` also answers keyless but its terms restrict use outside Esri products, so do
  not substitute it. If `basemap.nationalmap.gov` stops answering during execution, keep the switch and
  the layer wiring exactly as specified and report the outage — do not swap in a keyed provider.
- The imagery layer is inserted below the first symbol layer so OSM place labels stay readable on top.
  If the labels prove illegible over imagery, move the `addLayer` call to after the `alignment-status`
  layer is added and pass `'alignment-casing'` as the `beforeId` instead — imagery then hides the whole
  vector basemap and only the alignment lines draw over it. Do not add a second toggle for labels.
- Abbreviation coverage is deliberately partial: package ids in the rail, the segment detail, the strip
  labels, and `CVSR` in the rail status line. Prose in `NotesList`/`SourcesList` is left alone because
  those sections already spell the report name out.
- `trackSeries`'s `color: 'var(--cp1)'` (`src/App.tsx:337`) stays even though the all-null Sparkline
  branch ignores it — `SparklineSeries.color` is a required field and loosening the type is out of
  scope for a palette swap.
