# HSR dashboard data-correctness plan

## Goal

Correct two related failures without inventing progress:

1. A line-work item whose ArcGIS progress row has `Completion = null` is painted `no_data` through most of replay even when a canonical named-project record or dated Authority publication says that exact structure is in progress or complete. San Joaquin River Viaduct (`CP1:176`) is the concrete reproduction: it was completed in February 2021, but its progress-layer percentage and dates are null.
2. CVSR utility and parcel values are silently absent or carried forward. The pipeline currently cannot distinguish a report not downloaded, a metric not published, and a parser failure.

The fix keeps numeric completion null unless a source publishes a number. Categorical structure evidence changes categorical status and provenance, not the raw percentage.

## Locked decisions and assumptions

- Coverage for the monthly CVSR inventory starts at `2019-03`, the first month in the dashboard's standard Central Valley Status Report series, and ends at the latest data month found locally. Earlier individual CP reports are not classified as missing monthly CVSR snapshots.
- A BuildHSR/CAHSRA claim of **Completed** creates a new `structure_complete` alignment status for a structure work item. It does **not** imply `guideway_complete`, track laid, systems installed, or a published earthwork percentage.
- **In progress** and **substantially complete** both map conservatively to `under_construction`; the exact source wording remains visible in the evidence tooltip.
- Only an explicit reviewed source-record-to-segment crosswalk or a source that names the progress segment may change status. Spatial proximity alone may attach a location marker, but may not change status.
- Structure-project layer state is an observation as of the ArcGIS fetch date. It must not leak backward in replay. Exact dated publications supersede that conservative as-of date for the named claim.
- Month-precision claims remain `YYYY-MM`; “completed in February 2021” is not rewritten as February 1. The resolver applies a month claim at that month's replay position and labels it “during February 2021.” “By” claims remain explicitly `as_of`.
- CVSR ROW and utility values remain package-level. They never color individual miles.
- Missing monthly reports and missing fields are never interpolated. The UI may show the last observed package metrics only with an explicit source month and staleness/missing-month badge; it must not present them as the selected month's observation.
- Canonical CAHSRA/BuildHSR sources only for status-changing evidence. No automated bypass of hsr.ca.gov protections.

## Observed gaps before the change

### Segment status

The ArcGIS progress layer contains 33 structure rows in CP1/CP2-3 with null completion. The generated artifact currently attaches named-project points spatially, then mutates only `currentStatus`. Historical snapshots retain only `{ completion }`; `deriveStatuses()` reuses timeless current state for some null observations and shows `no_data` before the first tier-3 snapshot. It also calls completed structures `guideway_complete` and in-progress structures `preconstruction`, both semantically wrong.

`CP1:176` has station 1,041,545.5–1,046,286.83 ft / IOS mile 49.018–49.877, null completion/start/finish, and a canonical named project “San Joaquin River Viaduct & Pergola” marked Completed. BuildHSR states completion in February 2021.

### CVSR parser gaps in the 75 local snapshots

Current per-package nulls:

- Utilities, all CP1/CP2-3/CP4: every month `2019-03` through `2021-03` (25 months). Audit separates these into source non-comparability for `2019-03`–`2020-07` (17 months) and parser failures for `2020-08`–`2021-03` (8 months). August 2020 already contains package ratios such as CP1 `202 / 1,202` and CP2-3 `187 / 692`; February 2021 contains CP1 `239 / 1,210`, CP2-3 `301 / 694`, CP4 `35 / 161`.
- Parcels, all packages: `2019-03`–`2020-01` and `2021-04`–`2021-08`.
- Parcels, CP1/CP2-3/CP4: `2025-03`.
- Parcels, CP2-3 only: `2024-04`.

The parcel rows are present in the corresponding local PDFs and are parser defects, not zeroes. The implementation target is no parcel field gaps in locally available snapshots. If the strict parser still cannot prove a row, it must emit `parser_failure` rather than a number.

### Reports not present locally

These 11 data months are absent from `data/raw/cvsr/` and therefore absent for both utilities and parcels. Ten official reports are available for manual download. The apparent `2023-05` report link is not valid May evidence: its filename says `2305`, but the PDF itself says “data through April 2023,” duplicating the prior data month. Classify that month as `report_not_located`, not as a downloadable report and never as May data.

| Data month | State | Canonical report or audit evidence |
|---|---|---|
| `2023-05` | `report_not_located` | The official index links https://hsr.ca.gov/wp-content/uploads/2023/07/CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf, but the document internally says “data through April 2023”; retain it only as a rejected duplicate diagnostic. |
| `2023-10` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2024/01/CVSR-2312-2310-Data-FINAL-V0-A11Y.pdf |
| `2024-01` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2024/03/CVSR_2403_2401_Data-FINAL-V0-A11Y.pdf |
| `2024-05` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2024/08/Supplemental-CVSR-2024-08-Data-2024-05-FINAL-A11Y.pdf |
| `2024-06` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2024/08/CVSR-2024-08-Data-2024-06-FINAL-V0-A11Y.pdf |
| `2024-09` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2024/12/CVSR-2024-11-Data-2024-A11Y.pdf |
| `2025-01` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2025/03/CVSR-2025-03-20-Data-2025-01-FINAL-V0-A11Y.pdf |
| `2025-04` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2025/06/CVSR-2025-06-Data-2025-04-FINAL-V0-A11Y.pdf |
| `2025-08` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2025/10/CVSR-2025-10-Data-2025-08-Supplemental-FINAL-V0-A11Y.pdf |
| `2025-10` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2025/12/CVSR-2025-12-Data-2025-10-FINAL-V0-A11Y.pdf |
| `2026-01` | `report_not_downloaded` | https://hsr.ca.gov/wp-content/uploads/2026/03/FA-Central-Valley-Status-Report-Supplemental-March-2026-A11Y.pdf |

After a human downloads the ten valid PDFs, the expected period `2019-03`–`2026-04` contains 86 calendar months, 85 available snapshots, and one unresolved source month (`2023-05`). Until then, the committed dashboard must disclose ten not-downloaded reports plus the one unresolved month.

## Implementation

### 1. Add explicit evidence and gap contracts

Update `src/data/types.ts`:

- Add `structure_complete` to `AlignmentStatus`.
- Extend `NamedStructure` with `objectId`, `globalId`, and `observedAt`; extend `locationMethod` to include `crosswalk`. Keep `status` as the source's exact `Completed | In progress` text.
- Add `StructureEvidence`:
  - `id`, `segmentId`
  - `claim: 'in_progress' | 'substantially_complete' | 'completed'`
  - `date`, `datePrecision: 'day' | 'month' | 'as_of'`
  - `label`, `sourceTitle`, `sourceUrl`, `sourceId`
  - `quote` containing the short claim actually relied on
- Add `evidence: StructureEvidence[]` to `Segment`.
- Add `dataMonth: string` and optional `reportUrl` to tier-2 `Snapshot`; canonicalize `Snapshot.date` to `YYYY-MM-DD` everywhere (`dataMonth + '-01'` is a period key, not a claimed event day).
- Add `CvsrGapCause = 'report_not_downloaded' | 'report_not_located' | 'source_not_reported' | 'parser_failure'` and `CvsrGap` with month, metric (`snapshot | utilities | parcels`), affected packages, report file/URL, and detail.
- Add `CvsrInventory` with coverage start/end, expected/available months, gaps, and rejected/duplicate report diagnostics. Persist it in parsed CVSR output and `HistoryArtifact`.
- Add replay provenance `scheduled | observed | mixed` rather than forcing all colors into one tier number.

### 2. Replace heuristic status attachment with a reviewed GlobalID crosswalk

Create `src/data/structure-evidence.ts` as reviewed data, not parsing logic.

- Export `STRUCTURE_CROSSWALK: Record<globalId, segmentId>`.
- Seed the 28 exact reviewed records currently proven by source name/location, including the seven CP1 completed null rows and 21 CP2-3 null rows. Critical corrections include:
  - Cottonwood `d69fd73d-4055-4443-8e2f-90fa39e611c7 -> CP1:174`
  - San Joaquin `af60e24c-0a22-42ad-8478-414407be5ea5 -> CP1:176`
  - Cedar `c9568d6d-b431-4bd0-a467-d220dea26372 -> CP1:178`
  - Ventura `93ef529a-12cb-486e-a931-67fde92128de -> CP1:183`
  - Fresno River `458507d8-0b10-4a81-943b-1224ab191aa1 -> CP1:187`
  - Tulare `7a17b93b-5a83-40b6-9efc-3715960efbe1 -> CP1:190`
  - Muscat `4e29ce9b-269f-45cf-ad3d-e8fdc94dc711 -> CP1:199`
  - Peach `d65680fb-2fea-4328-bfce-3541e804221c -> CP2-3:119`
  - Conejo `8a399845-6cbd-4266-84e5-c9cd1db9957c -> CP2-3:129`
  - Tied Arch `c8f419bb-646d-4aec-a63f-787a053f50d2 -> CP2-3:123`
  - 9th Avenue `641f5716-3cc8-46e3-8164-7bbd2b852cfb -> CP2-3:143`
  - Cairo `4644a7b5-d039-421a-b378-181a76eecc28 -> CP2-3:112`
  - Hanford `f1a184e4-37eb-4fab-ab02-c06c1f0c33bc -> CP2-3:128`
  - Whitley `7ec4042c-aff1-4150-a97d-1ac87d3c60d8 -> CP2-3:139`
  - Tule River `41d4d2d8-e550-4f71-a888-27a76dba3934 -> CP2-3:131`
  - Deer Creek `cfe18835-9fcd-4b33-b9a5-665dd95b3161 -> CP2-3:170`
- Include the remaining reviewed CP2-3 mappings observed in the audit (Cole Slough 117, Dutch John 137, Kings River 160, Grangeville 118, Lansing 132, Cross Creek 130, Avenue 156 144, Avenue 136 151, Lakeland 150, Stoil Spur 127, Alpaugh Bridge 110, Avenue 24 169).
- Deliberately do not map Golden State Boulevard **Realignment** to Golden State Boulevard **Viaduct** or Herndon HST. Do not map Access Road Underpass or Alpaugh Angiola Atwell Trail Underpass without direct evidence.

Update `scripts/fetch-arcgis.ts` to request `GlobalID` for structure points. Update `scripts/build-segments.ts` so crosswalk attachment runs before name/spatial context attachment. Assert every configured GlobalID and segment ID resolves exactly once. Only `crosswalk` attachments are eligible to change status; name/spatial-only attachments remain contextual.

### 3. Seed dated, claim-preserving structure evidence

Populate `STRUCTURE_EVIDENCE` with at least these canonical events:

| Segment | Claim/date | Source |
|---|---|---|
| `CP1:174` Cottonwood Creek | completed **by** `2017-02-03` (`as_of`) | https://hsr.ca.gov/wp-content/uploads/2024/01/SB1029-ProjectUpdate-FINAL_020317-A11Y.pdf |
| `CP1:187` Fresno River | substantially complete by `2019-03` | https://hsr.ca.gov/wp-content/uploads/docs/about/legislative_affairs/SB1029_Project_Update_Report_050119.pdf |
| `CP1:199` Muscat Avenue | completed during `2019-07` | https://www.buildhsr.com/project/muscat-avenue-viaduct/ |
| `CP1:176` San Joaquin River | in progress during `2020-08`; completed during `2021-02` | August 2020 CVSR; https://www.buildhsr.com/project/san-joaquin-river-viaduct-pergola/ |
| `CP1:178` Downtown Fresno/Cedar | in progress during `2020-08`; completed on `2023-05-10` | August 2020 CVSR; https://buildhsr.com/project/cedar-viaduct/ |
| `CP1:184` Golden State Boulevard Viaduct | in progress during `2020-08` | August 2020 CVSR (directly names the viaduct) |
| `CP2-3:128` Hanford Viaduct | substantially complete/in progress during `2020-08` | August 2020 CVSR |
| `CP2-3:129` Conejo Viaduct | in progress during `2020-08` | August 2020 CVSR |
| `CP2-3:119` Peach Avenue | substantially complete during `2020-08`; opened/completed on `2024-12-06` | August 2020 CVSR; https://www.buildhsr.com/project/peach-avenue-grade-separation/ |
| `CP2-3:112` Cairo Avenue | completed on `2022-12-20` | https://buildhsr.com/project/cairo-avenue-viaduct/ |
| `CP2-3:139` Whitley Avenue | completed/opened on `2025-04-24` | https://buildhsr.com/project/whitley-avenue-underpass/ |
| `CP1:190` Tulare Street | completed on `2025-09-30` | https://hsr.ca.gov/2025/09/30/news-release-high-speed-rail-authority-completes-another-structure-in-fresno/ |
| `CP1:183` Ventura Street | completed on `2026-01-23` | https://hsr.ca.gov/2026/01/23/news-release-high-speed-rail-authority-completes-ventura-street-underpass/ |

For all reviewed crosswalk points, also generate a conservative as-of evidence state from the ArcGIS categorical value at `fetch-metadata.fetchedAt`. This gives truthful current status for records without a historical milestone while preventing backward leakage.

Store the exact old CVSR report URL on CVSR-derived events where known; otherwise link to the relevant Finance & Audit year index and retain `reportFile`.

### 4. Centralize date-aware status resolution

Replace the ad-hoc mutations in `scripts/build-segments.ts` and the null-structure special case in `src/lib/status.ts` with one resolver used by artifact generation and replay:

1. If a selected tier-3 observation has a non-null numeric completion, use the existing numeric mapping.
2. Otherwise select the latest eligible direct `StructureEvidence` and reviewed crosswalk observation whose date/as-of date is not after the selected date.
3. Resolve `completed -> structure_complete`; `in_progress | substantially_complete -> under_construction`.
4. If a tier-3 observation explicitly contains null and no eligible evidence exists, return `no_data`; never substitute present-day state.
5. If no tier-3 observation exists and no evidence exists, use the existing scheduled model.

`currentStatus` in `segments.json` and `segments.geojson` must be produced by this resolver at `generatedAt`; delete the current post-pass that maps complete points to `guideway_complete` and in-progress points to `preconstruction`.

Add `structure_complete` color/label to `src/lib/status.ts`, `src/components/Legend.tsx`, and the MapLibre match expression in `src/components/AlignmentMap.tsx`. Keep it visually distinct from `guideway_complete` and retain the official definition text.

### 5. Stop summary and tooltip time leakage

Update `src/App.tsx`:

- Replace `activeSnapshot?.perSegment?.[id]?.completion ?? segment.completion` with property-presence semantics. An explicit historical null remains null and cannot fall through to current completion.
- Keep `Earthwork-equivalent` numeric-only.
- For the modelled difficulty metric, count a categorical `structure_complete` as binary complete only for structure weight; do not invent partial percentages for in-progress structures. Rename/help-text the metric so this modelling rule is explicit.
- Replace the timeless deduplicated point count in “Structures observed” with the CVSR aggregate structure count at the displayed report month. If the selected month has no exact snapshot, show the last observation with an explicit `as of YYYY-MM` qualifier.
- Return replay provenance `scheduled`, `observed`, or `mixed`; update `TimeScrubber` badges so a replay containing dated milestone evidence plus scheduled segments says “Mixed observed + scheduled,” not “Scheduled replay.”

Update `src/components/StripChart.tsx`:

- Pass selected date and resolved evidence into the tooltip.
- Preserve `Current earthwork completion: not reported` for null values.
- Add an evidence line with exact wording, date precision (“during,” “on,” or “by”), and direct source link.
- Do not show a current ArcGIS point status as if it existed at a historical selected date. Location markers may remain, but their state must be labelled with its observation date.

### 6. Make CVSR parsing strict and auditable

Refactor the pure extraction routines from `scripts/fetch-cvsr.ts` into `scripts/lib/cvsr-parser.ts`; leave file enumeration/IO in the CLI.

Parse packages within their own CP section and support these source layouts by heading/semantic label, not fixed column offsets:

- Utilities:
  1. Narrative rows: `Relocated: R ... In Progress ... Scheduled ... Not Started ... Total: T` (August 2020–March 2021).
  2. Summary tables with `Total Relocations`, `Relocated to Date`, `Remaining`.
  3. Newer type/status tables whose package totals must reconcile with the package summary.
- Parcels:
  1. Narrative rows: `Total Parcels Delivered to Date – D ... Estimated Total Parcels Needed – T` (legacy reports).
  2. `ROW Summary` tables ordered `Total Needed`, `Delivered to Date`, `Remaining`.
  3. Newer `Total Parcels Needed`, `Total Parcels Delivered`, `Remaining` tables.

For every accepted pair assert finite nonnegative integers, delivered/relocated `<= total`, and `total - delivered = remaining` when remaining is published. Reject ambiguous or reversed rows rather than swapping values heuristically.

Encode only the audited true source exception: per-package utility relocated/total is not consistently comparable/published for `2019-03`–`2020-07`. Record those months as `source_not_reported`. Every null parcel field, and every null utility field from `2020-08` onward, is a `parser_failure` and causes `npm run parse:cvsr` to exit nonzero after writing diagnostics.

Canonicalize report data dates to `date: YYYY-MM-01` plus `dataMonth: YYYY-MM`; this removes duplicate `YYYY-MM`/`YYYY-MM-01` scrubber positions.

### 7. Persist and render the missing-data inventory

Update `data/raw/cvsr/MANIFEST.md` generation to include the ten valid download URLs plus the rejected `2023-05` candidate, expected local filename, data month, and `downloaded/missing/rejected-duplicate` state. The command remains a human handoff and must not fetch around bot protection.

`parsed-snapshots.json` must contain:

- continuous expected month list;
- available snapshot list;
- one `report_not_downloaded` gap for each valid known URL absent locally;
- `report_not_located` when no valid official report was found, including `2023-05`; retain the mislabeled April-data PDF as a rejected duplicate diagnostic;
- field-level `source_not_reported` and `parser_failure` entries;
- ignored duplicate/non-CVSR/missing-data-month report diagnostics.

Copy the inventory through `scripts/build-history.ts` to `public/data/history.json`.

Update `PackageBands` and `src/App.css`:

- Show the report's `dataMonth` and direct `reportUrl` when available.
- Exact snapshot + missing field: “Not reported by source” or “Parser failed,” from inventory cause.
- Missing selected month: show the last snapshot only as “Last observed YYYY-MM”; add “YYYY-MM report not downloaded/not located.”
- Add a compact “Data gaps” disclosure listing missing report months and source-omission months. Do not render a repeated generic `CVSR PDF required` for each package cell.

Change `SOURCES.cvsr` from the April 2026 PDF to the Finance & Audit index root; per-snapshot links point to the exact report. Add direct structure-event links in the evidence records.

### 8. Tests and verification

Add Node/tsx tests without a new framework:

- `scripts/lib/cvsr-parser.test.ts`: one fixture per utility/ROW layout; validates the February 2021 values above, reversed-column rejection, date normalization, and known source-gap classification.
- `src/lib/status.test.ts`: San Joaquin is under construction at `2020-08`, `structure_complete` at `2021-02`, and no present-day categorical state leaks to an earlier date; completed structure is not `guideway_complete`; explicit null does not fall through to current numeric completion.
- Add `npm test` using `tsx --test`.

Pipeline verification:

1. Run `npm run parse:cvsr`. With the current 75 PDFs: zero parser failures; parcel gaps zero; utility `source_not_reported` exactly the 17 months `2019-03`–`2020-07`; ten `report_not_downloaded` months and one `report_not_located` month (`2023-05`). With the ten valid official PDFs later added: 85 of 86 calendar-month snapshots, no not-downloaded reports, and the one unresolved May 2023 source gap.
2. Run `npm run fetch` to regenerate `segments.json`, `segments.geojson`, and `history.json`. Assert all crosswalk GlobalIDs resolve once, `CP1:176` has null numeric completion plus dated evidence, and GeoJSON current status is `structure_complete` rather than `guideway_complete`.
3. Run `npm test`, `npm run build`, and `npm run lint`.
4. Browser smoke test the production build:
   - `2020-08`: San Joaquin is `under_construction`, with August 2020 CVSR evidence; utilities show package values including CP1 `202 / 1,202`.
   - `2021-02`: San Joaquin becomes `structure_complete`, tooltip says completed during February 2021, earthwork percentage remains “not reported,” and the BuildHSR link is present.
   - A date before a current-only point observation does not show that current status.
   - `2024-05` before its PDF is added: package bands identify the report as not downloaded and label any displayed April values “Last observed 2024-04.”
   - Current date: completed null-progress structures use `structure_complete`; in-progress null-progress structures use `under_construction`; map and strip remain linked; no failed data requests or console errors.

## Files changed

- `src/data/types.ts`
- `src/data/sources.ts`
- `src/data/structure-evidence.ts` (new reviewed data registry)
- `src/lib/status.ts`
- `src/lib/status.test.ts` (new)
- `scripts/fetch-arcgis.ts`
- `scripts/build-segments.ts`
- `scripts/build-history.ts`
- `scripts/fetch-cvsr.ts`
- `scripts/lib/cvsr-parser.ts` (new)
- `scripts/lib/cvsr-parser.test.ts` (new)
- `src/App.tsx`
- `src/components/TimeScrubber.tsx`
- `src/components/StripChart.tsx`
- `src/components/Legend.tsx`
- `src/components/AlignmentMap.tsx`
- `src/App.css`
- `package.json`
- `README.md`
- generated `data/raw/cvsr/MANIFEST.md`, `data/raw/cvsr/parsed-snapshots.json`, `public/data/segments.json`, `public/data/segments.geojson`, and `public/data/history.json`
