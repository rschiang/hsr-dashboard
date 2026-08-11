# Data tier restructuring — CVSR spine, ArcGIS overlay, scrubber and rail split

## Context

The dashboard currently numbers three replay tiers: 1 = schedule reconstruction, 2 = CVSR reports,
3 = ArcGIS polls. This revision collapses to **two stored tiers — Tier 1 CVSR, Tier 2 ArcGIS** — and
makes Tier 2 a near-realtime overlay that applies to the last scrubber tick only. The strip at that
tick is the most recent CVSR data plus any ArcGIS observation dated after it; once CVSR publishes a
report covering the poll's month, the report controls and the poll disappears. Alongside that: the
last scrubber tick is labelled `Current` and the provenance badge is deleted, and
`.rail-report-status` is split — the "latest published CVSR" fact moves to the topbar, and the rail
line becomes a bottom-of-rail secondary source indicator with a `↗` link and no Audit-Committee
footnote.

Schedule reconstruction (`scheduledStatus`) is unchanged in behaviour but stops being called a tier:
it never had a `Snapshot` record and, with the provenance badge gone, has no UI surface.

## Grounded facts (verified this session against the current tree)

- `Snapshot` (`src/data/types.ts:153-172`) is a union discriminated on `tier`: `tier: 3` carries
  `date`, `polledAt`, `dataMonth?: never`, `reportUrl?: never`; `tier: 2` carries `date`,
  `dataMonth`, `reportUrl?`, `originalReportUrl?`. `ReplayProvenance` is at line 225.
- Every `tier` literal in the tree, from `grep -n 'tier' src scripts`:
  `src/data/types.ts:156,169` · `src/App.tsx:84,102,108,247` · `src/lib/cvsr-series.ts:35` (and the
  doc comment at 21) · `scripts/build-history.ts:23,50,53,59,61,75,78` · `scripts/build-segments.ts:464,467`
  · `scripts/fetch-cvsr.ts:503` · tests `src/lib/cvsr-series.test.ts:21,67` (+ test name line 64),
  `src/lib/status.test.ts:109,138,144`, `scripts/lib/cvsr-parser.test.ts:583`.
- Committed data: `public/data/history.json` holds 86 × `tier: 2` + 1 × `tier: 3`;
  `data/raw/cvsr/parsed-snapshots.json` holds 86 × `tier: 2` (keys per snapshot: `dataMonth`, `date`,
  `perPackage`, `reportFile`, `reportUrl`, `sourceId`, `tier`). 83 of the 86 carry `reportUrl`.
  `cvsrInventory` coverage is `2019-03 .. 2026-04`. The single poll is `date: 2026-08-10`,
  `polledAt: 2026-08-10T04:38:17.410Z`, 106/106 segments.
- `npm run fetch` = `fetch-arcgis` → `build-centerline` → `build-segments` → `build-history`. It does
  **not** re-parse CVSR PDFs; `parsed-snapshots.json` is a committed input regenerated only by
  `npm run parse:cvsr`. `scripts/build-history.ts` reads `public/data/segments.json` (for
  `generatedAt` + segments) and `data/raw/cvsr/parsed-snapshots.json`.
- `deriveStatuses` (`src/lib/status.ts:140-170`) filters `snapshot.date <= date && snapshot.perSegment`,
  sorts newest-first, and per segment takes the first snapshot with that segment key. Null completion
  is an observation (`status.ts:134-136`), not a fall-through.
- `selectedCompletions` (`src/lib/status.ts:177-197`) applies the same `date <= date` + newest-first
  + key-presence rule, independently of `deriveStatuses`.
- `replayMonths` already ends at the last published CVSR month (`scripts/build-history.ts`), so today
  it is `2018-11-01 … 2026-04-01`, 90 entries; the scrubber has 91 ticks.
- `SnapshotReportLink` (`src/App.tsx:246-263`) is used **only** in the `.rail-report-status` block
  (`src/App.tsx:343,345,347`). `.snapshot-report-link` CSS is `src/App.css:35`.
- `SOURCES.cvsr` (`src/data/sources.ts:50-55`) is `Finance & Audit Committee reports` →
  `https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/` — the Audit-Committee
  homepage to drop from the rail line. It stays in the registry: Notes and `SegmentDetail` cite it.
- `ReportLink` (`src/App.tsx:238-241`) already renders the `↗` pattern:
  `<a className="fn-ref" href … title={gap.detail}><sup>↗</sup></a>`.
- `.metric-rail` is `display:flex; flex-direction:column; gap:14px`; `.legend-panel` has
  `margin-top:auto`, so a div rendered last inside `MetricRail`'s fragment sits directly above the
  legend at the bottom of the rail.
- Headless verification note: `tab.evaluate` is reliable against this app, but `tab.screenshot` and
  `page.screenshot` **hang** once MapLibre initialises. All checks below are DOM-only.

## Approach

Step 1 is a prerequisite for steps 2 and 3. Steps 4, 5 and 6 are independent of one another and of
1–3. Step 7 is the stylesheet sweep and runs last.

### Step 1 — Renumber the tiers (CVSR 2 → 1, ArcGIS 3 → 2)

Pure renumber, no behaviour change. Do it in one pass so the tree never holds mixed numbering.

**`src/data/types.ts`** — in the `Snapshot` union, the ArcGIS branch becomes `tier: 2` and the CVSR
branch becomes `tier: 1`. Reorder the union so CVSR (tier 1) is first, matching the new numbering.
Update the `polledAt` doc comment's "a tier-3 snapshot" → "a tier-2 snapshot".

**Code**, mechanical `2 → 1` for CVSR and `3 → 2` for ArcGIS at exactly these sites:

| File | Site | Change |
|---|---|---|
| `src/App.tsx` | `pollDates`/`currentPoll` filter (line 84) | `tier === 3` → `tier === 2` |
| `src/App.tsx` | `exactCvsrSnapshot` (102), `lastCvsrSnapshot` (108) | `tier === 2` → `tier === 1` |
| `src/App.tsx` | `SnapshotReportLink` guard (247) | `tier !== 2` → `tier !== 1` |
| `src/lib/cvsr-series.ts` | line 35 + doc comment line 21 | `tier === 2` → `tier === 1`; "tier-2 CVSR snapshot" → "tier-1 CVSR snapshot" |
| `scripts/build-segments.ts` | 464, 467 | `tier === 2` → `tier === 1`; error text "no tier-2 CVSR snapshot" → "no tier-1 CVSR snapshot" |
| `scripts/fetch-cvsr.ts` | 503 | `tier: 2` → `tier: 1` |
| `scripts/build-history.ts` | 23, 50, 59, 61, 78 | covered by step 2, which rewrites this region |

**Tests** — fixtures and one test name:
- `src/lib/cvsr-series.test.ts:21` `tier: 2` → `1`; `:67` `tier: 3` → `2`; test name at `:64`
  `'tier-3 observations never contribute points'` → `'tier-2 ArcGIS observations never contribute points'`.
- `src/lib/status.test.ts:109` and `:144` `tier: 3` → `2`; `:138` `tier: 2` → `1`.
- `scripts/lib/cvsr-parser.test.ts:583` `tier: 2` → `1`.

**Committed data** — `parsed-snapshots.json` is the only stored input carrying a tier, and it must
not be regenerated by re-parsing PDFs (slow, and the PDFs are gitignored so it is not reproducible in
CI). Rewrite it in place, deterministically, from the repo root:

```bash
node -e "
const fs=require('fs');const p='data/raw/cvsr/parsed-snapshots.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
for(const s of d.snapshots) { if (s.tier===2) s.tier=1; }
fs.writeFileSync(p, JSON.stringify(d)+'\n');
"
```

Then regenerate the browser artifact with `npx tsx scripts/build-history.ts` (step 2 changes this
script, so run it after step 2). Do **not** re-run `build-segments`: it would rewrite
`segments.json.generatedAt` and churn the artifact for no reason.

Check `parsed-snapshots.json` ends with a trailing newline before and after; if the committed file
has none, drop the `+'\n'`.

### Step 2 — Drop superseded polls in `build-history`, so tier gating lives in one place

**Decision that removes all tier logic from `src/lib/status.ts`:** a poll is superseded the moment
CVSR publishes a report covering its month, and a superseded poll has no UI role at all. Rather than
teach both `deriveStatuses` and `selectedCompletions` a supersession rule — two independent
implementations that would drift — `build-history` simply never emits a superseded poll. Both
consumers then stay byte-identical and remain correct by construction, because a live poll's date is
always later than every replay month:

> live poll month > last published CVSR month = last replay month ⟹ `poll.date > every replayMonth`,
> so `snapshot.date <= date` already excludes the poll at every tick except the last one.

Rewrite the body of `scripts/build-history.ts` between the CVSR push and `replayMonths` to exactly:

```ts
for (const snapshot of parsed.snapshots ?? []) {
  if (snapshot.tier === 1) snapshots.push(snapshot);
}
snapshots.sort((a, b) => a.date.localeCompare(b.date));
const lastPublishedMonth = snapshots.at(-1)?.date;
if (lastPublishedMonth === undefined) {
  throw new Error('No tier 1 CVSR snapshots: the replay axis has no published month to end on');
}

// A poll is the leading edge only until CVSR publishes a report covering its month.
// After that the report is the controlling verdict and the poll has no UI role, so it
// never reaches the browser artifact — which keeps the supersession rule out of
// deriveStatuses and selectedCompletions entirely.
const poll = observedSnapshot(artifact.generatedAt, artifact.segments);
const pollSuperseded = poll.date.slice(0, 7) <= lastPublishedMonth.slice(0, 7);
if (!pollSuperseded) snapshots.push(poll);
snapshots.sort((a, b) => a.date.localeCompare(b.date) || a.tier - b.tier);

// The replay ends on the last month CVSR actually published. A month past it has
// neither a report nor a poll behind it, so a tick there could only redraw the
// month before — carry-forward wearing a date.
const replayMonths = monthSequence('2018-11-01', lastPublishedMonth);
```

In `observedSnapshot`, `tier: 3` → `tier: 2`. Final log line becomes:

```ts
console.log(`history: months=${replayMonths.length} (through ${lastPublishedMonth.slice(0, 7)}), tier 1=${counts[1] ?? 0}, tier 2=${counts[2] ?? 0}${pollSuperseded ? ` (poll ${poll.date} superseded, dropped)` : ''}`);
```

`src/lib/status.ts` is **not modified in this step or any other**. With today's data the poll
(`2026-08` > `2026-04`) is live, so `history.json` keeps 86 × tier 1 + 1 × tier 2.

### Step 3 — One `Current` tick for the ArcGIS overlay

**`src/App.tsx`.** Replace the `pollDates` memo (lines 79-91, the `pollDates` + `dates` pair) with:

```tsx
// Tier 2 applies to the last tick only. Every live poll is already eligible there
// (deriveStatuses takes the newest observation per segment), so the axis needs one
// tick, not one per poll.
const currentPoll = useMemo(
  () => data?.history.snapshots
    .filter((snapshot) => snapshot.tier === 2)
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1),
  [data],
);
const dates = useMemo(
  () => data
    ? (currentPoll ? [...data.history.replayMonths, currentPoll.date] : data.history.replayMonths)
    : [],
  [currentPoll, data],
);
```

`replayMonths` is already sorted and every live poll date is later than all of it, so no re-sort is
needed. The initial-date effect (`[...replayMonths, ...snapshots.map(s => s.date)].sort().at(-1)`)
already lands on that same last tick — leave it unchanged.

**`src/components/TimeScrubber.tsx`.** Delete the `pollDates` prop (both the destructure and the type
member) and replace the `<time>` element and its comment with:

```tsx
{/* The last tick is not a month: it is the present, CVSR base plus any later ArcGIS poll. */}
<time dateTime={date}>{index === dates.length - 1 ? 'Current' : date.slice(0, 7)}</time>
```

`index` is already computed at line 19. Remove `pollDates={pollDates}` from the callsite
(`src/App.tsx:207`). The last tick is labelled `Current` unconditionally — when no live poll exists it
is the newest CVSR month, which is still the current state of knowledge.

### Step 4 — Delete the provenance badge and its computation

The badge is the only consumer of `provenance`; leaving the computation behind would be dead code.

- **`src/components/TimeScrubber.tsx`** — remove the `provenance` prop (destructure + type member),
  the `provenanceLabel` ternary (lines 45-49), and the `<span className={`tier-badge provenance-${provenance}`}>`
  (line 71). Keep `.scrubber-status` and the `reportGap` badge inside it.
- **`src/App.tsx`** — remove `provenance={derived.provenance}` (line 209) and drop `provenance` from
  the `derived` fallback object (line 95), leaving `{ statuses: {}, evidence: {} }`.
- **`src/lib/status.ts`** — remove `provenance` from the `ResolvedSegmentStatus` type (line 102) and
  from all four `resolveSegmentStatus` return objects (lines 112-137); remove the `provenance` Set,
  the `provenance.add` call, and the `provenance` key from `deriveStatuses`' return type and value;
  drop `ReplayProvenance` from the type import at line 3.
- **`src/data/types.ts`** — delete `export type ReplayProvenance` (line 225).
- **`src/lib/status.test.ts`** — delete the `assert.equal(resolved.provenance, 'observed')` at line 73
  and the `assert.equal(result.provenance, 'mixed')` at line 90; rename the test at line 76 to
  `'null observations allow dated evidence to resolve status'`. Both tests keep every other assertion.

### Step 5 — Move the CVSR coverage fact to the topbar

**`src/App.tsx`**, the `Last updated` span (line 157). `inventory` is already in scope. Replace with:

```tsx
<span>
  Last updated {new Date(data.segments.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
  {' '}(CVSR up to {new Date(`${inventory.coverageEnd}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })})
</span>
```

With committed data this renders exactly `Last updated Aug 10, 2026 (CVSR up to Apr 2026)`.

### Step 6 — Rail status becomes a bottom-of-rail source indicator

**6a. `SnapshotReportLink` (`src/App.tsx:246-263`)** becomes a bare `↗`, reusing `ReportLink`'s
existing `fn-ref` pattern rather than its own class, and renders nothing when no byte-verified PDF
exists (3 of 86 months) — that branch currently emits the Audit-Committee footnote:

```tsx
function SnapshotReportLink({ snapshot }: { snapshot: Snapshot }) {
  // No byte-verified direct PDF for this month: the status line names the month and
  // the report file in its tooltip, which is all the attribution the source supports.
  if (snapshot.tier !== 1 || !snapshot.reportUrl) return null;
  const archived = snapshot.originalReportUrl !== undefined;
  return (
    <a
      className="fn-ref"
      href={snapshot.reportUrl}
      target="_blank"
      rel="noreferrer"
      title={archived
        ? `${snapshot.reportFile} · original overwritten Authority URL: ${snapshot.originalReportUrl}`
        : snapshot.reportFile}
    >
      <sup>↗</sup>
    </a>
  );
}
```

**6b. `MetricRail` gains one prop** for the overlay date, which only the last tick supplies:

```tsx
/** Poll date when the selected tick is the ArcGIS-overlaid present, else undefined. */
arcgisObserved?: string;
```

Callsite in `App` adds `arcgisObserved={currentPoll && date === currentPoll.date ? currentPoll.date : undefined}`.

**6c. Move the status `<div>`** from the first position in `MetricRail`'s returned fragment to the
**last**, after the `RAIL_METRICS.map(...)` block, so it renders directly above `<Legend />`. Replace
its contents with these branches — every `<SourceLink sourceId="cvsr" />` is gone, and the
`Latest published CVSR` wording is gone because step 5 now carries that fact:

```tsx
<div className={`rail-report-status${exact || beforeCoverage || afterCoverage ? '' : ' stale'}`}>
  {beforeCoverage
    ? <>Before the published CVSR series (starts {inventory.coverageStart})</>
    : afterCoverage && snapshot
      ? <>CVSR data through {inventory.coverageEnd}<SnapshotReportLink snapshot={snapshot} />{arcgisObserved && <> · ArcGIS observed {arcgisObserved}</>}</>
      : exact && snapshot
        ? <>CVSR data through {selectedMonth}<SnapshotReportLink snapshot={snapshot} /></>
        : snapshot
          ? <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} · last CVSR {snapshot.dataMonth}<SnapshotReportLink snapshot={snapshot} /></>
          : <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'}</>}
</div>
```

`ReportLink` and its `<SourceLink sourceId="cvsr" />` fallback on the per-metric `.metric-status` gap
line are deliberately left alone — this step is scoped to the rail status line.

**6d. Update the README tier table** (`README.md:52-58`), which currently documents three tiers and
describes Tier 3 as "accumulated by committed pipeline runs" — a mechanism that no longer exists.
Replace the table rows and the paragraph under it with:

```markdown
| Tier | Meaning | Resolution |
|---|---|---|
| 1 | Observed metrics parsed from monthly Central Valley Status Reports | Package metrics for all 86 months; per-segment observations for the two reports that publish row tables |
| 2 | One BuildHSR ArcGIS poll: what the layers returned at a single recorded instant | Per segment, applied to the last scrubber tick only |

**CVSR is the replay spine.** This is a ten-year program and monthly granularity sits comfortably
against it. The status reports are the stable record: a published data month, a fixed PDF that can be
re-read years later, and a correction trail when the Authority restates a figure. ArcGIS is realtime
and therefore volatile — it can regress or blank out between reads, and none of it is archived. Tier 2
overlays the last tick during the two to three months before a report lands; once a report covering
that month is published the poll is superseded and dropped, and tier 1 controls.

Months with no observation behind them are filled by a schedule reconstruction from published segment
start/finish dates, clamped to current observed completion (`scheduledStatus`). It is a computed
fallback, not a stored tier — no `Snapshot` carries it.
```

### Step 7 — Stylesheet sweep

In `src/App.css`:
- `.rail-report-status` (line 40) — `padding-bottom: 10px` → `padding-top: 10px`, and
  `border-bottom` → `border-top`. It sits above the legend now, not under the rail head.
- Delete `.snapshot-report-link` (line 35), `.tier-badge` (202-210), `.provenance-scheduled`,
  `.provenance-observed`, `.provenance-mixed` (211-213).
- `.scrubber-row` (line 185) — third column `78px` → `54px`. It was widened for a full `2026-08-10`
  label, which the `Current` label no longer needs.

Then re-run the whole-file dead-selector check:

```bash
cd . && python3 - <<'PY'
import re, pathlib
css = pathlib.Path('src/App.css').read_text()
src = ''.join(p.read_text() for p in list(pathlib.Path('src').rglob('*.tsx')) + list(pathlib.Path('src').rglob('*.ts')))
print([c for c in sorted(set(re.findall(r'\.([a-zA-Z][\w-]*)', css))) if c not in src])
PY
```

It must print exactly `['maplibregl-ctrl-attrib']`.

## Critical files & anchors

- `scripts/build-history.ts` — the supersession filter is the single point where tier gating lives;
  getting it wrong silently changes what every tick renders.
- `src/lib/status.ts` — **must not be edited except for the provenance removal in step 4**. Its
  `date <= date` + newest-first rule is what makes the one-tick overlay work without tier logic.
- `src/App.tsx` — `currentPoll`/`dates` (79-91), topbar span (157), `TimeScrubber` callsite (204-211),
  `SnapshotReportLink` (246-263), `MetricRail` signature and the status `<div>` (299-349).
- `src/components/TimeScrubber.tsx` — `pollDates` and `provenance` both leave; `index` is already
  computed and is what selects the `Current` label.
- `src/data/types.ts` — `Snapshot` union (153-172) and `ReplayProvenance` (225).

## Verification

Working directory `.`; no env vars or fixtures needed
(`public/data/*.json` and `data/raw/cvsr/parsed-snapshots.json` are committed).

1. **Data regenerated:** after the step-1 rewrite and `npx tsx scripts/build-history.ts`, the script
   logs `history: months=90 (through 2026-04), tier 1=86, tier 2=1` with no "superseded" suffix, and
   `jq -r '[.snapshots[].tier]|group_by(.)|map({tier:.[0],n:length})' public/data/history.json`
   returns `[{tier:1,n:86},{tier:2,n:1}]`. `jq '.snapshots[]|select(.tier==2)|{date,polledAt}'` is the
   single `2026-08-10` poll.
2. **Supersession fires when CVSR catches up** — the new build-history behaviour, exercised directly
   without mutating the repo:
   ```bash
   node -e "
   const fs=require('fs');const p='data/raw/cvsr/parsed-snapshots.json';
   const orig=fs.readFileSync(p,'utf8');const d=JSON.parse(orig);
   const last=d.snapshots.at(-1);
   d.snapshots.push({...last, dataMonth:'2026-08', date:'2026-08-01'});
   fs.writeFileSync(p, JSON.stringify(d)+'\n');
   try { require('child_process').execFileSync('npx',['tsx','scripts/build-history.ts'],{stdio:'inherit'}); }
   finally { fs.writeFileSync(p, orig); }
   "
   ```
   It MUST log `(poll 2026-08-10 superseded, dropped)` and `tier 2=0`. Restore the real artifact
   afterwards with `npx tsx scripts/build-history.ts` and re-check step 1's `jq` output.
3. `npm run lint` → clean. `npm test` → 48 tests, 48 pass. `npm run build` → succeeds; the
   pre-existing >500 kB chunk warning is expected.
4. Serve: `npm run dev -- --host 127.0.0.1` → `http://127.0.0.1:5173/hsr-dashboard/`, viewport
   1440×900. **`tab.evaluate` only — `tab.screenshot`/`page.screenshot` hang once MapLibre has
   initialised.** Drive the scrubber by index:
   ```js
   const setIdx = (i) => tab.evaluate((idx) => {
     const input = document.querySelector('.scrubber-row input');
     Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(idx));
     input.dispatchEvent(new Event('input', { bubbles: true }));
     input.dispatchEvent(new Event('change', { bubbles: true }));
   }, i);
   ```
5. **Scrubber (new behaviour):** `input.max === '90'` (91 ticks, unchanged). At index 90 the
   `.scrubber-row time` textContent is exactly `Current` and its `dateTime` attribute is `2026-08-10`.
   At index 89 it is `2026-04`, at index 0 `2018-11`. `document.querySelector('.tier-badge')` is
   `null` at every index, and `document.body.textContent` contains none of `Observed replay`,
   `Scheduled replay`, `Mixed observed + scheduled`. The `.scrubber-status` div still exists.
6. **Topbar (new behaviour):** the second `.topbar-meta span` textContent, whitespace-collapsed, is
   exactly `Last updated Aug 10, 2026 (CVSR up to Apr 2026)`.
7. **Rail status (new behaviour):** `.rail-report-status` is the second-to-last child of
   `.metric-rail` and `.legend-panel` is the last —
   `[...document.querySelector('.metric-rail').children].map(e => e.className).slice(-2)` is
   `['rail-report-status', 'legend-panel']`. `document.querySelector('.metric-rail').firstElementChild.className`
   is `metric-block`. `document.querySelectorAll('.rail-report-status a.fn-ref[href^="#fn-"]').length === 0`
   at every index — no Audit-Committee footnote. Text, whitespace-collapsed:
   - index 90 → `CVSR data through 2026-04↗ · ArcGIS observed 2026-08-10`
   - index 89 → `CVSR data through 2026-04↗`
   - index 0 → `Before the published CVSR series (starts 2019-03)`

   At index 90 and 89 the block contains exactly one `a.fn-ref` whose `href` starts `https://` and
   whose text is `↗`; `document.querySelector('.snapshot-report-link')` is `null`.
8. **Overlay applies to the last tick only** — the load-bearing tier behaviour. At index 90 and at
   index 89 the strip fills MUST be identical (the August poll confirms the April report; this was
   measured on the current tree), so
   `[...document.querySelectorAll('rect.strip-segment')].map(r => r.getAttribute('fill')).join('|')`
   is equal at both indices. To prove the overlay is actually wired rather than inert, compare
   against the poll being absent:
   ```bash
   node -e "
   const fs=require('fs');const p='public/data/history.json';
   const orig=fs.readFileSync(p,'utf8');const d=JSON.parse(orig);
   d.snapshots=d.snapshots.filter(s=>s.tier!==2);
   fs.writeFileSync(p, JSON.stringify(d)+'\n');
   " 
   ```
   With the poll removed the axis MUST drop to `input.max === '89'` and the last tick's `dateTime`
   MUST become `2026-04-01` while still reading `Current`. Restore with
   `npx tsx scripts/build-history.ts`.
9. **Unregressed:** rail headings are
   `['Track installed','Guideway complete','Structures complete','Right-of-way delivered','Utilities relocated']`;
   `document.querySelectorAll('.notes-list > ul > li').length === 10`;
   `document.querySelectorAll('.package-bands, .package-band, .data-gaps').length === 0`;
   `[...document.querySelectorAll('a.fn-ref[href^="#fn-"]')].every(a => document.getElementById(a.hash.slice(1)) !== null)` → `true`;
   at index 89 `Guideway complete` still reads `87.1 / 119mi` and `Utilities relocated` `1,720 / 1,826`;
   clicking a `.strip-segment` twice still opens then clears the map overlay.

## Assumptions & contingencies

- **The last tick is labelled `Current` unconditionally**, including when no live poll exists and it
  is simply the newest CVSR month. If that reads wrong in review, the narrower rule is
  `index === dates.length - 1 && currentPoll !== undefined`, which needs a boolean prop on
  `TimeScrubber` since it cannot otherwise know.
- **Superseded polls are dropped from `history.json` rather than kept and filtered at read time.**
  Nothing is lost permanently — `build-history` regenerates the artifact from
  `parsed-snapshots.json` plus the current `segments.json` on every run. If a later revision needs
  superseded polls in the browser (for an "as we saw it then" view), move the predicate into
  `deriveStatuses` *and* `selectedCompletions` together; they must never disagree.
- **The whole provenance chain is removed, not just the badge.** The user asked only for the badge;
  the computation has no other consumer, so leaving it would be dead code. If provenance is wanted
  back later it is ~15 lines in `resolveSegmentStatus`/`deriveStatuses`.
- **Tier renumbering rewrites `parsed-snapshots.json` with a script rather than re-parsing PDFs.**
  If the file turns out to carry a tier anywhere other than `snapshots[].tier` (it does not today —
  `cvsrInventory` and `diagnostics` hold no tier), extend the same `node -e` rewrite rather than
  running `npm run parse:cvsr`, which needs the gitignored PDFs.
- **`scheduledStatus` behaviour is untouched.** It stops being called a tier in docs and loses its UI
  label, but every colour it produces today it still produces.
