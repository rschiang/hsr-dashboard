# Dashboard design tweaks — scrubber replay, gap-status placement, segment detail, sparkline gaps

## Context

Four independent UI corrections to the Merced–Bakersfield dashboard, all in `src/components/` plus
`src/App.css`:

1. Pressing **Play** while the scrubber sits on the last tick (`Current`) restarts replay from the
   first tick instead of doing nothing; the now-purposeless `.scrubber-status` row is removed.
2. The gap explanation (`Not published in source` / `Related measure only`) moves out of its own row
   under the metric value — where it changes block height and makes the rail jag as you scrub — into
   the existing empty space under the metric label.
3. The `Earthwork at selected date` row leaves the segment-detail panel, and each named structure
   becomes its own list item.
4. Sparklines bridge missing months with a light-gray dashed line; a leading run of missing months is
   bridged flat at the first published value.

No data, no fetch script, and no metric derivation changes. Steps 1–4 are independent of one another
and may be done in any order.

## Grounded facts (verified this session against the current tree, commit `92a90b6`)

- `src/components/TimeScrubber.tsx` (75 ln): props `{ dates, date, onDateChange, reportGap? }`;
  `playing` state; `index = Math.max(0, dates.indexOf(date))`; a `requestAnimationFrame` loop that
  advances every 250 ms and calls `setPlaying(false)` once `dates.indexOf(date) >= dates.length - 1`.
  The `<time>` renders the literal `Current` at the last index. `.scrubber-status` (line 59) is a
  wrapper whose only child is the `reportGap` badge.
- `src/App.tsx:89-94` — `dates` is `data.history.replayMonths` plus `currentPoll.date` (the newest
  tier-2 ArcGIS poll) when one exists. `src/App.tsx:215` is the only `reportGap` callsite:
  `reportGap={selectedCvsrGaps.find((gap) => gap.metric === 'snapshot')}`. `selectedCvsrGaps` is also
  passed to `MetricRail` as `gaps=` (line 200), so it stays.
- A `snapshot` gap still surfaces without the badge: `MetricRail`'s `.rail-report-status`
  (`src/App.tsx:395-405`) renders `GAP_LABELS[snapshotGap.cause]`. The committed
  `public/data/history.json` contains **zero** gaps with `metric === 'snapshot'`, so the badge is
  unreachable with today's data.
- `src/components/MetricBlock.tsx` renders `.metric-head` (`h3` + optional `.metric-chip` + optional
  `ul.metric-packages`), then `p.metric-value`, then `{status && <p className="metric-status">}`,
  then `<Sparkline/>`. `.metric-block` is `display: grid; gap: 2px`, so the status `<p>` adds a whole
  row — this is the jag.
- Measured from `src/App.css:49-57`: `.metric-packages` is 3 `<li>` at `font-size: 10.5px;
  line-height: 1.35` ≈ **42.5 px**; `.metric-head h3` at `11.5px` with normal line-height ≈ 13.8 px;
  `.metric-status` at `10.5px; line-height: 1.3` ≈ 13.7 px. `13.8 + 13.7 = 27.5 px < 42.5 px`.
- `status` is passed only by the two `RAIL_METRICS` rows that carry a `gapMetric`
  (`Right-of-way delivered`, `Utilities relocated`, `src/App.tsx:290-291`), and both of those always
  render `packages`. No block ever has a `status` without a 3-line packages column.
- `src/components/SegmentDetail.tsx:53-68` — the `disagreement` ternary; its `else` branch is the
  `Earthwork at selected date` row and is the **only** use of the `completion` prop. Structures are
  `<span>`s joined by `' · '` inside one `<dd>` (lines 83-96).
- `selectedCompletionBySegment` is still required by `StripChart` (`src/components/StripChart.tsx:114,
  302` — the strip tooltip's own `Earthwork completion at selected date` line), so the
  `selectedCompletions` memo in `App.tsx` stays.
- `src/components/Sparkline.tsx` splits each series into contiguous non-null `runs` and draws each run
  as its own `<path className="sparkline-run">`; gaps are simply not drawn. An all-null series returns
  a single `<line>` at `BASELINE` dashed `2 3` in the series `color`. Constants: `WIDTH 240`,
  `HEIGHT 44`, `PLOT_LEFT 2`, `PLOT_WIDTH 236`, `BASELINE 40`, `AMPLITUDE 34`.
- Committed-data null patterns over the 86 `expectedMonths` (2019-03 … 2026-04), per `node -e` this
  session, for the four rail metrics on CP1/CP2-3/CP4:
  - `utilitiesRelocated`: **17 leading nulls**, 0 interior, 0 trailing (all three packages).
  - `parcelsDelivered`: 0 leading, **5 interior nulls**, 0 trailing (all three packages).
  - `guidewayMilesComplete`, `structuresComplete`: no nulls at all.
  - **No rail series has a trailing null**, so trailing-gap policy is unobservable today.
- `src/index.css` resets `h1, h2, p { margin: 0 }` only — a new `<ul>`/`<li>` needs its own
  `margin`/`padding`/`list-style` reset. Palette vars are `--ink --muted --faint --paper --panel
  --line --accent --cp1 --cp2-3 --cp4`; there is no gray suited to a "missing data" stroke, so step 4
  introduces one literal.

## Approach

### Step 1 — Replay restarts from the beginning; delete the scrubber status row

All in `src/components/TimeScrubber.tsx` unless noted.

**1a. Restart on Play.** Replace the inline `onClick={() => setPlaying((value) => !value)}` on
`.play-button` with a named handler declared above the `return`. The reset must be a plain statement,
not a side effect inside a `setState` updater — React StrictMode invokes updaters twice.

```tsx
const togglePlay = () => {
  if (playing) {
    setPlaying(false);
    return;
  }
  // The last tick is the present: replaying from there would advance zero frames,
  // so a Play press there means "start over".
  if (dates.length > 0 && index >= dates.length - 1) onDateChange(dates[0]);
  setPlaying(true);
};
```

`onClick={togglePlay}`. Every other attribute of the button, including the
`aria-label={playing ? 'Pause replay' : 'Play replay'}`, stays byte-identical. The existing
`requestAnimationFrame` effect needs no change: it reads `dates.indexOf(date)` each tick, so it picks
up the reset date and stops again at the last index.

**1b. Delete the status row.** Remove the `.scrubber-status` `<div>` (lines 59-71), the two-line
comment above it (lines 57-58), the `reportGap` parameter and its `reportGap?: CvsrGap;` type member,
and the now-unused `import type { CvsrGap } from '../data/types';` (line 2). `.time-scrubber` is left
with a single `.scrubber-row` child; leave the `.time-scrubber { display: grid; gap: 4px; }` rule
alone — it still positions the row inside the `.strip-controls` flex item.

**1c. Callsite.** In `src/App.tsx`, delete the `reportGap={…}` line from `<TimeScrubber>` (line 215).
Keep `selectedCvsrGaps` — `MetricRail` still receives it as `gaps=`.

**1d. CSS.** In `src/App.css`, delete `.scrubber-status` (line 183) and the `.report-gap-badge` rule
block plus `.report-gap-badge a` (lines 197-208). After this, `grep -rn "report-gap" src` must return
nothing.

### Step 2 — Move `.metric-status` under the metric label

**Decision: option (2), the head placement.** Option (1) — a red em dash with the footnote beside it —
also removes the jag, but it destroys the only place the *cause* is legible: `Not published in source`
and `Related measure only` are different facts and would both collapse into a bare red `—` plus a
tooltip, and a red headline number reads as an error rather than as "the Authority did not publish
this". Option (2) keeps the sentence and costs no height, because the head row is already sized by the
3-line packages column (42.5 px) while the label column uses only 13.8 px — the status lands in
existing whitespace. It needs one wrapper element, not CSS trickery.

**2a. `src/components/MetricBlock.tsx`.** Keep the prop signature exactly as it is (`status?:
React.ReactNode` stays). Wrap the heading and the status in a new `div.metric-head-label` as the first
child of `.metric-head`, and delete the `{status && …}` line from between `p.metric-value` and
`<Sparkline/>`:

```tsx
<div className="metric-head">
  <div className="metric-head-label">
    <h3>{label}</h3>
    {status && <p className="metric-status">{status}</p>}
  </div>
  {chip && <span className="metric-chip">{chip}</span>}
  {packages && (
    <ul className="metric-packages">
      …unchanged…
    </ul>
  )}
</div>
<p className="metric-value">{value}{unit && <span className="metric-unit">{unit}</span>}</p>
<Sparkline series={series} selectedIndex={selectedIndex} label={ariaLabel} />
```

`src/App.tsx` does not change: `MetricRail` keeps passing
`status={gap && <><span title={gap.detail}>{GAP_LABELS[gap.cause]}</span> <ReportLink gap={gap} /></>}`.

**2b. `src/App.css`.** `.metric-head` keeps `display: flex; align-items: baseline; justify-content:
space-between; gap: 10px;` — a block container's flex baseline is its first line box, i.e. the `h3`
baseline, so the label still baseline-aligns with the first packages line exactly as today. Add after
`.metric-head h3` (line 51):

```css
.metric-head-label { min-width: 0; }
```

and extend the existing `.metric-status` rule (line 56) with a top margin so it does not crowd the
label; the color, size, and weight stay:

```css
.metric-status { margin-top: 1px; color: #7a3c13; font-size: 10.5px; font-weight: 700; line-height: 1.3; }
```

### Step 3 — Segment detail: drop the earthwork row, list structures

All in `src/components/SegmentDetail.tsx`.

**3a. Delete the `Earthwork at selected date` row.** Collapse the ternary at lines 53-68 to the
disagreement branch only:

```tsx
{disagreement && date.slice(0, 7) >= disagreement.cvsrMonth && (
  <>
    <dt>Earthwork · ArcGIS</dt>
    <dd>{Math.round(disagreement.arcgis * 100)}% <SourceLink sourceId="arcgis_progress" /></dd>
    <dt>Earthwork · CVSR</dt>
    <dd>{Math.round(disagreement.cvsr * 100)}% · April 2026 data <SourceLink sourceId="cvsr" /></dd>
  </>
)}
```

Then delete the `completion` parameter and its `completion: number | null;` type member, and delete
`completion={selectedCompletionBySegment[selectedSegment.id] ?? null}` from the `<SegmentDetail>`
callsite in `src/App.tsx` (line 186). `grep -rn "completion" src/components/SegmentDetail.tsx` must
then return nothing.

**Also deletes** the strip tooltip's own `Earthwork completion at selected date` line
(`src/components/StripChart.tsx:302`) or the `selectedCompletionBySegment` memo — the tooltip still
consumes it and the request is scoped to the detail panel.

**3b. One list item per named structure.** Replace the `<dd>` at lines 86-94 with a list; the anchor
and `structureObservationLabel(structure, date)` text stay byte-identical, only the `' · '` separator
and the wrapping `<span>` go away:

```tsx
<dd>
  <ul className="detail-structures">
    {segment.structures.map((structure) => (
      <li key={structure.globalId}>
        <a href={structure.url} target="_blank" rel="noreferrer">{structure.name}</a>
        {' — '}{structureObservationLabel(structure, date)}
      </li>
    ))}
  </ul>
</dd>
```

CSS — `src/index.css` resets only `h1, h2, p`, so the list needs a full reset. Add after
`.segment-detail dd` (`src/App.css`, ends line 155):

```css
.detail-structures { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; }
```

### Step 4 — Sparklines bridge missing months with a gray dashed estimate

All in `src/components/Sparkline.tsx` plus one CSS rule.

**4a. Rules.** Within one series, after the existing `runs` split:

- **Interior gap** — for each consecutive pair of runs, draw a straight `<line>` from the last point
  of run *k* to the first point of run *k+1*.
- **Leading gap** — when `runs[0][0].index > 0`, draw a horizontal `<line>` at the first published
  point's `y`, from `xAt(0)` to `xAt(runs[0][0].index)`. This is the "use the first real value as the
  estimate" back-fill.
- **Trailing gap** — draw nothing. Carrying the last value forward is precisely what the series
  builder refuses to do (`src/lib/cvsr-series.ts:19-25`), and unlike a leading gap there is no later
  observation to justify the bridge. No rail series has a trailing null today, so this is invisible
  with committed data.
- **All-null series** — keep the single full-width dashed `<line>` at `BASELINE`, but drop its
  `stroke`/`strokeWidth`/`strokeDasharray` attributes and give it `className="sparkline-gap"` so it
  renders in the gray. This is what greys out the `Track installed` block.

**4b. Shape of the change.** Replace the body of the `series.map(…)` callback (lines 49-90) so it
returns one `<g key={id}>` per series containing the gap lines first (so solid runs paint over them),
then the runs. Wrapping in `<g>` also removes the current mixed return type (single element vs array)
and the per-run key juggling:

```tsx
{series.map(({ id, points, color }) => {
  const runs: Array<Array<{ index: number; point: CvsrSeriesPoint }>> = [];
  let run: Array<{ index: number; point: CvsrSeriesPoint }> = [];
  points.forEach((point, index) => {
    if (point === null) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ index, point });
  });
  if (run.length > 0) runs.push(run);

  if (runs.length === 0) {
    return (
      <line
        key={id}
        className="sparkline-gap"
        x1={PLOT_LEFT}
        x2={WIDTH - PLOT_LEFT}
        y1={BASELINE}
        y2={BASELINE}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  // Months the Authority never published are bridged, not plotted: a light-grey
  // dashed segment marks the span as an estimate the source does not support.
  const bridges: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
  const head = runs[0][0];
  if (head.index > 0) {
    // Nothing precedes the first published month, so the first value is the estimate.
    bridges.push({ key: 'lead', x1: xAt(0), y1: yAt(head.point), x2: xAt(head.index), y2: yAt(head.point) });
  }
  for (let position = 1; position < runs.length; position += 1) {
    const from = runs[position - 1].at(-1)!;
    const to = runs[position][0];
    bridges.push({ key: `gap:${from.index}`, x1: xAt(from.index), y1: yAt(from.point), x2: xAt(to.index), y2: yAt(to.point) });
  }

  return (
    <g key={id}>
      {bridges.map((bridge) => (
        <line
          key={bridge.key}
          className="sparkline-gap"
          x1={bridge.x1.toFixed(2)}
          y1={bridge.y1.toFixed(2)}
          x2={bridge.x2.toFixed(2)}
          y2={bridge.y2.toFixed(2)}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {runs.map((entries) => (
        entries.length === 1
          ? <circle key={entries[0].index} cx={xAt(entries[0].index)} cy={yAt(entries[0].point)} r="1" fill={color} />
          : (
            <path
              key={entries[0].index}
              className="sparkline-run"
              stroke={color}
              vectorEffect="non-scaling-stroke"
              d={entries.map(({ index, point }, position) => `${position === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point).toFixed(2)}`).join(' ')}
            />
          )
      ))}
    </g>
  );
})}
```

Nothing else in the file changes: `markerX`, `markerExact`, and the selected-month marker `<line>`
stay as they are, and `sparklineLabel` in `src/lib/cvsr-series.ts` keeps reporting the raw
`N of M months not published` count — the bridge is a visual estimate and must not change what the
screen reader is told.

**4c. Doc comment.** Replace the component doc comment (lines 12-18) so it states the new contract:

```
/**
 * One sparkline over N published CVSR series. Published months are drawn as solid
 * runs; every month the Authority did not publish is bridged with a light-grey
 * dashed segment, so an estimated span can never be mistaken for a reported one.
 * A leading run of unpublished months is bridged flat at the first published value;
 * a trailing one is not bridged at all, because nothing later justifies it. A series
 * with no published month is a grey dashed baseline, not an invented flat line.
 */
```

**4d. CSS.** Add after `.sparkline-run` (`src/App.css:59`). `#c3c8c6` is a new literal: no existing
palette var reads as "inactive grid line" (`--faint #9aa2a7` is text-dark, `--line #e3e1dc` is
warm-paper and vanishes on white).

```css
.sparkline-gap { fill: none; stroke: #c3c8c6; stroke-width: 1; stroke-dasharray: 2 3; }
```

## Critical files & anchors

- `src/components/MetricBlock.tsx` — the whole of step 2; the `.metric-head` children order and the
  removal of the status row from between `p.metric-value` and `<Sparkline/>` are the entire fix.
- `src/components/Sparkline.tsx` — `series.map` callback, lines 49-90; the run-splitting loop above it
  is reused verbatim and only the return is restructured.
- `src/components/TimeScrubber.tsx` — `playing` state, the rAF effect, and the `.scrubber-status`
  block; 1a and 1b both live here.
- `src/components/SegmentDetail.tsx` — the ternary at lines 53-68 and the structures `<dd>` at 86-94.
- `src/App.css` — `.metric-head*`/`.metric-status` (49-57), `.sparkline*` (58-59),
  `.segment-detail dd` (151-155), `.scrubber-status` (183), `.report-gap-badge` (197-208).

## Verification

No env vars or fixtures needed (`public/data/*.json` are committed).

1. `npm run lint` → clean. `npm test` → 48/48 (no lib touched). `npm run build` → succeeds; the
   pre-existing >500 kB chunk warning is expected.
2. `grep -rn "report-gap\|scrubber-status" src` → no matches.
   `grep -rn "completion" src/components/SegmentDetail.tsx` → no matches.
3. Serve: `npm run dev -- --host 127.0.0.1` → `http://127.0.0.1:5173/hsr-dashboard/`, viewport
   1440×900. **Use `tab.evaluate` only — `tab.screenshot`/`page.screenshot` hang once MapLibre has
   initialised.** Drive the scrubber by index:
   ```js
   const setIndex = (i) => tab.evaluate((idx) => {
     const input = document.querySelector('.scrubber-row input');
     Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(idx));
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.dispatchEvent(new Event('change', { bubbles: true }));
   }, i);
   ```
   With the committed data (`node -e` this session) `replayMonths` is 90 entries running
   `2018-11-01 … 2026-04-01` and `currentPoll.date` is `2026-08-10`, so there are **91 ticks**:
   index 0 = `2018-11`, **index 7 = `2019-06`**, **index 12 = `2019-11`**, index 89 = `2026-04`,
   index 90 = `Current`. Re-derive these if `npm run fetch` has been run. The `<time>` element's text
   confirms which tick you are on. Strip rects ignore `tab.click`; dispatch
   `new MouseEvent('click', { bubbles: true, cancelable: true, view: window })` inside `tab.evaluate`.
4. **Replay restart (new behaviour)**: on load the scrubber is at the last tick —
   `document.querySelector('.scrubber-row time').textContent === 'Current'`. Click `.play-button`,
   wait ~600 ms, then read `.scrubber-row time` again: it must read an early month at or just after
   `2018-11`, **not** `Current`, and `.play-button` must read `Pause`. Click Pause, `setIndex(40)`,
   press Play, wait ~600 ms → the month advances from *there* (a `2022-…` month), i.e. the reset
   fires only at the last tick. Let a replay run to the end → the button returns to `Play` on its own.
5. **Scrubber row gone**: `document.querySelector('.scrubber-status')` and
   `document.querySelector('.report-gap-badge')` are both `null`; `.scrubber-row` still holds the
   button, the `input[type=range]`, and the `<time>`.
6. **No rail jag (new behaviour)**: with the scrubber on the last tick, record
   ```js
   const heads = () => tab.evaluate(() => [...document.querySelectorAll('.metric-block')]
     .map((b) => [b.querySelector('h3').textContent, Math.round(b.getBoundingClientRect().height)]));
   ```
   Then `setIndex(7)` (`2019-06`) and read again: every block height must be **identical** to the
   last-tick reading, and `document.querySelector('.metric-status')` must be non-null there. Also
   assert the status is inside the head and above the value:
   `document.querySelector('.metric-head-label > .metric-status') !== null` and
   `document.querySelector('.metric-value + .metric-status') === null`.
7. **Status content unchanged**: at `setIndex(7)` (`2019-06`) the `Utilities relocated` block's
   `p.metric-status` reads `Not published in source` and contains `a.fn-ref[href="#fn-cvsr"]`, and its
   `span[title]` title starts `Package utility relocation counts are first published`. At
   `setIndex(12)` (`2019-11`) the `Right-of-way delivered` block reads `Related measure only`. At the
   last tick `document.querySelectorAll('.metric-status').length === 0`.
8. **Segment detail (new behaviour)**: dispatch a click on a wide `.strip-segment` rect to open the
   overlay. `[...document.querySelectorAll('.segment-detail dt')].map((d) => d.textContent)` contains
   no `Earthwork at selected date`. Select a segment that has structures (assert
   `document.querySelector('.detail-structures')` is non-null) → its `li` count equals the number of
   `a[href]` structure links, each `li` contains exactly one `<a>`, and no `li` text contains ` · `.
   The strip tooltip is untouched: hovering still yields a `.segment-tooltip` whose text includes
   `Earthwork completion at selected date`.
9. **Sparkline bridges (new behaviour)**:
   ```js
   const gapCount = (label) => tab.evaluate((l) => {
     const b = [...document.querySelectorAll('.metric-block')].find((s) => s.querySelector('h3').textContent === l);
     return { gaps: b.querySelectorAll('.sparkline-gap').length, runs: b.querySelectorAll('.sparkline-run').length };
   }, label);
   ```
   - `Utilities relocated` → `gaps === 3`, `runs === 3` (one leading bridge and one solid run per
     package; 17 leading nulls, no interior gaps). Each gap line must be horizontal:
     `y1 === y2`, and `x1` ≈ 2 (`PLOT_LEFT`).
   - `Right-of-way delivered` → `gaps === 3`, `runs === 6` (one interior 5-month gap splits each
     package into two runs). Those gap lines are sloped or flat but must have `x1 < x2` and `x1 > 2`.
   - `Guideway complete` → `gaps === 0`, `runs === 3`.
   - `Track installed` → `gaps === 1`, `runs === 0`, and that line's computed stroke is the grey:
     `getComputedStyle(el).stroke === 'rgb(195, 200, 198)'`.
10. **Unbroken**: `[...document.querySelectorAll('a.fn-ref[href^="#fn-"]')].every((a) =>
    document.getElementById(a.hash.slice(1)) !== null)` → `true`; at the last tick the
    `Guideway complete` value still reads `87.1 / 119mi` and `Utilities relocated` `1,720 / 1,826`.

## Assumptions & contingencies

- "Remove `.scrubber-status`" is read as removing the whole feature, not just the wrapper: the
  `report-gap-badge`, the `reportGap` prop, and their CSS all go. A snapshot gap is still reported, by
  `.rail-report-status` in the rail, and the committed data contains none. If you would rather keep
  the badge somewhere, the rail status line is the place — do not reinstate the scrubber row.
- Step 2 assumes the packages column stays three lines tall; that is what makes the head placement
  free. It is driven by `CVSR_PACKAGES` (`src/App.tsx:30`), which is a fixed three-package literal. If
  a future block ever renders `status` with no `packages`, that block — and only that block — grows by
  ~14 px; accept it rather than reserving a blank row on every block.
- The trailing-gap decision (draw nothing) is unobservable with committed data. If `npm run fetch`
  ever produces a rail series whose last months are null and the flat-line look is wanted, mirror the
  leading branch off `runs.at(-1)!.at(-1)!` — but that is a carry-forward and needs a deliberate call,
  so leave it out now.
- `#c3c8c6` for the bridge stroke is chosen to sit between `.axis-line`'s `#c8ccce` and the legend
  hatch `#aeb7b5` — visible on `--paper` white but clearly subordinate to the CP colours. If it reads
  too faint on the actual display, darken toward `#b4bab8`; do not switch it to a CP colour, which
  would make an estimate look reported.
