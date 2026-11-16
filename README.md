# CAHSR Merced–Bakersfield Progress Dashboard

A static, source-driven dashboard for exploring construction progress along the California High-Speed Rail Initial Operating Segment from Merced to Bakersfield.

The project turns official CAHSRA engineering documents, public ArcGIS layers, and Central Valley Status Reports into two linked views:

- a milepost strip chart that shows every part of the alignment by construction phase; and
- a MapLibre map that provides geographic context for the same segments.

A date scrubber replays the available history. The strip can use either physical distance or an explicitly labelled engineering-difficulty model for segment width.

## Goals

1. **Show the whole corridor.** Represent the official 171-mile Merced–Bakersfield station span, plus the TS1 continuation to Oswell Street at mile 175, without hiding gaps or unknown data.
2. **Preserve engineering stationing.** Use the CAHSRA TS1 station-to-milepost table as the canonical axis; fit GIS geometry to that axis rather than deriving official mileposts from geometry.
3. **Distinguish facts from models.** Cite official values, mark inferred stationing and missing coverage, and label the difficulty weighting as an unofficial heuristic.
4. **Replay progress honestly.** Keep scheduled reconstruction, historical package-level observations, and current segment-level observations as separate provenance tiers.
5. **Remain static and auditable.** Fetch and transform source data ahead of time, commit generated artifacts, and serve the dashboard without a backend or runtime ArcGIS dependency.

## What the dashboard shows

- Construction phase by alignment segment: not started, preconstruction, under construction, structure complete, guideway complete, track laid, systems installed, or no data.
- Official IOS distance and subdivision mileposts (`C`, `S`, and `D`).
- Construction-package boundaries, named structures, station ranges, earthwork completion, dated structure evidence, and source links; the five station marks are derived from the Authority’s published station points by projection onto the TS1-fitted alignment axis.
- Package-level structures, guideway miles, parcel acquisition, delivery to the design-builder, railroad parcel acquisition, and utility relocations reported in historical CVSR PDFs.
- Distance-proportional and difficulty-proportional strip widths.
- Linked hover and selection between the strip chart and map.

ROW and utilities remain at construction-package granularity and are never painted onto individual miles. Since the March-2026-data report, the CVSR also publishes per-row structure and guideway progress; the dashboard reads those rows as segment-level numeric observations. From the October-2026 report (August 2026 data) the Authority publishes those rows as charts without the completed/underway split or schedule dates; that month's rows are transcribed by hand in `TRANSCRIBED_ROWS` (`scripts/fetch-cvsr.ts`) and checked at ingest against the package counts the same report prints.

CVSR row tables are numeric Authority observations and can supply a published percentage. News releases and narrative CVSR quotes remain categorical evidence: they can resolve a named structure to under construction or structure complete but never manufacture a missing percentage.

## Data and provenance

Official published documents are authoritative for mileposts, lengths, status counts, and contract values. GIS geometry draws the route; it does not override published engineering figures. When sources disagree, the dashboard keeps the discrepancy visible.

Primary inputs:

- **TS1 3.0 – Alignment Segments and Lengths:** canonical station equations, segment lengths, and mileposts.
- **TS1 2.1 – Systemwide Alignment Schematic:** subdivision, station, and named-structure reference.
- **CAHSRA ArcGIS alignment layer:** M-aware route geometry.
- **BuildHSR Guideways Construction Progress:** station-resolved guideway and structure progress.
- **Closures and Detours Public:** named structure locations and current statuses.
- **Central Valley Status Reports:** historical package metrics and, from March 2026 data onward, per-row structure and guideway observations.
- **2026 Final Business Plan:** extension costs used in difficulty-model calibration.

The citation registry lives in [`src/data/sources.ts`](src/data/sources.ts). Numeric claims in the UI resolve through that registry.
Reviewed dated structure claims live in [`src/data/structure-evidence.ts`](src/data/structure-evidence.ts). Stable ArcGIS GlobalIDs in its crosswalk—not name similarity or spatial proximity—attach named projects to progress segments.
Reviewed CVSR row pairings live in [`src/data/cvsr-row-crosswalk.ts`](src/data/cvsr-row-crosswalk.ts): structure rows to strip segments, CP1 guideway rows to the segments they span (checked by station length), and structure rows to ArcGIS named structures that are not strip segments.

### Replay tiers

| Tier | Meaning | Resolution |
|---|---|---|
| 1 | Observed metrics parsed from monthly Central Valley Status Reports | Package metrics for all 90 months; per-segment observations for six reports: June 2026 (March 2026 data, 78 segments), June 24, 2026 (April 2026 data, 98 segments), July 2026 (May 2026 data, 98 segments), August 2026 (June 2026 data, 98 segments), September 2026 (July 2026 data, 98 segments), and October 2026 (August 2026 data, 98 segments, hand-transcribed); the same reports carry rows for 43 named structures (25 in the March data) |
| 2 | The BuildHSR ArcGIS progress layer's present state, dated by the layer's own last edit | Only the segments no CVSR row covers |

**CVSR is the replay spine.** This is a ten-year program and monthly granularity sits comfortably against it. The status reports are the stable record: a published data month, a fixed PDF that can be re-read years later, and a correction trail when the Authority restates a figure. ArcGIS is realtime and therefore volatile — it can regress or blank out between reads, and none of it is archived. Every ArcGIS value is dated by the layer's last edit, never by the poll: a poll proves the server answered, not that the Authority reviewed a status.

**The last tick is "Current".** When dated evidence is newer than the last report, `history.json` carries `currentDate` and the scrubber ends on it. There a completion the Authority announced after the report's data month (`STRUCTURE_EVIDENCE`, `NAMED_STRUCTURE_ANNOUNCEMENTS`) turns the structure complete; once a report covering that month is published, the report controls again. Named structures read the newest of announcement, CVSR row, and ArcGIS, in that precedence.

Months with no observation behind them are filled by a schedule reconstruction from published segment start/finish dates, clamped to current observed completion (`scheduledStatus`). It is a computed fallback, not a stored tier — no `Snapshot` carries it.

ROW uses three non-interchangeable series. **Parcel acquisition** means legally possessed by the Authority and retains the source table’s as-of date. **Delivery to the design-builder** is the separately certified delivery measure. **Railroad parcel acquisition/delivery** is published in a separate railroad ROW table. The dashboard never substitutes one series for another.

### Difficulty weighting

The optional difficulty axis combines official earthwork quantities and package contract values with author-defined structure-type factors. Those factors are **not a CAHSRA methodology** and are not audited cost estimates. The ordinary distance axis remains the default; the weighted view exists to make engineering-intensive structures visible at strip-chart scale.

## Repository layout

```text
scripts/                    Fetching and deterministic data transforms
src/data/                   TS1 transcription, types, and source registry
src/lib/                    Milepost, status, and weighting models
src/components/             Strip chart, map, scrubber, legend, citations
public/data/                Committed dashboard artifacts
data/raw/arcgis/            Cached source API responses
data/raw/cvsr/              Manually acquired CVSR PDFs and parsed snapshots
.github/workflows/          Static deployment and scheduled data refresh
```

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm

Dependencies are pinned in `package.json` and `package-lock.json`.

## Run locally

```bash
npm ci
npm run dev
```

Open <http://localhost:5173/hsr-dashboard/>.

To exercise the production build:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

## Data pipeline

Refresh ArcGIS inputs and rebuild the centerline, segments, and history:

```bash
npm run fetch
```

The pipeline writes static artifacts under `public/data/`. Raw ArcGIS responses are cached under `data/raw/arcgis/` so the latest committed snapshot remains reproducible if a query-only source changes or disappears. A re-fetch that differs from the cache only by last-digit coordinate noise leaves the cached file untouched, so it never reads as a refresh.

### Central Valley Status Reports

CVSR acquisition is deliberately human-in-the-loop because `hsr.ca.gov` may present bot protection. This project does not evade that protection.

```bash
npm run fetch:cvsr   # produce/update the download manifest
# Place downloaded PDFs in data/raw/cvsr/
npm run parse:cvsr   # parse local PDFs; performs no network requests
npm run fetch        # rebuild public/data/history.json
```

The parser keys snapshots by the report's **data month**, not its publication month, preserves changing denominators, and maps counts by semantic table labels rather than fixed column positions. It exits nonzero after writing diagnostics if a present report or required published metric cannot be parsed.

`npm run ingest:cvsr` is the incremental path CI uses. It discovers reports published in the last 180 days, downloads one that is new, and merges it into `data/raw/cvsr/parsed-snapshots.json` without rebuilding from the local corpus, so no PDFs are needed on the runner. Add `-- --file <name>` to merge a report already sitting in `data/raw/cvsr/`. A PDF that a CI run downloaded is attached to the run as the `cvsr-report` artifact; archive it into the local corpus.

`data/raw/cvsr/parsed-snapshots.json` and `public/data/history.json` carry an explicit inventory from March 2019 through August 2026. It distinguishes reports not downloaded, reports not located, metrics the source did not publish, and parser failures. Missing months are not filled from later or earlier reports; the dashboard labels the gap and links the exact report when known.

### Monthly checklist

Run this after a CVSR ingest lands — automatic or hand-merged. Each line is something that has
silently gone stale before.

1. The replay axis moved: `jq -r '.replayMonths | last' public/data/history.json` is the new data
   month, and `jq -r '.cvsrInventory.coverageEnd' public/data/history.json` agrees.
2. The deploy ran for that commit: `gh run list --workflow deploy.yml --limit 3`. Pages serves
   `index.html` and `data/*.json` with `max-age=600`, so verify against the site with a fresh
   fetch — `curl -s https://poren.tw/hsr-dashboard/data/history.json | jq -r '.replayMonths | last'`
   — rather than a browser tab that may still hold the previous build.
3. The report is in the citation registry: add a `cvsr_<publication year>_<publication month>` entry
   to `src/data/sources.ts` whenever page prose cites the new report; `date` is the first day of its
   data month.
4. The counts in this README still hold: the tier-1 resolution cell (months, and which reports carry
   per-segment rows) and the inventory coverage range above.
5. The report still prints its per-location `Structures/Guideways - Underway/Completed` tables. If
   it does, no transcription is needed and the **Per-location rows** note in
   `src/components/Notes.tsx` should be removed once no displayed month depends on it. If it
   publishes charts instead, extend `TRANSCRIBED_ROWS` in `scripts/fetch-cvsr.ts` for that report.
6. The citation dates the page prints still match the artifacts:
   `jq -r '.sources[] | "\(.name) \(.dataLastEditedAt)"' data/raw/arcgis/fetch-metadata.json`
   against the `date` fields of the `arcgis_*` entries in `src/data/sources.ts`, and the `cvsr`
   entry's `accessed` against
   `jq -r '[.[].verifiedAt] | max' data/raw/cvsr/report-urls.json`. The ArcGIS `accessed` date is
   derived from `segments.json` `generatedAt` and needs no edit.
7. The newest report still prints what the page quotes: the structure and guideway completion
   definitions behind the legend captions, and the `CVS 119 Track and System Installation Forecast`
   page behind the **Track installation** note and the Track chip. If the forecast's start quarter
   moves, update both the note and `TRACK_ARIA_LABEL` in `src/App.tsx`.
8. Completions the Authority announced since the report's data month are registered: a release in
   `src/data/sources.ts`, a `STRUCTURE_EVIDENCE` entry for a strip segment or a
   `NAMED_STRUCTURE_ANNOUNCEMENTS` entry for any other named structure. The **Current** note in
   `src/components/Notes.tsx` quotes the report's and the releases' structure counts; update both
   figures together.

## Validation

```bash
npm test
npm run lint
npm run build
```

The data scripts also enforce corridor invariants, including TS1 section totals, station-equation anchors, centerline length and joins, segment coverage, and package-level progress cross-checks.

## Known gaps

- `CP1:gap:0` (0.388 mi) has no ArcGIS row and no CVSR stationing. It remains hatched with the TS1/ArcGIS datum reason.
- Segment-level CVSR history begins with March 2026 data; the earlier 84 CVSR months remain package-level.
- Parcels delivered to the design-builder are not published for 2019-09 through 2020-01. Acquisition is shown separately; the January-data report exposes only a March 9 audit, not an exact January package split.
- Package utility relocation counts are not published for 2019-03 through 2020-07.
- ArcGIS structure-row `Completion` is null; current percentages come from cited CVSR row observations.
- CP1 guideway rows `HST Guideway`, `Fresno St to SR 41` and `Jensen Trench` (6.83 mi against `CP1:173` + `CP1:191`, 6.80 mi) have no one-to-one split and stay unpaired, as do CP1 structure rows `Olive Ave`, `Shaw Avenue` and `Herndon UPRR Bridge`, which have no ArcGIS record. Unmatched CVSR rows remain recorded in the generated artifact.

## Static deployment

Vite builds the site under the `/hsr-dashboard/` base path. GitHub Actions publishes `dist/` to GitHub Pages. Two scheduled workflows keep the data current: `refresh-arcgis.yml` re-polls the BuildHSR layers weekly, and `ingest-cvsr.yml` checks each weekday for a newly published Central Valley Status Report. Each validates and commits only when the upstream payloads actually changed, then calls the deploy workflow directly with the SHA it just pushed, so a data commit reaches the site without a token that could retrigger `push` (a called workflow's own `github.sha` would still be the pre-push commit). A poll that observed nothing records `stale` sources and holds `fetchedAt` at the last observed value rather than claiming freshness. Because "Last updated" only moves when the layers change, each poll also records every layer's own `editingInfo.dataLastEditDate`, and the header shows the newest as "ArcGIS edited …", so an unedited source can't be mistaken for a broken poll. When a CVSR ingest fails, the workflow opens a `CI: CVSR ingest failing for <file>` issue. Closing it as **not planned** holds that report out of future discovery. Closing it as completed (for example through a fixing PR) lets the next run retry.

## Core integrity rules

- The TS1 table defines the official axis; geometry never does.
- Unknown values remain unknown; gaps become explicit `no-data` segments or typed CVSR inventory gaps.
- Narrative dated structure evidence changes categorical status only; it never fills a missing numeric percentage. CVSR row tables are numeric observations and may supply percentages.
- Named-project attachment uses reviewed stable identifiers; spatial proximity alone is insufficient.
- ROW acquisition, delivery-to-DB, railroad ROW, and utility totals stay package-level unless a geolocated official source appears.
- Historical schedule reconstruction and observed snapshots are never presented as the same evidence tier.
- Missing CVSR months and metrics are never silently carried forward.
- Every displayed official figure needs a resolvable primary-source citation.
- CVSR bot protection is never bypassed.
