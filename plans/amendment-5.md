# Fact-check and citation audit

## Context

Vet every user-visible claim on the Tracking On dashboard against its cited source, repair the
claims that are wrong, and restructure `src/data/sources.ts` so the footnote list cites documents
the way a reader can actually follow: the ArcGIS layers as parts of the Authority's official
BuildHSR Interactive Map, the CVSR series with specific reports pinned where a specific report is
what proves the claim, and the 2026 Business Plan as one document with page locators instead of
several registry rows sharing one URL.

End state: no rendered claim contradicts its source; every quotation mark on the page contains
source text verbatim; the Sources list has 15 numbered entries with lettered sub-locators instead
of 20 flat rows; no dead source URL remains.

Two findings shape how the work must be done rather than only what to change. First, `pdftotext`
inlines superscript footnote markers with no delimiter, so quotations transcribed from its output can
contain text the page does not say — one currently does. Every quotation in this plan was
re-derived from font-aware output, and step 2 fixes that quote and records how far the defect
reaches. Second, the guideway/structure parse can be made to validate itself against the percentage
each report prints, which both fixes a wrong percentage on the page and proves the rest of the
numeric path across all 107 local reports; step 5 does that.

All findings below were verified this session against `data/raw/**`, the committed artifacts in
`public/data/**`, the live ArcGIS REST endpoints, and live `buildhsr.com` / `hsr.ca.gov` pages
through a real browser. Page numbers are the **printed** page unless noted.

## Approach

Steps 1–7 are independent content fixes. Steps 4, 5 and 9 change generated artifacts, so
`npm run parse:cvsr` then `npm run fetch` must run after them and before any UI check. Step 8
(registry restructure) touches every citation callsite and should land after 1–7 so it rewrites final
prose once. Steps 9–10 depend on 8. Step 11 reports counts produced by step 5's reparse, so it lands
last.

### 1. Replace the two dead news-release sources and correct their dates

Both currently registered release URLs 404 (verified in a real browser; the Ventura URL returns
`404 - California High Speed Rail`, the Fresno one returns an empty document). The real releases
exist with different slugs **and different dates**, and the dashboard's own CVSR row tables agree
with the real dates, not the registered ones.

In `src/data/sources.ts`, replace `authority_tulare_2025` and `authority_ventura_2026` with:

```ts
  hsr_tulare_2025: {
    title: 'High-Speed Rail’s Completed Tulare Street Grade Separation Project Reconnects Fresno’s Chinatown and Downtown',
    date: '2025-07-31',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/2025/07/31/photo-release-high-speed-rail-celebrates-completion-of-tulare-street-grade-separation-project-in-fresno/',
  },
  hsr_ventura_2026: {
    title: 'High-Speed Rail Completes Underpass Reconnecting Downtown and Southwest Fresno',
    date: '2026-03-13',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/2026/03/13/photo-release-high-speed-rail-completes-underpass-reconnecting-downtown-and-southwest-fresno/',
    note: 'Updated 2026-05-11 to rename the street throughout; the release carries the editor’s note.',
  },
```

In `src/data/structure-evidence.ts`, rewrite the two entries:

- `tulare-complete-2025-09-30` → id `tulare-complete-2025-07-31`, `date: '2025-07-31'`,
  `datePrecision: 'day'`, `sourceId: 'hsr_tulare_2025'`, `label: 'Tulare Street Undercrossing'`,
  quote **verbatim**: `'The Tulare Street Underpass and Grade Separation project is complete and open to traffic in the city of Fresno.'`
- `ventura-complete-2026-01-23` → id `ventura-complete-2026-03-13`, `date: '2026-03-13'`,
  `datePrecision: 'day'`, `sourceId: 'hsr_ventura_2026'`, quote **verbatim**:
  `'The Ventura Street underpass grade separation project is complete and open to traffic in the city of Fresno.'`

Update each entry's inline `sourceTitle`/`sourceUrl` to match the new registry values exactly.

Corroboration already in the artifacts: `public/data/history.json` carries
`Tulare Underpass Oct-17 Jul-25 100%` and `Ventura Underpass Jun-21 Mar-26 100%` from the CVSR row
tables, and `FA-Central-Valley-Status-Report-June-2026-A11Y.pdf` p. 4 states
"One structure was completed in March 2026. CP1 - One structure was completed (Ventura Underpass)."
The old `2025-09-30` and `2026-01-23` dates matched no source.

### 2. Make every rendered quotation verbatim — using footnote-aware extraction, not `pdftotext`

`SegmentDetail.tsx:66` and `StripChart.tsx:298` render `“{evidence.quote}”`. Ten of the sixteen
`STRUCTURE_EVIDENCE` quotes are paraphrases inside quotation marks, and one is corrupted by a PDF
footnote marker. Both classes must be fixed with source text copied verbatim (a leading label such
as `COMPLETED:` or a bullet glyph may be dropped; nothing else may be reworded).

**Extraction method is part of this step, not an implementation detail.** `pdftotext` inlines
superscript footnote markers with no delimiter, so its output silently fabricates text. In
`data/raw/cvsr/brdmtg_081320_FA_Central_Valley_Status_Report.pdf` printed p. 5, `pdftotext` emits
`…flare caps for Bents2 3 and 4…`; the page actually reads `…flare caps for Bents 3 and 4…` with a
superscript `2` referencing the footnote "Bents are the basic post and beam structure that forms a
cross section for the frame…". The repo's current quote, `Poured Abutment 5 walls, columns and flare
caps for Bents 2, 3 and 4.`, read that marker as a bent number and invented a comma.

Transcribe every quote from font-aware output instead. `pdftohtml` ships with the same poppler
install as `pdftotext`, so no dependency is added:

```bash
pdftohtml -xml -i -q -f <page> -l <page> <pdf> /tmp/pg   # emits /tmp/pg.xml
```

Each `<text top left width height font>` run carries a `font` id resolved by the `<fontspec
id size>` table. A run is a footnote marker — and must be dropped from the quote and recorded
separately — when all three hold against the longest run on the same line (the body run):
its text is 1–2 digits only, its `size` is at least 0.5 smaller, and its baseline (`top + height`)
is at least 2 units higher. Reconstruct the line by concatenating the remaining runs in `left`
order and collapsing whitespace.

Verified source text for every entry (footnote markers already removed; each line below was
reconstructed with the rule above):

| entry id | new verbatim `quote` | source, location |
|---|---|---|
| `cottonwood-complete-2017-02-03` | `The structure is complete, including barrier walls and a concrete bridge deck.` | SB 1029 Feb 2017, "COTTONWOOD CREEK BRIDGE (MADERA COUNTY)" paragraph; no footnote markers on the line |
| `fresno-river-substantial-2019-03` | `CP 1 work substantially completed: … Fresno River viaduct` | SB 1029 May 2019, "CP 1 work substantially completed" bullet list; no markers |
| `muscat-complete-2019-07` | `Muscat Avenue was completed in July 2019.` | buildhsr.com Muscat Avenue Viaduct, project summary |
| `san-joaquin-complete-2021-02` | `The San Joaquin River Viaduct was completed in February 2021.` | buildhsr.com San Joaquin River Viaduct & Pergola — already verbatim, keep |
| `cedar-complete-2023-05-10` | `The California High-Speed Rail Authority, in collaboration with Tutor-Perini/Zachry/Parsons, announced on May 10, 2023, the completion of the Cedar Viaduct in Fresno.` | buildhsr.com Cedar Viaduct |
| `cairo-complete-2022-12-20` | `On December 20, 2022, the California High-Speed Rail Authority (Authority), in collaboration with Dragados-Flatiron Joint Venture, announced the completion of the Cairo Avenue grade separation in Kings County.` | buildhsr.com Cairo Avenue Viaduct |
| `peach-complete-2024-12-06` | `UPDATE DECEMBER 2024: Peach Avenue Roadway was open to the public on 12/06/24.` | buildhsr.com Peach Avenue Grade Separation |
| `whitley-complete-2025-04-24` | `Whitley Avenue, now open to traffic, is the second high-speed rail structure to be completed in 2025.` | buildhsr.com Whitley Avenue Underpass |
| `golden-state-progress-2020-08` | `Golden State Boulevard Viaduct: Poured Abutment 5 walls, columns and flare caps for Bents 3 and 4; drilled Bent 2 and Abutment 1 Cast-In-Drilled-Hole (CIDH) piles.` | Aug 2020 CVSR printed p. 5; superscript `2` after "Bents" is a footnote reference and is not part of the sentence |

The four other Aug-2020 CVSR quotes are already verbatim and carry no footnote markers on their
lines — leave their text alone (their dates change in step 3): `san-joaquin-progress` and
`cedar-progress` on printed p. 5 ("CP 1 Construction Progress Summary"), `hanford-substantial`,
`conejo-progress` and `peach-substantial` on printed p. 7 ("CP 2-3 Construction Progress Summary").

`cottonwood-complete-2017-02-03.label` stays `'Cottonwood Creek Viaduct'` — it must match the
ArcGIS structure name for display — even though the Feb 2017 report calls the structure
Cottonwood Creek **Bridge**. The corrected quote no longer asserts a name the source does not use.

#### How far the extraction defect reaches

Audited every one of the 107 PDFs in `data/raw/cvsr/` with the rule above. Result: 2,211 runs match
the smaller-and-raised digit signature, but the overwhelming majority are bar-chart value labels,
not footnote references. Classified by what the project does with the affected text:

- **Hand-transcribed prose quotes** — unguarded, and the only place the defect actually produced a
  wrong user-visible string: exactly one of sixteen (`golden-state-progress`). Note the same bullet
  recurs in `brdmtg_071620`, `brdmtg_090920` and `brdmtg_101520`, and that a *different* report
  (`brdmtg_031720` printed p. 9) really does say "PCM is finalizing plans for bents 2, 3, and 4",
  which is the likely origin of the invented comma.
- **Parsed numeric fields** — clean. Step 5 adds a self-check that proves this across the corpus
  rather than asserting it: every exec-summary progress bullet that prints a percentage has that
  percentage exactly reproduced by its own complete/underway/not-started breakdown, 75 of 75.
- **Parsed row labels** — corrupted by design, and already handled: `FOOTNOTED_ROWS` in
  `scripts/lib/cvsr-parser.ts` is a hand-maintained allowlist of mangled labels per report
  (20 entries for the July 2026 report, which is exactly the set the font-aware scan finds).
  A missed registration cannot silently mis-state anything, because `scripts/build-segments.ts`
  throws unless 35/35 structure segments and 49 guideway rows resolve. Keep the allowlist as the
  mechanism; make its lookup insensitive to the spacing variant `pdftotext` happens to emit, since
  it currently carries both forms of the same row (`'AAAT1'` and `'AAAT 1'`, `'Belmont Avenue1'` and
  `'Belmont Avenue 1'`, `'Cole Slough to Access Road (0.33 Miles) 1'`): compare
  `location.replace(/\s+/g, ' ')` against entries normalised the same way, and collapse each
  duplicate pair to one entry.

### 3. Redate the August-2020 CVSR source and its evidence to the June-2020 data month

`data/raw/cvsr/brdmtg_081320_FA_Central_Valley_Status_Report.pdf` cover reads
"August 2020 Report (data through June 2020)" and every page footer reads "June 2020 data".
`parsed-snapshots.json` already keys it `dataMonth: "2020-06"`. The five hand-written evidence
entries date it `2020-08`, so five narrative observations replay two months late.

- `src/data/sources.ts`: rename `cvsr_2020_08` → `cvsr_2020_06`; `title` →
  `'Central Valley Status Report, August 2020 (data through June 2020)'`; `date` → `'2020-06-01'`.
- `src/data/structure-evidence.ts`: for `san-joaquin-progress-2020-08`, `cedar-progress-2020-08`,
  `golden-state-progress-2020-08`, `hanford-substantial-2020-08`, `conejo-progress-2020-08`,
  `peach-substantial-2020-08`: set `date: '2020-06'`, rename each id's suffix to `-2020-06`, set
  `sourceId: 'cvsr_2020_06'`, and update `sourceTitle` to the new registry title.

### 4. Derive the station marks from the published station points

`src/components/StripChart.tsx:11-17` hardcodes five station marks. Two carry a milepost that
belongs to something else, and all five are hand values on an axis the pipeline can compute.

**Where the wrong values came from.** TS1 2.1
(`Part_B-2-2-1_TS1_2-1-Systemwide_Alignment_Schematic-2019-0501.pdf`) is one 8640×2592 pt sheet whose
text is positioned, so labels must be read by coordinate. `pdftotext -bbox` exposes that:

```bash
pdftotext -bbox -q Part_B-2-2-1_TS1_2-1-Systemwide_Alignment_Schematic-2019-0501.pdf - \
  | grep -o '<word[^>]*>[^<]*</word>'
```

A corner index box (x ≈ 7350–7900, y ≈ 600–1200) reads
`MERCED MP: C124` / `CP SAN JOAQUIN MP: C139 P139` / `CP MERCED MP: B138 P144` /
`CP DIVIDE MP: B144 C144 S144` / `FRESNO MP: S194` / `BAKERFIELD MP: C295 D295` /
`LOS ANGELES MP: D424 T424` / `JUNCTION MP: T426 J426`. `S 194` is that index entry — not a station
platform: the sheet's own `FRESNO` station symbol is drawn beside `S184`, next to `Fresno Trench`,
`Jensen Trench` and `OCC FRESNO`, while `S194` falls in CP2-3 near Mt. View to Conejo Ave (S 197.6+),
about seven miles south of the Cedar Viaduct. `S 239` is worse: inline it labels `MOWS` / `CORCORAN`
at the Kings–Tulare county line, i.e. the Corcoran maintenance-of-way siding, 24 miles south of the
Kings/Tulare station. The sheet's inline station symbols sit at `MERCED` C124, `MADERA / AVE 12` S167
(a superseded site with a maintenance facility; the current station is Avenue 19 and Road 26),
`FRESNO` S184, `FRESNO HMF` S190, `KINGS/TULARE` S215, `BAKERSFIELD` S295 = D295. TS1 3.0 pins the
south end exactly: its `Bakersfield HSR Station` row gives station `6856+00.00`,
`Sierra Subdivision S 295 = Desert Subdivision D 295 AHD`.

**The values to use.** The TS1 schematic labels are whole mileposts — drafting annotations, not
surveyed points. The Authority publishes the station sites themselves as points in the
`ALL CHSRA MULTIMEDIA LAYERS` Stations layer, already cached at `data/raw/arcgis/stations.json`
(`spatialReference` wkid 4326; `Stat_Name`, `X_Streets`, `LAT`, `LONG`). Project those onto the
committed centerline and read the milepost off the TS1-fitted axis, so geometry supplies only the
position along an axis TS1 still defines. Computed with the repo's own turf and
`public/data/mileposts.json`:

| `Stat_Name` | `X_Streets` | iosMile | official MP | dist to centerline | chord at the projected segment |
|---|---|---|---|---|---|
| `Downtown Merced` | Between MLK Way and G Street | 0.52 | C 124.5 | 0.008 mi | 0.02 mi |
| `Madera Stop` | Avenue 19 and Road 26 | 34.28 | S 158.3 | 0.032 mi | 2.70 mi |
| `Fresno - Mariposa St.` | Mariposa St and H St | 59.34 | S 183.3 | 0.069 mi | 2.46 mi |
| `VTH Station` | Between Lacey Blvd and SH 198 | 91.24 | S 215.2 | 0.002 mi | 7.12 mi |
| `Bakersfield - F Street` | (blank) | 170.50 | S 294.5 | 0.010 mi | 0.86 mi |

Every derived milepost lands within 0.7 mi of the TS1 schematic's whole-number label for the same
station (C 124.5 vs C124, S 158.3 vs the CP1 limit S158, S 183.3 vs S184, S 215.2 vs S215,
S 294.5 vs S295), so the two sources agree and the projection is the finer of the two. The old
`mile: 70` (S 194) and `mile: 115` (S 239) agree with neither.

The "chord" column matters and must be surfaced: the published alignment geometry has holes, and
three of the five stations project onto a straight bridging chord rather than surveyed geometry —
7.12 mi at Kings/Tulare, where the nearest actual vertex is 3.05 mi away. The bridged run there is a
dead-straight north–south tangent whose longitude matches the station point to five decimals, so the
interpolated position is sound, but the reader must be told it is interpolated. This also retires the
existing claim that the Kings/Tulare "station site is 3.05 mi off the built alignment": 3.05 mi is
the distance to the nearest surveyed *vertex* across a geometry gap, not an offset from the route.

**Edits.**

1. `scripts/build-segments.ts` — after the centerline and `mileposts.json` are loaded and validated
   (the `Centerline/milepost array length mismatch` check), add the station projection. Reuse the
   exact pattern the structure snap already uses at the `nearestPointOnLine(centerline, point(coordinate), { units: 'miles' })`
   call: take `properties.totalDistance` and pass it through the existing
   `geodesicDistanceToIosMile`, take `properties.dist` as the perpendicular offset, and take
   `properties.index` to measure the chord with the same haversine the file already relies on via
   turf. Format the milepost with `formatOfficialMp` from `src/lib/mileposts.ts` — do not write a
   second formatter.

   ```ts
   const STATION_MARKS: ReadonlyArray<{ statName: string; label: string }> = [
     { statName: 'Downtown Merced', label: 'Merced' },
     { statName: 'Madera Stop', label: 'Madera' },
     { statName: 'Fresno - Mariposa St.', label: 'Fresno' },
     { statName: 'VTH Station', label: 'Kings/Tulare' },
     { statName: 'Bakersfield - F Street', label: 'Bakersfield' },
   ];
   ```

   `Kings Tulare - East Alt` in the same layer duplicates `VTH Station`'s coordinates exactly and is
   deliberately not listed.

2. `src/data/types.ts` — add to `SegmentsArtifact`:

   ```ts
   stations: Array<{
     /** Display label on the strip axis. */
     label: string;
     /** ArcGIS `Stat_Name`, verbatim. */
     officialName: string;
     /** ArcGIS `X_Streets`, verbatim; empty string when the layer leaves it blank. */
     crossStreets: string;
     iosMile: number;      // 2 dp
     officialMp: string;   // formatOfficialMp(iosMile)
     /** Perpendicular distance from the published point to the centerline, miles, 3 dp. */
     offsetMi: number;
     /** Length of the centerline chord the point projects onto, miles, 2 dp. */
     chordMi: number;
   }>;
   ```

3. Build guards, all hard errors — an unresolvable station must fail the build, never render a
   silent fallback: every `statName` must resolve to exactly one feature; `iosMile` must be finite
   and within `0 <= iosMile <= 175`; the five `iosMile` values must be strictly increasing in the
   declared order; and every `offsetMi` must be `<= 0.1` (the current maximum is 0.069). Do not
   guard `chordMi` — it is reported, not constrained.

4. `src/App.tsx` — pass `data.segments.stations` into `<StripChart stations={…} />`.

5. `src/components/StripChart.tsx` — delete the `STATIONS` constant and take
   `stations: SegmentsArtifact['stations']` as a prop. Marker and label positions come from
   `xForMile(station.iosMile)` and `station.label`, exactly as today. The `<title>` becomes:

   ```tsx
   {`${station.officialName}${station.crossStreets ? ` (${station.crossStreets})` : ''} — ${station.officialMp}, ios mile ${station.iosMile.toFixed(2)}`}
   {station.chordMi >= 0.5
     ? `; position interpolated across a ${station.chordMi.toFixed(1)} mi gap in the published alignment geometry`
     : ''}
   ```

   The 0.5 mi threshold is the decision: below it the chord is ordinary vertex spacing and saying
   nothing is correct; at or above it the position is an interpolation and must say so.

6. `src/components/Notes.tsx`, "Strip axis" bullet: replace "the named marks are the five station
   sites <arcgis_stations>" with

   > the named marks are the five published station points, projected onto the alignment centerline
   > and read off the TS1 milepost axis `<SourceLink sourceId="arcgis_stations" />`
   > `<SourceLink sourceId="ts1_alignment" />`; three of the five sit in gaps in the published
   > geometry and their tooltip says so

   The strings `S 194`, `S 239`, `Station site near CP1 north limit`, `3.05 mi off the built
   alignment` and `unresolved source discrepancy` disappear from the codebase entirely.

### 5. Make the guideway/structure parse reproduce the percentage each report prints

**The defect.** `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf` printed p. 4 states verbatim:
"Construction Package 4 – 21.1 complete (99.5%), 0.1 underway, all guideway miles started." The
dashboard's CP4 guideway cell reads **96%**. That is not a rounding artifact: 21.1 / 21.2 = 99.5 %,
21.1 / 22 = 95.9 %. The dashboard prints a percentage the report it cites contradicts by 3.6
percentage points, for the three most recent data months.

**The cause is one branch.** `packageCounts` in `scripts/lib/cvsr-parser.ts` has three fallbacks.
The `breakdown` branch computes `total = complete + underway + not started`. The `allActive` branch,
used when the bullet says "all guideway miles started" instead of "0 not started", discards the
breakdown and returns the hardcoded `guidewayTotals.CP4 = 22`. Reports through the February-2026
data month said "0.1 underway, 0 not started" and rendered 99 %; the phrasing changed with the
March-2026 data month and the cell dropped to 96 %. `parsed-snapshots.json` shows the break exactly
there: `21.1 / 21.2` for 2025-04 through 2026-02, then `21.1 / 22` for 2026-03, 2026-04, 2026-05.

**The fix, and the evidence that it is right for the whole corpus.** "All guideway miles started"
means not-started is zero, so the `allActive` branch must sum the breakdown like every other branch.
Extract the percentage the bullet prints and assert that the derived denominator reproduces it, so
the parse validates itself instead of trusting a constant. Running that check over all 107 PDFs:
**75 exec-summary progress bullets print a percentage, and all 75 are reproduced exactly** by
`complete / (complete + underway + not started)`, rounded half-up at the printed precision — CP4's
`21.1 / 21.2 → 99.5 %` in every one of the eight reports that print it, and CP2-3's
`30 / 48 → 62.5 % → 63 %` in the July report, which is the only case needing half-up rather than
banker's rounding.

In `scripts/lib/cvsr-parser.ts`:

1. Add a capturing group for the printed percentage to both branch patterns. The `allActive` pattern
   currently swallows it in a non-capturing group `(?:\s*\([^)]*\))?`; change that to
   `(?:\s*\((?<pct>[0-9.]+)%\))?` and convert the two positional groups in the same pattern to
   named `(?<complete>…)` and `(?<underway>…)` so the optional group cannot shift indices. Do the
   same in the `breakdown` pattern, adding `(?<notstarted>…)`.
2. `allActive` returns `{ complete, total: round1(complete + underway) }` instead of
   `{ complete, total: fallbackTotal }`, where `round1(x) = Math.round(x * 10) / 10`. Apply the same
   `round1` in the `breakdown` branch — it is what turns the stored `21.200000000000003` into
   `21.2`. That float is pure IEEE-754 error from `21.1 + 0.1`, nothing more; it never reached the
   UI, and rounding at the point of construction is the whole fix for it.
3. Add one shared guard used by both branches, before returning:

   ```ts
   /** Round half-up at `places`; the Authority rounds 62.5% to 63%, not to 62%. */
   function roundHalfUp(value: number, places: number): number {
     const factor = 10 ** places;
     return Math.sign(value) * Math.round(Math.abs(value) * factor + Number.EPSILON) / factor;
   }

   function checkedCounts(count: ProgressCount, printedPct: string | undefined, context: string): ProgressCount {
     if (printedPct === undefined) return count;
     if (!(count.total > 0)) throw new Error(`${context}: printed ${printedPct}% against a zero total`);
     const places = printedPct.includes('.') ? 1 : 0;
     const derived = roundHalfUp((count.complete / count.total) * 100, places);
     if (derived !== Number(printedPct)) {
       throw new Error(`${context}: ${count.complete} of ${count.total} is ${derived}%, but the report prints ${printedPct}%`);
     }
     return count;
   }
   ```

   `context` must name the data month, the package and whether it is structures or guideway, e.g.
   `2026-05 CP4 guideway`, so a failure is actionable from the message alone.
4. Leave `guidewayTotals` and `structureTotals` in place — the `parenthetical` branch still needs
   `fallbackTotal`, and those months print no percentage, so the guard skips them.

`CENTRAL_VALLEY_GUIDEWAY_MILES = 119` and `fixedTotal` are untouched. The 119-mile program
denominator is deliberate — package denominators drift between 115 and 119 across the corpus, so the
corridor length is not their sum — and this step only corrects the per-package denominator that
`packagePercent` divides by. After the fix the package denominators sum to 118.2 for the current
month; nothing renders that sum.

Do **not** also change the guideway headline. It reads `89.1 / 119mi` where the July report prints
"89 miles complete (75%)", but 89 is the report's own rounding of the same three package values
(11 + 57 + 21.1) and the rail's number is a sum of published package figures, so neither contradicts
the other and there is nothing to correct.

### 6. Stop splicing two railroad ROW series in the "Right-of-way delivered" note

`src/components/Notes.tsx:58-62` says "a railroad-parcel count that moved from 105 to 164 across
69 published months". Three problems:

- 105 is an **acquisition** count: `brdmtg_031720_FA_Central_Valley_Status_Report.pdf` (January
  2020 data) p. 10, "CP 1-4 ROW Railroad Parcels to be Acquired and Remaining … Total 183 / 105 /
  78", and its column headers are all dated **March 9, 2020**, not January 2020.
- 164 is a **delivery** count: `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf` p. 10,
  "CP 1-4 – Real Property/Right-of-Way (ROW) Railroad … Delivered to Date 164 … Total Railroad
  Parcels 176". Presenting one as the continuation of the other is exactly the substitution
  `README.md`'s ROW rule forbids.
- The month count is now 70, not 69 (`parsed-snapshots.json`: 70 snapshots carry
  `perPackage.CP1.railroadParcelsAcquired`), so the hardcoded 69 is stale.

Replace the second sentence of that bullet with, citing the two reports pinned in step 8:

> The Authority also publishes a separate acquisition count, last reported for the 2021-03 data
> month, and a railroad-parcel series in its own table: 105 of 183 parcels acquired as of March 9,
> 2020 in the January-2020-data report, and 164 of 176 delivered to the design-builder in the
> May-2026-data report. Neither is charted here, and the acquisition and delivery counts are not
> one series.

Drop the "69 published months" figure rather than hardcoding 70 — the count changes with every
ingest and nothing renders it from the artifact.

### 7. Attribute the difficulty-model figures to the right source

`src/components/Notes.tsx:34-43`, "Difficulty scale":

- "about 1.6 mi of corridor appears in both" is this dashboard's own measurement, not a CVSR
  figure: `public/data/segments.json` `overlaps` holds 7 CP1 nested pairs totalling 1.637 mi. Pass
  `overlapMiles` (sum of `segments.overlaps[].miles`) from `App.tsx` into `NotesList` and render
  `` `about ${overlapMiles.toFixed(1)} mi` ``, with the sentence reading "CP1 publishes structure
  rows inside their guideway rows; this dashboard measures about X mi of corridor in both."
  No source link on that clause — it is a measurement of the dashboard's own projection.
- "the 2026 Business Plan Table B.1 extension totals" is imprecise: Table B.1 publishes six
  extension line items, and `EXTENSION_COSTS` (`M2M: 3391`, `LGA: 2540`) are sums of three of them
  each from the **2026 Business Plan Estimate** column (Merced 2,539 + 287 + 565 = 3,391;
  Bakersfield 1,984 + 276 + 280 = 2,540; verified against `data/raw/2026-Final-Business-Plan-060126-A11Y.pdf`
  p. 47). Reword to: "plus, for the two extensions, the sum of each extension's construction,
  utility-relocation and right-of-way line items in the 2026 Business Plan Estimate column of
  Table B.1." Record the same derivation in the `EXTENSION_COSTS` comment in `src/lib/weights.ts`.

### 8. Restructure `src/data/sources.ts` into one table with parent/locator entries

Add three optional fields to `Source` and keep a single flat table — every `sourceId` already
written into `public/data/*.json` (`arcgis_progress`, `arcgis_alignment`, `arcgis_structures`,
`arcgis_stations`, `cvsr`, `ts1_alignment`) stays valid, so no artifact churn.

```ts
export type Source = {
  title: string;
  publisher: string;
  url: string;
  date?: string;
  accessed?: string;
  /** Parent entry this one pinpoints. The parent carries the footnote number; children get letters. */
  partOf?: SourceId;
  /** Printed location inside the parent document, e.g. 'p. 47', 'pp. 78–79'. */
  page?: string;
  /** Provenance or status the reader needs; rendered under the entry. */
  note?: string;
};
```

`src/components/Citation.tsx`:

- `sourceLabel(id): string` replaces `sourceNumber`. Numbers come from
  `SOURCE_IDS.filter((id) => SOURCES[id].partOf === undefined)`; a child renders
  `` `${parentNumber}${String.fromCharCode(97 + childIndex)}` `` (`3a`, `15c`). Child index is the
  child's position among siblings in registry order.
- `SourcesList` renders an `<ol>` of parents; a parent with children nests an
  `<ol className="source-locators">` styled `list-style-type: lower-alpha`. Every entry — parent and
  child — keeps `id={`fn-${id}`}`, so existing `#fn-…` anchors resolve and a locator is directly
  targetable. A child row renders `title`, then `· {page}` when set, then `· {date}` when its own
  `date` differs from the parent's; publisher and URL come from the parent unless the child sets its
  own `url` (the ArcGIS layers do).
- `SourceLink` tooltip for a child: `` `${parent.publisher}, ${parent.title} — ${child.title}${child.page ? `, ${child.page}` : ''} (${child.date ?? parent.date})` ``.
- Add a minimal `.source-locators` rule to `src/App.css` next to the existing `.sources-list` rules;
  match their type scale, do not invent a new one.

Final registry order (this fixes the rendered numbering — write the keys in exactly this order):

| # | key | title / role |
|---|---|---|
| 1 | `ts1_alignment` | `Track and Systems Contract 1 (TS1) 3.0 – Alignment Segments and Lengths` |
| 2 | `ts1_schematic` | `Track and Systems Contract 1 (TS1) 2.1 – Systemwide Alignment Schematic` |
| 3 | `geoplatform` | **parent** — `Interactive Map` |
| 3a | `arcgis_progress` | `BuildHSR Guideways Construction Progress view` |
| 3b | `arcgis_alignment` | `HSR Statewide Alignment and Stations` |
| 3c | `arcgis_structures` | `Closures and Construction Projects (Read-Only)` |
| 3d | `arcgis_stations` | `ALL CHSRA MULTIMEDIA LAYERS` |
| 4 | `cvsr` | **parent** — `Central Valley Status Reports` |
| 4a | `cvsr_2020_03` | March 2020 report (January 2020 data) |
| 4b | `cvsr_2020_06` | August 2020 report (data through June 2020) |
| 4c | `cvsr_2022_04` | June 2022 report (April 2022 data) |
| 4d | `cvsr_2026_06_24` | June 24, 2026 report (April 2026 data) |
| 4e | `cvsr_2026_07` | July 2026 report (data through May 31, 2026) |
| 5 | `sb1029_2017` | SB 1029 Project Update Report, February 2017 |
| 6 | `sb1029_2019` | SB 1029 Project Update Report, May 2019 |
| 7 | `buildhsr_muscat` | Muscat Avenue Viaduct |
| 8 | `buildhsr_san_joaquin` | San Joaquin River Viaduct & Pergola |
| 9 | `buildhsr_cedar` | Cedar Viaduct |
| 10 | `buildhsr_cairo` | Cairo Avenue Viaduct |
| 11 | `buildhsr_peach` | Peach Avenue Grade Separation |
| 12 | `buildhsr_whitley` | Whitley Avenue Underpass |
| 13 | `hsr_tulare_2025` | step 1 |
| 14 | `hsr_ventura_2026` | step 1 |
| 15 | `business_plan_2026` | **parent** — `2026 Business Plan` |
| 15a | `bp2026_milestones` | Letter from the CEO, "Looking Ahead: Anticipated 2026 Milestones" |
| 15b | `bp2026_costs` | Appendix B, Table B.1 |
| 15c | `bp2026_schedule` | Appendix D, Exhibit D.0 |

Exact values for the new and changed entries:

```ts
  ts1_alignment: {
    title: 'Track and Systems Contract 1 (TS1) 3.0 – Alignment Segments and Lengths',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20210921082559/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-3_TS1_3-0-Alignment_Segments_and_Lengths-2019-0501.pdf',
    note: 'Industry draft, footer “TS1 – INDUSTRY DRAFT – 2019-0501”; sheets dated 3/29/2019. Archived copy — hsr.ca.gov serves this path behind bot protection.',
  },
  ts1_schematic: {
    title: 'Track and Systems Contract 1 (TS1) 2.1 – Systemwide Alignment Schematic',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20221126054952/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-2-1_TS1_2-1-Systemwide_Alignment_Schematic-2019-0501.pdf',
    note: 'Industry draft, footer “TS1 – INDUSTRY DRAFT – 2019-0501”. Archived copy — hsr.ca.gov serves this path behind bot protection.',
  },

  geoplatform: {
    title: 'Interactive Map',
    publisher: 'California High-Speed Rail Authority (BuildHSR)',
    url: 'https://buildhsr.com/map/',
    accessed: '2026-08-10',
    note: 'The Authority’s public map embeds its own ArcGIS GeoPlatform layers — portal account GeoPlatform_CHSRA, experience “BuildHSR Interactive Map (V2)” (item b2ab11d536da42c8bbe03f3e1458c0a2). The map exposes no per-layer permalink, so each layer service is cited directly below; every one is an Authority publication, not a third-party mirror.',
  },
  arcgis_progress: {
    partOf: 'geoplatform',
    title: 'BuildHSR Guideways Construction Progress view — layer 0, Guideway_Structures_ConstructionProgress',
    date: '2026-05-04',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/BuildHSR_Guideways_Construction_Progress_view/FeatureServer/0',
    accessed: '2026-08-10',
  },
  arcgis_alignment: {
    partOf: 'geoplatform',
    title: 'HSR Statewide Alignment and Stations — layer 1, HSR Statewide Alignment',
    date: '2026-04-07',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/HSR_Statewide_Alignment/FeatureServer/1',
    accessed: '2026-08-10',
  },
  arcgis_structures: {
    partOf: 'geoplatform',
    title: 'Closures and Construction Projects (Read-Only) — layer 0, construction_project_points',
    date: '2026-06-04',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/Closures_and_Detours_Public/FeatureServer/0',
    accessed: '2026-08-10',
  },
  arcgis_stations: {
    partOf: 'geoplatform',
    title: 'ALL CHSRA MULTIMEDIA LAYERS — layer 0, Stations',
    date: '2025-03-18',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/0',
    accessed: '2026-08-10',
  },

  cvsr: {
    title: 'Central Valley Status Reports',
    publisher: 'California High-Speed Rail Authority, Finance & Audit Committee',
    url: 'https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/',
    accessed: '2026-08-10',
    note: 'Monthly series published with the committee’s meeting materials; the dashboard keys each report by its data month. Reports that carry a specific figure cited on this page are listed below.',
  },
  cvsr_2020_03: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, March 2020 (January 2020 data)',
    date: '2020-01-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_031720_FA_Central_Valley_Status_Report.pdf',
    page: 'p. 10',
  },
  cvsr_2020_06: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, August 2020 (data through June 2020)',
    date: '2020-06-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_081320_FA_Central_Valley_Status_Report.pdf',
  },
  cvsr_2022_04: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, June 2022 (April 2022 data)',
    date: '2022-04-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2022/06/CVSR-2206-2204-Data-FINAL-V0-A11Y.pdf',
  },
  cvsr_2026_06_24: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, June 24, 2026 (April 2026 data)',
    date: '2026-04-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf',
  },
  cvsr_2026_07: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, July 2026 (data through May 31, 2026)',
    date: '2026-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/07/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf',
  },

  business_plan_2026: {
    title: '2026 Business Plan',
    date: '2026-06-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf',
  },
  bp2026_milestones: {
    partOf: 'business_plan_2026',
    title: 'Letter from the CEO — “Looking Ahead: Anticipated 2026 Milestones”',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf#page=13',
    page: 'p. XIII',
  },
  bp2026_costs: {
    partOf: 'business_plan_2026',
    title: 'Appendix B, Table B.1: Merced – Bakersfield Capital Cost Estimates (YOE $ in millions)',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf#page=75',
    page: 'p. 47',
  },
  bp2026_schedule: {
    partOf: 'business_plan_2026',
    title: 'Appendix D, Exhibit D.0: Merced – Bakersfield Timeline for Major Scope Items',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf#page=106',
    page: 'pp. 78–79',
  },
```

Normalise the six BuildHSR project URLs to the bare host — `https://buildhsr.com/project/…`.
`www.buildhsr.com` is inconsistent today (`www` on Muscat, San Joaquin and Peach) and the `www`
Muscat URL returned an empty document in a real browser while the bare host resolved.
`buildhsr_cairo`'s page body calls the structure the "Cairo Avenue grade separation" while the page
title is "Cairo Avenue Viaduct" — keep the page title as the registry `title` and let step 2's
verbatim quote carry the body wording.

Grouping is worth the mechanism here rather than clutter: it is what lets the 2026 Business Plan
carry three distinct locators (the CEO letter, Table B.1, Exhibit D.0 — previously two rows sharing
one URL, with the milestone claim uncited), and the same mechanism pins five CVSR reports under one
footnote instead of five sibling rows repeating the same publisher.

Callsite updates required by the renames:

- `business_plan_2026` → `bp2026_costs` at `src/components/Notes.tsx:43`,
  `src/components/SegmentDetail.tsx:60`, `src/components/StripChart.tsx:309`.
- `business_plan_2026_schedule` → `bp2026_schedule` at `src/App.tsx:336`,
  `src/components/Notes.tsx:55`.
- `cvsr_2020_08` → `cvsr_2020_06` in `src/data/structure-evidence.ts` (six entries, step 3).
- `authority_tulare_2025` / `authority_ventura_2026` → `hsr_tulare_2025` / `hsr_ventura_2026`
  (step 1).
- `grep -rn "authority_tulare_2025\|authority_ventura_2026\|cvsr_2020_08\|business_plan_2026_schedule" src scripts`
  must return nothing when the step is done. `business_plan_2026` survives as the parent key, so
  check its remaining uses by hand against the three callsites above.

### 9. Attach the specific citation where the code already knows it

Six callsites render bare footnote 4 (`cvsr`) for a claim a specific report proves.

1. **Legend definitions** — `src/components/Legend.tsx`. Cite `cvsr_2026_07` instead of `cvsr`, and
   make the structure caption match the source: `'All concrete work is complete, ready for punchlist and certification.'`
   (currently drops "is"). Verbatim at `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf` p. 18;
   the fuller form with "then ready for either track install or open to traffic" is on pp. 6 and 30.
   The guideway caption `'Earthworks complete with rough grading.'` is already verbatim (p. 7).
   `cvsr_2026_07` keeps `page` unset, because different claims cite different pages of it. Instead
   add an optional `page?: string` prop to `SourceLink`; when set it overrides `SOURCES[id].page` in
   the tooltip only, and the Legend uses
   `<SourceLink sourceId="cvsr_2026_07" page="pp. 6–7" />`. Also update `OFFICIAL_DEFINITIONS` in
   `src/lib/status.ts` — it is the verbatim record, so its doc comment must name the report and the
   pages the two definitions come from.
2. **Segment earthwork disagreement** — `scripts/build-segments.ts` pushes `disagreements` with
   `reportFile` but no URL. Add `reportUrl: observation.reportUrl!` (the tier-1 snapshot carries it;
   all ten current rows resolve to the July 2026 report). Add `reportUrl: string` to the
   `crossCheck.disagreements` type in `src/data/types.ts`. In `src/components/SegmentDetail.tsx`,
   replace the `<SourceLink sourceId="cvsr" />` on the `Earthwork · CVSR` row with the same `↗`
   anchor pattern `App.tsx`'s `ReportLink` uses (`href={disagreement.reportUrl}`,
   `title={disagreement.reportFile}`).
3. **Restatements** — all eight `cvsrInventory.revisions` entries name
   `CVSR-2206-2204-Data-FINAL-V0-A11Y.pdf` in `reportFile` but the type has no URL. Add
   `reportUrl?: string` to the `revisions` element type in `src/data/types.ts`, populate it in
   `scripts/lib/cvsr-inventory.ts` from the same `report-urls.json` lookup the snapshots use, and
   render a `↗` per revision row in `src/components/Notes.tsx`. Change the bullet's own
   `<SourceLink sourceId="cvsr" />` to `cvsr_2022_04` — every current restatement was corrected in
   that report.
4. **Segment station ranges** — 84 of 106 segments cite `cvsr` for their published station range,
   but every `stationing: "published"` range comes from the ArcGIS progress layer;
   `segment.sourceId` is overwritten to `'cvsr'` at `scripts/build-segments.ts:521` only because a
   CVSR row supplied the *completion*. Add `stationSourceId: SourceId` to `Segment`
   (`src/data/types.ts`), set it where the segment is constructed (`'arcgis_progress'` for all
   ArcGIS-derived ranges; `'cvsr'` for `CP1:gap:1`, whose coverage comes from the two named CVSR
   rows), never reassign it in the observation overlay, and cite `segment.stationSourceId` on the
   `Station` row in both `src/components/SegmentDetail.tsx:41` and
   `src/components/StripChart.tsx:291`. The `Earthwork completion` line keeps `segment.sourceId`.
5. **ROW note** — cite `cvsr_2020_03` for the 105-of-183 acquisition figure and `cvsr_2026_07` for
   164-of-176, per step 6.
6. **January-2020 ROW gap** — its `detail` already names the April 2020 report and pages
   13/25/34/43 but carries no `reportUrl`, so it falls back to footnote 4. Set
   `reportUrl: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_042120_FA_Central_Valley_Status_Report.pdf'`
   on that gap in `scripts/lib/cvsr-inventory.ts`. The 17 utility gaps and the four other
   ROW-delivery gaps stay on footnote 4: they record that **no** report published the metric, so a
   series-level reference is the honest citation and no single PDF can replace it.

### 10. Show which CVSR row an evidence quote came from

`StructureEvidence` carries `label`, but `SegmentDetail`/`StripChart` render only the quote. A CVSR
row whose label differs from the segment's name then reads as a claim about the segment: `CP1:176`
"San Joaquin River Viaduct" shows `South of Pergola Viaduct May-17 Sep-18 100%` for scrubber dates
2018-09 through 2020-05, which implies the viaduct was complete in 2018 when it completed in
February 2021. In both components, when `evidence.label !== segment.label`, prefix the quote with
`{evidence.label} — `. Leave `CVSR_ROW_CROSSWALK` alone: the mapping is a reviewed judgement, and
naming the row is what the reader needs.

### 11. Refresh the stale counts in `README.md`

Verified against `public/data/history.json` and `data/raw/cvsr/parsed-snapshots.json`
(`coverageStart 2019-03`, `coverageEnd 2026-05`, 87 expected and available months, three snapshots
carrying `perSegment`):

- "Package metrics for all 86 months" → 87.
- "per-segment observations for the two reports that publish row tables" → three reports, and name
  them: the June 2026 report (March 2026 data, 72 rows), the June 24, 2026 report (April 2026 data,
  85 rows), and the July 2026 report (May 2026 data, 85 rows).
- "an explicit inventory from March 2019 through April 2026" → through **May 2026**.
- "Segment-level CVSR history begins with March 2026 data; the earlier 84 CVSR months remain
  package-level" → 84 → 84 is correct (87 − 3); leave the count, keep the sentence.
- "Reviewed dated structure claims live in `src/data/structure-evidence.ts`" — after steps 1–3 this
  is still true; no change.
- Add the station-projection artifact to the "What the dashboard shows" bullet list, since step 4
  makes station positions derived rather than hardcoded.

## Critical files & anchors

- `src/data/sources.ts` — the whole registry is rewritten in step 8; `Source` gains `partOf`,
  `page`, `note`, and `date` becomes optional. Every other step's citation target lands here.
- `src/components/Citation.tsx` — `sourceNumber` → `sourceLabel`, nested `<ol>` in `SourcesList`,
  new `page` prop on `SourceLink`. This is what makes grouped numbering render.
- `scripts/lib/cvsr-parser.ts` — `packageCounts`'s `allActive` branch (the CP4 96 % defect), the new
  printed-percentage guard, and `FOOTNOTED_ROWS` whitespace normalisation. A parser change alters
  `parsed-snapshots.json`, so `npm run parse:cvsr` must rerun before `npm run fetch`.
- `scripts/build-segments.ts` — the station projection (step 4), `disagreements.reportUrl` (step 9.2)
  and `stationSourceId` (step 9.4). It already imports `nearestPointOnLine`, `point`,
  `geodesicDistanceToIosMile` and `formatOfficialMp`, so step 4 adds no dependency. Note line 521
  overwrites `segment.sourceId` from the CVSR observation; `stationSourceId` must be excluded from
  that overwrite.
- `src/components/StripChart.tsx` — the `STATIONS` constant (step 4), the `Station` row's citation
  (step 9.4), and the evidence-label prefix (step 10).
- `src/data/structure-evidence.ts` — the sixteen hand-reviewed entries whose dates, quotes and
  source ids change in steps 1–3.

## Verification

Run from the repo root. Step 5 changes the parser, so its reparse must run before anything that
reads `parsed-snapshots.json`.

```bash
npm run parse:cvsr     # reparse local PDFs; no network
npm run fetch          # rebuild centerline, segments, history from cached ArcGIS + parsed CVSR
npm test
npm run lint
npm run build
```

**Parser diff must be exactly the intended change.** Before editing, save a baseline:
```bash
jq -S '[.snapshots[]|{m:.dataMonth,p:.perPackage}]' data/raw/cvsr/parsed-snapshots.json > /tmp/before.json
```
After `npm run parse:cvsr`, regenerate as `/tmp/after.json` and `diff` them. Exactly two differences
are allowed: `CP4.guidewayMilesTotal` `22` → `21.2` for data months 2026-03, 2026-04 and 2026-05, and
`21.200000000000003` → `21.2` for 2025-04 through 2026-02. Every other value must be byte-identical.
If the parse throws instead, the printed-percentage guard has found a month whose breakdown does not
reproduce its own printed percentage; the audit found none across the 107 local PDFs, so treat a
throw as a genuine source inconsistency: read that report, and if the Authority's own arithmetic is
wrong, move that month into the existing `LEGACY_PROGRESS` hand-transcription table with the
report's printed values and a comment naming the page. Do not weaken the guard.

**New-behaviour checks (dev server at <http://localhost:5173/hsr-dashboard/>, scrubber at its last
tick, which is the ArcGIS poll date):**

1. Metric rail, `Guideway complete`: the CP4 row reads `CP4: 99%`, matching
   `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf` printed p. 4, "Construction Package 4 –
   21.1 complete (99.5%)". `percentLabel` clamps 99.5 % to 99 % because 21.1 < 21.2, which is its
   documented behaviour. The headline stays `89.1 / 119mi` — unchanged by design. Scrub back to the
   `2026-02` data month: CP4 still reads `99%`, so the regression is gone rather than moved.
2. Strip chart stations. In the console:
   `(await (await fetch('/hsr-dashboard/data/segments.json')).json()).stations` returns five rows
   whose `iosMile` values are `[0.52, 34.28, 59.34, 91.24, 170.50]` ±0.05, whose `officialMp` values
   are `C 124.5, S 158.3, S 183.3, S 215.2, S 294.5`, whose maximum `offsetMi` is 0.069, and whose
   `chordMi` values are `[0.02, 2.70, 2.46, 7.12, 0.86]` ±0.05. On the strip, `Fresno` now falls
   between the Fresno Trench (S 181.3–182.3) and Jensen Trench (S 185.0–185.7) segments and
   `Kings/Tulare` lands on the Hanford Viaduct (S 214.7–215.9) — hover the segment under each mark to
   read its milepost. Hover the `Kings/Tulare` label itself: the title reads
   `VTH Station (Between Lacey Blvd and SH 198) — S 215.2, ios mile 91.24; position interpolated
   across a 7.1 mi gap in the published alignment geometry`. Hover `Merced`: its title has no
   interpolation clause, because its chord is 0.02 mi. The strings `S 194`, `S 239`,
   `3.05 mi off the built alignment`, `Station site near CP1 north limit` and
   `unresolved source discrepancy` must not appear anywhere in the DOM.
3. Sources list: fifteen numbered `<li>`, with nested lettered lists under entries 3, 4 and 15.
   `[...document.querySelectorAll('a.fn-ref[href^="#fn-"]')].every((a) => document.getElementById(a.hash.slice(1)) !== null)`
   → `true`. Every `<a>` inside `.sources-list` must have a distinct `href`; no two entries share a
   URL except the three Business Plan locators, which differ by `#page=`.
4. Every source URL resolves. In a real browser (the `read` tool is bot-blocked on `hsr.ca.gov` and
   `buildhsr.com`), open each of the 21 URLs and confirm a non-404 document whose title matches the
   registry `title`. The two release URLs from step 1 and all six `https://buildhsr.com/project/…`
   URLs were confirmed this way during the audit; re-confirm after the edit.
5. Scrub to `2020-06`: select `CP1:176` (San Joaquin River Viaduct). The detail panel's Evidence
   line reads `“Finishing touches on the Arch Span and clean-up work.”` and is dated June 2020, not
   August 2020. Scrub to `2019-01`: the same segment's Evidence line is prefixed
   `South of Pergola Viaduct — ` so the 2018 row is not read as a claim about the whole viaduct.
6. Select any of the ten cross-check segments (e.g. `CP1:192`): the `Earthwork · CVSR` row shows a
   `↗` linking to
   `https://hsr.ca.gov/wp-content/uploads/2026/07/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf`,
   and the `Station` row's footnote resolves to `#fn-arcgis_progress` (3a), not `#fn-cvsr`.
7. Notes: the `Data anomalies` row for `2021-08–2022-03` carries a `↗` to
   `https://hsr.ca.gov/wp-content/uploads/2022/06/CVSR-2206-2204-Data-FINAL-V0-A11Y.pdf`. The
   `Right-of-way delivery (CP1, CP2-3, CP4): 2020-01` gap row carries a `↗` to the April 2020
   report. The seventeen `Utilities … 2019-03–2020-07` rows still resolve to footnote 4 — that is
   the intended behaviour, not a miss.
8. Notes prose: the difficulty bullet reads `about 1.6 mi` sourced from the artifact
   (`(await (await fetch('/hsr-dashboard/data/segments.json')).json()).overlaps.reduce((s,o)=>s+o.miles,0)`
   → `1.637…`), and the string `69 published months` no longer appears in the DOM.
9. Scrub to `2020-06` and select `CP1:184` (Golden State Boulevard Viaduct). The Evidence line reads
   `“Golden State Boulevard Viaduct: Poured Abutment 5 walls, columns and flare caps for Bents 3 and
   4; drilled Bent 2 and Abutment 1 Cast-In-Drilled-Hole (CIDH) piles.”` The strings `Bents 2, 3` and
   `Bents2` must not appear anywhere in the DOM.

**Grep gates:**
```bash
grep -rn "authority_tulare_2025\|authority_ventura_2026\|cvsr_2020_08\|business_plan_2026_schedule" src scripts   # → no matches
grep -rn "geodesic mile 59\|69 published months\|Bents 2, 3\|Bents2" src                                          # → no matches
grep -rn "S 194\|S 239\|3.05 mi off\|unresolved source discrepancy\|Station site near CP1" src                    # → no matches
grep -rn "www.buildhsr.com" src                                                                                   # → no matches
```

## Assumptions & contingencies

- **`accessed` is normalised to 2026-08-10**, matching `data/raw/arcgis/fetch-metadata.json`'s
  `fetchedAt` (`2026-08-10T04:38:17.410Z`); the registry's current `2026-08-09` matches nothing in
  the repo. If `npm run fetch` refreshes the ArcGIS cache during this work, take `accessed` and the
  four ArcGIS `date` values from the new `fetchedAt` and the live `editingInfo.lastEditDate` instead
  of the values written above.
- **ArcGIS `date` now means the layer's own last edit**, read from `editingInfo.lastEditDate` on
  each `FeatureServer/<n>?f=json` (progress 2026-05-04, alignment 2026-04-07, structures
  2026-06-04, stations 2025-03-18). Today three of the four carry `2026-08-09`, which is the access
  date wearing a publication date's clothes.
- **TS1 stays cited to the Wayback snapshots.** Both original `hsr.ca.gov` paths return an Incapsula
  challenge, not a 404, so the documents are probably still live but unretrievable here; the `note`
  records that. If a future check retrieves the originals, move the `hsr.ca.gov` URL into `url` and
  demote the Wayback link into `note`.
- **`hsr.ca.gov` and `buildhsr.com` are bot-protected.** Every live check in this plan must run
  through the real browser tool. Do not add a fetch-based link checker to the pipeline, and do not
  work around the protection — `README.md`'s integrity rules forbid it.
- **The Fresno River Viaduct entry keeps its `substantially_complete` claim at 2019-03.** The May
  2019 SB 1029 report also carries a photo caption reading "FRESNO RIVER VIADUCT GROUND BREAKING
  TOOK PLACE IN JUNE 2015 AND WAS COMPLETED SEPTEMBER 2017", and the CVSR row table reports the
  structure finishing Jun-19. Three sources give three dates for the same structure; the entry as
  scoped ("CP 1 work substantially completed", as of the report's March 2019 data) is the one the
  cited page states, so keep it and let the CVSR row supply the completion. If a reviewer decides
  the caption should win, add a second entry `fresno-river-complete-2017-09` with the caption as its
  verbatim quote rather than editing this one — `latestStructureEvidence` already handles multiple
  dated claims per segment.
- **Grouped locators are worth the mechanism.** If, once rendered, the nested lists read as clutter,
  the fallback is to collapse only the CVSR children — keep `cvsr`, `cvsr_2026_07` and `cvsr_2022_04`
  as parents' children and inline the other three reports' URLs at their single callsite through the
  existing `↗` `ReportLink` pattern. Do not fall back on the Business Plan grouping: three locators
  in one PDF is precisely the case flat rows handle badly.
- **Station positions come from the published station points, not from the TS1 schematic labels.**
  The TS1 2.1 sheet's inline station symbols carry whole mileposts (C124, S184, S215, S295) which are
  drafting annotations; the derived positions land within 0.7 mi of each and are the finer figure.
  This is the one place geometry is allowed to contribute, and only for position along the axis —
  the milepost itself is still read off the TS1-fitted `mileposts.json`, so TS1 continues to define
  the axis. If a later canonical document publishes a station milepost directly (a station-area
  plan, a Fresno or Kings/Tulare station EIR/EIS, or a revised TS1), prefer that number, keep the
  derived `offsetMi`/`chordMi` in the artifact as the reconciliation, and record the difference in
  the station tooltip.
- **`Madera Stop` at Avenue 19 and Road 26 is the current Madera site.** TS1 2.1 labels a superseded
  `MADERA / AVE 12` site with a maintenance facility at S 167; the Avenue 19 location is the one the
  2026 Business Plan uses to define the Central Valley Segment's north end. If a future refresh of
  the Stations layer moves this point, the build guards catch a position outside the axis or a
  non-monotonic order, and the derived value simply follows the layer.
- **The published alignment geometry has multi-mile holes and the plan reports rather than repairs
  them.** The largest is 7.12 mi between centerline vertices 3021 and 3022, spanning ios 88.2–95.4,
  which contains the Kings/Tulare station; the raw `data/raw/arcgis/alignment.json` has no vertices
  there either, so this is upstream. The bridged run is a dead-straight north–south tangent whose
  longitude matches the station point to five decimals, so interpolating across it is sound. Do not
  synthesise geometry to close the gap; the `chordMi` field and the tooltip clause are the whole
  treatment.
- **`plans/` is left untouched.** It is a historical record of previous rounds; this plan does not
  supersede `plans/amendment-4.md`, it corrects the per-package CP4 denominator that round left
  behind after fixing the program denominator.
