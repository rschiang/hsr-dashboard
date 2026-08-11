# Dashboard revision — rail consolidation, map-overlay segment panel, notes merge

## Context

The Merced–Bakersfield dashboard currently renders a 340 px metric rail with seven blocks, and a
below-fold region holding *Selected segment*, *Package detail*, a *Data gaps, transcriptions &
revisions* `<details>`, *Notes*, and *Sources*. This revision consolidates every per-package number
into the rail, moves the selected-segment panel onto the map as a top-right overlay, deletes the
*Package detail* table and the data-gap disclosure outright (their content folds into the rail and
into *Notes*), and makes a second click on an already-selected strip segment clear the selection.
End state: below the fold only *Notes* and *Sources* remain.

No metric is re-derived and no unknown is filled in. `parcelsAcquired`, `railroadParcelsAcquired`,
`acquisitionAudit`, `parcelAcquisitionAsOf`, and `transcribedFields` stay in `src/data/types.ts`,
`src/lib/cvsr-series.ts` (`NumericPackageMetric`), `scripts/fetch-cvsr.ts`, and the committed
`public/data/history.json` — only their UI surfaces go away.

## Grounded facts (verified this session against the current tree)

- `src/App.tsx` (639 ln) holds `App`, plus module-level `CVSR_PACKAGES` (28), `PACKAGE_BAND_METRICS`
  (30–45), types `CvsrGapGroup`/`TranscriptionGroup`/`RevisionGroup` (47–61), `nextMonth` (63–67),
  `groupCvsrGaps` (69–89), `groupTranscriptions` (91–104), `groupRevisions` (106–127), `sumPackages`
  (129–142), `GAP_LABELS` (348–354), `ReportLink` (356–359), `SnapshotReportLink` (361–381),
  `GAP_METRIC_LABELS` (383–388), `DataGapDisclosure` (390–427), `PackageBands` (429–~528),
  `CP_COLORS`, `RAIL_METRICS`, `TRACK_ARIA_LABEL`, `MetricRail`.
- `MetricBlock` (`src/components/MetricBlock.tsx`) takes
  `{ label, value, unit?, chip?, packages?, series, selectedIndex, ariaLabel }` and renders
  `.metric-block > .metric-head(h3 + .metric-chip? + ul.metric-packages?) + p.metric-value + Sparkline`.
  `packages` is `Array<{ cp: string; percent: string }>`.
- `SegmentDetail` (`src/components/SegmentDetail.tsx`) accepts `segment: Segment | undefined` and
  renders `<p className="detail-empty">Select a segment on the strip or map for its sources.</p>`
  when undefined. Two `<dd>`s carry `className="detail-wide"` (evidence, named structures).
- `StripChart` (`src/components/StripChart.tsx`) already receives `selectedId`. Selection happens in
  exactly two places inside `interactionProps`: `onClick: () => onSelect(segment.id)` and the
  `Enter`/`Space` branch of `onKeyDown`. `Escape` already calls `onSelect(null)`.
- `AlignmentMap` renders `<section className="map-section">` (`position: relative`) containing only
  the sr-only `h2` and `.map-container`. `.map-section` is currently the direct grid item of
  `.viewport-grid`.
- `NotesList` (`src/components/Notes.tsx`) currently takes no props and renders seven `<li>`s.
- Committed data, from `public/data/history.json` (`node -e` this session):
  - `groupCvsrGaps` produces **exactly 2 groups**: `utilities` / `source_not_reported` / CP1+CP2-3+CP4
    / 2019-03–2020-07, and `parcel_delivery` / `related_measure_only` / CP1+CP2-3+CP4 / 2019-09–2020-01.
    There are **zero** gaps with `metric === 'snapshot'`, so `.report-gap-badge` never renders.
  - `groupRevisions` produces **exactly 1 group**: `progress` / CP4 / correctedIn `2022-04` /
    2021-08–2022-03, detail "A discrepancy has been identified for CP4 in the previous months
    reporting of the guideway progress. This has been corrected for the April 2022 Data report."
  - 86 tier-2 months, 2019-03 … 2026-04. `parcelsAcquired` is published in only 18 of them
    (2019-09 … 2021-03, nothing after). `acquisitionAudit` exists for the 2020-01 data month only.
    `railroadParcelsAcquired` spans 2020-01 … 2026-04 (69 months) moving 105 → 164 with 15 distinct
    aggregate values. `transcriptions` has 21 entries.
- `SOURCES` index of `cvsr` is 7, so `<SourceLink sourceId="cvsr" />` renders footnote `7`.
- Headless verification note: `tab.evaluate` against this app is reliable, but `tab.screenshot` and
  `page.screenshot` **hang** once MapLibre has initialised. Verification below is DOM-only.

## Approach

Step 1 is a prerequisite for steps 2 and 3. Steps 2, 3, 4, and 5 are independent of one another once
step 1 lands. Step 6 is the stylesheet sweep and runs last.

### Step 1 — Extract gap/revision grouping into `src/lib/cvsr-gaps.ts`

`Notes.tsx` needs the grouping helpers and label maps; `App.tsx` needs `GAP_LABELS` for the new
per-metric status line. Importing `Notes` → `App` would be circular, so both import a new lib module.
No existing module owns this (`src/lib/` holds `status.ts`, `cvsr-series.ts`, `mileposts.ts`,
`observation-labels.ts`, `weights.ts`).

Create `src/lib/cvsr-gaps.ts` containing, **moved verbatim** from `src/App.tsx`: the `CvsrGapGroup`
and `RevisionGroup` types, `nextMonth`, `groupCvsrGaps`, `groupRevisions`, and `GAP_LABELS`. Export
everything except `nextMonth`. Add two label maps with these exact literals:

```ts
export const GAP_METRIC_LABELS: Record<CvsrGap['metric'], string> = {
  snapshot: 'Monthly report',
  utilities: 'Utilities',
  parcels: 'Right-of-way acquisition',
  parcel_delivery: 'Right-of-way delivery',
};

export const REVISION_METRIC_LABELS: Record<CvsrInventory['revisions'][number]['metric'], string> = {
  progress: 'Guideway and structure progress',
  parcels: 'Right-of-way delivery',
  utilities: 'Utilities',
};
```

`GAP_METRIC_LABELS` replaces the old `parcels: 'Parcels'` / `parcel_delivery: 'Parcels delivered to
DB'` wording so the notes match the rail's new label. Imports the module needs:
`import type { CvsrGap, CvsrGapCause, CvsrInventory } from '../data/types';`.

Delete from `src/App.tsx`: the `TranscriptionGroup` type, `groupTranscriptions`, the
`groupedTranscriptions` `useMemo` (lines 218–221), `GAP_METRIC_LABELS`, and everything moved above.
`App.tsx` then imports `{ GAP_LABELS, groupCvsrGaps, groupRevisions }` from `./lib/cvsr-gaps` and
drops the now-unused `CvsrGapCause` member from its `./data/types` type import (`CvsrGap`,
`CvsrInventory`, `CvsrPackageId` are all still used).

Transcriptions leave the UI entirely — the request calls them a non-issue. `CvsrInventory
.transcriptions`, `PackageMetrics.transcribedFields`, and `scripts/lib/cvsr-inventory.ts:190` are
untouched.

### Step 2 — Fold data gaps and revisions into `NotesList`

`NotesList` becomes data-driven rather than static prose: the two committed groups are small today,
but `npm run fetch` can add more, and hard-coded prose would silently rot.

New signature in `src/components/Notes.tsx`:

```tsx
export function NotesList({ gaps, revisions }: { gaps: CvsrGapGroup[]; revisions: RevisionGroup[] })
```

Imports add `import { GAP_LABELS, GAP_METRIC_LABELS, REVISION_METRIC_LABELS, type CvsrGapGroup, type RevisionGroup } from '../lib/cvsr-gaps';`.

Keep the seven existing `<li>`s verbatim, then append three more in this order.

**New item 8 — placed after "Track installation."** Explains the recipient that the rail label drops
and records why the two removed blocks are gone. Every figure below is from the committed data
(see Grounded facts):

```tsx
<li>
  <b>Right-of-way delivered.</b> The CVSR counts parcels the Authority has handed to the
  design-builder — the contractor joint venture building that package — which is what the rail
  charts. The Authority also publishes a separate acquisition count, last reported for the 2021-03
  data month, and a railroad-parcel count that moved from 105 to 164 across 69 published months;
  neither is charted here. <SourceLink sourceId="cvsr" />
</li>
```

**New item 9 — "Data gaps."** Rendered only when `gaps.length > 0`:

```tsx
<li>
  <b>Data gaps.</b> A month the Authority did not publish a metric is left blank, never interpolated
  and never carried forward. <SourceLink sourceId="cvsr" />
  <ul>
    {gaps.map((group) => (
      <li
        key={`${group.metric}:${group.cause}:${group.month}:${group.endMonth}:${group.packages.join(',')}`}
        title={group.detail}
      >
        {GAP_METRIC_LABELS[group.metric]} ({group.packages.join(', ')}):{' '}
        {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — {GAP_LABELS[group.cause]}
      </li>
    ))}
  </ul>
</li>
```

**New item 10 — "Data anomalies."** Rendered only when `revisions.length > 0`:

```tsx
<li>
  <b>Data anomalies.</b> Values the Authority later restated. The superseded month keeps the number
  its own report published; the rail marks the affected package with a wavy underline.
  <SourceLink sourceId="cvsr" />
  <ul>
    {revisions.map((group) => (
      <li key={`revision:${group.key}:${group.month}:${group.endMonth}`} title={group.detail}>
        {REVISION_METRIC_LABELS[group.metric]} ({group.packages}):{' '}
        {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — restated in the{' '}
        {group.correctedIn} report
      </li>
    ))}
  </ul>
</li>
```

Delete `DataGapDisclosure` from `src/App.tsx` and its callsite; in the `.below-fold` section replace
the `SegmentDetail` / `PackageBands` / `DataGapDisclosure` children with just
`<NotesList gaps={groupedCvsrGaps} revisions={groupedRevisions} />` and `<SourcesList />`. The
`groupedCvsrGaps` and `groupedRevisions` memos stay exactly as they are.

CSS in `src/App.css` — add after `.notes-list b`:
```css
.notes-list ul ul { margin: 4px 0 0; padding-left: 15px; }
.notes-list ul ul li { margin-bottom: 2px; font-size: 11.5px; }
```
Delete the `.data-gaps`, `.data-gaps summary`, `.data-gaps ul`, `.data-gaps b` rules.

### Step 3 — Rail: report status, four metrics, revision marks, gap status

**3a. `MetricBlock` gains two capabilities** (`src/components/MetricBlock.tsx`). Widen the
`packages` element type and add an optional secondary status line:

```tsx
packages?: Array<{ cp: string; percent: string; revisedTitle?: string }>;
status?: React.ReactNode;
```

Render the package entry as `<li key={cp}><b>{cp}</b>: {revisedTitle === undefined ? percent :
<span className="revised" title={revisedTitle}>{percent}</span>}</li>`, and insert
`{status && <p className="metric-status">{status}</p>}` between `p.metric-value` and `<Sparkline/>`.

**3b. `RAIL_METRICS` in `src/App.tsx`** drops two rows, renames one, and gains two fields. Exactly
four entries, in this order:

```ts
const RAIL_METRICS: ReadonlyArray<{
  label: string;
  value: NumericPackageMetric;
  total: NumericPackageMetric;
  unit?: string;
  /** CVSR revision family this metric belongs to; marks restated package cells. */
  revisedAs?: 'progress' | 'parcels' | 'utilities';
  /** CVSR gap metric that explains a blank month for this block. */
  gapMetric?: CvsrGap['metric'];
  format: (value: number, total: number) => string;
}> = [
  { label: 'Guideway complete', value: 'guidewayMilesComplete', total: 'guidewayMilesTotal', unit: 'mi', revisedAs: 'progress', format: (value, total) => `${value.toFixed(1)} / ${total.toFixed(0)}` },
  { label: 'Structures complete', value: 'structuresComplete', total: 'structuresTotal', revisedAs: 'progress', format: (value, total) => `${value} / ${total}` },
  { label: 'Right-of-way delivered', value: 'parcelsDelivered', total: 'parcelsTotal', revisedAs: 'parcels', gapMetric: 'parcel_delivery', format: (value, total) => `${value.toLocaleString()} / ${total.toLocaleString()}` },
  { label: 'Utilities relocated', value: 'utilitiesRelocated', total: 'utilitiesTotal', revisedAs: 'utilities', gapMetric: 'utilities', format: (value, total) => `${value.toLocaleString()} / ${total.toLocaleString()}` },
];
```

`revisedAs` reproduces the mapping `PACKAGE_BAND_METRICS` already shipped. The CVSR revision record
carries `metric: 'progress'` with no guideway/structure distinction, so both progress blocks mark
CP4 for 2021-08 … 2022-03 — narrowing it to guideway alone would invent a split the source does not
publish. Only `parcelsDelivered` and `utilitiesRelocated` get a `gapMetric`, so only those two blocks
can show a status line, which is what the request asks for.

**3c. `MetricRail` signature** gains the two values the moved report status needs:

```tsx
function MetricRail({ snapshot, snapshots, inventory, selectedMonth, gaps, exact }: {
  snapshot: Snapshot | undefined;
  snapshots: Snapshot[];
  inventory: CvsrInventory;
  selectedMonth: string;
  gaps: CvsrGap[];
  exact: boolean;
})
```

Callsite in `App` passes `gaps={selectedCvsrGaps}` and `exact={exactCvsrSnapshot !== undefined}` —
the same two expressions `PackageBands` receives today.

**3d. Move the report status to the top of the rail.** Inside `MetricRail`, compute
`const afterCoverage = selectedMonth > inventory.coverageEnd;` and
`const snapshotGap = gaps.find((gap) => gap.metric === 'snapshot');` alongside the existing
`beforeCoverage`, then render as the **first** element of the returned fragment, before the
`Track installed` block. Take the `<div>` from `PackageBands` **verbatim**, changing only the class
name from `package-report-status` to `rail-report-status`:

```tsx
<div className={`rail-report-status${exact || beforeCoverage || afterCoverage ? '' : ' stale'}`}>
  {beforeCoverage
    ? <>Before the published CVSR series (starts {inventory.coverageStart}) <SourceLink sourceId="cvsr" /></>
    : afterCoverage && snapshot
      ? <>Latest published CVSR: data through {inventory.coverageEnd} · <SnapshotReportLink snapshot={snapshot} />{snapshot.reportUrl && <> <SourceLink sourceId="cvsr" /></>}</>
      : exact && snapshot
        ? <>Data through {selectedMonth} · <SnapshotReportLink snapshot={snapshot} />{snapshot.reportUrl && <> <SourceLink sourceId="cvsr" /></>}</>
        : snapshot
          ? <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} · Last observed {snapshot.dataMonth} · <SnapshotReportLink snapshot={snapshot} />{snapshot.reportUrl && <> <SourceLink sourceId="cvsr" /></>}</>
          : <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} <SourceLink sourceId="cvsr" /></>}
</div>
```

**3e. Per-metric revision marks and status line.** Inside the `RAIL_METRICS.map` callback, before
building `packages`:

```tsx
const gap = beforeCoverage || metric.gapMetric === undefined
  ? undefined
  : gaps.find((candidate) => candidate.metric === metric.gapMetric || candidate.metric === 'snapshot');
```

Pass to `MetricBlock`:

```tsx
status={gap && <><span title={gap.detail}>{GAP_LABELS[gap.cause]}</span> <ReportLink gap={gap} /></>}
```

and replace the existing `packages` prop with this complete expression — the added `revision` lookup
is per package, so it must live inside the mapper callback:

```tsx
packages={CVSR_PACKAGES.map((cp) => {
  const packageMetric = beforeCoverage ? undefined : snapshot?.perPackage?.[cp];
  const packageValue = packageMetric?.[metric.value];
  const packageTotal = packageMetric?.[metric.total];
  // The superseded month keeps the number its own report published; the marker
  // says the Authority later restated it.
  const revision = beforeCoverage || metric.revisedAs === undefined ? undefined : inventory.revisions.find(
    (entry) => entry.month === selectedMonth
      && entry.metric === metric.revisedAs
      && entry.packages.includes(cp),
  );
  return {
    cp,
    percent: packageValue === undefined || packageTotal === undefined || packageTotal <= 0
      ? '—'
      : `${Math.round((packageValue / packageTotal) * 100)}%`,
    revisedTitle: revision === undefined
      ? undefined
      : `Superseded: the Authority restated this value in the ${revision.correctedIn} report. ${revision.detail}`,
  };
})}
```

`ReportLink` stays in `App.tsx` (it is now used only here); its no-`reportUrl` branch already falls
back to `<SourceLink sourceId="cvsr" />`, which is the footnote anchor the request asks for — none of
the committed gaps carry a `reportUrl`.

**3f. Delete `PackageBands`** and `PACKAGE_BAND_METRICS` from `src/App.tsx`, plus the callsite.
`sumPackages`, `CVSR_PACKAGES`, `CP_COLORS`, `TRACK_ARIA_LABEL`, `SnapshotReportLink`, and the
`Track installed` block are all still used and stay.

CSS in `src/App.css`:
```css
.rail-report-status { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 11px; font-weight: 700; line-height: 1.35; }
.rail-report-status.stale { color: #7a3c13; }
.metric-status { color: #7a3c13; font-size: 10.5px; font-weight: 700; line-height: 1.3; }
.metric-packages .revised { text-decoration: underline wavy #a04302; text-underline-offset: 2px; }
```
`.snapshot-report-link` keeps its existing rule. Delete `.package-report-status` and
`.package-report-status.stale`.

### Step 4 — Selected segment as a map overlay

**4a. `SegmentDetail` loses its empty state.** In `src/components/SegmentDetail.tsx` change
`segment: Segment | undefined` to `segment: Segment`, delete the `{!segment ? … : (…)}` conditional
so the `<dl>` renders unconditionally, delete the `'No segment selected'` fallback in the `<h2>`
(now always `{segment.label}`), delete the `.detail-empty` paragraph, and drop the
`className="detail-wide"` from both `<dd>`s — the overlay `<dl>` is single-column so the modifier is
meaningless. `{segment && <button …>}` becomes an unconditional `<button type="button"
onClick={onClear}>Clear selection</button>`. Every other prop and row stays byte-identical.

**4b. Wrap the map.** In `src/App.tsx`, replace the bare `<AlignmentMap … />` grid child with:

```tsx
<div className="map-pane">
  <AlignmentMap
    data={data.geojson}
    statuses={derived.statuses}
    hoveredId={hoveredId}
    selectedId={selectedId}
    onHover={handleHover}
    onSelect={handleSelect}
  />
  <div className="map-overlay" aria-live="polite">
    {selectedSegment && (
      <SegmentDetail
        segment={selectedSegment}
        status={derived.statuses[selectedSegment.id]}
        evidence={derived.evidence[selectedSegment.id]}
        completion={selectedCompletionBySegment[selectedSegment.id] ?? null}
        disagreement={selectedDisagreement}
        date={date}
        onClear={handleClearSelection}
      />
    )}
  </div>
</div>
```

The `aria-live` region is the always-mounted `.map-overlay`, so selection changes are still
announced even though the panel itself unmounts. `AlignmentMap` is not modified — the wrapper owns
the positioning context, so the component keeps its current API.

CSS — `.map-pane` becomes the grid item, so `.map-section` must fill it; `display: grid` makes the
child stretch without relying on percentage heights:
```css
.map-pane { position: relative; display: grid; min-width: 0; }
.map-overlay { position: absolute; z-index: 3; top: 12px; right: 12px; width: 320px; max-width: calc(100% - 24px); max-height: calc(100% - 24px); overflow: auto; pointer-events: none; }
```
Replace the whole `.segment-detail` rule and its `dl`/`dt`/`dd` rules with the overlay card
(`pointer-events: auto` re-enables interaction on the card itself, mirroring `.segment-tooltip`):
```css
.segment-detail { display: grid; align-content: start; gap: 8px; padding: 12px 14px; background: rgba(255,255,255,0.96); border: 1px solid var(--line); border-radius: 3px; box-shadow: 0 6px 24px rgba(20,24,28,0.14); pointer-events: auto; font-size: 12px; line-height: 1.35; }
.segment-detail h2 { font-size: 14px; font-weight: 750; letter-spacing: -0.01em; line-height: 1.2; }
.segment-detail dl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; margin: 0; }
.segment-detail dt { color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
.segment-detail dd { min-width: 0; margin: 0; color: var(--ink); }
```
Delete `.segment-detail .detail-empty` and `.segment-detail dd.detail-wide`. Keep
`.segment-detail-head`, `.segment-detail a`, `.segment-detail a:hover`, `.segment-detail button`,
and `.segment-detail button:hover` unchanged.

Remove `.segment-detail h2` from the shared below-fold heading selector on line 5 of `App.css`,
which also loses the now-dead `.package-bands h2`:
```css
.notes-list h2, .sources-list h2 { font-size: 15px; font-weight: 750; letter-spacing: -0.01em; }
```

### Step 5 — Clicking a selected strip segment clears the selection

In `src/components/StripChart.tsx`, `interactionProps` already closes over the `selectedId` prop.
Change both selection paths to toggle:

- `onClick: () => onSelect(selectedId === segment.id ? null : segment.id),`
- in `onKeyDown`, the `Enter`/`Space` branch: `onSelect(selectedId === segment.id ? null : segment.id);`

`Escape` keeps its unconditional `onSelect(null)`. `AlignmentMap`'s click handler is deliberately
left alone: a map click that toggled off would also cancel the `fitBounds` fly-to the same effect
just started, and the request scopes this to the strip.

### Step 6 — Stylesheet sweep

After steps 2–5, delete from `src/App.css` every rule whose selector no longer appears in `src/`.
Confirm each with `grep -rn "<selector>" src --include=*.tsx` before deleting. Expected casualties
beyond those already named: `.package-bands`, `.package-band`, `.package-band + .package-band`,
`.band-title`, `.band-value`, `.band-value b`, `.band-value.missing`, `.band-value .transcribed`,
`.band-value .revised`. In the `@media (max-width: 1024px)` block, delete the `.package-bands` and
`.package-band` lines and change `.map-section { min-height: 60vh; }` to
`.map-pane { min-height: 60vh; }` — `.map-pane` is the grid item now.

Then re-run the whole-file check that found zero dead selectors last time:

```bash
cd . && python3 - <<'PY'
import re, pathlib
css = pathlib.Path('src/App.css').read_text()
src = ''.join(p.read_text() for p in list(pathlib.Path('src').rglob('*.tsx')) + list(pathlib.Path('src').rglob('*.ts')))
print([c for c in sorted(set(re.findall(r'\.([a-zA-Z][\w-]*)', css))) if c not in src])
PY
```
It must print only `['maplibregl-ctrl-attrib', 'provenance-mixed', 'provenance-observed',
'provenance-scheduled']` — the MapLibre class and the three built from the
`` `tier-badge provenance-${provenance}` `` template.

## Critical files & anchors

- `src/App.tsx` — `MetricRail` (~line 555 to end) absorbs the report status, the revision marks, and
  the gap status; `PackageBands` (~429–528) and `DataGapDisclosure` (~390–427) are the two whole
  components to delete; the `.viewport-grid` and `.below-fold` JSX (~265–345) is where the overlay
  and the trimmed below-fold land.
- `src/components/MetricBlock.tsx` — the only place the `packages` element type and the new
  `status` slot are defined; both new rail behaviours flow through it.
- `src/components/SegmentDetail.tsx` — the `{!segment ? … : (…)}` conditional at line 37 is the
  whole empty-state removal; everything below it is preserved verbatim.
- `src/components/StripChart.tsx` — `interactionProps` (~line 148) holds both selection callsites.
- `src/App.css` — single stylesheet; roughly a third of it is rewritten across steps 2–6.

## Verification

Working directory `.`; no env vars or fixtures needed
(`public/data/*.json` are committed).

1. `npm run lint` → clean (no warnings). `npm test` → 48 tests, 48 pass (no lib signature this
   revision touches is under test). `npm run build` → succeeds; the pre-existing >500 kB chunk
   warning is expected.
2. Serve: `npm run dev -- --host 127.0.0.1` → `http://127.0.0.1:5173/hsr-dashboard/`, viewport
   1440×900. **Use `tab.evaluate` only — `tab.screenshot`/`page.screenshot` hang once MapLibre has
   initialised.** Drive the scrubber by index rather than clicking:
   ```js
   const setMonth = (m) => tab.evaluate((month) => {
     const input = document.querySelector('.scrubber-row input');
     const idx = window.__dates.findIndex((d) => d.startsWith(month));
     Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(idx));
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.dispatchEvent(new Event('change', { bubbles: true }));
   }, m);
   ```
   after seeding `window.__dates` from `fetch('/hsr-dashboard/data/history.json')` exactly as the
   app builds it: `[...new Set([...h.replayMonths, ...h.snapshots.filter((s) => s.tier === 3).map((s) => s.date)])].sort()`.
   Strip rects ignore `tab.click`; dispatch
   `new MouseEvent('click', { bubbles: true, cancelable: true, view: window })` inside `tab.evaluate`.
3. **Rail shape**: `[...document.querySelectorAll('.metric-block h3')].map((h) => h.textContent)`
   equals `['Track installed', 'Guideway complete', 'Structures complete', 'Right-of-way delivered',
   'Utilities relocated']` — five blocks, and neither `ROW parcels acquired` nor `Railroad ROW
   parcels` appears anywhere in `document.body.textContent`.
4. **Report status prepended**: `document.querySelector('.metric-rail').firstElementChild.className`
   is exactly `rail-report-status` (no `stale`). At the default date the scrubber lands on
   `2026-08-10`, which is past `coverageEnd` `2026-04`, so the text is
   `Latest published CVSR: data through 2026-04 · Authority report (PDF)` followed by footnote `7`.
   Set the month to `2026-04` → it becomes `Data through 2026-04 · Authority report (PDF)` plus
   footnote `7`. Set the month to `2018-12` → `Before the published CVSR series (starts 2019-03)`
   plus footnote `7`. `document.querySelector('.package-report-status')` is `null` in all three.
5. **Revision mark (new behaviour)**: set the month to `2022-03`. In the `Guideway complete` block,
   the `li` whose `<b>` reads `CP4` contains a `span.revised`, and its `title` is exactly
   `Superseded: the Authority restated this value in the 2022-04 report. A discrepancy has been
   identified for CP4 in the previous months reporting of the guideway progress. This has been
   corrected for the April 2022 Data report.`; the `CP1` and `CP2-3` `li`s contain no
   `span.revised`. The `Structures complete` block marks CP4 the same way. Set the month to
   `2026-04` → `document.querySelectorAll('.metric-packages .revised').length === 0`.
6. **Gap status (new behaviour)**: set the month to `2019-06`. The `Utilities relocated` block has a
   `p.metric-status` reading `Not published in source` plus an `a.fn-ref[href="#fn-cvsr"]`, and its
   `span[title]` title starts `Package utility relocation counts are first published`. Set the month
   to `2019-11` → the `Right-of-way delivered` block shows `Related measure only`. Set the month to
   `2026-04` → `document.querySelectorAll('.metric-status').length === 0`.
7. **Package detail and gap disclosure gone**:
   `document.querySelectorAll('.package-bands, .package-band, .data-gaps').length === 0`, and
   `document.body.textContent` contains neither `Package detail` nor `Transcribed`.
8. **Notes merge**: `[...document.querySelectorAll('.notes-list > ul > li')].length === 10`; the
   `Data gaps.` item has exactly 2 nested `li`s, the first reading
   `Utilities (CP1, CP2-3, CP4): 2019-03–2020-07 — Not published in source`; the `Data anomalies.`
   item has exactly 1 nested `li` reading
   `Guideway and structure progress (CP4): 2021-08–2022-03 — restated in the 2022-04 report`.
9. **Overlay (new behaviour)**: with nothing selected,
   `document.querySelector('.map-overlay .segment-detail')` is `null` while
   `document.querySelector('.map-overlay')` is not. Dispatch a click on a wide
   `.strip-segment` rect → the panel appears; assert its `getBoundingClientRect()` sits inside the
   `.map-pane` rect and that its `right` is within 24 px of the pane's `right` and its `top` within
   24 px of the pane's `top`. Its `a.fn-ref` markers resolve:
   `[...document.querySelectorAll('.segment-detail a.fn-ref[href^="#fn-"]')].every((a) => document.getElementById(a.hash.slice(1)) !== null)` → `true`.
10. **Toggle deselect (new behaviour)**: dispatch a click on the *same* rect again →
    `document.querySelector('.map-overlay .segment-detail')` is `null` and
    `document.querySelectorAll('.strip-segment.selected').length === 0`. Then click rect A, click
    rect B → exactly one `.strip-segment.selected` and the panel shows B's label. Focus a rect and
    press `Enter` twice → selected, then cleared.
11. **Unbroken**: `document.body.scrollHeight / window.innerHeight >= 1.8` → `true`;
    `[...document.querySelectorAll('a.fn-ref[href^="#fn-"]')].every((a) => document.getElementById(a.hash.slice(1)) !== null)` → `true`;
    at `2026-04` the `Guideway complete` value still reads `87.1 / 119mi` and `Utilities relocated`
    `1,720 / 1,826`.

## Assumptions & contingencies

- "Keep the data but remove the section" is read as UI-only: `parcelsAcquired`,
  `parcelsAcquisitionTotal`, `parcelAcquisitionAsOf`, `railroadParcelsAcquired`,
  `railroadParcelsTotal`, `acquisitionAudit`, and `transcribedFields` keep their places in
  `src/data/types.ts`, the `NumericPackageMetric` union, `scripts/fetch-cvsr.ts`, and
  `public/data/history.json`. Nothing under `scripts/` changes in this revision.
- The label is `Right-of-way delivered`; the recipient moves to Notes item 8. It fits the rail head
  on one line at 340 px. If a future label needs more room, widen `.viewport-grid`'s second track
  rather than re-abbreviating.
- Both progress blocks (guideway *and* structures) carry the CP4 revision mark, because the CVSR
  revision record is `metric: 'progress'` with no finer split. If the Authority ever publishes a
  guideway-only restatement, add a narrower metric value to `CvsrInventory['revisions']` rather than
  hard-coding a block exclusion here.
- The `Data gaps.` and `Data anomalies.` items are omitted entirely when their group array is empty,
  so a future dataset with no gaps yields 8 notes rather than an empty heading.
- Pre-existing state, deliberately not changed: the strip axis suppresses the `C 124` and `D 299`
  endpoint labels because `Merced` and `Bakersfield` occupy those slots in the single label row, so
  the ruler reads `C 134 … 284` with two lettered labels. Leave it as is unless separately asked.
- `.report-gap-badge` in the scrubber is unreachable with the committed data (zero `snapshot` gaps).
  It stays wired; do not delete it and do not expect it during verification.
