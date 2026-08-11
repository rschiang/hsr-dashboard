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
- Construction-package boundaries, stations, named structures, station ranges, earthwork completion, dated structure evidence, and source links.
- Package-level structures, guideway miles, parcel acquisition, delivery to the design-builder, railroad parcel acquisition, and utility relocations reported in historical CVSR PDFs.
- Distance-proportional and difficulty-proportional strip widths.
- Linked hover and selection between the strip chart and map.

ROW and utilities remain at construction-package granularity and are never painted onto individual miles. Since the March-2026-data report, the CVSR also publishes per-row structure and guideway progress; the dashboard reads those rows as segment-level numeric observations.

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

### Replay tiers

| Tier | Meaning | Resolution |
|---|---|---|
| 1 | Observed metrics parsed from monthly Central Valley Status Reports | Package metrics for all 86 months; per-segment observations for the two reports that publish row tables |
| 2 | One BuildHSR ArcGIS poll: what the layers returned at a single recorded instant | Per segment, applied to the last scrubber tick only |

**CVSR is the replay spine.** This is a ten-year program and monthly granularity sits comfortably against it. The status reports are the stable record: a published data month, a fixed PDF that can be re-read years later, and a correction trail when the Authority restates a figure. ArcGIS is realtime and therefore volatile — it can regress or blank out between reads, and none of it is archived. Tier 2 overlays the last tick during the two to three months before a report lands; once a report covering that month is published the poll is superseded and dropped, and tier 1 controls.

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

The pipeline writes static artifacts under `public/data/`. Raw ArcGIS responses are cached under `data/raw/arcgis/` so the latest committed snapshot remains reproducible if a query-only source changes or disappears.

### Central Valley Status Reports

CVSR acquisition is deliberately human-in-the-loop because `hsr.ca.gov` may present bot protection. This project does not evade that protection.

```bash
npm run fetch:cvsr   # produce/update the download manifest
# Place downloaded PDFs in data/raw/cvsr/
npm run parse:cvsr   # parse local PDFs; performs no network requests
npm run fetch        # rebuild public/data/history.json
```

The parser keys snapshots by the report's **data month**, not its publication month, preserves changing denominators, and maps counts by semantic table labels rather than fixed column positions. It exits nonzero after writing diagnostics if a present report or required published metric cannot be parsed.

`data/raw/cvsr/parsed-snapshots.json` and `public/data/history.json` carry an explicit inventory from March 2019 through April 2026. It distinguishes reports not downloaded, reports not located, metrics the source did not publish, and parser failures. Missing months are not filled from later or earlier reports; the dashboard labels the gap and links the exact report when known.

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
- CP1 guideway decompositions do not have a one-to-one CVSR/ArcGIS crosswalk. Unmatched CVSR rows remain recorded in the generated artifact.

## Static deployment

Vite builds the site under the `/hsr-dashboard/` base path. GitHub Actions publishes `dist/` to GitHub Pages. A scheduled workflow refreshes the public ArcGIS data and commits changed generated artifacts, so the tier-2 poll always reflects the most recent successful fetch.

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
