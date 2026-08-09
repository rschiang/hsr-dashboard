# California HSR 119-Mile Progress Dashboard

## Summary

Build a source-auditable research dashboard for CP 1, CP 2-3, and CP 4, from the north end of CP 1 to the south end of CP 4. The Authority labels this corridor as 119 miles; its current GIS centerlines measure approximately 118.52 miles. Preserve both values and identify the source snapshot date. See the [official alignment service](https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/HSR_Statewide_Alignment/FeatureServer).

Use official records first, permit labeled estimates from contractor reports, imagery, and reputable secondary sources, and show unknown or conflicting data rather than manufacturing precision. Complete the data foundation and historical backfill before implementing the TypeScript frontend.

## Data Foundation

### 1. Canonical alignment and mileposts

- Extract CP 1, CP 2-3, and CP 4 from the official southbound-track centerline in EPSG:3310.
- Order and join them north-to-south; define dashboard milepost `0.000` at the northern terminus and calculate cumulative statute miles along the geometry.
- Preserve contract package, source stationing, source geometry ID, and source snapshot date. Do not present derived mileposts as legal or surveying stationing.
- Split the line at every guideway limit, structure extent, design-profile transition, and reported work boundary; fixed-size bins are derived views only.

### 2. Asset inventory

- Create stable records for every guideway section, viaduct, bridge, grade separation, trench, underpass, road relocation, retaining wall, sound wall, utility conflict, and later track/system installation area.
- Merge the Authority's [guideway progress layer](https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/BuildHSR_Guideways_Construction_Progress_view/FeatureServer) with the [BuildHSR construction-project layer](https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/Closures_and_Detours_Public/FeatureServer/0), design documents, change orders, and project pages.
- Resolve aliases and scope changes without deleting old records; retain scope-version history when official structure totals change.

### 3. Independent workstreams

- Track ROW availability, site/environmental clearance, utility relocation, enabling works, civil guideway/structures, track, OCS/traction power, train control/communications, and testing/certification separately.
- Use normalized states: `unknown`, `not_started`, `ready`, `in_progress`, `complete`, `blocked`, and `not_applicable`, plus a source-reported percentage where one exists.
- Define conservative readiness as the highest stage whose applicable prerequisites are complete. Do not convert "underway" into an invented percentage.
- Preserve exact source terminology such as "parcel delivered to design-builder" instead of reinterpreting it as ownership.

## Sources and History

- Backfill monthly package-level ROW, utility, guideway, structure, expenditure, and forecast figures from the Authority's [Finance and Audit archives](https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/) beginning in 2019.
- Backfill feature-level milestones only when a dated project page, report, release, contractor update, or imagery observation supports them. Granular GIS history begins with the first stored snapshot.
- Store `effective_at`, `published_at`, and `ingested_at`; playback changes state only on documented events and never interpolates between reports.
- Attach publisher, URL, document page, retrieval date, content hash, evidence class, reviewer, confidence, and supersession links to every observation.
- Retain contradictory observations and display them as conflicts. Aggregate package statistics must never be painted onto individual miles.
- Request unavailable records through public-record channels: parcel delivery geometry/status, utility conflict register, work-area clearance logs, baseline WBS/schedule, schedule of values, structure register, and historical guideway status exports.
- Run weekly automated ArcGIS snapshots and a monthly reviewed release after new committee reports. Automation opens a data-diff pull request; it does not publish unreviewed status changes.
- Before public distribution, obtain written reuse permission or confirm applicable terms for Authority GIS layers whose item metadata restrict redistribution. Exclude restricted raw or derived geometry from the public repository until cleared.

## Effort Weighting

- Distance remains the canonical metric. The map is never geometrically distorted.
- Add an optional effort-weighted linear lens using attributable baseline budget by asset or `quantity x documented official unit price`. The Authority's estimating methodology identifies separate unit-price elements for at-grade guideway, fill, aerial structures, retaining structures, track, and related work. See the [2026 Basis of Estimate](https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Business-Plan-Basis-of-Estimate-A11Y.pdf).
- Report completed cost share conservatively; underway assets contribute only when an official earned-progress value exists.
- Never combine unrelated units such as dirt volume, structure count, and calendar duration into one score.
- Always show denominator coverage. Do not headline an overall effort-weighted percentage until at least 90% of the relevant baseline civil budget has been spatially allocated; below that threshold, label it "documented work coverage."

## Visualization

- Build a React/Vite static SPA using MapLibre GL JS and D3 or Observable Plot, published through GitHub Pages with prebuilt data artifacts and no application server.
- Desktop layout: linked chainage profile and geographic map side by side. Mobile layout: synchronized profile/map tabs.
- The profile uses actual milepost width by default, CP boundaries, one row per workstream, structure glyphs, and a `Distance / Documented effort` segmented control.
- The map colors only the selected workstream; structures remain individually selectable. Unknowns use neutral gray, estimates use patterning, conflicts use a distinct warning treatment, and evidence quality is never encoded solely by color.
- Shared controls include effective-date playback, step/play controls, workstream selector, package filter, asset search, known-data coverage, and CSV/GeoJSON download.
- Hover and selection synchronize both views. A detail drawer shows asset dimensions, current and historical observations, source excerpts, evidence classification, conflicts, and direct source links.
- Summary metrics show physical miles, ready-for-track miles, completed structures, and documented weighted progress as separate measures rather than one universal completion percentage.

## Interfaces and Storage

- Use a Python geospatial pipeline with GeoPandas/Shapely/PyProj and a TypeScript presentation layer.
- Maintain three layers of data: immutable source manifests/snapshots, reviewed CSV or YAML observations, and generated GeoParquet/GeoJSON/JSON artifacts.
- Publish schemas for `CorridorSegment`, `Asset`, `Observation`, `Source`, `Snapshot`, and `WeightSet`; stable IDs must survive name and geometry revisions.
- Encode view state in shareable query parameters: date, workstream, measurement mode, construction package, and selected asset.

## Verification and Acceptance

- Validate alignment connectivity, north-to-south ordering, and a measured total between 118 and 120 miles; flag source geometry changes in review.
- Require every status, percentage, date, and weight to reference at least one source; reject invalid ranges and orphaned assets.
- Reconcile monthly extracted totals with each report and flag, rather than silently fix, non-monotonic revisions or changed denominators.
- Test temporal queries so future observations cannot leak into earlier playback and corrections remain auditable.
- Use unit tests for linear referencing, segmentation, rollups, weighting coverage, and report extraction.
- Use Playwright for linked selection, time playback, filters, downloads, keyboard access, responsive layouts, nonblank maps, and text-overlap checks.
- The data phase is complete when the current 119-mile corridor, all known structures, coverage gaps, provenance, and 2019-present aggregate history are downloadable without the frontend.
- The frontend phase is complete when both linked views reproduce those datasets without hiding unknown, inferred, stale, or conflicting evidence.
