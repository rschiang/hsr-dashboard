## Context

The California High-Speed Rail Authority has published current, first-party material that the dashboard does not yet use: the Merced-to-Madera (M2M) civil-works procurement with named North/Wye/South design sections, the Locally Generated Alternative (LGA) procurement status, the awarded Track and Systems Construction Contract (TSCC) with its authorized packages, and the "CVS 119 Track and System Installation Forecast" published in the August 2026 Central Valley Status Report (data through June 30, 2026). Today the dashboard shows `M2M:gap:0` and `LGA:gap:0` as bare no-data spans and a hard-coded `Track installed: 0 mi`, which misstates a program that has an awarded track contract and a published installation forecast.

End state: one typed, source-backed delivery-outlook data module plus one below-fold presentation section that prefills what these documents actually publish, keeps procurement/forecast facts strictly separate from observed construction progress, and replaces the misleading zero track metric with a cited em dash.

Scope boundary: this change adds no map features, does not modify `src/components/StripChart.tsx`, `scripts/**`, `public/data/**`, or the CVSR ingest pipeline. Bringing August 2026 CVSR data into the strip is another team's work — do not touch it here.

## Approach

Steps 1–3 are data-only and independent of each other; step 4 depends on all three. The tree builds and existing tests pass after each step.

### 1. Register the new sources

Append these records to the `REGISTRY` object in `src/data/sources.ts` **after** the existing `business_plan_2026` group, in this order. `src/components/Citation.tsx` derives footnote numbers positionally from registry declaration order (`sourceLabel` uses `PARENT_IDS.indexOf(...) + 1`), so appending at the end leaves every existing footnote number unchanged.

`SourceRecord` requires `title`, `publisher`, and `url` on every record including children, so each child repeats a usable URL. Publisher is `'California High-Speed Rail Authority'` on every record below except `m2m_rfq_2026`.

| ID | `partOf` | title | date / page / accessed | url | note |
| --- | --- | --- | --- | --- | --- |
| `tscc_2025_presentation` | — | `Release of a Request for Proposals (RFP) for the Track and Systems Construction Contract (TSCC) procurement` | date `2025-11-20` | `https://hsr.ca.gov/wp-content/uploads/2025/11/2025-11-20-Agenda-Item-3-PPT-TSCC-V1-A11Y.pdf` | — |
| `tscc_2025_packages` | `tscc_2025_presentation` | `Planned packages and track-start requirement` | page `slides 4, 6-7` | same URL as parent | `Nine-package count, the planned NTP 1-9 enumeration, and the contract track-start requirement.` |
| `tscc_2025_term_sheet` | — | `Track and Systems Construction Contract Term Sheet` | date `2025-11-20`, page `pp. 1-8` | `https://hsr.ca.gov/wp-content/uploads/2025/11/2025-11-20-Agenda-Item-3-Term-Sheet-TSCC-V1-A11Y.pdf` | `Not the full contract; package sequencing and pricing may be revised.` |
| `tscc_award_presentation_2026` | — | `Approval to Award and Execute Track and Systems Construction Contract (TSCC)` | date `2026-06-01` | `https://hsr.ca.gov/wp-content/uploads/2026/05/2026-06-01-Agenda-Item-3-Track-and-Systems-PPT-V1-A11Y.pdf` | — |
| `tscc_award_packages_2026` | `tscc_award_presentation_2026` | `Awarded packages and Package 2 milestones` | page `slides 5-7` | same URL as parent | — |
| `tscc_resolution_2026` | — | `Resolution HSRA 26-07 - Approval to Execute and Award the Track & Systems Construction Contract and Issue Notices to Proceed for Package 1B and Package 2` | date `2026-06-01`, page `pp. 1-2` | `https://hsr.ca.gov/wp-content/uploads/2026/06/2026-06-01-Agenda-Item-3-Track-and-Systems-Final-Resolution-V1-A11Y.pdf` | `Binding award and initial notice-to-proceed authorization.` |
| `cvsr_2026_08` | `cvsr` (already exists) | `Central Valley Status Report, August 2026 (data through June 30, 2026)` | date `2026-06-01` | `https://hsr.ca.gov/wp-content/uploads/2026/08/FA-Central-Valley-Status-Report-August-2026-A11Y.pdf` | — |
| `cvsr_2026_08_forecast` | `cvsr_2026_08` | `CVS 119 Track and System Installation Forecast` | page `p. 11` | parent URL + `#page=11` | `Published as a chart image; mileages and quarter ranges are transcribed from the slide.` |
| `cvsr_2026_08_railhead` | `cvsr_2026_08` | `Railhead overview` | page `pp. 3, 38` | parent URL + `#page=38` | — |
| `m2m_board_presentation_2026` | — | `Issuance of a Request for Qualifications (RFQ) for the Merced to Madera (M2M) Civil Works Collaborative Design-Build procurement` | date `2026-06-24`, page `slides 2-8` | `https://hsr.ca.gov/wp-content/uploads/2026/06/2026-06-24-Agenda-Item-4-M2M-PPT-A11Y.pdf` | `Original board request; superseded on schedule and value by the July 2026 material.` |
| `m2m_resolution_2026` | — | `Resolution HSRA 26-10 - Approval to Release a Request for Qualifications for Collaborative Design-Build Services for Merced to Madera Civil Works and Award Pre-Proposal Collaboration Agreements` | date `2026-06-24`, page `pp. 1-2` | `https://hsr.ca.gov/wp-content/uploads/2026/06/2026-06-24-Agenda-Item-4-M2M-Final-Resolution-HSR26-10-A11Y.pdf` | `Authorizes the RFQ and two collaboration agreements, not a design-build award.` |
| `m2m_rfq_2026` | — | `Cal eProcure Event HSR26-16 - Merced to Madera Civil Works` | date `2026-07-31`, accessed `2026-08-14` | `https://caleprocure.ca.gov/event/2665/HSR26-16` | `Current RFQ Addendum 1 as checked August 14, 2026; supersedes the June 24 draft.` — publisher `California Department of General Services, California State Contracts Register` |
| `m2m_rfq_sections_2026` | `m2m_rfq_2026` | `Section limits, Figure 1, and scope of work` | page `Addendum 1, Exhibit A, pp. 2-8` | parent URL unchanged (the event page has no stable deep link) | — |
| `m2m_prebid_2026` | — | `M2M Civil Works Pre-Bid Presentation` | date `2026-07-16`, page `slides 24-38` | `https://hsr.ca.gov/wp-content/uploads/2026/07/M2M-Pre-Bid-Presentation-A11Y.pdf` | `Current procurement schedule and value, the approximately 30% reference-design scope, and the major-segments figure.` |
| `m2m_procurement_2026` | — | `Merced to Madera Civil Works` | accessed `2026-08-14` | `https://hsr.ca.gov/work-with-us/procurements/architectural-engineering-and-capital-contracts/merced-to-madera-civil-works/` | `Live procurement status page.` |
| `procurement_schedule_2026` | — | `Procurement Schedule` | accessed `2026-08-14` | `https://hsr.ca.gov/work-with-us/procurements/procurement-schedule/` | `Live schedule; the LGA entry is the Authority's own current status for that procurement.` |
| `lga_environmental_record` | — | `Fresno to Bakersfield: Locally Generated Alternative - Environmental Documents` | date `2019-10-31`, accessed `2026-08-14` | `https://hsr.ca.gov/programs/environmental-planning/project-section-environmental-documents-tier-2/fresno-to-bakersfield-locally-generated-alternative/` | `Approved environmental alignment context, not a construction contract.` |

Do **not** register the January 2026 CEO-report track graphic or the January board transcript. The August 2026 CVSR forecast is newer, is the Authority's published forecast rather than a slide marked `CONFIDENTIAL DRAFT`, and supersedes that sequence.

### 2. Add the delivery-outlook data module

New file `src/data/delivery-outlook.ts`. It follows the maintained-evidence pattern of `src/data/structure-evidence.ts`: hand-maintained typed constants with per-record `sourceId`, imported directly by components. No existing module holds procurement or forecast facts, so this is new. Official values never go into JSX and never into `public/data/*`.

Types:

```ts
export type DeliveryFactState = 'reported' | 'authorized' | 'forecast' | 'planned';
export type Quarter = { year: number; quarter: 1 | 2 | 3 | 4 };
export type DeliveryTiming =
  | { kind: 'date'; date: string }
  | { kind: 'quarters'; year: number; quarters: readonly (1 | 2 | 3 | 4)[] }
  | { kind: 'verbatim'; label: string };
export type DeliveryFact = {
  id: string;
  label: string;
  state: DeliveryFactState;
  timing?: DeliveryTiming;
  value?: string;
  sourceId: SourceId;
};
export type SourcedNote = { id: string; text: string; sourceId: SourceId };
export type M2MSection = {
  id: 'north' | 'wye' | 'south';
  label: string;
  miles: number;
  approximate: boolean;
  tracks: 'single' | 'double';
  stationStart: string;
  stationEnd: string;
  features: readonly string[];
  sourceId: SourceId;
};
export type M2MOption = { id: 'sr152' | 'downtown-merced'; label: string; features: readonly string[]; sourceId: SourceId };
export type M2MLegendEntry = { abbr: 'BR' | 'OH' | 'UP'; expansion: string };
export type DeliveryProgram = {
  id: 'm2m' | 'lga' | 'tscc';
  heading: string;
  status: string;
  sourceId: SourceId;
  facts: readonly DeliveryFact[];
};
export type ForecastActivity =
  | 'guideway_subgrade'
  | 'survey'
  | 'track_ocs_design'
  | 'mobilization'
  | 'pre_track_work'
  | 'track_laying'
  | 'ocs_installation'
  | 'system_installation';
export type ForecastBand = { activity: ForecastActivity; start: Quarter; end: Quarter };
export type ForecastPackage = {
  cp: 'CP1' | 'CP2-3' | 'CP4';
  miles: number;
  subSegments: readonly { id: string; label: string; miles: number }[];
  anchors: readonly string[];
  bands: readonly ForecastBand[];
};
export type TrackMetricSummary = { value: '—'; unit: 'mi'; chip: string; ariaLabel: string; sourceId: SourceId };
export type DeliveryContext = {
  anchor: '#delivery-m2m' | '#delivery-lga' | '#delivery-track';
  state: string;
  summary: string;
  sourceId: SourceId;
};
```

Exports: `DELIVERY_OUTLOOK_AS_OF = '2026-08-14'`, `M2M_SECTIONS`, `M2M_OPTIONS`, `M2M_LEGEND`, `M2M_SCOPE_NOTES`, `TSCC_PACKAGES`, `TSCC_PACKAGE_2_MILESTONES`, `DELIVERY_PROGRAMS` (ordered `m2m`, `lga`, `tscc`), `TRACK_FORECAST`, `ACTIVITY_LABELS`, `TRACK_METRIC`, `DELIVERY_CONTEXT_BY_PACKAGE`.

Invariant: nothing here may be read by `deriveStatuses` or `selectedCompletions` in `src/lib/status.ts`, mapped to an `AlignmentStatus`, or written into `public/data/*`. Procurement scope and forecast dates are not observed progress.

**M2M** — `DELIVERY_PROGRAMS[0]`: heading `M2M civil works`, status `Active procurement`, `sourceId: 'm2m_procurement_2026'`. Facts, in order:

| id | label | state | timing / value | sourceId |
| --- | --- | --- | --- | --- |
| `m2m-rfq-release` | `RFQ HSR26-16 released` | `reported` | date `2026-07-09` | `m2m_procurement_2026` |
| `m2m-scope` | `Guideway scope` | `reported` | value `Approximately 30.3 miles, Merced to the CP1 interface in Madera County` | `m2m_rfq_sections_2026` |
| `m2m-soq-due` | `Statements of qualifications due` | `forecast` | date `2026-09-29` | `m2m_procurement_2026` |
| `m2m-shortlist` | `Shortlist of two teams` | `forecast` | verbatim `Late October 2026` | `m2m_procurement_2026` |
| `m2m-rfp-ppca` | `RFP issued and collaboration agreements awarded` | `forecast` | verbatim `December 2026` | `m2m_procurement_2026` |
| `m2m-proposals-due` | `Proposals due` | `forecast` | verbatim `October 2027` | `m2m_procurement_2026` |
| `m2m-nopa` | `Notice of proposed award` | `forecast` | verbatim `November 2027` | `m2m_procurement_2026` |
| `m2m-estimated-value` | `Estimated design and construction value` | `forecast` | value `$2.4 billion including collaboration agreements` | `m2m_prebid_2026` |
| `m2m-ppca-ceiling` | `Pre-proposal collaboration agreements` | `authorized` | value `Two agreements, $17 million each ($34 million total)` | `m2m_resolution_2026` |
| `m2m-reference-design` | `Authority reference design furnished to bidders` | `reported` | value `Approximately 30% design level` | `m2m_prebid_2026` |

**LGA** — `DELIVERY_PROGRAMS[1]`: heading `LGA civil works`, status `Developing scope`, `sourceId: 'procurement_schedule_2026'`. Facts:

| id | label | state | timing / value | sourceId |
| --- | --- | --- | --- | --- |
| `lga-environmental-alignment` | `Approved environmental alignment` | `reported` | value `23.13 miles, Poplar Avenue in Shafter to Bakersfield` | `lga_environmental_record` |
| `lga-station` | `Station location` | `reported` | value `F Street at State Route 204` | `lga_environmental_record` |
| `lga-delivery-method` | `Delivery method` | `reported` | value `Progressive design-build` | `procurement_schedule_2026` |
| `lga-solicitation` | `Solicitation` | `forecast` | `{ kind: 'quarters', year: 2026, quarters: [3, 4] }` | `procurement_schedule_2026` |
| `lga-award` | `Tentative award` | `forecast` | `{ kind: 'quarters', year: 2027, quarters: [1, 2] }` | `procurement_schedule_2026` |

The LGA card additionally renders the exact sentence `The Authority publishes no construction sections or civil-works contract for this alignment yet, so the dashboard shows it as one unsegmented span.` Do not reuse the archived 18.5-mile LGA design-services scope as a construction scope — it is a different, closed contract.

**TSCC** — `DELIVERY_PROGRAMS[2]`: heading `Track & Systems`, status `Awarded · Packages 1B and 2 authorized`, `sourceId: 'tscc_resolution_2026'`. Facts:

| id | label | state | value | sourceId |
| --- | --- | --- | --- | --- |
| `tscc-award` | `Contract HSR25-89 awarded` | `reported` | `Kiewit, Stacy Witbeck, Herzog - A Joint Venture` | `tscc_resolution_2026` |
| `tscc-ceiling` | `Contract ceiling` | `authorized` | `$3.5 billion not-to-exceed` | `tscc_resolution_2026` |
| `tscc-scope` | `Contract scope` | `reported` | `Track, overhead contact system, and related work on the 171-mile Early Operating Segment` | `tscc_2025_term_sheet` |
| `tscc-future-approval` | `Later packages` | `reported` | `Each remaining notice to proceed requires a further Board approval` | `tscc_resolution_2026` |
| `tscc-track-start-backstop` | `Contract track-start requirement` | `reported` | `Start track construction no later than December 15, 2026` | `tscc_2025_packages` |

`TSCC_PACKAGES: readonly DeliveryFact[]`, in package order, ids `tscc-package-1b` … `tscc-package-9`:

| package | label | state | value | sourceId |
| --- | --- | --- | --- | --- |
| 1B | `Package 1B` | `authorized` | `$118,110,340 time-and-materials/not-to-exceed · design development for OEM procurement, estimating for Packages 5-7, preconstruction and program management` | `tscc_award_packages_2026` |
| 2 | `Package 2` | `authorized` | `$260,843,101 lump sum · civil, track, and OCS construction within CP4` | `tscc_award_packages_2026` |
| 3 | `Package 3` | `planned` | `Civil, track, and OCS construction within CP2-3` | `tscc_2025_packages` |
| 4 | `Package 4` | `planned` | `Civil, track, and OCS construction within CP1` | `tscc_2025_packages` |
| 5 | `Package 5` | `planned` | `Mobilization of traction power, train control, telecommunications, and SCADA installation and testing teams, with long-lead systems procurement` | `tscc_2025_term_sheet` |
| 6 | `Package 6` | `planned` | `Train control and communications systems for the 119-mile First Construction Section` | `tscc_2025_term_sheet` |
| 7 | `Package 7` | `planned` | `Traction power system` | `tscc_2025_term_sheet` |
| 8 | `Package 8` | `planned` | `Merced Extension` | `tscc_2025_term_sheet` |
| 9 | `Package 9` | `planned` | `Bakersfield Extension` | `tscc_2025_term_sheet` |

Packages 8 and 9 are base scope of the 171-mile contract awaiting a notice to proceed — **not** contract options. Render `planned` as the visible text `Not yet authorized`.

`TSCC_PACKAGE_2_MILESTONES: readonly DeliveryFact[]`, all `state: 'forecast'`, all `sourceId: 'tscc_award_packages_2026'`:

- `cp4-track-start` / `Commence laying track` / date `2026-11-30`
- `cp4-track-completion` / `Complete track construction` / date `2027-06-14`
- `cp4-ocs-completion` / `Complete OCS construction` / date `2027-10-18`

### 3. Encode the CVS 119 track and system installation forecast

`TRACK_FORECAST` mirrors the chart on p. 11 of the August 2026 CVSR and nothing else:

```ts
export const TRACK_FORECAST = {
  title: 'CVS 119 Track and System Installation Forecast',
  asOf: '2026-06-30',
  sourceId: 'cvsr_2026_08_forecast',
  riskWindow: { start: { year: 2029, quarter: 3 }, end: { year: 2029, quarter: 4 } },
  packages: [ /* CP1, CP2-3, CP4 in chart order */ ],
} as const;
```

Package mileages, sub-segments, and anchors, exactly as printed:

| cp | miles | subSegments (id / label / miles) | anchors |
| --- | --- | --- | --- |
| `CP1` | 31.6 | `1a` `1A` 23.8 · `1b` `1B` 2.7 · `1c` `1C` 5.1 | `Madera Station`, `Fresno Station` |
| `CP2-3` | 65.6 | `s1` `S1` 16.9 · `s2` `S2` 22.3 · `s3` `S3` 26.4 | `Fresno Railhead`, `Kings/Tulare Station` |
| `CP4` | 21.1 | `north` `North` 15.0 · `south` `South` 6.1 | `Southern Railhead` |

Bands are recorded at package level as the envelope of that activity across the package. The chart draws some preparatory activities per sub-segment and draws pre-track work and track laying as diagonal progress lines; a single package-level start/end quarter is the only reading that does not require guessing interior cell boundaries. Do not encode per-sub-segment bands or line direction.

| cp | activity | start | end |
| --- | --- | --- | --- |
| CP1 | `guideway_subgrade` | Q1 2025 | Q3 2026 |
| CP1 | `survey` | Q3 2026 | Q4 2026 |
| CP1 | `track_ocs_design` | Q4 2026 | Q4 2027 |
| CP1 | `pre_track_work` | Q4 2027 | Q2 2028 |
| CP1 | `track_laying` | Q1 2028 | Q4 2028 |
| CP1 | `ocs_installation` | Q3 2028 | Q1 2029 |
| CP1 | `system_installation` | Q1 2029 | Q2 2029 |
| CP2-3 | `guideway_subgrade` | Q1 2025 | Q4 2026 |
| CP2-3 | `survey` | Q2 2026 | Q3 2026 |
| CP2-3 | `track_ocs_design` | Q3 2026 | Q4 2027 |
| CP2-3 | `pre_track_work` | Q1 2027 | Q1 2028 |
| CP2-3 | `track_laying` | Q4 2027 | Q3 2028 |
| CP2-3 | `ocs_installation` | Q4 2027 | Q4 2028 |
| CP2-3 | `system_installation` | Q1 2029 | Q2 2029 |
| CP4 | `survey` | Q1 2025 | Q4 2025 |
| CP4 | `track_ocs_design` | Q1 2026 | Q2 2026 |
| CP4 | `mobilization` | Q3 2026 | Q3 2026 |
| CP4 | `pre_track_work` | Q3 2026 | Q1 2027 |
| CP4 | `track_laying` | Q4 2026 | Q2 2027 |
| CP4 | `ocs_installation` | Q2 2027 | Q3 2027 |
| CP4 | `system_installation` | Q1 2029 | Q2 2029 |

CP4 has no `guideway_subgrade` band: the same report records CP4 final completion in August 2025.

`ACTIVITY_LABELS: Readonly<Record<ForecastActivity, string>>` uses the chart's own wording: `Guideway subgrade completion`, `Survey`, `Track and OCS detailed design`, `Mobilization`, `Pre-track work`, `Track laying`, `OCS installation`, `System installation`.

Render a `Quarter` as `Q{quarter} {year}`; render a band as `Q4 2026 – Q2 2027`, or as the single quarter when start equals end. No other date arithmetic.

`TRACK_METRIC`:

```ts
export const TRACK_METRIC: TrackMetricSummary = {
  value: '—',
  unit: 'mi',
  chip: 'CP4 track laying forecast Q4 2026',
  ariaLabel: 'Track installed: not published. The Authority forecasts CP4 track laying beginning in the fourth quarter of 2026 and requires track construction to start no later than December 15, 2026, but publishes no installed-track mileage total and no monthly track-installation series.',
  sourceId: 'cvsr_2026_08_forecast',
};
```

`DELIVERY_CONTEXT_BY_PACKAGE: Readonly<Record<ConstructionPackage, DeliveryContext>>` — exact strings:

| key | anchor | state | summary | sourceId |
| --- | --- | --- | --- | --- |
| `M2M` | `#delivery-m2m` | `Active procurement` | `RFQ HSR26-16 covers this extension as North, Wye, and South design sections. Procurement scope, not construction progress.` | `m2m_rfq_sections_2026` |
| `LGA` | `#delivery-lga` | `Developing scope` | `Progressive design-build procurement not yet released; no construction sections published.` | `procurement_schedule_2026` |
| `CP4` | `#delivery-track` | `TSCC Package 2 authorized` | `Track laying forecast Q4 2026 - Q2 2027; OCS installation Q2 - Q3 2027.` | `tscc_award_packages_2026` |
| `CP2-3` | `#delivery-track` | `TSCC Package 3 not yet authorized` | `Track laying forecast Q4 2027 - Q3 2028; OCS installation Q4 2027 - Q4 2028.` | `cvsr_2026_08_forecast` |
| `CP1` | `#delivery-track` | `TSCC Package 4 not yet authorized` | `Track laying forecast Q1 2028 - Q4 2028; OCS installation Q3 2028 - Q1 2029.` | `cvsr_2026_08_forecast` |

### 4. Prefill the M2M design sections

`M2M_SECTIONS`, in chart order North → Wye → South, from RFQ Addendum 1:

| id | label | miles | approximate | tracks | stationStart | stationEnd |
| --- | --- | --- | --- | --- | --- | --- |
| `north` | `North Segment` | 9.6 | `false` | `single` | `8097+00` | `8602+12.91` |
| `wye` | `Wye Segment` | 6.1 | `false` | `single` | `8602+2.91` | `8924+20` |
| `south` | `South Segment` | 14.6 | `true` | `double` | `8924+20` | `9694+71.00` |

All three carry `sourceId: 'm2m_rfq_sections_2026'`. Store the ten-foot North/Wye station overlap exactly as printed — do not normalize either string. `approximate: true` renders the length as `~14.6 mi`.

`features`, verbatim from Figure 1, in the order printed, not geocoded:

- North: `Miles Creek BR`, `Owens Creek BR`, `Duck Slough BR`, `Hydraulic BR3`, `Hydraulic BR4`, `Hydraulic BR5`, `Hydraulic BR6`, `Le Grand OH`, `Deadman Creek BR`, `Sandy Mush Rd UP`, `Dutchman Creek BR`
- Wye: `Ave 26 UP`, `Chowchilla River BR #1`, `Washington Rd (Ave 25) UP`, `Ash Slough BR, NB`, `Ave 23 1/2 UP, NB`, `Road 12 UP, NB`, `Ash Slough BR, SB`, `Ave 23 1/2 UP, SB`, `Road 12 UP, SB`, `Aerial #3`
- South: `Berenda Slough BR`, `Aerial #2`, `Road 19 1/2 Multiuse Trail UP`, `Road 20 UP`, `Road 22 UP`, `Berenda Creek BR`, `Ave 20 1/2 UP`, `Dry Creek BR`

`M2M_OPTIONS` — discretionary work the RFQ keeps out of base scope:

- `sr152` / `SR-152 improvements` / features `SR 152/SR 233 grade separation with tight diamond interchange`, `SR 152/Road 16 separation`, `SR 152/Road 17 1/2 overhead` / `m2m_rfq_sections_2026`. Use these RFQ sentences rather than transcribing the diagram's overlapping red callouts.
- `downtown-merced` / `Extension to Downtown Merced` / features `[]` / `m2m_board_presentation_2026`.

`M2M_LEGEND`: `BR` → `bridge`, `OH` → `overhead structure (Type 2)`, `UP` → `underpass structure (Type 1)`.

`M2M_SCOPE_NOTES` — exact ids, text, and sources:

- `m2m-features-preliminary` / `Structure names come from the RFQ reference design and are preliminary; spelling and scope may change when the construction contract is awarded.` / `m2m_rfq_sections_2026`
- `m2m-limits-caveat` / `The RFP will more clearly delineate the Project limits and lengths of major work elements.` / `m2m_rfq_sections_2026`
- `m2m-reference-design-caveat` / `The approximately 30% reference design may change during the collaborative pre-proposal phase.` / `m2m_prebid_2026`
- `m2m-civil-exclusions` / `Civil scope excludes track work and track-level permanent drainage, passenger stations, geotechnical investigations, third-party utility design and relocations, right-of-way engineering and acquisition, sound walls, and systems work.` / `m2m_rfq_sections_2026`
- `m2m-wye-label` / `The board presentation legend labels this the Wye/Mid Segment; the RFQ text calls it the Wye Segment.` / `m2m_board_presentation_2026`

The RFQ's design stationing and its 30.3-guideway-mile measure have no verified transform to the dashboard's TS1/IOS axis. Keep `M2M:gap:0` and its geometry as they are: no `segments.json` change, no North/Wye/South boundaries on the map or strip, no conversion of procurement sections into progress.

### 5. Present it and fix the track metric

**New component** `src/components/DeliveryOutlook.tsx`, signature `export function DeliveryOutlook(): React.ReactElement`. It reads only the constants from step 2–4 and holds no official value of its own. Structure, following the existing `aria-labelledby` convention of `Legend`, `NotesList`, and `SourcesList`:

```
<section id="delivery-outlook" className="delivery-outlook" aria-labelledby="delivery-outlook-heading">
  <header>
    <h2 id="delivery-outlook-heading">Delivery outlook</h2>
    <p>Current procurement and forecast, sources checked Aug. 14, 2026. Independent of the time scrubber.</p>
  </header>
  <div className="delivery-grid"> … three articles … </div>
</section>
```

- `<article id="delivery-m2m" className="delivery-card delivery-card-wide" aria-labelledby="delivery-m2m-heading">` — `<h3 id="delivery-m2m-heading">` from `DELIVERY_PROGRAMS[0].heading`; status; the fact table; a section table with label, length, track configuration, and station limits; a proportional bar per section captioned `Schematic - relative section lengths, not mapped geometry`; the three feature lists as `<ul>`; the legend; `M2M_SCOPE_NOTES`; a link `View official segment diagram (July 16, 2026 pre-bid briefing)` to `https://hsr.ca.gov/wp-content/uploads/2026/07/M2M-Pre-Bid-Presentation-A11Y.pdf#page=33` (the June deck's slide 8 schedule is superseded, so do not link it as current); and `M2M_OPTIONS` under a heading `Option work (not in base scope)`.
- `<article id="delivery-lga" className="delivery-card" aria-labelledby="delivery-lga-heading">` — heading, status, fact table, and the unsegmented-span sentence.
- `<article id="delivery-track" className="delivery-card" aria-labelledby="delivery-track-heading">` — heading, status, TSCC fact table, `TSCC_PACKAGES` list, `TSCC_PACKAGE_2_MILESTONES`, then the `TRACK_FORECAST` table: one row group per package showing mileage, sub-segment mileages, anchors, and each band's activity label and quarter range, captioned `Forecast as of June 30, 2026` plus the risk window `Q3 2029 – Q4 2029` and the transcription note from the source record.

Every state renders as its own text (`Reported`, `Authorized`, `Forecast`, `Not yet authorized`) — never color alone. Cite each fact with `SourceLink` from `src/components/Citation.tsx`.

**`src/App.tsx`** — render `<DeliveryOutlook />` as the first child of the existing `.below-fold` section (before `<Legend />`). In `MetricRail`, delete the `TRACK_ARIA_LABEL` constant and change the first `MetricBlock` to `value={TRACK_METRIC.value} unit={TRACK_METRIC.unit} chip={<>{TRACK_METRIC.chip} <SourceLink sourceId={TRACK_METRIC.sourceId} /></>} ariaLabel={TRACK_METRIC.ariaLabel}`. Keep `value` and `unit` as separate props so `MetricBlock`'s existing `.metric-unit` span survives. Keep `trackSeries` all-null: the completed railhead is enabling infrastructure, not installed mainline mileage.

**`src/components/SegmentDetail.tsx`** — add prop `deliveryContext?: DeliveryContext` and, when present, render one row immediately after the existing `Package · status` pair inside the same `<dl>`: `<dt>Delivery outlook</dt>` and a `<dd>` with `{state} — {summary}`, a `SourceLink sourceId={deliveryContext.sourceId}`, and `<a href={anchor}>` labelled `See outlook`. `App` passes `deliveryContext={DELIVERY_CONTEXT_BY_PACKAGE[selectedSegment.cp]}` at the existing callsite. The record is total over `ConstructionPackage`, so no missing-key path exists. Leave shared `selectedId`, map/strip synchronization, and keyboard behavior untouched — the detail panel is the actionable surface because strip-tooltip links are intentionally inert.

**`src/components/Abbr.tsx`** — widen `Abbreviation` to `ConstructionPackage | 'CVY' | 'CVSR' | 'TSCC' | 'OCS'` and add `TSCC: 'Track and Systems Construction Contract'` and `OCS: 'overhead contact system'`.

**`src/components/Notes.tsx`** — rewrite the existing `Track installation` list item (currently citing `bp2026_milestones` and `bp2026_schedule` for a "bare zero") to state that the Authority now has an awarded track contract with Packages 1B and 2 authorized, that CP4 track laying is forecast for Q4 2026 under a contract requirement to start no later than December 15, 2026, and that the block shows an em dash over a dashed baseline because no installed-track mileage total or monthly series is published. Cite `tscc_resolution_2026` and `cvsr_2026_08_forecast`. Keep the dense package and section detail in `DeliveryOutlook`.

**`src/App.css`** — extend the existing grid rather than adding a new layout system:

- line 4 `.below-fold`: `grid-template-areas: 'delivery delivery' 'notes legend' 'sources sources';`
- add `.delivery-outlook { grid-area: delivery; }`
- add `.delivery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }`
- add `.delivery-card { align-self: start; padding: var(--space-4); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }` (matches `.legend-panel`)
- add `.delivery-card-wide { grid-column: 1 / -1; }`
- add `.delivery-card table { width: 100%; }` and `.delivery-scroll { overflow-x: auto; }` around the forecast and station tables
- in the existing `@media (max-width: 64rem)` block: `.below-fold { grid-template-areas: 'delivery' 'legend' 'notes' 'sources'; }`, `.delivery-grid { grid-template-columns: minmax(0, 1fr); }`, `.delivery-card-wide { grid-column: auto; }`

## Critical files & anchors

- `src/data/sources.ts` — `REGISTRY`; append after `business_plan_2026` so positional footnote numbers stay stable, and note `cvsr` already exists as the parent for CVSR children.
- `src/components/Citation.tsx` — `sourceLabel`, `SourceEntry`; children print only what they add, and every record needs `title`/`publisher`/`url`.
- `src/App.tsx` — `MetricRail`'s first `MetricBlock` (the `value="0" unit="mi"` track block) and the `.below-fold` section; both are the insertion points.
- `src/data/structure-evidence.ts` — the maintained-evidence shape to copy for `delivery-outlook.ts`.
- `src/components/StripChart.tsx` — `CP_BOUNDARIES`; read-only reference. Do not project RFQ stationing or forecast mileages onto this axis.

## Verification

1. Add `src/data/delivery-outlook.test.ts` using `node:test` and `node:assert/strict`, matching `src/lib/status.test.ts`. Append it to the file list in `package.json`'s `test` script. Assert:
   - `M2M_SECTIONS` is ordered north/wye/south; `Number(M2M_SECTIONS.reduce((sum, s) => sum + s.miles, 0).toFixed(1)) === 30.3` (the raw float sums to 30.299999999999997, so the rounding is required); `south.approximate === true` and the other two `false`; the six station strings match the table above, including `8602+12.91` against `8602+2.91`.
   - `TRACK_FORECAST.packages` is ordered `CP1`, `CP2-3`, `CP4`; each package's sub-segment mileages sum to within 0.05 of its printed total; `CP4` has no `guideway_subgrade` band; every band's end quarter is at or after its start; `CP4` `track_laying` is Q4 2026 → Q2 2027 and `CP1` `track_laying` is Q1 2028 → Q4 2028.
   - `TSCC_PACKAGES` is ordered 1B, 2, 3…9; only `1b` and `2` are `authorized`; 3–9 are `planned`; no record uses a state outside `DeliveryFactState`; `TSCC_PACKAGE_2_MILESTONES` carries exactly `2026-11-30`, `2027-06-14`, `2027-10-18`.
   - `TRACK_METRIC.value === '—'` and `TRACK_METRIC.ariaLabel` contains neither `0` nor the word `zero`.
   - `DELIVERY_CONTEXT_BY_PACKAGE` has one entry per `ConstructionPackage` value, and every `sourceId` in the module resolves in `SOURCES`.

2. From the repository root on Node `^20.19.0` or `>=22.12.0`:

   ```bash
   npm test
   npm run lint
   npm run build
   npm run preview -- --host 127.0.0.1
   ```

   All four must exit zero. `npm run fetch`/`ingest:cvsr` are **not** run: no generated artifact changes.

3. Open the preview at `/hsr-dashboard/` (the production base path, serving the committed `public/data`) and confirm:
   - The first metric-rail block reads `Track installed`, `— mi`, chip `CP4 track laying forecast Q4 2026` with a footnote; its sparkline is still a dashed no-data baseline; its accessible name says no installed-track total or monthly series is published.
   - `Delivery outlook` appears above Notes/Legend/Sources with three articles. M2M shows 9.6 / 6.1 / ~14.6 mi, the exact station strings, single/single/double, all 29 feature labels across three lists, the preliminary-names note, the legend, option work, and the segment-diagram link. LGA shows `Developing scope`, the 23.13-mile alignment, `Q3/Q4 2026`, and `Q1/Q2 2027`. Track & Systems shows the award, Packages 1B/2 authorized and 3–9 `Not yet authorized`, the three Package 2 dates, and the forecast table with `31.6` / `65.6` / `21.1` mi, sub-segments `1A 23.8` … `South 6.1`, `Track laying Q4 2026 – Q2 2027` for CP4, and the `Q3 2029 – Q4 2029` risk window.
   - Drag the TimeScrubber to an earlier month: segment colors and CVSR metrics replay as before, the outlook does not change, and no forecast turns a segment `track_laid` or `systems_installed`.
   - Select `M2M:gap:0`, `LGA:gap:0`, and one segment each in CP4, CP2-3, and CP1 from the strip using the keyboard. Each detail panel shows the matching `Delivery outlook` row; `See outlook` jumps to the right article and the map/strip selection survives.
   - Below the `64rem` breakpoint the three cards stack, the forecast and station tables scroll horizontally instead of truncating station strings, and every state is readable as text without color.
   - Tab to each new `SourceLink` and the segment-diagram link: footnote targets land on the right parent/child entries in Sources, the pre-bid PDF opens at page 33, and the Cal eProcure record is labelled Addendum 1.

## Assumptions & contingencies

- The forecast is presented as a current planning layer with `asOf` June 30, 2026, not a historical series. The time scrubber keeps controlling only observed snapshot/segment data.
- `— mi` is deliberate. The Authority publishes railhead completion and future track milestones but no installed-track mileage. Never substitute CP4's 21.1-mile package extent, and never sum forecast mileages into an "installed" figure.
- Band quarters in step 3 are transcribed from a chart image; the values in this plan are the transcription of record. If a later CVSR publishes the same chart with a machine-readable table or visibly different bands, update the values and bump the source record to that report.
- If Cal eProcure event HSR26-16 is unreachable when implementing, keep the source record with its `accessed` date and note; if a newer addendum has changed a station string or length, use the newer document's value and update the record's date. If the Addendum cannot be retrieved at all, ship only the corroborated facts (30.3-mile total, section names, options, exclusions) and omit station strings and feature lists rather than publishing values that cannot be reverified.
- If the Board authorizes a further notice to proceed before implementation, change only that `TSCC_PACKAGES` record from `planned` to `authorized` and add its resolution as a source; the rest of the model is unaffected.
- If a first-party source reports actual track laying, change `cp4-track-start` from `forecast` to `reported` and keep the forecast citation as provenance. Keep `TRACK_METRIC.value` at `'—'` until a source publishes an installed-track mileage total.
