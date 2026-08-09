# HSR dashboard — fidelity corrections and observed-history build-out

## Context

The dashboard is architecturally faithful to `README.md` and `plans/proposal.md`, but four stated rules are broken on screen and one promised view was never built. This plan: (1) removes every fabricated number and false provenance claim, (2) makes the recovered 86-month CVSR corpus load-bearing — headline metric, per-package sparklines, and a visible dashboard-vs-Authority reconciliation, (3) resolves and byte-verifies a direct PDF URL for every CVSR month, (4) raises the typography floor to ≥11 px, fixes four sub-4.5:1 colors, and makes the strip keyboard-operable.

End state: no number on screen is invented; every CVSR figure links to the exact PDF it came from; replay shows observed data instead of a schedule placeholder; the page is readable and operable without a mouse.

## Findings this plan acts on

All observed this session against the running dev server (`npm run dev`), the committed artifacts, and live HTTP probes.

| # | Finding | Evidence |
|---|---|---|
| F1 | Fabricated `50%` earthwork completion, cited to ArcGIS | `scripts/build-history.ts:20` `Math.min(segment.completion, 0.5)`; rendered at `StripChart.tsx:215` and `App.tsx:194`. Observed live at 2022-06: *"Earthwork completion at selected date 50% ⁽arcgis_progress⁾"*, headline *"36.5 / 119 mi ⁽arcgis_progress⁾"* |
| F2 | Colors never use tier-1 numbers | `src/lib/status.ts:139-147` reads tier 3 only, else `scheduledStatus`. The 94×106 tier-1 numeric payload has no consumer but the two false displays |
| F3 | Backward leak on fallback | `src/App.tsx:135-138` falls back to `segment.completion` (today's value) when the snapshot lacks a segment |
| F4 | False calibration claim | `src/lib/weights.ts:67-70` structure share = `publishedStructures / (publishedStructures + publishedMiles)` — a count added to a distance, no source. Caption in `StripChart.tsx` `.model-caption` says "calibrated to published per-package contract values" |
| F5 | Unknown spans carry modelled effort | `src/lib/weights.ts:63` `kind !== 'structure'` sweeps `no-data` into guideway; `CP1:gap:1` (1.97 mi, *"No alignment-resolved progress data"*) gets median-dirt weight |
| F6 | No OpenStreetMap attribution | `https://tiles.openfreemap.org/styles/positron` and `.../planet` carry **no** `attribution` field (fetched and inspected); the live control renders only `MapLibre` |
| F7 | 21 hand-transcribed months are indistinguishable from parsed ones | `scripts/fetch-cvsr.ts:165` `LEGACY_PROGRESS` (21 files), `LEGACY_PARCELS` (3 files); merged at `:292-297` with `sourceId: 'cvsr'` |
| F8 | 75 of 86 CVSR months have no report link | Only `REVIEWED_CVSR_REPORTS` (11) carry `reportUrl`; counted in `public/data/history.json` |
| F9 | `wp-json` and HTML pages are Incapsula-gated, but `/wp-content/uploads/*.pdf` is **not** | `curl` with honest UA: `wp-json` → Incapsula challenge; two known PDFs → `206 application/pdf`; F&A index → challenge |
| F10 | No CVSR time series, no visible source disagreement | `plans/proposal.md` step 6 tier 2 and README *"when sources disagree, the dashboard keeps the discrepancy visible"* — neither built |
| F11 | The right cross-check metric is earthwork-equivalent, not 100%-complete count | Computed from `segments.json` + latest CVSR (2026-04): equivalent CP1 **10.45** vs CVSR **11**, CP2-3 **55.73** vs **55**, CP4 **20.77** vs **21.1**. Counting only `completion === 1` gives CP1 **0**, CP2-3 **19.68** — useless. `build-segments.ts:445` uses the right measure with a vacuous ±8 aggregate tolerance; proposal Verification #3 named the wrong measure |
| F12 | Typography floor 7–9 px; four colors below 4.5:1 | `.axis-label`/`.station-label` 7px, `.cp-label`/`.tier-badge`/`.model-caption`/`.sources-list li` 8px, `.package-band`/`.segment-tooltip`/`.definition`/`.data-gaps` 9px. Measured ratios: `.eyebrow` #8a9698 **2.99**, `.source-link` #d95f02 **3.69**, `.snapshot-report-link` #b84f00 on #ece8dd **4.13**, `.axis-caption` #718084 **4.03** |
| F13 | Strip and map are pointer-only; tooltip links are dead for everyone | SVG `<rect>`s have no `tabIndex`/role/key handler; `.segment-tooltip { pointer-events: none }` (App.css:227) makes its structure and evidence anchors unclickable by mouse too |
| F14 | Citation wallpaper | 24 `SourceLink`s in the default view; 16 are the identical `cvsr` link in `PackageBands` (`App.tsx:335`, `:352`) |
| F15 | Landing state reads as an error | Default date = ArcGIS fetch date `2026-08-09` > CVSR `coverageEnd` `2026-04`, so the page opens warning-styled *"No CVSR snapshot for selected month · Last observed 2026-04"*. Nothing is missing |
| F16 | CP1 structures sit inside guideway rows; nothing asserts it | 7 pairs, 1.64 mi (e.g. `CP1:173` 58.26–60.00 contains `CP1:197`, `CP1:190`, `CP1:183`). CP2-3 tiles cleanly. Difficulty mode allocates cumulative width to both |

---

## Approach

Steps 1–4 are pipeline and data contracts; 5 regenerates artifacts; 6–10 are UI. The tree builds and `npm test` passes after each step. Steps 1, 2, 3 are independent of each other. Step 4 depends on 3. Step 5 depends on 1–4. Steps 6–9 depend on 5. Step 10 (typography/a11y) is independent of everything and may run in parallel.

### 1. Delete the fabricated schedule numbers (F1, F2, F3)

**`src/data/types.ts`**
- `Snapshot`'s non-CVSR branch: `tier: 1 | 3` → `tier: 3`.
- `HistoryArtifact` gains `replayMonths: string[]` — every scrubbable month as `YYYY-MM-01`, from `2018-11-01` through the month of `generatedAt`.

**`scripts/build-history.ts`**
- Delete `scheduledCompletion` (lines 16-22) and the tier-1 `snapshots` construction (lines 34-40). Keep `monthSequence`; use it for `replayMonths`.
- Write `replayMonths: monthSequence('2018-11-01', artifact.generatedAt.slice(0, 10))` into the artifact.
- Final log becomes `history: months=${replayMonths.length}, tier 2=…, tier 3=…`.

**`src/lib/status.ts`**
- `deriveStatuses` returns `{ statuses, evidence, provenance }` — drop the unused `tier` field.
- Add, next to `deriveStatuses`:
  ```ts
  export function selectedCompletions(
    segments: Segment[],
    observation: Snapshot | undefined,
  ): Record<string, number | null>
  ```
  Returns, per segment id, `observation?.perSegment` value when `Object.hasOwn(observation.perSegment, id)`, else **`null`**. No fallback to `segment.completion` — that is F3.

**`src/App.tsx`**
- `dates` = `[...new Set([...history.replayMonths, ...history.snapshots.filter(s => s.tier === 3).map(s => s.date)])].sort()`.
- `activeSnapshot` keeps only the tier-3 branch; delete the tier-1 fallback (`App.tsx:113`).
- `selectedCompletionBySegment` = `selectedCompletions(data.segments.segments, activeSnapshot)`; delete the inline `useMemo` body.
- Delete the local `completionFor` helper; read the record directly.

**`src/lib/status.test.ts`** — any fixture constructing `tier: 1` snapshots must move to `tier: 3` or be dropped. Add a case: `selectedCompletions(segments, undefined)` yields `null` for every id, including segments whose `segment.completion` is non-null.

### 2. Correct the difficulty model's provenance (F4, F5)

**`src/lib/weights.ts`**
- Add, immediately under `STRUCTURE_TYPE_FACTORS` and inside the same "UNOFFICIAL HEURISTIC" doc comment scope, a second exported constant with its own comment stating that **no published source splits a package's contract value between structures and guideway**, that this is an editorial judgment, and that changing it changes strip widths only and never a source value:
  ```ts
  export const EDITORIAL_STRUCTURE_SHARE: Record<'CP1' | 'CP2-3' | 'CP4', number> = {
    CP1: 0.5,
    'CP2-3': 0.45,
    CP4: 0,
  };
  ```
  `CP4: 0` because the ArcGIS layer publishes no CP4 structure rows (3 coarse guideway rows only).
- Replace `weights.ts:67-70` with `const modelledStructureShare = structureRaw > 0 ? EDITORIAL_STRUCTURE_SHARE[cp] : 0;` and add a guard immediately after: `if (structureRaw > 0 && modelledStructureShare <= 0) throw new Error(\`${cp} has structure segments but a zero editorial structure share\`);` plus `if (modelledStructureShare > 0.7) throw new Error(...)`. Delete the `Math.min(0.7, …)` clamp — the constants are literals now, so an out-of-range value is a bug, not something to silently clamp.
- F5: change `const guideway = packageSegments.filter((segment) => segment.kind !== 'structure')` (line 63) to `=== 'guideway'`. `no-data` spans inside CP1/CP2-3/CP4 then keep `weight = 0` and `weightShare = 0`. The `M2M`/`LGA` extension loop (lines 96-103) is untouched and still spreads the published Table B.1 totals across those spans, so the extensions keep their weight.
- Rename the misleading `Calibration.structureScale` (it stores `structureScale / guidewayScale`, a ratio) to `structurePerGuidewayScale` in `src/data/types.ts` and here.

**`scripts/build-segments.ts`** — update the `artifact.model` string (line 376) to: `'Package and extension totals are published contract values; the structure/guideway split and structure type factors are editorial with no published basis'`.

**`src/components/StripChart.tsx`** — rewrite `.model-caption` text to say exactly: package totals come from published per-package contract values and 2026 Business Plan Table B.1 extension totals; **both** the structure type factors **and** the structure/guideway split are this dashboard's editorial judgment with no published basis; spans with no alignment-resolved data carry no modelled effort and render as hairlines; CP1 publishes structure rows inside their guideway rows, so 1.6 mi of corridor appears in both. Keep the existing `SourceLink`s.

### 3. Resolve and byte-verify a direct PDF URL per report (F8, F9)

Add `parseReportMonth` to **`scripts/lib/cvsr-parser.ts`**, exported, strict, returning `string | null` (never throws, never guesses):
```ts
export function parseReportMonth(text: string): string | null
```
Match `/([A-Z][a-z]+)\s+(20\d{2})\s+Report\s*\(\s*data\s+through/i` and `/Central Valley Status Report\s*[-–—]?\s*([A-Z][a-z]+)\s+(20\d{2})/i`; normalize through the existing `normalizeDataMonth`; return `null` on no match. Add tests for both patterns and for the no-match case.

Add a third mode to **`scripts/fetch-cvsr.ts`**: `--resolve-urls`, wired as `"resolve:cvsr-urls": "tsx scripts/fetch-cvsr.ts --resolve-urls"` in `package.json`.

Behaviour — this is the only network path and its policy goes in a header comment on the function:
1. Load the committed registry `data/raw/cvsr/report-urls.json`, shape:
   ```ts
   type ResolvedReportUrl = { url: string; bytes: number; prefixSha256: string; verifiedAt: string };
   type ReportUrlRegistry = Record<string /* reportFile */, ResolvedReportUrl>;
   ```
   Already-verified files are skipped.
2. Build ≤8 ordered candidates per unresolved local PDF, deduped:
   - `https://hsr.ca.gov/wp-content/uploads/{YYYY}/{MM}/{file}` for the `parseReportMonth` result, then for `dataMonth` + 2, + 3, + 1 months.
   - Every distinct `20\d{2}` + `(0[1-9]|1[0-2])` pair appearing in the filename, as `uploads/{YYYY}/{MM}/{file}`.
   - For `brdmtg_*` files, `https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/{YYYY}/{file}` where `YYYY` is `20` + the last two digits of the `MMDDYY` token (e.g. `brdmtg_031720_…` → `2020`).
3. Probe each candidate with `GET`, header `Range: bytes=0-262143`, `User-Agent: hsr-dashboard/1.0 (+https://github.com/rschiang/hsr-dashboard)`, and a **1000 ms delay between every request**.
4. Accept only when **all** hold: status `200` or `206`; `content-type` starts `application/pdf`; the full length (from `Content-Range`'s total, else `Content-Length`) equals the local file's byte size; and SHA-256 of the returned prefix equals SHA-256 of the local file's first `262144` bytes. Anything else → next candidate.
5. Write `report-urls.json` sorted by key, one entry per verified file. Print a summary and list unresolved filenames.
6. **Never** request `wp-json`, HTML pages, or any URL twice, and never vary the User-Agent. If a probe returns an Incapsula challenge (`text/html`), abort that file's remaining candidates and record it unresolved. Document all of this in the mode's header comment.

`--parse` stays offline: it reads `report-urls.json` and stamps `reportUrl` on each tier-2 snapshot. Precedence is `REVIEWED_CVSR_REPORTS` first (so the archived May 2023 keeps its Wayback `reportUrl` and `originalReportUrl`), then the resolver registry, then nothing. Extend `CvsrInventory` with `unresolvedReportUrls: string[]` listing files with no verified URL, and add an `Unresolved report URLs` section to the generated `MANIFEST.md`.

### 4. Tag hand transcriptions (F7)

**`src/data/types.ts`**
- `PackageMetrics` gains `transcribedFields?: Array<'progress' | 'parcels'>`.
- `CvsrInventory` gains `transcriptions: Array<{ month: string; reportFile: string; fields: Array<'progress' | 'parcels'>; detail: string }>`.

**`scripts/fetch-cvsr.ts`** — in `parsePdf`, when `LEGACY_PROGRESS[reportFile]` supplies `perPackage`, set `transcribedFields: ['progress']` on each package; when `LEGACY_PARCELS[reportFile]?.[cp]` supplies parcels, append `'parcels'`. Detail string for the inventory record, verbatim: `'Reviewed transcription: the published value is a chart image in the source PDF and is not extractable as text.'`

**`scripts/lib/cvsr-inventory.ts`** — `buildCvsrInventory()` collects `transcriptions` from the snapshots (sorted by month) and `unresolvedReportUrls`. A transcription is **not** a gap and must not appear in `gaps`.

Add a `Transcribed values` table to `MANIFEST.md`.

### 5. Per-package cross-check assertion, overlap assertion, regenerate (F11, F16)

**`scripts/build-segments.ts`**
- Replace the aggregate check at lines 433-445 with a per-package one. Read `data/raw/cvsr/parsed-snapshots.json`; take the tier-2 snapshot with the greatest `dataMonth`. For each of `CP1`, `CP2-3`, `CP4` compute `equivalent = Σ (iosMileEnd − iosMileStart) × completion` over `kind === 'guideway'` segments and require `|equivalent − perPackage[cp].guidewayMilesComplete| <= 1.5`; require the three-package total within `2.0` of the CVSR total. Observed deltas today: CP1 −0.55, CP2-3 +0.73, CP4 −0.33, total −0.15. If `parsed-snapshots.json` is missing, `console.warn` and skip — the ArcGIS-only pipeline must still run.
- Write the comparison into the artifact so the UI can render it without recomputing:
  ```ts
  crossCheck: {
    cvsrDataMonth: string;
    perPackage: Record<'CP1' | 'CP2-3' | 'CP4', { equivalentMiles: number; cvsrMilesComplete: number; cvsrMilesTotal: number }>;
  }
  ```
  Add it to `SegmentsArtifact` in `src/data/types.ts`.
- Add an overlap invariant: for each `cp`, every pair of segments whose `[iosMileStart, iosMileEnd]` intervals overlap by more than `0.001` mi must be exactly one `guideway` containing one `structure`; throw otherwise. Require zero overlaps in `CP2-3`. Emit `overlaps: Array<{ guidewayId: string; structureId: string; miles: number }>` into the artifact (today: 7 entries, 1.64 mi total) and assert the total is `< 3` mi.

**Regenerate** (no ArcGIS refresh — `build-segments.ts` reads the committed `data/raw/arcgis/` cache and takes `generatedAt` from `fetch-metadata.fetchedAt`, so the observation date stays `2026-08-09`):
```
npm run resolve:cvsr-urls
npm run parse:cvsr
npx tsx scripts/build-segments.ts
npx tsx scripts/build-history.ts
```
Do **not** run `npm run fetch`.

### 6. Header metrics: observed CVSR first, ArcGIS only where observed (F1, F10, F11)

**`src/App.tsx`** — four cells, in this order. `cvsrTotalMiles` = `Σ guidewayMilesTotal` over the displayed snapshot's packages (119 today); it replaces the hardcoded `119` literal at `App.tsx:194`.

| Cell | Value | Sub-label | Citation |
|---|---|---|---|
| `Guideway complete` | `Σ guidewayMilesComplete` / `cvsrTotalMiles` mi, one decimal | `Data through {dataMonth}` when exact, `Last observed {dataMonth}` when stale, `Before the published series` when `selectedMonth < coverageStart` | `SnapshotReportLink` (exact PDF) |
| `Earthwork-equivalent` | as today, `/ cvsrTotalMiles`; **`—`** when `activeSnapshot === undefined` | `ArcGIS observed {activeSnapshot.date}` or `No ArcGIS observation at this date` | `arcgis_progress` |
| `Structures complete` | as today | same as row 1 | `SnapshotReportLink` |
| `Difficulty-weighted` | `weightedPercent`; **`—`** when `activeSnapshot === undefined` | `Modelled · ArcGIS observed {date}` or `No ArcGIS observation at this date` | `business_plan_2026` |

Rationale to keep in a comment: earthwork-equivalent and difficulty-weighted are both re-readings of the same ArcGIS `Completion` values, so they are defined exactly when an observation exists. The CVSR cells are defined for every month in coverage.

### 7. Sparklines and the reconciliation row (F10)

**New `src/lib/cvsr-series.ts`** — pure, tested:
```ts
export type CvsrSeriesPoint = { month: string; value: number; total: number; ratio: number };
export function buildCvsrSeries(
  snapshots: Snapshot[],
  months: string[],
  cp: 'CP1' | 'CP2-3' | 'CP4',
  valueKey: NumericPackageMetric,
  totalKey: NumericPackageMetric,
): Array<CvsrSeriesPoint | null>;
```
One entry per month in `months` (use `cvsrInventory.expectedMonths`, 86 entries). A month yields a point **only** when a tier-2 snapshot with that `dataMonth` exists and both fields are finite numbers and `total > 0`; otherwise `null`. `ratio = value / total`, unclamped. Never interpolate, never carry forward.

**New `src/components/Sparkline.tsx`**
```tsx
export function Sparkline({ points, selectedIndex, label }: {
  points: Array<CvsrSeriesPoint | null>;
  selectedIndex: number | null;
  label: string;
}): React.ReactElement
```
- `viewBox="0 0 120 24"`, rendered at 120×24 CSS px, `role="img"`, `aria-label={label}`, plus a `<title>` with the same text.
- `x = 2 + i * (116 / (points.length - 1))`, `y = 22 - ratio * 20`.
- One `<path>` per **contiguous run** of non-null points; a run of length 1 renders `<circle r="1">`. Runs are never joined across `null` — that break is the visible evidence of the 17 unpublished utility months.
- Marker: filled `<circle r="2.5" fill="var(--accent)">` at `selectedIndex` when that point exists; hollow `<circle r="2.5" fill="none" stroke="var(--accent)">` at the last non-null index `<= selectedIndex` otherwise; nothing when no such index.
- `label` format: `` `${metric} ${cp}: ${firstMonth} ${firstPct}% to ${lastMonth} ${lastPct}%; ${nullCount} of ${points.length} months not published` ``.

**`src/App.tsx` `PackageBands`** — each of the four metric rows renders, per package, `<Sparkline>` followed by `value / total`. `selectedIndex` = `expectedMonths.indexOf(selectedMonth)` (`-1` → `null`).

**New `CrossCheck` row** rendered directly under the bands, from `segments.crossCheck` and the displayed snapshot. When `activeSnapshot` exists:
`Cross-check · Earthwork-equivalent {x.x} mi (ArcGIS {date}) vs CVSR guideway complete {y.y} mi ({cvsrDataMonth}) · Δ {±z.z} mi`
plus a fixed explanatory clause: *"Independent measures of the same thing: ArcGIS publishes an earthwork-volume ratio per segment; the CVSR publishes miles with earthworks complete and rough grading. They are not required to agree exactly, and the ArcGIS fetch is later than the CVSR data month."* When `activeSnapshot` is undefined, the row states which side is missing instead of showing a Δ.

### 8. Coverage state, report links, citation density (F8, F14, F15)

**`src/App.tsx`**
- `PackageBands` status line gains two neutral-styled states ahead of the gap logic, keyed off `cvsrInventory.coverageStart` / `coverageEnd`:
  - `selectedMonth > coverageEnd` → `Latest published CVSR: data through {coverageEnd}` + `SnapshotReportLink`. Neutral, **not** `.stale`.
  - `selectedMonth < coverageStart` → `Before the published CVSR series (starts {coverageStart})`, no values, no report link.
  - Only months inside `[coverageStart, coverageEnd]` with a real gap keep the warning `.stale` style and the typed cause.
- `SnapshotReportLink`: label `Authority report (PDF)` with `title={snapshot.reportFile}`; `archived Authority report (PDF)` with the existing overwritten-URL title when `originalReportUrl` is present; when no `reportUrl`, fall back to `<SourceLink sourceId="cvsr" />` with `title={snapshot.reportFile}`.
- Remove the per-cell `<SourceLink sourceId="cvsr" />` (`App.tsx:352`) and the per-band-title one (`:335`). One `<SourceLink sourceId="cvsr" />` moves onto the `package-bands` section heading, beside the report link. `ReportLink` on gap cells stays. Rule to state in a comment: the panel's single exact-report link plus its `Data through {month}` label attributes every figure in the panel; the registry link identifies the series.
- `Legend.tsx`: drop the two `legend-zero` `SourceLink`s; keep the two definition citations.
- Transcribed values: `.band-value.transcribed` gets a dotted underline and `title={\`Transcribed by hand from a chart image in ${reportFile}; not extractable as PDF text.\`}`.
- Rename the disclosure to `Data gaps & transcriptions` and append a grouped transcription list (contiguous months, same fields) below the gap list.

### 9. Selected-segment detail panel and map attribution (F6, F13)

**New `src/components/SegmentDetail.tsx`** — rendered between `StripChart` and `TimeScrubber`, driven by `selectedId`:
- Fields: label; `cp` · status; station range; ios-mile and official MP range; `Earthwork completion at selected date` (or `not reported`); evidence quote with date-precision wording and a real `<a>`; difficulty share; one `<a>` per named structure with its observation label. Same content as the tooltip, with **working links**.
- A `Clear selection` button and `aria-live="polite"` on the container.
- When nothing is selected: `Select a segment on the strip or map for its sources.`

**`src/components/StripChart.tsx`**
- Wrap the segment `<rect>`s in `<g role="list">`; each rect gets `role="listitem"`, `tabIndex={focusedIndex === i ? 0 : -1}` (roving tabindex, `focusedIndex` initialised to `0`), and `aria-label={\`${label}, ${cp}, ${STATUS_LABELS[status]}, ios mile ${start.toFixed(1)} to ${end.toFixed(1)}\`}`.
- `onFocus` sets hover + shows the tooltip anchored at the rect's `getBBox()` centre; `onBlur` clears both. `onKeyDown`: `ArrowLeft`/`ArrowRight` move `focusedIndex` by one and `.focus()` the new rect (`preventDefault`); `Home`/`End` jump to first/last; `Enter`/`Space` call `onSelect`; `Escape` calls `onSelect(null)` and clears the tooltip.
- Remove the anchors from inside the tooltip (they are unreachable behind `pointer-events: none`) — the detail panel owns them now. Keep the tooltip's text lines.
- Axis-tick label collision at ≥11 px: keep all 18 ticks but render a label only when `(plotRight - plotLeft) / 18 >= 62`; otherwise label every second tick, always including `0` and `171`.

**`src/components/AlignmentMap.tsx`** — add to the `new maplibregl.Map({...})` options:
```ts
attributionControl: {
  compact: false,
  customAttribution: [
    '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
    '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>',
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    '<a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>',
  ],
},
```
(`MapOptions.attributionControl?: false | AttributionControlOptions` and `customAttribution?: string | string[]`, verified in `node_modules/maplibre-gl/dist/maplibre-gl.d.ts:10975,11833`. Supplying `customAttribution` replaces MapLibre's default, hence the explicit MapLibre entry.)
Also add `aria-label="Alignment map; the strip chart above carries the same data in keyboard-accessible form"` to `.map-container`.

### 10. Typography, contrast, layout (F12)

**`src/App.css`** — raise every size to the floor; no rule below 11 px remains:

| Selector | 11 px | | Selector | 12 px |
|---|---|---|---|---|
| `.eyebrow` | 10→11 | | `.package-report-status` | 9→12 |
| `.headline-metrics span` | 9→11 | | `.package-band`, `.band-title` | 9→12 |
| `.cp-label` | 8→11 | | `.data-gaps` | 9→12 |
| `.axis-label`, `.axis-caption`, `.station-label` | 7/8→11 | | `.axis-toggle button`, `.play-button` | 10→12 |
| `.tier-badge`, `.report-gap-badge` | 8→11 | | `.segment-tooltip` (title 14) | 9→12 |
| `.map-title > span`, `.legend-zero` | 8→11 | | `.model-caption`, `.definition`, `.granularity-note` | 8/9→12 |
| `.sources-list li`, `.maplibregl-ctrl-attrib` | 8/9→11 | | | |

Contrast replacements (computed this session against the actual backgrounds):

| Selector | Old | New | Ratio |
|---|---|---|---|
| `.eyebrow` | `#8a9698` (2.99) | `#5f6d70` | **5.28** on `#fffdf7` |
| `.source-link a` | `#d95f02` (3.69) | `#a04302` | **6.26** on `#fffdf7` |
| `.snapshot-report-link` | `#b84f00` (4.13) | `#8f3d00` | **6.05** on `#ece8dd` |
| `.axis-caption` | `#718084` (4.03) | `#5b696d` | **5.60** on `#fffdf7` |

Layout — the page scrolls below the fold (user's choice):
- `src/index.css`: `body { overflow: hidden }` → `overflow: auto`; delete the `@media (max-width: 900px) { body { overflow: auto } … }` override that now duplicates the default.
- `.app-shell`: `height: 100dvh` → `min-height: 100dvh`.
- `.dashboard-column`: drop `height: 100%` and `overflow: hidden`; `grid-template-rows` becomes `auto` for every row (the strip, detail panel, scrubber, bands and map size to content).
- `.map-section`: fixed `height: 380px`.
- `.legend-panel`: `height: 100%` → `position: sticky; top: 0; align-self: start; max-height: 100dvh` (keeps `overflow: auto`).
- New `.segment-detail` rules matching the panel style; `.band-value.transcribed { text-decoration: underline dotted; text-underline-offset: 2px; }`; `.strip-segment:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }`.
- Keep the existing 1180 px and 900 px breakpoints, raising their font sizes by the same table.

---

## Critical files & anchors

| File | Anchor | Why |
|---|---|---|
| `scripts/build-history.ts` | `scheduledCompletion`, tier-1 construction (lines 16-40) | The source of every fabricated percentage. Deleting it is the whole of F1; everything downstream must stop expecting tier-1 payloads |
| `src/lib/weights.ts` | lines 63, 67-70 | Two one-line changes carry F4 and F5; both shift `weightShare` for every segment, so `segments.json` must be regenerated and the caption must change with them |
| `scripts/fetch-cvsr.ts` | `parsePdf` (line 280), `LEGACY_PROGRESS` (165), `LEGACY_PARCELS` | The only place transcriptions and resolved URLs can be tagged; `--parse` must stay network-free |
| `scripts/build-segments.ts` | lines 433-445 (cross-check), 375-378 (artifact) | The ±8 aggregate tolerance is vacuous; the per-package numbers in F11 are the real proof the milepost projection is sound |
| `src/App.tsx` | `activeSnapshot` (111-121), `PackageBands` (311-360) | Both the tier fallback and the citation/gap rendering live here; the coverage states and sparkline wiring land in the same two regions |

## Verification

Run from the repo root. Every command's expected output is stated; a mismatch is a failure, not a note.

1. **URL resolution (network, ≤1 req/s):** `npm run resolve:cvsr-urls`
   - Prints a per-file verdict and a summary. Expect the 11 registry reports skipped or verified and a verified URL for the large majority of the remaining 95 local PDFs. `data/raw/cvsr/report-urls.json` exists and every entry carries `url`, `bytes`, `prefixSha256`, `verifiedAt`.
   - Spot-check one entry by hand: `curl -sI -r 0-0 <url>` returns `206` and `content-type: application/pdf`, and `stat -f%z data/raw/cvsr/<file>` equals the recorded `bytes`.
   - Re-running is a no-op (all files already verified, zero requests).
2. **Parse:** `npm run parse:cvsr` — still `86 monthly snapshots from 87 candidate reports; 19 non-CVSR alternatives ignored; network requests: 0`, zero failures. `data/raw/cvsr/parsed-snapshots.json` now has `cvsrInventory.transcriptions.length === 21` progress records plus the parcel records, and `unresolvedReportUrls` matches step 1's unresolved list.
3. **Rebuild:** `npx tsx scripts/build-segments.ts && npx tsx scripts/build-history.ts`
   - `build-segments` prints the per-package cross-check and exits 0. `public/data/segments.json` has `generatedAt === '2026-08-09…'` (unchanged), a `crossCheck` block, and `overlaps.length === 7` totalling ≈1.64 mi.
   - `public/data/history.json` has `replayMonths.length === 94`, **zero** tier-1 snapshots, 86 tier-2, 1 tier-3, and ≥75 tier-2 snapshots now carrying `reportUrl`.
4. **New behaviour, exercised directly** — `node -e` / `npx tsx` one-liner over `public/data/history.json`: assert no snapshot anywhere has `tier === 1`, and assert `buildCvsrSeries(snapshots, expectedMonths, 'CP1', 'utilitiesRelocated', 'utilitiesTotal')` returns exactly **17 leading `null`s** (2019-03 … 2020-07) followed by 69 non-null points. That is the sparkline break that proves gaps are not interpolated.
5. **Suites:** `npm test` (existing 17 plus new `cvsr-series`, `parseReportMonth`, `selectedCompletions`, and weights cases), `npm run lint`, `npm run build`.
6. **Browser smoke test** — `npm run build && npm run preview -- --host 127.0.0.1`, open `/hsr-dashboard/`:
   - **Landing (2026-08-09):** package panel reads `Latest published CVSR: data through 2026-04` in neutral styling — no warning color, no "No CVSR snapshot". Header: `Guideway complete 87.1 / 119 mi`, `Earthwork-equivalent 87.0 / 119 mi`, `Structures complete 62 / 92`, `Difficulty-weighted` populated. Cross-check row shows `Δ −0.1 mi`.
   - **Scrub to 2022-06:** the strip tooltip on any guideway segment reads `Earthwork completion at selected date not reported` — **the string `50%` must not appear anywhere**. `Earthwork-equivalent` and `Difficulty-weighted` both read `—`. `Guideway complete` reads the CVSR 2022-06 figure with `Data through 2022-06` and a working `Authority report (PDF)` link.
   - **Scrub to 2019-06:** all four utility sparklines show no line before 2020-08; the `Data gaps & transcriptions` disclosure lists `Utilities (CP1, CP2-3, CP4): 2019-03–2020-07 — Not published in source` and the transcription entries; the CP band values for that month carry the dotted-underline transcription marker.
   - **Keyboard only:** Tab reaches the first strip segment; `ArrowRight` walks segments and the tooltip follows focus; `Enter` fills the detail panel; the detail panel's structure and evidence links are focusable and open; `Escape` clears.
   - **Map:** the attribution control reads `OpenFreeMap © OpenMapTiles Data from OpenStreetMap MapLibre`.
   - **Legibility:** no rendered text below 11 px (`getComputedStyle` sweep over all elements asserting `parseFloat(fontSize) >= 11`).
   - Console clean, no failed requests.

## Assumptions & contingencies

- **URL resolution will not reach 100%.** Contingency: files that fail every candidate stay in `unresolvedReportUrls`, keep the `SourceLink sourceId="cvsr"` fallback with the filename in `title`, and are listed in `MANIFEST.md`. Do **not** widen the candidate set by brute-forcing months, and do **not** record an unverified URL. If the whole host starts returning Incapsula challenges for `/wp-content/uploads/`, abort the mode, commit whatever verified, and leave the rest unresolved — the offline pipeline is unaffected.
- **`EDITORIAL_STRUCTURE_SHARE` values (0.50 / 0.45 / 0) are a judgment call**, chosen to land near the current effective shares so widths do not lurch. They are declared unsourced. If you prefer different weighting emphasis, they are three numbers in one file and nothing else changes.
- **Cross-check tolerance ±1.5 mi per package** is set against today's observed deltas (max 0.73 mi), giving roughly 2× headroom. If a future ArcGIS fetch trips it, that is the assertion working — investigate the milepost projection before widening it.
- **`parseReportMonth` may return `null` for older layouts.** That is designed for: the resolver still tries `dataMonth + 1/2/3` and filename tokens, so a null report month costs candidates, not correctness. Never fall back to guessing from the publication cadence.
- **Removing tier-1 snapshots leaves replay colors schedule-derived** — that is unchanged and correct; `scheduledStatus` already produces them from published `Start`/`Finish` dates and the scrubber badge already says `Scheduled replay`. Only the invented *numbers* go.
- **The page now scrolls.** If the strip, detail panel and scrubber do not fit above the fold at 1512×950, shrink `.map-section` to 320 px rather than reintroducing `overflow: hidden`.
