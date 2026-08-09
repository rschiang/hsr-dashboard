# CAHSR Merced–Bakersfield Progress Dashboard

## Context

Build a static web dashboard that visualizes construction progress along the 171-mile California High-Speed Rail Initial Operating Segment (Merced–Bakersfield). The repo `.` is **empty** — this is greenfield.

Two deliverables, both in scope:
1. **Data pipeline** — fetch the alignment centerline with mileposts, the structures and guideway segments along it, and their construction status; derive an engineering-difficulty weight per segment; assemble a time series so progress can be replayed.
2. **Visualization** — a milepost strip chart and a map overlay, both colored by status, both driven by a date scrubber, with a toggle between distance-proportional and difficulty-proportional segment widths.

End state: `npm run fetch && npm run build` produces a static site showing every mile of the IOS painted by its current construction phase, replayable back through time, with segment widths optionally scaled by engineering difficulty.

---

## Data sources (all verified live this session)

**Citation discipline — this project is held to an investigative-report standard.** Every milepost, length, cost and status figure the UI displays MUST carry a resolvable citation to a primary CAHSRA document or a named API layer. GIS geometry is used to *draw* the alignment; **official published documents are the authority for every number.** Where the two disagree, the document wins and the discrepancy is shown, not silently reconciled. Implementation: a single `src/data/sources.ts` registry (step 2) keyed by a short id, with every UI figure rendering a superscript link to its source.

CAHSRA's own public ArcGIS Online org is `rGGp0aiv6Rf11t2H` (`GeoPlatform_CHSRA`). All layers below are token-free, anonymous-queryable, and returned real data when probed. Service root:

```
https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services
```

| # | Source | What it gives | Verified |
|---|---|---|---|
| **F** | **TS1 3.0 — Alignment Segments and Lengths (2019-05-01 industry draft)** | **CANONICAL MILEPOSTS.** Official station↔milepost table for every segment Merced→Bakersfield, with exact equation points between construction-package datums | Fetched and fully parsed |
| G | TS1 2.1 — Systemwide Alignment Schematic (2019-05-01) | Subdivision letters, control points, station mileposts, named structures | Fetched; text extracts, layout jumbled |
| A | `HSR_Statewide_Alignment/FeatureServer/1` | Alignment **geometry**, 16 features, **M-aware** (M = engineering stationing in **feet**, identical to TS1 stationing) | 16 features; `hasM: true` |
| B | `BuildHSR_Guideways_Construction_Progress_view/FeatureServer/0` | 102 polylines: guideway + named structures, `Completion` %, `Station`/`StationEnd`, `Start`/`Finish`, earthwork quantities | 102 features |
| C | `Closures_and_Detours_Public/FeatureServer/0` | 88 named structure/project **points** with `status` ∈ {`Completed`, `In progress`} and `projectPageURL` | 88 features |
| D | `ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/0` | Stations (`Stat_Name`, `X_Streets`, `SECTION`, `PHASE`, `LAT`, `LONG`) | Merced/Madera/Fresno/Kings-Tulare/Bakersfield present |
| E | `hsr.ca.gov` Central Valley Status Report (CVSR) monthly PDFs | The only historical time series: structures, guideway miles, utilities, ROW parcels — **per construction package, PDF only** | Monthly run 2020-09 → 2026-06 |

### F. CANONICAL MILEPOSTS — TS1 3.0 Alignment Segments and Lengths

**This document, not the GIS server, defines the milepost axis.**

> California High-Speed Rail Authority, *Track and Systems Contract 1 (TS1) 3.0 – Alignment Segments and Lengths, San Francisco and Merced to Bakersfield*, industry draft dated 2019-05-01 (sheet dated 3/29/2019).
> Archived: `https://web.archive.org/web/20210921082559/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-3_TS1_3-0-Alignment_Segments_and_Lengths-2019-0501.pdf`
> Original (now delisted): `https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-3_TS1_3-0-Alignment_Segments_and_Lengths-2019-0501.pdf`

CAHSR does **not** use a single 0–171 milepost axis. It uses **subdivision-prefixed mileposts**, confirmed by the companion schematic (source G): Bay `B`, Capital `C`, Pacheco `P`, Sierra `S`, Desert `D`, 4th & King `K`, Tonga `T`, San Jacinto `J`. The IOS runs across three of them:

**Merced `C 124` → CP Divide `C 144` = `S 144` → Bakersfield Station `S 295` = `D 295` → Oswell St (TS1 southern limit) `D 299`.**

`124 → 144` = 20 mi on Capital, `144 → 295` = 151 mi on Sierra. **20 + 151 = 171 — this is the provenance of the Authority's "171-mile" figure**, and it measures Merced station to Bakersfield station. Continuing to the TS1 southern limit at Oswell Street gives 175. The Authority's own current term is "171-mile Early Operating Segment" (Board Memo, Agenda Item 3, 2025-11-20, `https://hsr.ca.gov/wp-content/uploads/2025/11/2025-11-20-Agenda-Item-3-Board-Memo-TSCC-V1-A11Y.pdf`).

Full IOS table, transcribed verbatim from the source. Stations are `SSSS+FF.FF` engineering notation (feet). `AHD` = ahead, `BK` = back, `PS TO` = point of switch of a turnout. Each `=` row is an **equation point** where one construction package's datum hands off to the next — these are what make the packages joinable.

| Project Section | Alignment Name | Start Sta | End Sta | ft | mi | Start MP | End MP |
|---|---|---|---|---|---|---|---|
| Wye to Merced | Northern Limit of TS1 at Martin Luther King Way, Merced | POB | 6066+14.09 | | | POB **C 124** | |
| Merced to Madera | Ranch Road to Merced / North Merced Corridor | 6066+14.09 | 5655+00.00 `= 15655+00.00 AHD` | 41,114 | 7.8 | C 124 | C 132 |
| Merced to Madera | Ranch Rd → CP San Joaquin, along SR 152 to Road 11 Wye | 15655+00.00 | 15317+00.00 | 33,800 | 6.4 | C 132 | C 139 |
| CVY | **CP San Joaquin** | `= 15317+00.00` | `= 36457+64.82 PS TO` | | | C 139 | = P 139 |
| CVY | CP San Joaquin → CP Divide, along SR 152 to Road 11 Wye | 15317+00.00 | 15009+29.85 | 30,770 | 5.8 | C 139 | C 144 |
| CVY | **CP Divide** | `= 6477+00.00 BK` (Bay) | `= 6477+00.00 AHD` (Sierra) | | | B 144 | **S 144** |
| CVY | CP Divide → CP1, along SR 152 to Road 11 Wye | 6477+00.00 | 7171+85.19 `= 9620+39.57 AHD` | 69,485 | 13.2 | S 144.5 | S 158 |
| CP1 | CP1 Extension (60% design, Feb 2019) | 9620+39.57 | 9828+00.00 | 20,760 | 3.9 | S 158 | S 162 |
| CP1 | Track Guideway Package 1 (RFC Sep 2017) | 9828+00.00 | 10304+00.00 | 47,600 | 9.0 | S 162 | S 171 |
| CP1 | Track Guideway Package 2 (RFC Dec 2017) | 10304+00.00 | 10580+10.38 `= 10580+22.31 AHD` | 27,610 | 5.2 | S 171 | S 176 |
| CP1 | Track Guideway Package 2 (cont.) | 10580+22.31 | 10691+50.00 | 11,128 | 2.1 | S 176 | S 178 |
| CP1 | Caltrans Segment (RFC Jan 2016) | 10691+50.00 | 10825+60.00 | 13,410 | 2.5 | S 178 | S 180 |
| CP1 | Track Guideway Package 3 (RFC Feb 2018) | 10825+60.00 | 11030+00.00 | 20,440 | 3.9 | S 180 | S 184 |
| CP1 | Track Guideway Package 4 (RFC Feb 2018) | 11030+00.00 | 11299+98.90 `= 587+30.67 AHD` | 26,999 | 5.1 | S 184 | S 189 |
| CP2-3 | Segment 1 North (RFC Oct 2017) | 587+30.67 | 1075+00.00 | 48,769 | 9.2 | S 189 | S 199 |
| CP2-3 | Segment 1 South (RFC Dec 2017) | 1075+00.00 | 1595+00.00 | 52,000 | 9.8 | S 199 | S 209 |
| CP2-3 | Segment 2 North (90% design, Feb 2017) | 1595+00.00 | 1731+00.00 | 13,600 | 2.6 | S 209 | S 211 |
| CP2-3 | Segment 2 Combined Middle and South (RFC Mar 2018) | 1731+00.00 | 2665+00.00 | 93,400 | 17.7 | S 211 | S 229 |
| CP2-3 | Segment 3 North (RFC Dec 2017) | 2665+00.00 | 3449+00.00 | 78,400 | 14.8 | S 229 | S 244 |
| CP2-3 | Segment 3 South (RFC Mar 2018) | 3449+00.00 | 4045+55.69 `= 14769+22.54 AHD` | 59,656 | 11.3 | S 244 | S 255 |
| CP4 | Alignment A1 (RFC Jun 2018) | 14769+22.54 | 15259+07.86 | 48,985 | 9.3 | S 255 | S 264 |
| CP4 | Alignment L1 (RFC Jun 2018) | 15259+07.86 | 15426+88.18 | 16,780 | 3.2 | S 264 | S 267 |
| CP4 | Alignment WS1 (RFC Sep 2018) | 15426+88.18 | 15610+00.00 | 18,312 | 3.5 | S 267 | S 271 |
| CP4 | Alignment WS1 (RFC Oct 2018) | 15610+00.00 | 15884+38.60 `= 5880+00.00 AHD` | 27,439 | 5.2 | S 271 | S 276 |
| Poplar Ave to Bakersfield | Fresno–Bakersfield Locally Generated Alternative (FB–LGA) | 5880+00.00 | 6856+00.00 | 97,600 | 18.5 | S 276 | S 295 |
| Poplar Ave to Bakersfield | **Bakersfield HSR Station** | `= 6856+00.00` (Sierra) | `= 6856+00.00 AHD` (Desert) | | | **S 295** | = D 295 |
| Poplar Ave to Bakersfield | FB–LGA (Desert Subdivision) | 6856+00.00 | 7101+04.43 | 24,504 | 4.6 | D 295 | D 299 |
| Poplar Ave to Bakersfield | Southern Limit of TS1 at Oswell Street, Bakersfield | POE | 7101+04.43 | | | POE **D 299** | |

Official per-section lengths from the same sheet: **Merced to Madera 33 · CP1 32 · CP2-3 65 · CP4 21 · Poplar Ave to Bakersfield 23 = 174 miles** (Merced to Oswell Street).

Source note 4, verbatim: *"All alignment lengths and mileposts are approximate."* Notes 1–2: CP1–CP4 are design-build contracts under construction; all other sections were at PEPD (≈15% design) as of 2019.

**Cross-validation against the GIS server — performed this session, and the reason this table is trustworthy:**

| Package | TS1 station range | ArcGIS layer A `M` range | Match |
|---|---|---|---|
| CP1 | 9620+39.57 → 11299+98.90 | 962 039.6 → 1 129 998.9 ft | **exact** |
| CP2-3 | 587+30.67 → 4045+55.69 | 58 730.7 → 404 555.7 ft | **exact** |
| CP4 | 14769+22.54 → 15884+38.60 | M is null, but layer B `Limits` reads `"14769+22.54 - 15425+84"` and `"15436+68 - 15884+38.60"` | **exact** |

The ArcGIS M-values *are* TS1 stationing, agreeing to the hundredth of a foot on two independent packages. Two further independent corroborations: the assembled GIS geometry measures 174.5 mi against the document's 174; and the document's Merced-station-to-Bakersfield-station span is exactly the 171 the Authority publishes.

### G. TS1 2.1 Systemwide Alignment Schematic — subdivision and structure reference

> *Track and Systems Contract 1 (TS1) 2.1 – Systemwide Alignment Schematic*, 2019-05-01 (sheet 3/28/2019).
> Archived: `https://web.archive.org/web/20221126054952/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-2-1_TS1_2-1-Systemwide_Alignment_Schematic-2019-0501.pdf`

A single large-format engineering drawing. Text extracts but the layout is jumbled, so **treat it as a human reference, not a parser target.** Milepost anchors legible on it and consistent with source F: Merced `C124`; CP San Joaquin `C139`/`P139`; CP Divide `C144`=`B144`=`S144`; CP1 begin `S158`; CP1 end / CP2-3 begin `S189`; **Fresno station `S194`**; Kings/Tulare `S239`; CP2-3 end / CP4 begin `S255`; CP4 end `S276`; Bakersfield `S295`=`D295`. Station platform lengths: Merced, Fresno, Kings/Tulare and Bakersfield all 1400 ft.

It also names the major structures in corridor order — San Joaquin River Viaduct, Fresno Trench, Jensen Trench, Downtown Fresno Viaduct, Conejo Viaduct, SR 43 Viaduct, BNSF Viaduct, Cross Creek, Cole Slough, Kings River, Deer Creek, Dutch John Cut, Cottonwood Creek, Fresno River Embankment, Wasco Viaduct, Kern River, Bakersfield Viaduct — useful for validating the structure-name alias table in step 3.

**The full archived TS1 document set** (enumerated via the Wayback CDX API on `hsr.ca.gov/wp-content/uploads/docs/programs/track*`, 33 files, all HTTP 200 as of the 2021-09-21 capture) also includes `Part_B-2-1_TS1_1-0-Limits_of_Work_Map`, `Part_B-2-0_TS1_0-0_HSR_Industry_Draft_Civil_Infrastructure_Deliverables`, `Part_B-2-5_TS1_5-0-Base_Design_Civil_Infrastructure_Typical_Sections` and `Part_B-1_TS-1_Industry_Draft_Functional_and_Technical_Requirements`. The Limits of Work Map is a raster map — text extraction returns nothing; do not target it programmatically.

### A. Centerline — `HSR_Statewide_Alignment/FeatureServer/1`

Query (M is dropped by `f=geojson`; **must** use `f=json&returnM=true`):

```
/HSR_Statewide_Alignment/FeatureServer/1/query
  ?where=Section IN ('M2M','CP1','CP2-3','CP4','LGA')
  &outFields=Section,PROJECT_SECTION&returnM=true&outSR=4326&f=json
```

Vertices come back as `[lon, lat, m]` — **3 elements, `hasZ` is false, so M is at index 2, not 3.** (Indexing `v[3]` silently yields all-null and is the single easiest way to break this pipeline.)

Verified per-section results:

| `Section` | `PROJECT_SECTION` | paths | geom miles | M range (ft) | M span |
|---|---|---|---|---|---|
| `M2M` | Merced to Madera | 2 | 36.88 | 788 532.5 – 969 471.0 | 34.27 mi |
| `CP1` | Construction Package 1-1E | 1 | 31.82 | 962 039.6 – 1 129 998.9 | 31.81 mi |
| `CP2-3` | Construction Package 2-3 | 1 | 65.59 | 58 730.7 – 404 555.7 | 65.50 mi |
| `CP4` | Construction Package 4 | 1 | 21.15 | **all NULL** | — |
| `LGA` | Locally Generated Alternative (Bakersfield ext.) | 1 | 23.10 | **all NULL** | — |

Notes that drive the design:
- **`M2M` and `CP1` share one stationing datum and overlap** (M2M ends 969 471; CP1 starts 962 039 — 7 431 ft / 1.41 mi of overlap).
- **`M2M` is multipart and its two paths overlap each other** by ~2.64 mi (path0 M 788 532–899 728, path1 M 885 800–969 471). They are the two legs of the Central Valley Wye. Deduplicate by M, not by geometry.
- `CP2-3` has its own independent datum starting near 58 730.
- `Old CVY` has a corrupt M range (589-mile span across 25 miles of geometry) — **exclude it.**
- Provenance: converted from the PDS Engineering Branch MicroStation DGN master alignment; ~9 m vertex spacing through curves.

### B. Guideway & structures progress — the core dataset

102 features. Fields verified verbatim:

```
OBJECTID, Section (alias "Construction Package"), Limits, Start (date), Finish (date),
BaselineDirtQnty, DeliveredDirtQnty, Completion (string "NN%"), Seg, StructureType,
Station (double, alias "Station Start"), StationEnd (double), GlobalID
```

Distribution and quality, measured:

| Package | Features | Geometry | Stationing | Tiling |
|---|---|---|---|---|
| `CP2-3` | 72 | 65.59 mi | 58 730 – 405 653 ft | **Zero gaps or overlaps** — perfect tiling; station-delta matches geodesic length within 0.15 mi on 71/72 |
| `CP1` | 27 | 31.90 mi | 964 055 – 1 129 999 ft | **9 discontinuities**, including a backwards jump (1 103 000 → 1 099 163) in the Fresno urban core, and a genuine ~2.06 mi coverage hole (1 048 373 → 1 059 250) |
| `CP4` | 3 | 21.15 mi | **`Station` is NULL**; stationing appears only inside `Limits` text, e.g. `"14769+22.54 - 15425+84 Completed Guideway"` | 3 coarse rows only |

Total geometry 118.64 mi ≈ the Authority's published 119-mile Central Valley segment.

- `StructureType` ∈ {`Guideway`, `Type 1 Structure`, `Type 1`, `Type 1 ` (**trailing space — trim before comparing**)}. Guideway rows and structure rows *tile* rather than overlap (e.g. CP2-3: structure 146 125–146 374, guideway 146 374–148 257).
- `Completion` is a **string** `"NN%"`, null/empty on most structure rows. For guideway rows it equals `DeliveredDirtQnty / BaselineDirtQnty` exactly — i.e. **Completion is an earthwork-volume ratio, not a schedule ratio.**
- `Start`/`Finish` are epoch-millis; present on 60/102 rows, spanning 2018-11 → 2026-07. `BaselineDirtQnty` present on 87/102.
- Layer `editingInfo.lastEditDate` = 2026-05-04. Capabilities: `Query` only. `maxRecordCount` 2000, so one unpaged request returns everything.

### C. Named structures with status — 88 points

`Closures_and_Detours_Public/FeatureServer/0`, fields `name, location, description, constructionUpdate, status, projectPageURL, latitude, longitude`.
`status` vocabulary is exactly two values: **`Completed` (59)** and **`In progress` (29)**. Names are official (`American Avenue Grade Separation`, `Avenue 88 Grade Separation`, …). `location` is free text and **sometimes contains raw HTML** (`<p>At Avenue 10 …</p>`) — strip tags. 4 rows have `location: null`.

### D. Stations — milepost anchors

From `ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/0`, the five IOS stations, verified coordinates:

| Station | lon, lat |
|---|---|
| Downtown Merced | −120.4913, 37.3019 |
| Madera Stop (Ave 19 & Rd 26) | −120.0757, 37.0225 |
| Fresno – Mariposa St. | −119.7946, 36.7326 |
| Kings/Tulare (VTH) | −119.5915, 36.3341 |
| Bakersfield – F Street | −119.0236, 35.3913 |

### E. History — CVSR monthly PDFs (the only time series that exists)

**There is no historical snapshot of any of the ArcGIS layers.** Verified: the Internet Archive CDX API returns **zero** captures for `services3.arcgis.com/rGGp0aiv6Rf11t2H*`. Progress history cannot be back-filled from the API.

The Authority's monthly **Central Valley Status Report** is the substitute. Enumerate it machine-readably via the WordPress REST API (the *index* is JSON; the *data* is PDF):

```
https://hsr.ca.gov/wp-json/wp/v2/media?search=CVSR&per_page=100&orderby=date&order=asc
  &_fields=id,date,title,source_url,mime_type
```
Returns ~85 items, 2020-09-08 → 2026-06-24, roughly monthly. **Union with `search=Central+Valley+Status`** — neither query alone covers all naming variants.

Verified example documents:
- `https://hsr.ca.gov/wp-content/uploads/2026/04/FA-Central-Valley-Status-Report-April-2026.pdf`
- `https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_031720_FA_Central_Valley_Status_Report.pdf`
- `https://hsr.ca.gov/wp-content/uploads/2025/12/CVSR-2025-12-Data-2025-10-FINAL-V0-A11Y.pdf`

Highest-signal, lowest-fragility extraction target is the **Executive Summary (pp. 2–3)**, which restates every metric as a labelled sentence. Verbatim from the April 2026 edition:

```
• Structures – 58 complete (63%), 30 underway, 4 not started. No change from the prior period.
  ▫ Construction Package 1 – 22 complete (67%), 7 underway, 4 not started.
  ▫ Construction Package 2-3 – 25 complete (52%), 23 underway, 0 not started.
  ▫ Construction Package 4 – 11 of 11 structures completed (100%).
• Guideway – 81 miles complete (68%), 27 underway, 11 not started.
  ▫ Construction Package 1 – 11 complete (34%), 12 underway, 9 not started.
  ▫ Construction Package 2-3 – 49 complete (75%), 14 underway, 2 not started.
  ▫ Construction Package 4 – 21.1 complete (99.5%), 0.1 underway, 0 not started.
• Relocated: 1,699 (93%); In Progress: 59 (3%); Not Started: 68 (4%); Total: 1,826.
• Total Parcels Delivered to Date – 99.8% or 2,287 parcels compared to an estimated 2,291 parcels needed.
• Total Railroad Parcels Delivered to Date – 164 parcels delivered compared to an estimated 176 total.
```

Official metric definitions, verbatim — **use these as the legend tooltips**:
- *Structure Completion – all concrete work is complete, ready for punchlist and certification, then ready for either track install or open to traffic.*
- *Guideway Completion – earthworks complete with rough grading.*

Two hard gotchas:
- **`hsr.ca.gov` sits behind Imperva/Incapsula, and this project does not work around it.** Raw `curl` of `/wp-json/...` returns a challenge page. **Automated bypass is out of scope and must not be attempted** — no spoofed browser fingerprints, no headless-browser evasion, no challenge solving. The pipeline instead emits a download manifest and the PDFs are placed in `data/raw/cvsr/` by hand (step 6).
- **Denominators drift between editions** (93 vs 92 total structures; 1 836 vs 1 826 utilities). Store the denominator with each snapshot; never assume a fixed total.

### Per-package cost & duration (difficulty weighting inputs)

From the CVSR "Design-Build Contract Summary" pages, Feb-2026 data:

| | CP1 | CP2-3 | CP4 |
|---|---|---|---|
| Original contract price | $1,022,988,000 | $1,365,335,890 | $444,247,000 |
| Current contract amount | **$4,066,619,637** | **$3,808,462,483** | **$866,093,967** |
| Miles | 32 | 65 | 21.2 |
| Structures | 33 | 48 | 11 |
| Award | 8/16/2013 | 6/10/2015 | Feb 2016 |
| Original contract days | 1 628 | 1 486 | — |
| Current forecast days | 4 787 | 4 078 | complete Jan 2024 |
| Cost / mile (current) | $127.1 M | $58.6 M | $39.4 M |

**Per-structure cost is not published anywhere.** The finest published cost granularity inside the 119-mile segment is the construction package. Any finer weighting must be modelled and calibrated, not sourced.

Extension costs come from the 2026 Business Plan Table B.1 (`https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf`): Merced Extension $2 539 M + utilities $287 M + ROW $565 M; Bakersfield Extension $1 984 M + utilities $276 M + ROW $280 M (YOE $M, 2026 BP estimate).

### Sources checked and rejected

- **data.ca.gov** — CAHSRA is not a publishing organization (checked the full CKAN `organization_list`). The 24 hits for "high-speed rail" are third-party habitat/vegetation datasets.
- **OpenStreetMap** — the corridor is tagged `railway=proposed`, with no construction tagging and no linear referencing.
- **`ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/6` ("Alignment (Design Profile)", `Track_Supp` ∈ At-Grade/Elevated/Trench/Tunnel/Aerial/Embankment)** — attractive as a difficulty proxy but **unusable**: only 9 features totalling 207.5 mi, extending well past Bakersfield into the Tehachapi tunnels. Too coarse and wrong extent.
- **MapLibre `line-gradient`** — rejected, see Approach step 8.

---

## Approach

Steps 1–6 build the data pipeline; 7–12 build the UI. Steps 2, 3 and 4 are independent of each other once step 1 lands. Step 5 is independent of everything and may be done in parallel. Step 6's CVSR tier needs a manual PDF download between its two modes, so start it early. The tree builds and `npm run build` succeeds after every step.

### 1. Scaffold

```bash
npm create vite@latest . -- --template react-ts
```

Pin these (all verified current on npm this session):

```
vite@8.2.1  @vitejs/plugin-react@6.0.5  react@19.2.8  react-dom@19.2.8
typescript@5.9  maplibre-gl@6.2.0  d3-scale@4  @types/d3-scale
@turf/along@7.4.0  @turf/length@7.4.0  @turf/line-slice-along@7.4.0  @turf/nearest-point-on-line@7.4.0
tsx  (for running pipeline scripts)
```

**Pin `typescript@5.9`, not `latest`.** npm `latest` is now `typescript@7.0.2`, a different (native-port) compiler; the surrounding ecosystem still builds against 5.x. Vite 8 requires Node `^20.19.0 || >=22.12.0`.

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: '/hsr-dashboard/' });
```

Layout:
```
scripts/          pipeline, run with tsx, output committed
  fetch-arcgis.ts       raw layer dumps -> data/raw/
  build-centerline.ts   -> public/data/centerline.geojson + mileposts.json
  build-segments.ts     -> public/data/segments.json
  fetch-cvsr.ts         --manifest | --parse, data/raw/cvsr/
  build-history.ts      -> public/data/history.json
src/
  data/        ts1-alignment.ts (transcribed TS1 table), sources.ts (citation registry)
  lib/         mileposts.ts, status.ts, weights.ts
  components/  StripChart.tsx, AlignmentMap.tsx, TimeScrubber.tsx, Legend.tsx
public/data/   committed JSON artifacts
```

Do **not** fetch ArcGIS at runtime — the site is static, and baking the data makes `git log public/data/` the observed-history archive that the Wayback Machine does not provide (see step 6).
Fetch data in the app via `import.meta.env.BASE_URL + 'data/segments.json'`; a literal `/data/...` 404s under a GitHub Pages project sub-path.

### 2. Milepost axis and centerline — `scripts/build-centerline.ts`, `src/data/ts1-alignment.ts`, `src/data/sources.ts`

**The axis is the official TS1 milepost system, transcribed from source F — not derived from geometry.** Geometry is fitted *to* the axis, never the reverse.

**2a. Transcribe the TS1 table** into `src/data/ts1-alignment.ts` as a hand-checked constant — every row of the source-F table, verbatim. This file is data, not logic; no fetching, no parsing. Each row:

```ts
export type Ts1Segment = {
  section: 'Merced to Madera' | 'CVY' | 'CP1' | 'CP2-3' | 'CP4' | 'Poplar Ave to Bakersfield';
  name: string;          // e.g. 'Track Guideway Package 4'
  startSta: number;      // feet, e.g. 1103000
  endSta: number;        // feet, e.g. 1129998.90
  aheadSta: number | null; // equation point: station in the NEXT datum, e.g. 58730.67
  subdivision: 'C' | 'S' | 'D';
  startMp: number;       // e.g. 184
  endMp: number;         // e.g. 189
  lengthFt: number; lengthMi: number;  // as published, for assertion only
};
export const TS1_SEGMENTS: Ts1Segment[] = [ /* 24 IOS rows from source F */ ];
```

**2b. Build the continuous axis.** Define **`iosMile` = 0 at Merced (`C 124`)**, increasing south. Walk `TS1_SEGMENTS` in order accumulating `(endSta − startSta) / 5280`; at each equation point switch datum to `aheadSta`. This yields sub-foot precision while landing on the published integer mileposts at every anchor.

Two functions, both pure, both exported from `src/lib/mileposts.ts`:
```ts
export function stationToIosMile(section: Ts1Segment['section'], station: number): number;
export function iosMileToOfficialMp(iosMile: number): { subdivision: 'C'|'S'|'D'; mp: number };
```
`stationToIosMile` finds the TS1 row whose `[startSta, endSta]` brackets the station **within that section's datum** and interpolates linearly. If no row brackets it, return `NaN` and let the caller emit a `no-data` segment — **never extrapolate past a datum boundary.**

Assertions the script must make and fail on (all from source F):
- `stationToIosMile('CP1', 962039.57)` ≈ 34.0 and maps to `S 158`
- `stationToIosMile('CP2-3', 58730.67)` ≈ 65.0 and maps to `S 189`
- `stationToIosMile('CP4', 1476922.54)` ≈ 131.0 and maps to `S 255`
- `iosMileToOfficialMp(0)` = `C 124`; `iosMileToOfficialMp(171)` = `S 295` (Bakersfield station); axis ends at `iosMile` 175 = `D 299`
- per-section totals reproduce the published 33 / 32 / 65 / 21 / 23 within ±1 mi

**2c. Fetch the drawing geometry** from layer A with `returnM=true` (M is dropped by `f=geojson`; **must** use `f=json`). Vertices are `[lon, lat, m]` — **M is at index 2, not 3**, because `hasZ` is false. Indexing `v[3]` silently yields all-null.

Then, per section:
1. **Deduplicate `M2M`'s two paths by M** — path0 spans M 788 532–899 728, path1 spans 885 800–969 471; they are the two Central Valley Wye legs and overlap ~2.64 mi. Keep path0 whole, then only the part of path1 with `M > max(path0.M)`.
2. **Trim the `M2M`/`CP1` overlap** — they share a datum and CP1 starts at 962 039 while M2M ends at 969 471. Drop CP1 vertices with `M < max(M2M.M)`.
3. **Chain north→south** in the order `M2M, CP1, CP2-3, CP4, LGA`. Verified joint gaps for `CP1→CP2-3`, `CP2-3→CP4`, `CP4→LGA` are **0.000 mi** (vertex-identical seams); assert `< 0.01 mi` and throw otherwise. `M2M→CP1` has a ~0.5 mi joint — accept up to 1.0 mi there only.
4. **Attach `iosMile` to every vertex.** For CP1 and CP2-3 use the vertex's own M through `stationToIosMile` — exact. `CP4`, `LGA` and `M2M` carry null M, so distribute their vertices by cumulative geodesic fraction across that section's TS1 `iosMile` span, which pins both endpoints to the official value and only interpolates within.

Emit `public/data/centerline.geojson` (one `LineString`, WGS84) plus `public/data/mileposts.json` (parallel array of per-vertex `iosMile`).

Measured this session, for the step's acceptance assertions — geodesic length of the assembled geometry is **174.5 mi** against the document's **174**, a 0.3% agreement that validates both:

| Anchor | Official (source F/G) | Geodesic snap (measured) |
|---|---|---|
| Downtown Merced | `C 124` = iosMile 0 | 0.67 |
| Madera | — | 33.5 |
| Fresno – Mariposa | `S 194` = iosMile 70 | 59.0 |
| Bakersfield – F Street | `S 295` = iosMile 171 | 171.0 |
| Oswell St (TS1 POE) | `D 299` = iosMile 175 | 174.5 |

**The Fresno row is a real, unresolved discrepancy and must be surfaced, not hidden.** Source G puts Fresno station at `S 194`, i.e. iosMile 70; the station point from layer D snaps to geodesic mile 59. The most likely explanation is that the `S`-subdivision mileposts are not zero-based at CP Divide in the way a naive `MP − 124` implies (source F note 4 calls all mileposts approximate, and the `S 144.5` entry shows a half-mile offset at the very first Sierra row). **Decision: `iosMile` is defined by accumulated TS1 station distance (2b), which is exact; the printed `S`/`C`/`D` milepost is shown alongside as the published label.** Where the two disagree for a station marker, render the tick at the accumulated position and put both values in the tooltip. Do not "fix" either number.

Kings/Tulare station snaps 3.05 mi off the alignment — it is a station *site*, not on the built centerline. Render it as an off-alignment marker, not a milepost tick.

**2d. `src/data/sources.ts`** — the citation registry every UI figure links through:
```ts
export const SOURCES = {
  ts1_alignment: { title: 'TS1 3.0 – Alignment Segments and Lengths', date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20210921082559/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-3_TS1_3-0-Alignment_Segments_and_Lengths-2019-0501.pdf' },
  ts1_schematic: { /* … 2019-05-01 schematic, archived URL from source G … */ },
  arcgis_progress: { /* … BuildHSR_Guideways_Construction_Progress_view, with fetch date … */ },
  arcgis_alignment: { /* … HSR_Statewide_Alignment layer 1, with fetch date … */ },
  arcgis_structures: { /* … Closures_and_Detours_Public layer 0, with fetch date … */ },
  cvsr: { /* … per-snapshot: report month, data month, PDF URL … */ },
  business_plan_2026: { /* … Table B.1 … */ },
} as const;
```
Every numeric figure rendered anywhere in the UI carries a `sourceId` and renders a superscript link. A figure with no `sourceId` is a bug.

### 3. Project every progress feature onto the milepost axis — `scripts/build-segments.ts`

All three packages resolve **by station arithmetic through the TS1 table** — no spatial snapping is needed for any guideway or structure record, because layer B's stationing and TS1's stationing are the same numbers (verified exact on CP1 and CP2-3, and on CP4 via the `Limits` strings).

- **`CP2-3` (72 features).** `Station`/`StationEnd` → `stationToIosMile('CP2-3', …)`. Stationing tiles perfectly here (zero gaps, zero overlaps, station-delta matches geodesic length within 0.15 mi on 71/72 rows), so the output segments tile too.
- **`CP1` (27 features).** Same call with `'CP1'`. CP1 stationing has 9 discontinuities including a backwards jump (1 103 000 → 1 099 163) in the Fresno urban core. After conversion, sort by `iosMile` and: drop any feature whose station range runs backwards, and emit every remaining gap — including the genuine ~2.06 mi coverage hole at stations 1 048 373 → 1 059 250 — as an explicit `no-data` segment. **Never interpolate status across a hole.**
- **`CP4` (3 features).** `Station` is NULL, but the stationing is in the `Limits` text and matches TS1 exactly. Parse with `/(\d+)\+(\d+(?:\.\d+)?)\s*-\s*(\d+)\+(\d+(?:\.\d+)?)/` → feet = `group1 * 100 + group2`. The three rows yield `14769+22.54 – 15425+84`, `15436+68 – 15884+38.60`, and `"North Kern Incomplete Guideway"` which carries **no** stationing — emit that third row as spanning the residual gap between the other two (`15425+84 → 15436+68`) plus any CP4 remainder, flagged `stationing: 'inferred'`. **No spatial projection anywhere.**
- **`M2M` and `LGA`** have no progress features. Emit one segment each covering their full TS1 `iosMile` span with status `not_started` — factually correct: the Merced–Madera civil contract is in procurement with major construction anticipated late 2027–2030, and the Bakersfield extension has not been let.

Then overlay layer **C**'s 88 structure points. These are points with lat/lon and no stationing, so they *do* need `nearestPointOnLine` against the assembled centerline; read `properties.totalDistance` (**`properties.location` is deprecated as of turf 7.4**) and pass `{units: 'miles'}` explicitly — **all turf functions default to kilometres.** Convert the resulting geodesic distance to `iosMile` via the per-vertex milepost array from step 2, then attach `{name, status, projectPageURL}` to the containing segment. Build a name-alias table while doing so: the Authority's own naming drifts between editions (`Overhead` → `Overcrossing`, `Cesar Chavez Blvd Underpass` → `Ventura Ave Underpass`, `Road 26 Overhead` → `Road 26 Overcrossing`), and source G's corridor-ordered structure list is the reference for validating it.

Emit `public/data/segments.json`:

```ts
type Segment = {
  id: string;              // `${cp}:${objectId}`
  cp: 'M2M' | 'CP1' | 'CP2-3' | 'CP4' | 'LGA';
  kind: 'guideway' | 'structure' | 'no-data';
  label: string;           // from Limits, trimmed
  iosMileStart: number; iosMileEnd: number;   // official axis, step 2
  officialMpStart: string; officialMpEnd: string;  // e.g. 'S 189', for display
  stationStart: number | null; stationEnd: number | null;  // feet, as published
  stationing: 'published' | 'inferred';
  completion: number | null;   // 0..1, parsed from "NN%"
  baselineDirt: number | null; deliveredDirt: number | null;
  start: string | null; finish: string | null;   // ISO
  weight: number;          // step 5
  structures: { name: string; status: 'Completed' | 'In progress'; url: string }[];
};
```

Parsing rules to implement explicitly: `Completion` is a **string** — `parseInt` after stripping `%`, mapping `""`/`null` to `null` (**not** 0; a structure with no reported completion is unknown, not unstarted). `StructureType` must be `.trim()`ed before comparison because the source contains both `"Type 1"` and `"Type 1 "` (trailing space) as well as `"Type 1 Structure"`.

### 4. Status model — `src/lib/status.ts`

Seven ordered phases. The critical integrity constraint: **only two of these are published at alignment-resolved granularity.** ROW acquisition and utility relocation exist *only* as per-construction-package counts in the CVSR — they are not geolocated anywhere. Inventing a per-mile ROW status would be fabrication.

```ts
export const PHASES = [
  'row_acquired',      // CP-level only  (CVSR: parcels delivered)
  'utilities_relocated', // CP-level only (CVSR: utility relocations)
  'preconstruction',   // per-structure  (layer C: "In progress" on road/grade-separation projects)
  'under_construction',// per-segment    (layer B: 0% < Completion < 100%)
  'guideway_complete', // per-segment    (layer B: Completion === 100%)
  'track_laid',        // not yet started programme-wide
  'systems_installed', // not yet started programme-wide
] as const;
```

Rendering rule, decided:
- The **strip chart and map paint the three alignment-resolved phases** (`preconstruction`, `under_construction`, `guideway_complete`) plus `not_started` and `no_data`.
- `row_acquired` and `utilities_relocated` render as **two thin CP-wide summary bands above the strip chart**, each a per-package percentage from the CVSR — honest about their granularity, and never drawn as if they varied by milepost.
- `track_laid` and `systems_installed` are in the enum with legend entries shown as 0%. The Track & Systems contract was awarded June 2026 covering the 119 miles under construction, with installation phased as civil work completes; when per-segment data appears, it populates without a schema change.

Segment status derivation from layer B:
```
completion === null                        -> 'no_data'
completion === 0    && start && start<=now -> 'preconstruction'
completion === 0                           -> 'not_started'
0 < completion < 1                         -> 'under_construction'
completion === 1                           -> 'guideway_complete'
```

Legend colors (colorblind-safe, from ColorBrewer Dark2 + greys):
```
not_started #d9d9d9 · no_data #f0f0f0 (hatched) · preconstruction #e6ab02
under_construction #d95f02 · guideway_complete #1b9e77
track_laid #1f78b4 · systems_installed #6a3d9a
```

### 5. Difficulty weighting — `src/lib/weights.ts`

Every segment gets `weight`, a dimensionless "engineering effort" figure, used to drive the optional weighted x-axis.

**Provenance is load-bearing here and must be surfaced in the UI, not just in code.** Only part of this model is official. The split:

| Input | Provenance | Citation |
|---|---|---|
| `BaselineDirtQnty` / `DeliveredDirtQnty` (cu. yd. per guideway segment) | **OFFICIAL — CAHSRA published field.** Fields `BaselineDirtQnty`, `DeliveredDirtQnty` on the Authority's own `BuildHSR_Guideways_Construction_Progress_view` layer; present on 87/102 rows. Verified: for guideway rows `DeliveredDirtQnty / BaselineDirtQnty` reproduces the published `Completion` percentage exactly, so this ratio *is* the Authority's own measure of guideway progress. | `services3.arcgis.com/rGGp0aiv6Rf11t2H/.../BuildHSR_Guideways_Construction_Progress_view/FeatureServer/0` |
| Per-package contract values, contract days, Earned Value / SPI | **OFFICIAL — CVSR "Design-Build Contract Summary" and "Earned Value" pages.** | Central Valley Status Report, e.g. `https://hsr.ca.gov/wp-content/uploads/2026/04/FA-Central-Valley-Status-Report-April-2026.pdf` |
| Extension cost totals | **OFFICIAL — 2026 Business Plan Table B.1**, "Merced – Bakersfield Capital Cost Estimates (YOE $ in millions)". | `https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf` |
| **Structure type factors** (viaduct vs trench vs underpass) | **NOT OFFICIAL — author-defined heuristic.** No published CAHSRA, FRA, State Auditor or OIG methodology assigns relative difficulty weights to individual structures, and **per-structure cost is not published anywhere.** These six numbers are an editorial modelling choice. | none — must be labelled as such |

The one *officially used* progress-weighting methodology in this programme is **Earned Value Management**: the CVSR reports, per construction package, a Schedule Performance Index alongside Planned Value and Earned Value percentages (e.g. *"CP 1 – Earned Value: Schedule Performance Index 0.93, Planned Value 93.1%, Earned Value 86.2%"*). EVM is package-level only — it cannot place a weight on an individual viaduct — so it cannot drive the strip chart directly. Use it as the **calibration target and the published cross-check** (step 3 below), and cite it in the UI as the official measure.

Construction:
1. **Guideway segments — sourced.** `weight = BaselineDirtQnty` (cubic yards). Where null, fall back to `medianDirtPerMile(cp) × lengthMiles`.
2. **Structures — modelled.** No per-structure cost exists publicly, so score `weight = lengthMiles × typeFactor`:
   `viaduct 12 · trench 10 · tied-arch/river bridge 8 · bridge 6 · underpass/overcrossing/grade separation 4 · other 3`.
   Match case-insensitively against the `Limits`/`name` text (`Conejo Viaduct`, `Fresno Trench`, `Tied Arch (SR-43) Underpass`, `San Joaquin River Viaduct`, `Cairo Avenue Underpass` all appear verbatim in the data). Declare this table as a single exported `const STRUCTURE_TYPE_FACTORS` with a header comment stating in full that it is an unofficial heuristic with no published basis.
3. **Calibrate per package — against official figures.** Scale each package's structure weights by one factor so that `Σ structure weight / (Σ structure weight + Σ guideway weight)` reproduces that package's published cost split. Anchor on current contract amounts: CP1 $4 066.6 M / 32 mi / 33 structures; CP2-3 $3 808.5 M / 65 mi / 48 structures; CP4 $866.1 M / 21.2 mi / 11 structures. Emit the resulting calibration constants into `segments.json` so the model is auditable rather than hidden in code.
4. **Extensions.** `M2M` and `LGA` have no contract, so weight them from 2026 BP Table B.1 ($3 391 M and $2 540 M respectively — construction + utilities + ROW) spread uniformly over their length.
5. Normalize so `Σ weight = 1` and expose `weightShare` per segment. Percent-complete under the weighted axis is `Σ (weightShare × completion)`.

**UI requirement — do not omit.** When the weighted axis is active, the chart displays a persistent caption: *"Segment widths scaled by an unofficial difficulty model (earthwork quantities are official CAHSRA data; structure type factors are this dashboard's own estimate, calibrated to published per-package contract values). The Authority's own progress measures are miles of guideway and structure counts."* The distance axis stays the default on load so the headline numbers reconcile with the Authority's "81 of 119 miles" framing.

The strip chart's x-axis toggles between `mpStart/mpEnd` and cumulative `weightShare` — same `<rect>` components, one prop. This is the "fair representation" requirement: the Conejo and Hanford viaducts occupy far more width in weighted mode than their mileage.

### 6. Time replay — `scripts/build-history.ts`

There is no observed history in the API and none in the Wayback Machine, so the replay is assembled from three tiers, each labelled in the UI so the viewer knows what they are looking at.

- **Tier 1 — scheduled (retroactive, per-segment, 60 rows).** `Start`/`Finish` on layer B give each segment a planned build window spanning 2018-11 → 2026-07. Segment status at date *d* is a step function: `d < Start` → `not_started`; `Start ≤ d < Finish` → `under_construction`; `d ≥ Finish` → `guideway_complete`, then clamped so that no segment is shown further along than its *current* observed `Completion`. This is the only per-segment, per-milepost history available.
- **Tier 2 — observed aggregate (retroactive, per-package, monthly 2020→now).** Extract the CVSR Executive Summary numbers into `history.json` keyed by **data month** (parse `"Data Through {date}"` from page 1 — the report month lags data by ~2 months). Drives a per-package "miles complete / structures complete / utilities / ROW" line chart under the strip, and cross-checks tier 1.
- **Tier 3 — observed per-segment (forward-accumulating).** `npm run fetch` writes `public/data/segments.json`; committing it means `git log` becomes a real snapshot archive from day one. Add a scheduled GitHub Action (monthly, matching CVSR cadence) that re-runs the fetch and commits on diff. Build `history.json` by additionally walking `git log -p public/data/segments.json`, so tier 3 progressively replaces tier 1 as real observations accumulate.

`history.json` shape:
```ts
type Snapshot = { date: string; tier: 1 | 2 | 3;
  perSegment?: Record<string, { completion: number | null }>;
  perPackage?: Record<'CP1'|'CP2-3'|'CP4', {
    structuresComplete: number; structuresTotal: number;
    guidewayMilesComplete: number; guidewayMilesTotal: number;
    utilitiesRelocated: number; utilitiesTotal: number;
    parcelsDelivered: number; parcelsTotal: number; }>;
};
```

**CVSR acquisition is a two-part, human-in-the-loop flow. Do not automate around the bot protection.**

`scripts/fetch-cvsr.ts` runs in two modes:

- `--manifest` (default): builds `data/raw/cvsr/MANIFEST.md` — a checklist of every CVSR document to download, with its URL, report month and expected data month. Build it from the Authority's own index pages, which are the canonical browsable archive:
  - `https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/` (current year)
  - `https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/{YYYY}-finance-audit-committee-meetings/` — year pages exist for 2018 through 2025

  Try the WordPress media index first with a single plain, honestly-identifying `User-Agent` (e.g. `hsr-dashboard/1.0 (+github.com/<user>/hsr-dashboard)`) and no more than ~1 request/second:
  `https://hsr.ca.gov/wp-json/wp/v2/media?search=CVSR&per_page=100&orderby=date&order=asc&_fields=id,date,title,source_url,mime_type`, unioned with `search=Central+Valley+Status`. **If it returns a challenge page, stop — log it, and write the manifest with the two index-page URLs above plus the known URL patterns so the list can be assembled by hand.** Never retry with a spoofed fingerprint, a headless browser, or a proxy.
- `--parse`: reads whatever PDFs are present in `data/raw/cvsr/`, ignoring the network entirely. Filenames are irrelevant; each snapshot is keyed on the **data month** parsed from page 1 (`"Data Through {date}"` / `"data through {Month} {Year}"`), because the report month lags data by ~2 months.

Parsing: extract text, run anchored regexes against the Executive Summary lines quoted verbatim in the Data sources section, and cross-check each parse against the corresponding table page. Log and skip any month that fails rather than emitting a guess. Record the per-snapshot denominators (structures total, utilities total, parcels total) alongside the numerators — they drift between editions.

`npm run fetch:cvsr` prints the manifest path and the two index URLs on completion, so the download step is an explicit, visible handoff rather than a silent failure.

### 7. Page layout and linked interaction — `App.tsx`

Both views ship, vertically stacked in one scroll-free viewport, with the **strip chart as the primary view**:

```
┌───────────────────────────────────────────────────────────┐
│ header: date · miles complete/total · weighted % · structs │
├───────────────────────────────────────────────────────────┤
│ CP-level bands:  ROW parcels delivered | utilities reloc.  │  ~24px each
├───────────────────────────────────────────────────────────┤
│ STRIP CHART  (primary)                                     │  ~180px
│   milepost axis · station ticks · CP boundaries            │
├───────────────────────────────────────────────────────────┤
│ TimeScrubber  ─────────●───────  [play]  tier badge        │  ~56px
├───────────────────────────────────────────────────────────┤
│ MAP  (geographic context)                                  │  flex-grow
└───────────────────────────────────────────────────────────┘
  Legend + axis-mode toggle (distance ↔ difficulty) pinned right
```

Linked interaction, both directions — this is the reason for stacking rather than tabbing:
- Hovering a strip segment sets `hoveredId`; the map highlights that feature (`setFeatureState({hover:true})`, a wider casing line) **and** pans/eases to it only on click, never on hover.
- Hovering the map line sets the same `hoveredId`; the strip chart draws a vertical marker at that milepost and shows the same tooltip.
- A single `hoveredId` / `selectedId` pair lives in `App.tsx` state and is passed to both children. No context, no store.

The map is **not** the primary view because difficulty-weighted widths are imperceptible on a geographic line — the weighting idea only reads on the strip. The map exists so the viewer can recognize Fresno, the San Joaquin River crossing and the Kings County viaducts.

### 8. `AlignmentMap.tsx` — MapLibre

```ts
map.addSource('alignment', { type: 'geojson', data: segmentsFC, promoteId: 'id' });
map.addLayer({ id: 'alignment-status', type: 'line', source: 'alignment',
  layout: { 'line-cap': 'butt', 'line-join': 'round' },
  paint: {
    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 6],
    'line-color': ['match', ['feature-state', 'status'],
      'preconstruction', '#e6ab02', 'under_construction', '#d95f02',
      'guideway_complete', '#1b9e77', 'track_laid', '#1f78b4',
      'systems_installed', '#6a3d9a', 'not_started', '#d9d9d9', '#f0f0f0'] }});
```

Basemap: `https://tiles.openfreemap.org/styles/positron` — no API key, no account, no request limit, commercial use allowed; MapLibre injects the required `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` attribution automatically.

During replay call `map.setFeatureState({ source: 'alignment', id }, { status })` rather than `source.setData(...)`; `setData` re-parses and re-tiles the whole collection every frame.

**Do not use `line-gradient`.** Its data-driven styling is documented as "Not supported yet", it is a per-*layer* property that cannot read feature properties, and `['line-progress']` re-normalizes 0..1 independently for every feature — so hundreds of heterogeneous status sub-segments is precisely the case it cannot express. It also requires `lineMetrics: true`, which breaks `line-dasharray` scaling on that source. The `match`-on-`line-color` approach above is the supported path (DDS on `line-color` since 0.49.0).

### 9. `StripChart.tsx` — plain SVG + `d3-scale`

One `scaleLinear()` and one `<rect>` per segment:

```tsx
const x = scaleLinear().domain([0, totalMiles]).range([0, width]);
segments.map(s => <rect x={x(s.mpStart)} width={x(s.mpEnd) - x(s.mpStart)}
                        y={0} height={BAND} fill={COLORS[status[s.id]]} />)
```

Variable-width bars are the *default* here rather than a workaround — which is why this beats the alternatives: Recharts derives bar width from a band scale and would need custom `shape` renderers (plus it hard-depends on Redux); Observable Plot's `Plot.rect` with `x1`/`x2` channels does support it natively but renders a detached SVG imperatively and rebuilds the DOM on every date change. React owning the DOM keeps hover and scrub as ordinary state.

Includes: milepost axis ticks every 10 mi labelled with **both** `iosMile` and the official subdivision milepost (`0 / C 124` … `171 / S 295`), station markers, construction-package boundary rules, named-structure ticks, and a hover tooltip showing label, official station range, milepost range, completion %, weight share, source link and any structure names. Add the axis-mode toggle (distance ↔ difficulty weight) here.

### 10. `TimeScrubber.tsx` — no animation library

```tsx
const [date, setDate] = useState(LATEST);
const status = useMemo(() => deriveStatus(history, segments, date), [history, segments, date]);
```
`deriveStatus` is a linear scan over a few thousand pre-sorted events — sub-millisecond, so an `<input type="range">` scrubs at full frame rate unthrottled. Autoplay is a `requestAnimationFrame` loop advancing `date` one month per ~250 ms. **Do not tween colors**: construction status is a step function and interpolating it would misrepresent the data. Show the active tier badge (scheduled / observed) beside the date.

### 11. `Legend.tsx` and the summary header

Legend entries use the Authority's own definitions as tooltips (quoted verbatim in the Data sources section) so the dashboard's vocabulary matches official reporting. Header shows, for the scrubbed date: miles complete / total, weighted percent complete, structures complete / total, and — as separate CP-level bands — ROW parcels delivered and utilities relocated. **Every figure renders a superscript citation link resolved through `src/data/sources.ts`**, and the page carries a "Sources" footer listing all of them with publisher, document title and date.

### 12. Static deploy

GitHub Actions workflow: `npm ci && npm run build`, then `actions/deploy-pages` on `dist/`. Repository Settings → Pages → Source → GitHub Actions. A second scheduled workflow (monthly) runs `npm run fetch` and commits any diff to `public/data/`, which is what accumulates tier-3 history.

---

## Critical files & anchors

| File | Anchor | Why |
|---|---|---|
| `src/data/ts1-alignment.ts` | the transcribed TS1 table | The canonical milepost authority. A single mistyped station corrupts every downstream position, and it cannot be re-derived from the API — check it row-by-row against the archived PDF. |
| `scripts/build-centerline.ts` | M-dedup of `M2M` paths; `v[2]` M index | Both are silent-failure traps: M lives at vertex index 2 (`hasZ` false), and the two `M2M` wye legs overlap 2.64 mi. Getting either wrong corrupts the drawn geometry. |
| `scripts/build-segments.ts` | the three per-package station branches | CP2-3 and CP1 read `Station`/`StationEnd` directly; CP4 must parse stationing out of the `Limits` text. All three go through `stationToIosMile` — if any branch falls back to spatial snapping, the CP1 Fresno-core features land in the wrong place. |
| `src/lib/weights.ts` | `typeFactor` table + per-package calibration | The only modelled (non-sourced) numbers in the project. Keep them in one file with the published contract values in comments so the model is auditable. |
| `src/lib/status.ts` | `PHASES` + the CP-level vs segment-level split | Encodes the integrity rule that ROW and utilities are never painted per-milepost. |
| `scripts/fetch-cvsr.ts` | two-mode `--manifest` / `--parse` split | The only non-ArcGIS source and the only PDF parser. The split exists so no code path is ever tempted to work around the site's bot protection. |
| `src/App.tsx` | shared `hoveredId`/`selectedId` state | The only coupling between strip chart and map; keeping it as two plain props is what avoids a store. |

---

## Verification

Run from the repo root.

**1. Pipeline correctness (exercises the new milepost math):**
```bash
npm run fetch && npx tsx scripts/build-centerline.ts
```
Assert, and fail the script if violated:
- transcribed `TS1_SEGMENTS` per-section totals reproduce the published 33 / 32 / 65 / 21 / 23 miles within ±1
- `iosMileToOfficialMp(0)` = `C 124`, `(171)` = `S 295`, axis ends at 175 = `D 299`
- `stationToIosMile('CP2-3', 58730.67)` maps to `S 189`; `stationToIosMile('CP4', 1476922.54)` maps to `S 255`
- assembled geodesic geometry length `174.0 < L < 175.5` miles (document says 174)
- Bakersfield F Street point snaps to geodesic `170.5 < mi < 171.5`; Downtown Merced to `< 1.0`
- every inter-section joint gap `< 0.01` mi for `CP1→CP2-3`, `CP2-3→CP4`, `CP4→LGA`

**2. Segment projection (exercises the three-branch join):**
```bash
npx tsx scripts/build-segments.ts
```
Assert: 102 input features in, ≥102 segments out (extras are `no-data` gap fillers); CP2-3's 72 segments tile with zero gaps and zero overlaps; CP1 emits exactly the expected `no-data` holes including the ~2.06 mi one; total guideway mileage across CP1+CP2-3+CP4 is `118.0 < m < 119.5`.

**3. Cross-check against the Authority's published numbers (the real end-to-end proof):**
Sum `guideway_complete` mileage from `segments.json` per package and compare with the April 2026 CVSR: CP1 11 mi, CP2-3 49 mi, CP4 21.1 mi, total 81 of 119. Agreement within ~3 mi validates the whole chain — centerline, projection, and status derivation — against an independent official figure. A larger divergence means the milepost projection is wrong; investigate before proceeding. Note the layer-B snapshot is dated 2026-05-04 while the CVSR figure is Feb-2026 data, so expect the dashboard to read slightly *ahead*.

**4. Structure count cross-check:** `segments.json` should carry 59 `Completed` + 29 `In progress` named structures from layer C. Compare with buildhsr.com's "Construction by the Numbers" (61 complete / 27 underway as of June 2026) — small differences are expected from the differing as-of dates; a difference >5 means the point-to-segment snap is dropping structures.

**5. UI smoke test (manual, exercises the new behavior):**
```bash
npm run dev   # http://localhost:5173/hsr-dashboard/
```
- Strip chart renders a continuous band from iosMile 0 to 175 with no unexplained white gaps outside the known CP1 holes, and the axis is labelled with both `iosMile` and official mileposts.
- Hovering the CP2-3 segment at station 148 256–148 574 shows `Cole Slough Bridge`, and 150 297–150 336 shows `Access Road Underpass`; both tooltips print the official station range and an `S`-subdivision milepost.
- Scrubbing the date to **2019-01** shows nearly the entire alignment `not_started`; to **2026-06** shows CP4 fully `guideway_complete` and CP1 substantially `under_construction`. CP4 completing before CP1 is correct — CP4 achieved substantial completion Jan 2024, CP1 forecasts Nov 2026.
- Toggling to difficulty-weighted width visibly widens the Conejo Viaduct, Hanford Viaduct, Fresno Trench and San Joaquin River Viaduct relative to flat guideway, and the header's weighted percent-complete differs from the mileage percent.
- Map and strip chart show the same colors for the same milepost, and the map is centered on the Central Valley with the OpenFreeMap attribution visible.

**6. Deploy check:** `npm run build && npx vite preview --base /hsr-dashboard/` — confirm `public/data/*.json` loads through `import.meta.env.BASE_URL` (a `/data/...` 404 here is the sub-path bug).

**7. Provenance and citation check (required before shipping — this is the investigative-standard gate):**
- Switch to the difficulty axis and confirm the unofficial-model caption from step 5 is visible on screen, and that `src/lib/weights.ts` carries the "not official" header comment on `STRUCTURE_TYPE_FACTORS`.
- Confirm the legend tooltips quote the Authority's verbatim definitions of *Structure Completion* and *Guideway Completion*.
- Walk every numeric figure rendered on the page — header counts, axis labels, tooltip fields, CP-level bands — and confirm each carries a superscript link that resolves to a live document or layer URL in `src/data/sources.ts`. **A figure with no citation is a defect, not a cosmetic issue.**
- Confirm the Sources footer lists TS1 3.0 (2019-05-01), TS1 2.1 schematic, the three ArcGIS layers with their fetch dates, every CVSR edition actually parsed, and the 2026 Business Plan — each with publisher, title and date.
- Spot-check three transcribed `TS1_SEGMENTS` rows character-by-character against the archived PDF; a transcription error here is invisible downstream.

**8. CVSR flow check:** `npm run fetch:cvsr` must terminate cleanly whether or not the index request succeeds, printing the manifest path and the F&A index URLs. Then, with PDFs placed in `data/raw/cvsr/`, `npx tsx scripts/fetch-cvsr.ts --parse` must make **zero** network requests and must emit one snapshot per successfully-parsed data month, skipping and logging the rest. Verify the April 2026 report parses to CP1 22/CP2-3 25/CP4 11 structures complete and 81 total guideway miles.

---

## Assumptions & contingencies

- **The milepost axis is the official TS1 station-accumulated axis, not a geodesic derivation.** `iosMile` 0 = Merced `C 124`; 171 = Bakersfield station `S 295`; 175 = Oswell St `D 299`. The published "171 miles" is reproduced exactly by this construction rather than being an approximation to reconcile. The source table is a **2019 industry draft** and its note 4 states *"All alignment lengths and mileposts are approximate"*; the alignment has since changed slightly (CP1 gained a north extension). If a newer public alignment-segments table appears, replace `src/data/ts1-alignment.ts` and re-run — nothing else changes, which is why the table is isolated in one data file.
- **Fresno's published milepost (`S 194`) and its geodesic snap (mile 59) disagree by ~11 miles and this is left visible.** Both values are shown in the station tooltip. Do not reconcile them by shifting the axis; if a newer TS1 revision resolves it, update `ts1-alignment.ts` only.
- **ROW and utility status are rendered as CP-level bands, never per-milepost**, because no geolocated parcel or utility dataset is published (the Authority directs such requests to a Public Records Act filing). *If* a geolocated parcel layer surfaces later, it slots into the existing `PHASES` enum with no schema change.
- **Structure difficulty factors are this dashboard's own estimate, not an official or audited methodology.** Per-structure cost is not published by CAHSRA, FRA, the State Auditor or the OIG, and no published source ranks structures by difficulty. The factors are calibrated against official per-package contract values so the aggregate reconciles, and the UI says so on screen. The programme's own weighting method is package-level Earned Value / SPI, reported in the CVSR — it cannot weight an individual viaduct, which is why the model exists at all. If you disagree with the factor table, it is six numbers in one file. If calibration produces a structure share above ~70% for any package, the factors are too aggressive — clamp and re-normalize.
- **Historical replay before "today" is schedule-derived, not observed**, because no snapshot archive exists (verified: zero Wayback captures of the ArcGIS org). The UI labels which tier is active. Tier 3 begins accumulating from the first commit.
- **The ArcGIS layers are `Query`-only and could be withdrawn or re-schema'd without notice** (`Guideway_Structures_ConstructionProgress` was last edited 2026-05-04). `data/raw/` caches every response, so a pipeline run always has a fallback; if a layer disappears, the dashboard keeps rendering the last committed snapshot.
- **If the CVSR PDFs are never placed in `data/raw/cvsr/`**, `--parse` emits an empty tier-2 series and the aggregate chart hides itself. Tiers 1 and 3 are unaffected — tier 2 is a cross-check and a per-package overlay, never a dependency of the map or strip chart. Do not block the release on it, and do not attempt to fetch the PDFs by defeating the site's bot protection.
