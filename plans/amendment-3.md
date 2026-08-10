# HSR dashboard — closing the remaining "no data" and "not reported" surfaces

## Context

Six spans on the strip render as hatched `no-data`, 33 segments report "Earthwork at selected date — not reported", and the CVSR disclosure lists 22 typed metric gaps. This plan establishes, per surface, whether the value is genuinely unpublished or merely unread, and corrects the ones that are unread.

The central finding is that the Authority changed the CVSR format in June 2026. The two newest reports publish **per-row percent complete for every structure and every guideway row**, in tables whose row names are — for CP2-3 guideway — byte-identical to the ArcGIS `Limits` strings the dashboard already keys on. That source resolves all four unresolved structure slivers, fills all 33 "not reported" earthwork values, corrects a four-year-stale status, and covers the 1.97-mile CP1 hole. The pipeline does not read it at all.

Two further defects are geometric and presentational, not evidentiary: sub-pixel rows are inflated 3.3× by a minimum-width clamp, and named projects fall back to spatial attachment in exactly the places where the rule forbids it.

End state: the strip hatches only what no source publishes; every structure carries a published percentage with a resolvable citation; the ArcGIS/CVSR disagreements are visible rather than silently resolved in ArcGIS's favour; the remaining gaps are typed with the precise reason and the precise report that first publishes the metric.

## Inventory — what is unknown on screen today

Observed live against `npm run dev` at the default date (`2026-08-10`), plus `public/data/segments.json` and `public/data/history.json`.

### A. Hatched `no-data` spans — 6 rows, 2.407 mi

| Segment | ios mi | Length | Why |
|---|---|---|---|
| `CP1:gap:0` | 34.000–34.388 | 2,050 ft | No ArcGIS row; TS1/ArcGIS datum offset |
| `CP1:195` Herndon HST | 50.230–50.255 | 133 ft | ArcGIS `Completion` is `<Null>`; no crosswalk, no evidence |
| `CP1:gap:1` | 50.255–52.221 | 10,380 ft | ArcGIS publishes no guideway row for stations 1048373.25–1059250 |
| `CP1:197` Fresno Street Underpass | 59.249–59.267 | 96 ft | `<Null>`; no crosswalk, no evidence |
| `CP2-3:114` Access Road Underpass | 83.230–83.238 | 40 ft | `<Null>`; no crosswalk, no evidence |
| `CP2-3:138` AAAT Underpass | 126.650–126.652 | 10 ft | `<Null>`; no crosswalk, no evidence |

In historical replay the hatched set is far larger: 30 rows / 12.65 mi at `2024-01-01`, because tier-3 snapshots exist only for `2026-08-09` and `2026-08-10`.

### B. "Earthwork at selected date — not reported"

33 segments at today's date: every `kind: 'structure'` row except `CP1:192` Fresno Trench and `CP1:189` Jensen Trench, plus the two CP1 gaps. The ArcGIS progress layer publishes `Completion` for guideway rows and `<Null>` for `Type 1 Structure` rows — 23 of 23 in CP2-3, 11 of 13 in CP1. At any date before `2026-08-09` the field reads "not reported" for **all 106** segments, because `selectedCompletions` returns `null` when no tier-3 snapshot covers the date.

### C. CVSR inventory gaps — 22 entries

| Metric | Months | Declared cause |
|---|---|---|
| `utilities` | 2019-03 → 2020-07 (17) | `source_not_reported` |
| `parcels` | 2019-09 → 2020-01 (5) | `source_not_reported` |
The `parcels` entries are not source gaps. They are **schema gaps created by the dashboard**: each report publishes acquired/needed/remaining parcels, while the existing `PackageMetrics` schema has room only for delivered/total. The disclosure's cause label is therefore false.


---

## Findings this plan acts on

| # | Finding | Evidence |
|---|---|---|
| G1 | **The CVSR now publishes per-row percent complete, and the pipeline ignores it.** `FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf` (data 2026-04) carries `CP 1 / CP 2-3 – Construction Progress` pages with `Structures - Underway`, `Structures - Completed`, `Guideways - Underway`, `Guideways - Completed` tables, columns `Location / Start / Finish / Complete % / Monthly Progress %` | 153 rows extracted. All **35** ArcGIS structure rows resolve; **49 of 67** guideway rows resolve; all 39 CP2-3 guideway rows match the ArcGIS `Limits` string **verbatim** (`Cole Slough to Access Road`, `Ave 56 to AAAT`, `AAAT to Ave 24`, …). Corpus scan: only the June-2026 (data 2026-03) and June-24-2026 (data 2026-04) reports carry these tables; all 104 earlier PDFs have zero matches |
| G2 | **All four unresolved structure slivers are published.** | 2026-04: `Herndon HST Bridge Aug-26 Feb-27 0% –`; `Fresno Underpass Apr-26 Feb-27 0% –`; `Access Road Jun-20 Jun-26 7% –`; `AAAT1 Jun-23 Aug-24 96%` under *Structures - Completed* with footnote `1. Substantially completed structures may not show as 100% complete if minor closeout items remain, but are treated as completed for project reporting purposes.` |
| G3 | **`CP1:184` Golden State Boulevard Viaduct is four years stale.** Rendered "Under construction" from `golden-state-progress-2020-08` (`structure-evidence.ts:126`) | 2026-04 *CP 1 Structures - Completed*: `Golden State Blvd Jan-20 Apr-22 100%`. 2026-03 lists the same row with `Open` in the Complete column (`Golden State Blvd Jan-20 Apr-22 Open`) |
| G4 | **"Golden State Boulevard Realignment" is a different project and is attached by the forbidden method.** Closures-layer `OBJECTID 20`, GlobalID `938432eb-f888-4450-ab52-e9a6b2141a4a`, status `In progress`, `On Golden State Boulevard between Herndon and Ashlan avenues` — a roadway realignment, not the CP1 viaduct at ios 62.3 | It lands on `CP1:gap:1` via `locationMethod: 'spatial'` (`build-segments.ts:314-333`), contradicting README *"Named-project attachment uses reviewed stable identifiers; spatial proximity alone is insufficient"*. buildhsr.com: *"The new alignment of Golden State Boulevard will be constructed west of the existing road. The future high-speed rail line will then be constructed between the new roadway and existing Union Pacific rail line. Construction … began south of Herndon Avenue in June 2017."* |
| G5 | **`CP1:gap:1` is 0%, not unknown.** | 2026-04 *CP 1 Guideways - Underway*: `Viaduct 203 at SJR to Herndon Canal Feb-27 Jun-27 0% –` and `Herndon Canal to Swift Ave Jun-26 Sep-26 0% –`; *CP 1 Structures - Underway*: `Herndon UPRR Bridge Jul-26 Jan-27 0% –`, `Herndon HST Bridge Aug-26 Feb-27 0% –`. CPUC GO-88 filing `XREQ20250900012_HerndonAve_Fresno_HSR`: *"Construct two rail bridge structures: one 43-foot wide rail bridge structure with two CHSRA tracks and one 100-foot wide rail bridge structure with one UPRR track, along with a 139-foot wide roadway below the tracks"* — the ArcGIS `Herndon HST` row is exactly 139.00 ft (station 1048234.25→1048373.25) |
| G6 | **`CP1:gap:0` is a datum artifact, not missing progress.** | TS1 3.0 puts the CVY→CP1 equation at station `962039.57` (MP S 158, `ts1-alignment.ts:34-35`); the first ArcGIS CP1 row `North Extension Guideway` starts at `964055`. Difference 2,015.43 ft = 0.382 mi. No ArcGIS row exists in between; the CVSR names `N1A Boundary to Viaduct 501` and `GW North Extension` but publishes no stationing |
| G7 | **Sub-pixel rows are inflated 3.3×, which is what produces the apparent "rounding-error gap".** `StripChart.tsx:151` `width={Math.max(0.75, end - x)}` | At the live scale (6.583 px/mi, measured from the rendered DOM) 0.75 px = **602 ft**. 24 rows are below that: 4,416 ft of true corridor drawn as 14,437 ft. The 10-ft AAAT underpass is drawn **60× oversize** and, being painted after its neighbours, overwrites the head of `AAAT to Ave 24` — two rows the CVSR reports at 100% each |
| G8 | **Veterans Boulevard is not CAHSRA scope but is listed as a named structure of the segment.** Closures-layer `OBJECTID 51`, GlobalID `84e93d1f-9100-4fff-8e61-f3bfec1425ab`, attached to `CP1:gap:1` by spatial fallback | measurec.com: *"Veterans Boulevard is a new 2.3-mile arterial surface highway … The Veterans Boulevard interchange at California State Route 99 opened to traffic on November 20, 2023. The project includes grade separations over Union Pacific Railroad, High-Speed Rail line, and Golden State Boulevard."* — a Fresno County Measure C project |
| G9 | **ArcGIS and the CVSR disagree on six rows; only ArcGIS is shown.** | `CP2-3:113 SR 43 Curved Br to Corcoran HWY` ArcGIS 66% / CVSR 2026-03 66% / CVSR 2026-04 **7%**; `CP2-3:156 Houston Ave to Idaho Ave` 98 / 98 / **83**; `CP2-3:122 SR 43 Tule River to Ave 136` 52 / 22 / 58; `CP2-3:162 Ave 24 to Project Finish` 85 / 95 / 95; `CP1:192 Fresno Trench` ArcGIS 56% vs CVSR **79%**; `CP1:189 Jensen Trench` ArcGIS 0% (rendered *Preconstruction*) vs CVSR structure **37%** / guideway **48%** |
| G10 | **Replay hatches rows that have a published completion.** `status.ts:71-72` returns `no_data` whenever `start` or `finish` is null and `completion !== 0` | `CP1:181/196/188/200/177` (`Guideway - 02/04/05/07/08`, 7.92 mi, ArcGIS 68/82/93/80/78%) are hatched for all 92 replay months that lack a tier-3 snapshot |
| G11 | **The five "parcels" gap months all publish a full parcel table; the dashboard says "Not published in source".** | `brdmtg_111919` (2019-09), `brdmtg_121019` (2019-10), `brdmtg_011420` (2019-11), `brdmtg_021820` (2019-12) each carry a text-extractable `CP 1-4 – ROW Parcels to be Acquired and Remaining` slide; `brdmtg_031720` (2020-01) carries `CP 1-4 ROW Parcel Acquisition Summary`. Corpus scan confirms those five headings occur nowhere else in 2019–2020. What is absent is only the **delivered-to-DB** measure, which the Authority states it began tracking in the 2020-02 report: *"Parcels that have been acquired, but not yet delivered to the Design-Builder (DB) are now accounted for in this report and will be included in future reports."* That report publishes both, and they differ: acquired CP1 828 / CP2-3 604 / CP4 160 versus delivered 824 / 587 / 159 |
| G12 | **The 2019-08 transcription's *value* is right; its *provenance note* and its hand-entry are wrong.** `LEGACY_PARCELS['brdmtg_101519_…']` = CP1 `827/932`, CP2-3 `547/854`, CP4 `166/223`, annotated *"the published value is a chart image in the source PDF and is not extractable as text"* | That report has no chart; page 6 (rendered to PNG and read) is a plain table. Every figure is derivable from it: CP1 `839 excl-RR + 93 additional in August = 932`, `932 − 105 remaining as of Aug 30 = 827`; CP2-3 `714 + 140 = 854`, `854 − 307 = 547`; CP4 `210 + 13 = 223`, `223 − 57 = 166`. The column is literally `Total Delivered to date excluding railroads`, so 2019-08 is on-series. Two real defects: the "chart image" claim is false, and a parsable table is hand-entered. One source wart to record: CP4's base is the total *including* railroads (166 + 44 = 210), where CP1 and CP2-3 use the excluding-railroads total |
| G13 | **The utilities gap is genuine.** | No package-level utility counts appear before the 2020-08-data report, which publishes them as narrative: *"Relocated: 202 (17%); In Progress: 428 (36%); Scheduled: 10 (1%); Not Started: 562 (47%); Total: 1,202."* Earlier reports carry only third-party agreement schedules and target milestones (`04. CP 1 Utility Relocation Complete Mar-21`) |
| G14 | **Railroad ROW parcels are published separately and shown nowhere.** The CP2-3 band reads `985 / 985`, i.e. complete | 2026-04 `CP 2-3 – Real Property/Right-of-Way (ROW) Railroad … CP 2-3 58 55 3` — 3 railroad parcels outstanding. CP4 summary likewise lists `Railroad Parcels 0 / 29 (100%) / 29`. The 2020-01 report already carries `CP 1-4 ROW Railroad Parcels to be Acquired and Remaining … CP 1 95 52 43` |

---

## Approach

Steps 1–2 are the new source and its reviewed crosswalk; 3–6 consume it in the pipeline; 7–8 are UI; 9 is the CVSR inventory correction; 10 is documentation. Steps 1, 8 and 9 are independent of each other. `npm test`, `npm run lint` and `npm run build` must pass after each step.

### 1. Parse the per-row CVSR progress tables (G1)

**`scripts/lib/cvsr-parser.ts`** — add, exported:

```ts
export type CvsrRowKind = 'structure' | 'guideway';
export type CvsrRowTable = 'underway' | 'completed';
export type CvsrRowProgress = {
  cp: CvsrPackage;
  kind: CvsrRowKind;
  table: CvsrRowTable;
  location: string;          // verbatim, footnote marker stripped
  footnote: 'substantially_complete' | 'partially_open' | null;
  start: string;             // 'YYYY-MM'
  finish: string;            // 'YYYY-MM'
  completion: number | null; // null only for the literal 'Open'
  monthlyProgress: number | null;
};
export function parseRowProgress(text: string): CvsrRowProgress[];
```

Section bounds: from each `CP\s*(1|2[-–]3|4)\s*[–—-]\s*Construction Progress` heading, the following line names the table — `Structures - Underway`, `Structures - Completed`, `Guideways - Underway`, `Guideways - Completed`, each optionally followed by `(cont'd)`. A section ends at the next `Report Notes`, `Footnotes`, or `-- N of M --` marker. One page in the 2026-04 report carries `Structures - Completed (cont'd)` **without** the `CP 2-3 – Construction Progress` heading; the parser must carry the current package across a bare `(cont'd)` heading.

Row grammar, applied line by line inside a section:

```
^(?<location>\S.*?)\s+(?<start>[A-Z][a-z]{2}-\d{2})\s+(?<finish>[A-Z][a-z]{2}-\d{2})\s+(?<pct>\d+(?:\.\d+)?%|Open)(?:\s+(?<monthly>\d+(?:\.\d+)?%|[\u2013-]))?$
```

Layout facts the grammar must survive, all observed in the two reports:

- The `Complete %` column carries decimals (`Kings River to Dover Ave Sep-20 May-26 98.0% 0%`).
- Missing monthly progress is `–` (U+2013) in the 2026-04 report and `-` (U+002D) in the 2026-03 report.
- Completed tables have no monthly column at all (`South Ave Mar-19 Feb-22 100%`).
- The 2026-03 report uses the literal `Open` where 2026-04 uses `100%` (`Golden State Blvd Jan-20 Apr-22 Open`).
- The column-header line (`Location Start Finish Complete %`) appears **after** the data rows, together with the Gantt quarter labels (`2026 2027`, `Q1 Q2 Q3 Q4 …`), the legend (`■ Not Started ■ Completed ■ Underway`) and the summary tile digits. None of those lines match the row grammar; assert that by counting rejected lines rather than assuming it.
- The heading line ends in a run of `#` glyphs (`Structures - Underway # # # # …`); strip it.

Footnote markers are glued (`AAAT1`, `Ave 241`, `Ave 1561`, `Lansing1`, `Cross Creek1`, `SR 43 Jersey1`, `Excelsior Ave1`) or space-separated (`Belmont Avenue 1`). `Ave 241` is *Avenue 24, footnote 1* — **not** Avenue 241. A regex cannot tell those apart. Use a reviewed per-report set:

```ts
const FOOTNOTED_ROWS: Readonly<Record<string, readonly string[]>> = {
  'FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf': [
    'Excelsior Ave1', 'AAAT1', 'Ave 241', 'Ave 1561', 'Lansing1', 'Cross Creek1', 'SR 43 Jersey1', 'Belmont Avenue 1',
  ],
};
```

The 2026-03 report carries no markers (`AAAT Jun-23 Aug-24 96% –`), so its set is empty. Footnote 1 means different things per package and must be recorded per package, not globally: CP1 *"Partially Open structures that are avaialbe for limited or partial use, but may still have remaining work, access restrictions, or closeout activites pending"* (sic — quote the source verbatim, typos included); CP2-3 *"Substantially completed structures may not show as 100% complete if minor closeout items remain, but are treated as completed for project reporting purposes."*

Strictness: a report whose text contains `– Construction Progress` but yields zero rows is a parse failure and is recorded in `diagnostics` (the existing mechanism). A report without the heading yields `[]` and is **not** a failure — 104 of 106 local PDFs are in that state.

Also parse the summary tiles (`Total Structures / Structures Complete / Structures Underway / Structures Not Started`) and cross-check them against the row counts: `completed rows == Structures Complete` and `underway rows == Structures Underway` for CP1 and CP2-3 in both months. Throw on mismatch. **Not-Started rows are never listed by name**, only counted — the tables are complete for underway and completed work and silent otherwise.

**`scripts/lib/cvsr-parser.test.ts`** — add fixtures for: the decimal percent, both dash variants, the `Open` value, a `(cont'd)` page with no package heading, `Ave 241` resolving to `Ave 24` + footnote, and a header line that must be rejected.

### 2. Reviewed row crosswalk (G1, G2)

New **`src/data/cvsr-row-crosswalk.ts`**, alongside `structure-evidence.ts` and following the same rule — reviewed identifiers, never name similarity at runtime:

```ts
/** Reviewed CVSR row `Location` → ArcGIS progress segment id. */
export const CVSR_ROW_CROSSWALK: Readonly<Record<string, string>> = { … };
```

Two classes of entry:

- **Guideway, 49 rows.** The CVSR `Location` equals the ArcGIS `Limits` verbatim for every CP2-3 guideway row. Do not hand-list these; resolve by exact label match and assert the count is 49. Any drop is a source change and must throw.
- **Structure, 35 rows.** Hand-mapped, because the CVSR uses short names. The complete set:

  | CVSR row | Segment | | CVSR row | Segment |
  |---|---|---|---|---|
  | `Fresno River Viaduct 501` | `CP1:187` | | `Access Road` | `CP2-3:114` |
  | `Cottonwood Creek` | `CP1:174` | | `Lakeland Bridge` | `CP2-3:150` |
  | `South of Pergola Viaduct` | `CP1:176` | | `Dutch John Cut` | `CP2-3:137` |
  | `Herndon HST Bridge` | `CP1:195` | | `Alpaugh Bridge` | `CP2-3:110` |
  | `Fresno Underpass` | `CP1:197` | | `Grangeville Ave` | `CP2-3:118` |
  | `Tulare Underpass` | `CP1:190` | | `Stoil Spur` | `CP2-3:127` |
  | `Ventura Underpass` | `CP1:183` | | `SR 43 Tied Arch` | `CP2-3:123` |
  | `Golden State Blvd` | `CP1:184` | | `9th Ave` | `CP2-3:143` |
  | `HST Fresno Viaduct` | `CP1:178` | | `Cairo Ave` | `CP2-3:112` |
  | `Muscat Ave` | `CP1:199` | | `Peach Ave` | `CP2-3:119` |
  | `Fresno Trench` | `CP1:192` | | `AAAT` | `CP2-3:138` |
  | `Jensen Trench` | `CP1:189` | | `Ave 24` | `CP2-3:169` |
  | `Conejo Ave` | `CP2-3:129` | | `Whitley Ave` | `CP2-3:139` |
  | `Kings River` | `CP2-3:160` | | `Ave 156` | `CP2-3:144` |
  | `Hanford Viaduct` | `CP2-3:128` | | `Lansing` | `CP2-3:132` |
  | `Ave 136` | `CP2-3:151` | | `Cross Creek` | `CP2-3:130` |
  | `Deer Creek` | `CP2-3:170` | | `SR 43 Tule River` | `CP2-3:131` |
  | `Cole Slough` | `CP2-3:117` | | | |

  `Golden State Blvd → CP1:184` is the one entry that needs a human sign-off before merge. The supporting evidence: it is the only Golden State row in the CP1 structures list; the ArcGIS row `Golden State Boulevard Viaduct` (station 1115180.46–1115600.46, 411 ft, ios 62.26) sits at the north end of the Cedar Viaduct, whose ArcGIS description reads *"From Golden State Boulevard to west of State Route 99 in south Fresno"*; and the existing 2020-08 CVSR quote for that segment (*"Poured Abutment 5 walls, columns and flare caps for Bents 2, 3 and 4"*) falls inside the published `Jan-20 → Apr-22` window. It is a **different** project from the Closures-layer `Golden State Boulevard Realignment` at Herndon–Ashlan (G4).

`build-segments.ts` validation, throwing on failure:

- Every crosswalk key resolves to exactly one CVSR row in the latest report and exactly one segment.
- Every `kind: 'structure'` segment (35) has a crosswalk entry. This is the invariant that keeps the "not reported" surface closed as the layer changes.
- CVSR rows with no counterpart (68 in 2026-04, mostly CP1 grade separations and the CP1 guideway decomposition) are recorded in the artifact as `unmatchedCvsrRows`, not silently dropped.

### 3. Segment-level tier-2 observations (G1, G2, G3, G9)

**`src/data/types.ts`** — `Snapshot` gains a tier-2 per-segment payload. Keep the tier separation intact: `perSegment` entries carry their own `sourceId`, so a CVSR observation is never confusable with an ArcGIS one.

```ts
type SegmentObservation = {
  completion: number | null;
  sourceId: 'arcgis_progress' | 'cvsr';
  reportFile?: string;   // CVSR only
  scheduleStart?: string;
  scheduleFinish?: string;
};
```

**`scripts/fetch-cvsr.ts`** — for each report yielding rows, attach `perSegment` to that month's tier-2 snapshot, keyed through `CVSR_ROW_CROSSWALK`. This produces tier-2 per-segment observations for `2026-03` and `2026-04` only.

**`src/lib/status.ts`** — `deriveStatuses` currently reads only tier 3. Change the observation lookup to *the latest snapshot at or before the selected date that has an entry for this segment*, regardless of tier, and keep the entry's `sourceId` for display. Precedence within a date stays: numeric observation → dated evidence → scheduled. A row from the *Completed* table whose `completion` is `null` (the 2026-03 `Open` literal) resolves categorically to `structure_complete` and supplies no number.

This does **not** weaken the README rule "dated structure evidence changes categorical status only; it never fills a missing numeric percentage". The CVSR row tables are a numeric *observation*, published by the Authority, not evidence. Step 10 makes that distinction explicit in the README rather than leaving the two mechanisms looking alike.

Effect, all verifiable against the artifact: 33 "not reported" earthwork values become published percentages; `CP1:195` → 0%, `CP1:197` → 0%, `CP2-3:114` → 7%, `CP2-3:138` → 96% substantially complete; `CP1:184` → 100%; `CP2-3:169 Ave 24` → 90% and `CP2-3:144 Ave 156` → 98%, both currently rendered *Under construction*.

### 4. Dated completion evidence from the Completed tables (G3, G10)

The `Finish` column of the *Underway* tables is explicitly forecast (`Report Notes: ● Sourced from PCM Forecasted Schedule.`) and must never drive a historical status. The *Completed* tables are different: their `Finish` is an achieved month.

In **`scripts/fetch-cvsr.ts`**, for every Completed-table row whose `Finish` is at or before the report's data month, emit a `StructureEvidence` record:

- `claim`: `'completed'` when `completion === 1` and no footnote; `'substantially_complete'` when the CP2-3 footnote applies; `'in_progress'` never.
- `date`: the `Finish` month, `datePrecision: 'month'`.
- `sourceId: 'cvsr'`, `reportFile`, and `quote` = the verbatim row (`"Golden State Blvd Jan-20 Apr-22 100%"`).
- `id`: `cvsr-row-${reportFile-slug}-${location-slug}`.

Do not emit for Underway rows. Do not emit a `not_started`/`preconstruction` claim from `Start` — that is the same forecast schedule.

This converts a two-month table into corridor-wide categorical history for completed structures, so replay stops hatching them. It leaves `Guideway - 02/04/05/07/08` (G10) hatched, which step 5 addresses.

### 5. Stop hatching rows that have a published completion (G10)

**`src/lib/status.ts`** — `scheduledStatus` line 71-72 currently returns `no_data` for any segment with a null `start`/`finish` and a non-zero completion. That conflates "the schedule fields are empty" with "no progress is published". Split them:

```ts
if (segment.start === null || segment.finish === null) {
  return segment.completion === null
    ? 'no_data'
    : statusFromCompletion(segment.completion, null, date);
}
```

A segment with a published completion but no schedule renders in its completion's colour under *scheduled* provenance, which the tier badge already labels. This removes 7.92 mi of false hatching from the replay and leaves genuinely unknown spans hatched.

Add to **`src/lib/status.test.ts`**: a segment with `start: null, finish: null, completion: 0.68` resolves to `under_construction`, and one with `completion: null` still resolves to `no_data`.

### 6. Resolve the two CP1 gaps and fix named-project attachment (G4, G5, G6, G8)

**`scripts/build-segments.ts`**

- `CP1:gap:1` — reviewed resolution from the CVSR rows in G5. Relabel to `Herndon Avenue to Golden State Boulevard realignment — guideway not started`, set `completion: 0`, `currentStatus: 'not_started'`, `sourceId: 'cvsr'`, and keep `stationing: 'inferred'` and `weight: 0`. Record the two covering CVSR row names in the segment so the detail panel can cite them. The span stops being hatched because the Authority publishes 0%, not because we assumed it.
- `CP1:gap:0` — keep `no_data`; replace the generic label with the reason: `North of the first published ArcGIS CP1 row — TS1 places the CVY/CP1 equation at station 962039.57 (MP S 158); the layer's first row starts at 964055`. A gap that names its cause is not the same as an unexplained hatch.
- Named-project attachment (`build-segments.ts:314-333`): **remove the spatial fallback onto `kind: 'no-data'` segments.** A feature that resolves spatially into a gap is either a reviewed attachment or a package-level one; it is never allowed to become the gap's evidence. Introduce:

  ```ts
  /** Reviewed location for projects that sit on the alignment but do not describe
   *  its HSR construction status. These attach for display and emit no evidence. */
  export const CONTEXT_PROJECTS: Readonly<Record<string, { segmentId: string; scope: 'enabling-works' | 'third-party' }>> = {
    '938432eb-f888-4450-ab52-e9a6b2141a4a': { segmentId: 'CP1:gap:1', scope: 'enabling-works' },
    '84e93d1f-9100-4fff-8e61-f3bfec1425ab': { segmentId: 'CP1:gap:1', scope: 'third-party' },
  };
  ```

  `locationMethod` gains `'reviewed-context'`; those attachments never push into `segment.evidence`. Golden State Boulevard Realignment is CAHSRA enabling work for the guideway that follows it; Veterans Boulevard is a Measure C project (G8) and must be labelled as such wherever it is shown.
- The existing throw `if (completedStructures !== 59 || inProgressStructures !== 29)` counts closures-layer features. Leave the check, but exclude `CONTEXT_PROJECTS` from the counts and state the excluded set in the message.

### 7. Show the disagreement instead of resolving it silently (G9)

**`scripts/build-segments.ts`** — extend `artifact.crossCheck` with a per-segment `disagreements` array: `{ segmentId, arcgis, cvsr, cvsrMonth, reportFile }` for every crosswalked row where the two sources differ by more than 0.005. Six rows qualify today. Do not throw; a disagreement between two published sources is a fact to display.

**`src/components/SegmentDetail.tsx`** — when a segment has both, render two rows rather than one:

```
Earthwork · ArcGIS      66%  (BuildHSR Guideways Construction Progress, 2026-05-04)
Earthwork · CVSR         7%  (Central Valley Status Report, April 2026 data)
```

Keep the existing single row when only one source reports. `StripChart`'s tooltip keeps one line and appends `· sources disagree` when both exist and differ, since the tooltip is not interactive.

Strip colour continues to come from the resolved observation. State the precedence in the caption: the CVSR row table wins where it exists, because it is the dated published report; ArcGIS fills the rest.

### 8. Stop inflating sub-pixel rows (G7)

**`src/components/StripChart.tsx`**

- `width={Math.max(0.75, end - x)}` → `width={Math.max(0.4, end - x)}` is not the fix; the row must not displace its neighbours at all. Use the true width for the band rect, and render rows whose true width is below `1.5` px in a second pass, **after** the band, as a 4 px tall notch spanning `y=44..48` (immediately above the band) at their true `x`, in the row's status colour, with a 6 px wide transparent `rect` behind it carrying the `role="listitem"`, `tabIndex`, `aria-label` and all pointer/keyboard handlers.
- The 24 affected rows are listed in G7. After the change the band shows a continuous 100%-complete run from `Alpaugh Bridge to Ave 56` through `Ave 24`, with the AAAT underpass marked as a notch above it rather than a 602 ft hole in it.
- Update the `.model-caption` to say that structures shorter than the pixel grid are drawn as notches above the band at true position, and are not drawn to scale.

### 9. Parse the published ROW acquisition series; keep delivery separate (G11, G12, G14)

The existing schema has only `parcelsDelivered` / `parcelsTotal`. That is why the parser throws away five complete acquisition tables and the UI calls them “Not published.” Do **not** relabel acquisition as delivery; preserve both measures.

**`src/data/types.ts`** — add to `PackageMetrics`:

```ts
parcelsAcquired?: number;
parcelsAcquisitionTotal?: number;
parcelAcquisitionAsOf?: string; // ISO date; report date may differ from data month
railroadParcelsAcquired?: number;
railroadParcelsTotal?: number;
```

**`scripts/lib/cvsr-parser.ts`** — add:

```ts
export type DatedCountPair = CountPair & { asOf: string };
export function parseParcelAcquisitionPair(
  text: string,
  cp: CvsrPackage,
  dataMonth: string,
): DatedCountPair | null;
```

Support three audited layouts, in precedence order:

1. **2019-09 → 2019-12 — `ROW Parcels to be Acquired and Remaining`.** The row publishes a previous-month `Total Needed / Total Acquired / Remaining`, then current-month `Optimized / Acquired / Total Remaining`. Derive the current month:

   ```ts
   total = priorTotal - optimized
   acquired = priorAcquired + acquiredThisMonth
   remaining = publishedCurrentRemaining
   ```

   Require `total === acquired + remaining`; throw with the report file and CP when it does not balance. Expected values:

   | Data month | CP1 | CP2-3 | CP4 |
   |---|---:|---:|---:|
   | 2019-09 | 827 / 928 | 559 / 850 | 166 / 223 |
   | 2019-10 | 827 / 928 | 565 / 850 | 166 / 223 |
   | 2019-11 | 827 / 928 | 573 / 850 | 172 / 223 |
   | 2019-12 | 804 / 908 | 582 / 886 | 159 / 248 |

   The December report explicitly says it re-baselines prior acquisition data after GeoAMPS reconciliation. Preserve the discontinuity; do not “correct” December from November.

2. **2020-01 — `CP 1-4 ROW Parcel Acquisition Summary`.** This is an exceptional report: the table is certified **March 9, 2020**, although the cover says January 2020 data. Parse the published March-9 `Total Needed`, the November-30 `Total Acquired`, modifications, acquisitions from December through March 9, and March-9 remaining columns. Preserve `parcelAcquisitionAsOf: '2020-03-09'`; never present the numbers as a January month-end observation. The report gives only an aggregate monthly split (*“five parcels in December, 10 parcels in January, four parcels in February”*), not that split by package, so exact January per-package acquired totals are still unavailable.

   Store the report's per-package table verbatim in an `acquisitionAudit` payload rather than manufacturing a balanced pair:

   | CP | Mar-9 total needed | Nov-30 acquired | Dec→Mar modifications | Dec→Mar acquired | Mar-9 remaining |
   |---|---:|---:|---:|---:|---:|
   | CP1 | 919 | 827 | −2 | 7 | 92 |
   | CP2-3 | 956 | 573 | 118 | 12 | 383 |
   | CP4 | 263 | 172 | 40 | 0 | 91 |

   This table's own printed identity is `Total Needed (A) = prior Acquired (B) + March-9 Remaining (F)`. Do not reinterpret `B + E` as a March-9 acquired total; the Authority did not label it that way.

3. **2020-02 onward — `ROW Parcel Acquisition Summary`.** Parse the explicitly labelled `Total Needed` and `Total Acquired` columns when present, independently of the existing delivered-to-DB parser. The 2020-02 report proves why the fields must remain separate: CP1 acquired **828** vs delivered **824**; CP2-3 **604** vs **587**; CP4 **160** vs **159**.

**2019-08 derivation (G12).** Delete the hand-entered `LEGACY_PARCELS['brdmtg_101519_…']` entry and parse page 6. It is a text table, not an image. The current-month pair is derivable and remains in the **delivery** series:

```ts
total = publishedBase + additionalParcelsThisMonth
delivered = total - publishedCurrentRemaining
```

Expected CP1 `827/932`, CP2-3 `547/854`, CP4 `166/223`. The source uses `Total Parcels Excluding Railroads` as the base for CP1/CP2-3, but CP4 balances only from `Total Parcels` including railroads; encode that reviewed source quirk explicitly and assert all three expected pairs. Remove the false `transcribedFields: ['parcels']` annotation for this report. Keep the verified 2019-06 and 2019-07 chart-image transcriptions.

**`scripts/lib/cvsr-inventory.ts`** — replace the five generic `metric: 'parcels', cause: 'source_not_reported'` entries with a measure-specific condition:

- `metric: 'parcel_delivery'`
- `cause: 'related_measure_only'`
- detail: *“The report publishes package parcel acquisition, needed and remaining counts; it does not publish parcels certified and delivered to the design-builder. The acquisition series is displayed separately.”*

The disclosure must not say “Not published in source” for the acquisition data. At 2019-09 → 2019-12, the ROW band shows `Acquired N / total` and a second line `Delivered to DB — not reported`. At 2020-01 it shows the March-9 acquisition audit with that as-of date and explicitly says exact January package values are unavailable. At 2020-02 onward it can show acquired and delivered side by side.

**Railroad ROW parcels (G14).** Parse the separate railroad acquisition table into `railroadParcelsAcquired` / `railroadParcelsTotal` and show it as a third ROW line. Without it, today's band reads `985 / 985` while three CP2-3 railroad parcels are outstanding (`55 / 58`). Where no railroad table is published, leave the field absent — never zero.

**`scripts/lib/cvsr-parser.test.ts`** — add one exact fixture per layout and assert the values above, the 2019-08 CP4 base-column exception, the 2019-12 re-baseline, the 2020-01 `2020-03-09` as-of date, and that acquired values never populate `parcelsDelivered`.

Utilities remain unchanged: keep the genuine 2019-03 → 2020-07 gap, but name the boundary — *“Package utility relocation counts are first published in the August-2020-data report; earlier reports publish only third-party agreement schedules and target milestones.”*

### 10. Documentation (all)

**`README.md`**

- Replace *"ROW parcels and utilities are only published at construction-package granularity"* with the current truth: ROW and utilities remain package-level; **structure and guideway progress is now published per row** in the CVSR, and the dashboard reads it.
- Rewrite the rule *"Dated structure evidence changes categorical status only; it never fills a missing numeric percentage"* to distinguish the two mechanisms: CVSR row tables are numeric observations and do supply percentages; news releases and narrative CVSR quotes remain categorical-only evidence.
- Add to the replay-tier table that tier 2 now carries per-segment observations for the months whose report publishes row tables, and package-level metrics for all 86 months.
- Document ROW as three distinct package-level series — parcel acquisition, parcel delivery to the design-builder, and railroad parcel acquisition — with their source definitions and as-of dates. Never call one a synonym for another.
- Add a *Known gaps* section listing exactly what stays unknown (below), so the hatching is documented rather than discovered.

**`data/raw/cvsr/MANIFEST.md`** — regenerate the transcription table under the split note kinds from step 9.

---

## What stays unknown after this plan

These remain unavailable at the stated resolution. They must stay typed gaps; related measures are shown separately rather than substituted.

- `CP1:gap:0`, 0.388 mi — no ArcGIS row and no CVSR stationing. Hatched, with the datum reason on the label.
- Per-segment history for 2019-03 → 2026-02 — the row tables begin with the June-2026 report. 84 of 86 CVSR months remain package-level.
- ROW parcels **delivered to the design-builder**, 2019-09 → 2020-01 — every report publishes acquisition counts, which are shown; none publishes the delivery certification measure. The 2020-01 report additionally lacks an exact January package acquisition split, so its March-9 audit is shown with that date.
- Package utility relocations, 2019-03 → 2020-07 — no counts published.
- ArcGIS `Completion` for structure rows — permanently `<Null>`; the number now comes from the CVSR, cited to the CVSR.
- CP1 guideway rows have no 1:1 CVSR counterpart (the CVSR decomposes CP1 into 32 rows against the layer's 15). ArcGIS stays authoritative for CP1 guideway; the CVSR CP1 guideway rows are recorded as `unmatchedCvsrRows` and are not displayed against segments.

---

## Verification

1. `npm run parse:cvsr` reports row tables found in exactly 2 of 106 reports, 153 rows for 2026-04, and 0 parse failures. Summary-tile cross-check passes for CP1 and CP2-3 in both months.
2. `npm run fetch` prints the crosswalk audit: 35 of 35 structure segments resolved, 49 guideway rows matched verbatim, 68 unmatched CVSR rows recorded, 6 disagreements recorded. The build throws if any structure segment lacks a crosswalk entry.
3. `public/data/segments.json` contains **zero** segments with `currentStatus: 'no_data'` other than `CP1:gap:0`.
4. On the running dashboard at the default date: hovering `Alpaugh Angiola Atwell Trail Underpass` shows *Structure complete · 96%* with an April-2026 CVSR link, and the band between `Ave 56 to AAAT` and `AAAT to Ave 24` is continuous. `Golden State Boulevard Viaduct` reads *Structure complete* and cites `Golden State Blvd Jan-20 Apr-22 100%`. `Access Road Underpass` reads 7%. `Herndon HST` and `Fresno Street Underpass` read 0%.
5. Scrub to `2024-01`: hatched rows drop from 30 to at most 2, and no segment with a published ArcGIS completion is hatched.
6. Scrub across `2022-03` → `2022-04`: `Golden State Boulevard Viaduct` transitions from *Under construction* to *Structure complete*, matching the achieved April-2022 finish month.
7. `CP1:gap:1` renders as *Not started*, cites the two CVSR guideway rows, and lists `Golden State Boulevard Realignment` (enabling works) and `Veterans Boulevard` (third party, Measure C) as context projects with no evidence attached.
8. `SR 43 Curved Br to Corcoran HWY` shows both percentages with distinct citations.
9. `npm test`, `npm run lint`, `npm run build` pass.
10. At 2019-09 the ROW band shows CP1 `Acquired 827 / 928` plus `Delivered to DB — not reported`; at 2019-12 it shows the reconciled CP1 `804 / 908`; at 2020-01 it labels the acquisition audit `as of 2020-03-09`. The disclosure says `related measure only`, not `Not published in source`. Utilities still list `2019-03–2020-07`. `brdmtg_101519_FA_Central_Valley_Status_Report.pdf` has no transcription annotation.
