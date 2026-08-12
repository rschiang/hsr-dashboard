# Data refinement: May 2026 ingest, 119-mile invariant, ROW gap recovery

## Context

Three asks against `hsr-dashboard`:

1. Ingest `data/raw/cvsr/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf` (May 2026 data) — it is downloaded but unregistered and unparsed; `coverageEnd` is still `2026-04`.
2. "Guideway complete" fluctuates 115 → 118 → 119 → 118 → 119 across the scrubber. Root cause found: `src/App.tsx` builds the headline denominator by summing the three packages' *published* denominators, which move with contract scope and reporting precision. The corridor never changed.
3. Fill data gaps where a canonical source exists. Located exactly one: January 2020 cumulative parcels delivered to the design-builder, published in the April 2020 report. No canonical source exists for the 17 utility months or the four 2019 ROW-delivery months; those stay typed gaps with a citation explaining why.

End state: replay runs through May 2026, the guideway headline reads `… / 119 mi` at every tick, railroad parcels never masquerade as ordinary ROW, and every month either shows a published number or a typed gap that names what the source withheld.

### Verified facts this plan depends on

Parsed from the July PDF (isolated `npm run parse:cvsr` run) and confirmed against `pdftotext -layout` of the source:

| Metric | May 2026 | Where |
|---|---|---|
| Structures | 65 / 92 (CP1 24/33, CP2-3 30/48, CP4 11/11) | p6 `Overall 1 26 65 92` |
| Guideway | 89 / 119 published; packages sum 89.1 (11 + 57 + 21.1) | p7 `Overall 9 21 89 119` |
| Utilities | 1,721 / 1,826 | p8 `Total 105 1,721 1,826` |
| ROW delivered | **2,288 / 2,288, program only — no package split published** | p2 exec summary |
| Railroad ROW | 164 / 176 (CP1 80/89, CP2-3 55/58, CP4 29/29) | p10 |

Four defects the July layout exposes:

- `parseDeliveryTable` matches `CP 1-4 – Real Property/Right-of-Way (ROW) **Railroad**` because the heading regex does not exclude `Railroad`. The July report retired the ordinary CP 1-4 ROW page, so the railroad table is now the first match: the rail would show **164 / 176** as right-of-way delivered.
- CP2-3 row labels gained a `(1.86 Miles)` suffix. Resolved observations collapse 85 → 31. Stripping the suffix restores exactly 49/49 CP2-3 guideway matches (verified against `data/raw/arcgis/progress.json`).
- The July report's superscript footnotes are unregistered, so `AAAT 1`, `Ave 241`, `Ave 1561`, `Cross Creek1` fail the structure crosswalk (4 rows) and 15 substantially-complete guideway rows lose their footnote claim.
- `coverageEnd` is `2026-04`, so May would be an out-of-coverage month even once parsed.

Guideway denominator provenance, per parsed month:

| First month | CP1 + CP2-3 + CP4 denominators | Rendered |
|---|---|---|
| 2019-03 | 29.2 + 65 + 21 | 115 |
| 2020-01 | 32 + 65 + 21 | 118 |
| 2020-12 | 32 + 65 + 22 | 119 |
| 2025-04 | 32 + 65 + **21.2** | 118 |
| 2026-03 | 32 + 65 + 22 | 119 |

CP4's denominator is not a published constant: `packageCounts` derives it from whichever exec-summary sentence the report happens to print. April 2025 says "21.1 complete (99.5%), 0.1 underway, 0 not started" → total 21.2. May 2026 says "21.1 complete (99.5%), 0.1 underway, all guideway miles started" → falls through to the hard-coded fallback 22. Meanwhile every report states the program total directly: the May report prints `Overall … 89 … 119`, the April 2025 report prints `Total Guideway : 119` and `Overall … 119`, and the earliest report in the corpus (`brdmtg_052119`, March 2019 data) prints "Central Valley 119 Miles". 119 is a program constant; the package denominators are not summands of it.

## Approach

Steps 1–7 are independent edits; step 8 reads the artifacts they produce and must run after them; step 9 adds the tests. Nothing here refreshes `data/raw/arcgis/**` — see Assumptions.

### 1. Register the July report and extend coverage

`scripts/fetch-cvsr.ts`:

- Line 617: `coverageEnd: '2026-04'` → `coverageEnd: '2026-05'`.
- Line 411: `if (dataMonth === '2026-04' && rowProgress.length > 0)` → `if (dataMonth >= '2026-04' && rowProgress.length > 0)`, so the 35-structure resolution guard covers every current-layout report, not just April.

Do **not** add the July report to `REVIEWED_CVSR_REPORTS`; that register is for reports recovered outside the normal corpus and is deliberately never probed. `npm run resolve:cvsr-urls` resolves this one on its own: `parseReportMonth` reads `July 2026` from the `CENTRAL VALLEY STATUS REPORT / July 2026 (Data Through May 31, 2026)` heading, producing the candidate `https://hsr.ca.gov/wp-content/uploads/2026/07/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf`, which serves `application/pdf` (confirmed live). It writes the byte-verified entry into `data/raw/cvsr/report-urls.json`.

`data/raw/cvsr/MANIFEST.md` is generated — do not hand-edit; `npm run fetch:cvsr` rewrites it after the parse.

`plans/data-refinement.md` in the repo is a superseded earlier draft of this work. Replace its contents with this plan so the checked-in `plans/` directory does not carry two conflicting versions.

### 2. Never read a railroad table as ordinary ROW delivery

`scripts/lib/cvsr-parser.ts`, `parseDeliveryTable` (line 547) — add the negative lookahead:

```ts
const heading = /CP\s*1-4\s*[–—-]\s*Real Property\/Right-of-Way\s*\(ROW\)(?!\s*Railroad)[\s\S]{0,100}?(?:To Be Delivered vs\. Delivered|Parcels Delivered to DB)/i.exec(text);
```

`parseRailroadParcelPair` already owns that table and stays untouched. After this change the July report yields `parseParcelPair(text, cp) === null` for all three packages, which is correct: the report publishes no package ROW split. Step 6 turns that into a typed gap instead of a parse failure.

Do **not** recover CP4's `ROW Parcels 0 / 223 (100%) / 223` from the CP4 overview page (p37). That box is the PCM contract summary for a closed package, sourced under its own footnote 1, and substituting it for the ROW delivery series is the same class of defect this step removes. One rule: package ROW delivery comes only from CP-level ROW delivery tables.

### 3. Add a program-level parcels parser and cross-check it

`scripts/lib/cvsr-parser.ts`, new export next to `parseParcelPair`:

```ts
/**
 * Cumulative parcels delivered to the design-builder as the report states it for
 * CP 1-4. Recorded only when the report prints the pair itself; package tables are
 * never summed into it.
 */
export function parseProgramParcelDelivery(text: string): CountPair | null {
  const match = /All required parcels have been delivered\s*[\u2014\u2013-]\s*([0-9,]+)\s+of\s+([0-9,]+)/i.exec(text);
  if (!match) return null;
  return validateCountPair({ delivered: integer(match[1]), total: integer(match[2]) }, 'program parcels');
}
```

`src/data/types.ts`, `SnapshotFields` (lines 145–150) — replace `aggregate` wholesale. It was a derived sum of packages, read by nothing but the duplicate-report comparison, and keeping a derived field under the same name as a published one is exactly the ambiguity this change removes:

```ts
  /** Values the report prints for CP 1-4 as a program total, never a sum of packages. */
  program?: {
    parcelsDelivered?: number;
    parcelsTotal?: number;
  };
```

`scripts/fetch-cvsr.ts`, `parsePdf` (lines 480–499 and 520) — delete the four `packageMetrics.reduce` sums and the `aggregate` construction, and emit `program` instead:

```ts
  const packageMetrics = Object.values(perPackage);
  const packageSum = (key: 'parcelsDelivered' | 'parcelsTotal'): number | undefined => {
    let total = 0;
    for (const metrics of packageMetrics) {
      const value = metrics[key];
      if (typeof value !== 'number') return undefined;
      total += value;
    }
    return total;
  };
  const programParcels = parseProgramParcelDelivery(text);
  const summedDelivered = packageSum('parcelsDelivered');
  const summedTotal = packageSum('parcelsTotal');
  if (
    programParcels
    && summedDelivered !== undefined
    && summedTotal !== undefined
    && (programParcels.delivered !== summedDelivered || programParcels.total !== summedTotal)
  ) {
    throw new Error(
      `${reportFile}: published program parcels ${programParcels.delivered}/${programParcels.total} disagree with the package sum ${summedDelivered}/${summedTotal}`,
    );
  }
  const program = programParcels
    ? { parcelsDelivered: programParcels.delivered, parcelsTotal: programParcels.total }
    : undefined;
```

Return `program` in place of `aggregate` (line 520 → `...(program ? { program } : {})`), and swap both duplicate-comparison payloads (lines 552–553) from `aggregate: …` to `program: …`. Import `parseProgramParcelDelivery` alongside `parseParcelPair`.

This cross-check has teeth on the April 2026 report, which prints both forms: 2,288 / 2,288 against 1,080 + 985 + 223.

### 4. Restore row → segment resolution for the July layout

`scripts/lib/cvsr-parser.ts`:

a. Register the July footnotes in `FOOTNOTED_ROWS` (line 32). These 22 strings are verbatim `pdf-parse` output — copy them exactly, including the two with a space before the `1`:

```ts
  'FA-Central-Valley-Status-Report-July-2026-A11Y.pdf': [
    'Belmont Avenue1',
    'Road 261',
    'Excelsior Ave1',
    'AAAT 1',
    'Ave 241',
    'Ave 1561',
    'Cross Creek1',
    'SR 43 Tied Arch to Cole Slough (0.36 Miles)1',
    'Conejo Ave to Peach Ave (0.23 Miles)1',
    'Elkhorn Ave to Fowler Ave (0.55 Miles)1',
    'Fowler Ave to Davis Ave (1.35 Miles)1',
    'Cole Slough to Access Road (0.33 Miles) 1',
    'Kings River to Dover Ave (1.29 Miles)1',
    'Dover Ave to Excelsior Ave (1.01 Miles)1',
    'Hanford Armona to Houston Ave (1.04 Miles)1',
    'Ave 156 to SR 43 Tule River (1.58 Miles)1',
    'Alpaugh Bridge to Ave 56 (0.95 Miles)1',
    'Access Road to Dutch John Cut (0.22 Miles) 1',
    'Excelsior Ave to Flint Ave (2.04 Miles)1',
    'Houston Ave to Idaho Ave (2.0 Miles)1',
    'Fargo Ave to Grangeville Ave (1.04 Miles)1',
    'Ave 88 to Deer Creek (2.14 Miles)1',
  ],
```

The reviewed allowlist is load-bearing, not a convenience: the same report contains a genuine CP1 structure named **`Avenue 11`** (Sep-17 → Jul-20, 100%). A generic "strip a trailing 1" rule would silently rename it to `Avenue 1`. Never generalise this.

The existing `cp === 'CP1' ? 'partially_open' : 'substantially_complete'` rule is already correct for July: the CP1 footnote (p18) reads "Partially Open structures…", the CP2-3 footnotes (p30/31, p33/34) read "Substantially completed…".

b. In `parseRowProgress` (lines 119–124), strip a trailing published mileage after the footnote strip:

```ts
    let location = match.groups.location;
    let footnote: CvsrRowProgress['footnote'] = null;
    if (footnoted.has(location)) {
      location = location.replace(/\s*1$/, '');
      footnote = cp === 'CP1' ? 'partially_open' : 'substantially_complete';
    }
    // July 2026 appends the published span to guideway labels. ArcGIS `Limits` and the
    // structure crosswalk both key on the bare label; `quote` keeps the verbatim line.
    location = location.replace(/\s*\(\d+(?:\.\d+)?\s*Miles\)$/i, '');
```

Order matters — the footnote digit sits outside the parenthesis. Verified end to end: all 49 CP2-3 guideway rows, `Herndon Canal to Swift Ave (1.88 Miles)` → the reviewed `CP1:gap:1` mapping, and the 4 footnoted CP2-3 structures resolve, giving **85 resolved observations and 68 unmatched rows** — identical to April. No ArcGIS `Limits` value ends in a parenthesised mileage, so no existing match is disturbed.

### 5. Publish-aware aggregates, fixed corridor denominator, honest percentages

New file `src/lib/rail-metrics.ts` — pure data and formatting, extracted from `App.tsx` so it is unit-testable (there is no DOM test harness in this repo):

```ts
import type { CvsrGap, Snapshot } from '../data/types';
import type { NumericPackageMetric } from './cvsr-series';

/**
 * The Central Valley construction segment, CP 1-4, is 119 miles. Every report in the
 * corpus states it — `brdmtg_052119` (March 2019 data) as "Central Valley 119 Miles",
 * the April 2025 report as `Total Guideway : 119`, the July 2026 report as
 * `Overall 9 21 89 119`. Package denominators move with contract scope and with which
 * sentence a given report happens to print, so their sum is not the corridor length.
 */
export const CENTRAL_VALLEY_GUIDEWAY_MILES = 119;

export type ProgramMetric = keyof NonNullable<Snapshot['program']>;

export type RailMetric = {
  label: string;
  value: NumericPackageMetric;
  total: NumericPackageMetric;
  /** Published program value, preferred over the package sum when the report printed one. */
  programValue?: ProgramMetric;
  programTotal?: ProgramMetric;
  /** Program denominator that does not vary by report. */
  fixedTotal?: number;
  unit?: string;
  /** CVSR revision family this metric belongs to; marks restated package cells. */
  revisedAs?: 'progress' | 'parcels' | 'utilities';
  /** CVSR gap metric that explains a blank or partial month for this block. */
  gapMetric?: CvsrGap['metric'];
  format: (value: number, total: number) => string;
  /** Rendering when the source published a count but no denominator. */
  formatPartial?: (value: number) => string;
};

export const RAIL_METRICS: readonly RailMetric[] = [
  {
    label: 'Guideway complete',
    value: 'guidewayMilesComplete',
    total: 'guidewayMilesTotal',
    fixedTotal: CENTRAL_VALLEY_GUIDEWAY_MILES,
    unit: 'mi',
    revisedAs: 'progress',
    format: (value, total) => `${value.toFixed(1)} / ${total.toFixed(0)}`,
  },
  {
    label: 'Structures complete',
    value: 'structuresComplete',
    total: 'structuresTotal',
    revisedAs: 'progress',
    format: (value, total) => `${value} / ${total}`,
  },
  {
    label: 'Right-of-way delivered',
    value: 'parcelsDelivered',
    total: 'parcelsTotal',
    programValue: 'parcelsDelivered',
    programTotal: 'parcelsTotal',
    revisedAs: 'parcels',
    gapMetric: 'parcel_delivery',
    format: (value, total) => `${value.toLocaleString()} / ${total.toLocaleString()}`,
    formatPartial: (value) => value.toLocaleString(),
  },
  {
    label: 'Utilities relocated',
    value: 'utilitiesRelocated',
    total: 'utilitiesTotal',
    revisedAs: 'utilities',
    gapMetric: 'utilities',
    format: (value, total) => `${value.toLocaleString()} / ${total.toLocaleString()}`,
  },
];

/** Sum over the packages that reported the metric; `undefined` unless every one did. */
export function sumPackages(
  snapshot: Snapshot | undefined,
  key: NumericPackageMetric,
): number | undefined {
  const packages = Object.values(snapshot?.perPackage ?? {});
  if (packages.length === 0) return undefined;
  let total = 0;
  for (const metrics of packages) {
    const value = metrics[key];
    if (typeof value !== 'number') return undefined;
    total += value;
  }
  return total;
}

/** A published program value beats a package sum; a fixed corridor total beats both. */
export function railMetricValues(
  snapshot: Snapshot | undefined,
  metric: RailMetric,
): { value: number | undefined; total: number | undefined } {
  const program = snapshot?.program;
  return {
    value: (metric.programValue ? program?.[metric.programValue] : undefined)
      ?? sumPackages(snapshot, metric.value),
    total: metric.fixedTotal
      ?? (metric.programTotal ? program?.[metric.programTotal] : undefined)
      ?? sumPackages(snapshot, metric.total),
  };
}

export function formatRailValue(
  metric: RailMetric,
  value: number | undefined,
  total: number | undefined,
): string {
  if (value === undefined) return '—';
  if (total === undefined) return metric.formatPartial?.(value) ?? '—';
  return metric.format(value, total);
}

/** 21.1 of 21.2 miles is not a finished package: never round an incomplete measure to 100%. */
export function percentLabel(value: number, total: number): string {
  if (!(total > 0)) return '—';
  const rounded = Math.round((value / total) * 100);
  return `${value < total ? Math.min(rounded, 99) : rounded}%`;
}
```

`src/App.tsx`:

- Delete the local `sumPackages` (lines 36–49) and `RAIL_METRICS` (lines 294–309); import `RAIL_METRICS`, `formatRailValue`, `percentLabel`, `railMetricValues` from `./lib/rail-metrics`. `CP_COLORS` and `TRACK_ARIA_LABEL` stay.
- Lines 372–373 and 382 become:

```ts
        const { value, total } = beforeCoverage
          ? { value: undefined, total: undefined }
          : railMetricValues(snapshot, metric);
```
```ts
            value={formatRailValue(metric, value, total)}
```

- Lines 397–399 become `percent: packageValue === undefined || packageTotal === undefined ? '—' : percentLabel(packageValue, packageTotal)`.
- Update the `MetricRail` doc comment (lines 313–318): the rail prefers a value the report published for CP 1-4, falls back to the sum over packages that all reported it, and uses the fixed 119-mile corridor denominator for guideway.

Per-package sparklines keep using each package's own published denominator (`buildCvsrSeries` is unchanged) — the fixed total is a program-level statement, not a rewrite of package history.

Register the new test file: `package.json` line 15, append ` src/lib/rail-metrics.test.ts` to the `test` script.

### 6. Typed gaps for what the source withheld

`src/data/types.ts`, `CvsrGapCause` (lines 174–179) — add two causes. Both render beside a real number, so "Not published in source" would misread:

```ts
  | 'package_split_not_reported'
  | 'total_not_reported'
```

`src/lib/cvsr-gaps.ts`, `GAP_LABELS` (line 65) — the `Record<CvsrGapCause, string>` type forces both entries:

```ts
  package_split_not_reported: 'Package split not published',
  total_not_reported: 'Total not published',
```

`scripts/lib/cvsr-inventory.ts` — replace `PARCEL_OMISSION_MONTHS` (line 77) with a register that carries cause and packages, and export a lookup:

```ts
/**
 * Audited months where the reports publish no per-package cumulative
 * parcels-delivered-to-design-builder pair. Each entry says what the source
 * published instead, so a withheld measure is never a parser failure and never a
 * substituted value.
 */
export type ReviewedParcelOmission = {
  months: readonly string[];
  packages: readonly CvsrPackage[];
  cause: Extract<CvsrGapCause, 'related_measure_only' | 'source_not_reported' | 'total_not_reported' | 'package_split_not_reported'>;
  detail: string;
};

export const PARCEL_OMISSIONS: readonly ReviewedParcelOmission[] = [
  {
    months: monthRange('2019-09', '2019-12'),
    packages: [...CVSR_PACKAGES],
    cause: 'related_measure_only',
    detail: 'The report publishes package parcel acquisition, needed and remaining counts; it does not publish parcels certified and delivered to the design-builder. The acquisition series is displayed separately.',
  },
  {
    months: ['2020-01'],
    packages: [...CVSR_PACKAGES],
    cause: 'total_not_reported',
    detail: 'Cumulative parcels delivered to the design-builder for January 2020 are recovered from the April 2020 report (data through February 2020), which publishes them only as chart images: 1,498 program total on page 13, CP 1 785 on page 25, CP 2-3 557 on page 34, CP 4 156 on page 43. That report publishes no January total-needed count — its 1,066 / 1,011 / 253 figures are a March 9, 2020 count — so no denominator is recorded for this month.',
  },
  {
    months: ['2026-05'],
    packages: [...CVSR_PACKAGES],
    cause: 'package_split_not_reported',
    detail: 'The July 2026 report retires the per-package right-of-way delivery tables and publishes only the program result — all 2,288 of 2,288 parcels delivered. No package split is published for this month, and the April 2026 split is not carried forward.',
  },
];

export function parcelOmission(month: string, cp: CvsrPackage): ReviewedParcelOmission | undefined {
  return PARCEL_OMISSIONS.find((entry) => entry.months.includes(month) && entry.packages.includes(cp));
}
```

Import `CvsrGapCause` into that file's type imports. Replace the `PARCEL_OMISSION_MONTHS` loop in `buildCvsrInventory` (lines 154–162):

```ts
  for (const entry of PARCEL_OMISSIONS) {
    for (const month of entry.months) {
      gaps.push({
        month,
        metric: 'parcel_delivery',
        packages: [...entry.packages],
        cause: entry.cause,
        detail: entry.detail,
      });
    }
  }
```

Sharpen the utilities gap detail (line 150) so the note says why no source can fill it:

```ts
      detail: 'Package utility relocation counts are first published in the August-2020-data report; earlier reports publish only third-party agreement schedules and target milestones against a different denominator — the April 2020 report counts 20 of 87 CP 2-3 relocations where the first standardized report counts 187 of 692. The two are not the same series and are not merged.',
```

`scripts/fetch-cvsr.ts` — swap the import (line 28) from `PARCEL_OMISSION_MONTHS` to `parcelOmission`, and the field-failure guard (line 592):

```ts
      if (metrics?.parcelsTotal === undefined && !parcelOmission(snapshot.dataMonth, cp)) {
```

### 7. Recover January 2020 parcels delivered

The April 2020 report is already byte-verified in `data/raw/cvsr/report-urls.json`. Its "Parcel Delivery to DB Summary" charts carry an actual-cumulative series starting at Jan-20. Reading, cross-checked three ways: the package values sum exactly to the program chart's Jan-20 actual label (785 + 557 + 156 = 1,498, against a planned label of 1,499), and the same charts' Feb-20 actual/planned pair (1,512 / 1,570) reconciles with the report's March 9 delivered-to-date total of 1,570 under its own note 3.

`scripts/fetch-cvsr.ts` — widen `LEGACY_PARCELS` (line 211) to carry an optional denominator and an optional provenance override, and add the January entry keyed by the report whose data month it is:

```ts
const LEGACY_PARCELS: Readonly<Record<string, {
  /** Replaces TRANSCRIPTION_DETAIL when the value comes from a later report. */
  detail?: string;
  values: Record<CvsrPackage, { delivered: number; total?: number }>;
}>> = {
  'brdmtg_082019_FA_Central_Valley_Status_Report.pdf': {
    values: {
      CP1: { delivered: 819, total: 892 },
      'CP2-3': { delivered: 533, total: 755 },
      CP4: { delivered: 164, total: 208 },
    },
  },
  'brdmtg_091719_FA_Central_Valley_Status_Report.pdf': {
    values: {
      CP1: { delivered: 823, total: 893 },
      'CP2-3': { delivered: 540, total: 756 },
      CP4: { delivered: 165, total: 210 },
    },
  },
  'brdmtg_031720_FA_Central_Valley_Status_Report.pdf': {
    detail: 'Reviewed transcription from a later report: January 2020 cumulative parcels delivered to the design-builder are published only as chart images in the April 2020 report (data through February 2020) — program total 1,498 on page 13, CP 1 785 on page 25, CP 2-3 557 on page 34, CP 4 156 on page 43. https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_042120_FA_Central_Valley_Status_Report.pdf. That report publishes no January total-needed count, so no denominator is recorded.',
    values: {
      CP1: { delivered: 785 },
      'CP2-3': { delivered: 557 },
      CP4: { delivered: 156 },
    },
  },
};
```

`parsePdf` (lines 458–464) — a transcription may now be delivered-only, so the pair can no longer be assigned as a unit:

```ts
    const transcribed = LEGACY_PARCELS[reportFile];
    const transcribedParcels = transcribed?.values[cp];
    if (transcribedParcels) {
      perPackage[cp].parcelsDelivered = transcribedParcels.delivered;
      if (transcribedParcels.total !== undefined) perPackage[cp].parcelsTotal = transcribedParcels.total;
      (perPackage[cp].transcribedFields ??= []).push('parcels');
      if (transcribed.detail !== undefined) perPackage[cp].transcriptionDetail = transcribed.detail;
    } else {
      const parcels = parseParcelPair(text, cp);
      if (parcels) {
        perPackage[cp].parcelsDelivered = parcels.delivered;
        perPackage[cp].parcelsTotal = parcels.total;
      }
    }
```

`src/data/types.ts`, `PackageMetrics` — add beside `transcribedFields` (line 134):

```ts
  /** Overrides TRANSCRIPTION_DETAIL when the transcribed value came from a later report. */
  transcriptionDetail?: string;
```

`scripts/lib/cvsr-inventory.ts`, the transcription flatMap (lines 185–202) — use the override when present:

```ts
      const fields: Array<'progress' | 'parcels'> = [];
      let detail: string | undefined;
      for (const cp of CVSR_PACKAGES) {
        const metrics = snapshot.perPackage?.[cp];
        for (const field of metrics?.transcribedFields ?? []) {
          if (!fields.includes(field)) fields.push(field);
        }
        detail ??= metrics?.transcriptionDetail;
      }
      if (fields.length === 0) return [];
      fields.sort((a, b) => (a === b ? 0 : a === 'progress' ? -1 : 1));
      return [{
        month: snapshot.dataMonth,
        reportFile: snapshot.reportFile ?? '',
        fields,
        detail: detail ?? TRANSCRIPTION_DETAIL,
      }];
```

Result at the 2020-01 tick: the rail reads `1,498` (package sum, no denominator) with the status chip "Total not published"; the sparkline point stays null because no ratio exists.

### 8. Re-derive the segment cross-check against an asynchronous ArcGIS layer

The latest tier-1 snapshot becomes 2026-05, which moves CP2-3 guideway complete from 55 to 57. The ArcGIS side does not move with it, and the reason is not the poll time:

- `data/raw/arcgis/fetch-metadata.json` `fetchedAt` is **2026-08-10T04:38:17Z** — when we polled.
- The layer's own `editingInfo.lastEditDate` is **2026-05-04T23:03:48Z** (live `…/FeatureServer/0?f=json`), already recorded as `SOURCES.arcgis_progress.date: '2026-05-04'` with `accessed: '2026-08-09'`. The Authority has not edited the layer in the three months since. Poll time is not data vintage.
- The layer is also not a single clean vintage. Compared segment by segment against CVSR April and CVSR May: `CP2-3:113` (0.66) and `CP2-3:156` (0.98) match **May** exactly and disagreed with April; `CP2-3:122`, `CP2-3:162`, `CP2-3:166`, `CP2-3:141` still sit at April-or-older values (0.52, 0.85, 0.85, 0.98) against May's 1.0. It is edited feature by feature, so no "reconcile against month M" rule exists to write.

That rules out pinning the reconciliation to a vintage month; the guard has to be a tolerance, and the tolerance has to be sized for a source that lags by up to a report month per feature.

`scripts/build-segments.ts`:

- Replace the comment above the cross-check block (lines 438–441) and widen both bounds — line 473 `> 1.5` → `> 2.5`, line 483 `> 2` → `> 3.5`:

```ts
// Per-package cross-check against the latest published CVSR. Earthwork-equivalent
// miles (Σ span × ArcGIS completion) and the CVSR's "guideway miles complete" are
// independent measures of the same thing, but they are asynchronous. The CVSR is a
// month-end report; the BuildHSR layer is edited feature by feature and was last
// touched 2026-05-04 (SOURCES.arcgis_progress.date), so individual guideways sit
// anywhere between April and May month-end regardless of when we poll it. One report
// month of a single package's guideway progress is larger than the old 1.5-mile bound
// — CP2-3 alone added 2.0 miles in May 2026 — so the bounds are sized to absorb that
// and still catch a package-scale error. Spread today: total 86.95 vs 89.1 mi
// (-2.15); CP1 -0.55, CP2-3 -1.27, CP4 -0.33.
```

- Line 528: `disagreements.length !== 6` → `!== 10`. All ten are genuine published differences between the two live sources: `CP1:189` 0% vs 60%, `CP1:192` 56% vs 79%, `CP2-3:109` 100% vs 99%, `CP2-3:120` 35% vs 43%, `CP2-3:121` 0% vs 2%, `CP2-3:122` 52% vs 100%, `CP2-3:124` 93% vs 98%, `CP2-3:141` 98% vs 100%, `CP2-3:162` 85% vs 100%, `CP2-3:166` 85% vs 100%. (`CP2-3:109` is the inverse case: ArcGIS reads 100% where the May report prints 99% under its "substantially completed … treated as completed" footnote. Leave it in — the report's published number is 99%.)
- Lines 520–527 need no change: 35/35 structures, 49 guideway matches and 68 unmatched rows all hold after step 4.

`src/components/SegmentDetail.tsx` line 57 hard-codes the CVSR month in the disagreement rows, so every one of the ten would be labelled "April 2026 data". Make both vintages explicit — this is what makes ten disagreements legible instead of alarming:

```tsx
            <dt>Earthwork · ArcGIS</dt>
            <dd>{Math.round(disagreement.arcgis * 100)}% · layer updated {SOURCES.arcgis_progress.date} <SourceLink sourceId="arcgis_progress" /></dd>
            <dt>Earthwork · CVSR</dt>
            <dd>{Math.round(disagreement.cvsr * 100)}% · {disagreement.cvsrMonth} data <SourceLink sourceId="cvsr" /></dd>
```

Add `import { SOURCES } from '../data/sources';` to that file; it currently imports only `SourceLink` from `./Citation`.

### 9. Tests

Add to `scripts/lib/cvsr-parser.test.ts` (same `node:test` + `node:assert/strict` style as the existing file; pass `reportFile` explicitly rather than relying on `rowReportFile`):

- `parseParcelPair` returns `null` for a `CP 1-4 – Real Property/Right-of-Way (ROW) Railroad` / `To Be Delivered vs. Delivered` section with rows `CP 1 9 80 89`, and `parseRailroadParcelPair` returns `{ delivered: 80, total: 89, remaining: 9 }` for the same text. This is the 164/176 regression.
- `parseProgramParcelDelivery` reads `2,288 / 2,288` from the em-dash sentence and returns `null` for text without it.
- `parseRowProgress` strips `(1.86 Miles)` from a guideway label while `quote` keeps the verbatim line.
- `parseRowProgress` marks `Cross Creek1` as `substantially_complete` with location `Cross Creek`, and leaves the genuine CP1 row `Avenue 11` untouched with `footnote: null`.

Add `src/lib/rail-metrics.test.ts`:

- `railMetricValues` prefers `snapshot.program.parcelsDelivered/parcelsTotal` over package sums, and returns `{ value: 1498, total: undefined }` when packages report deliveries but no totals.
- The guideway metric returns `total === 119` for a snapshot whose package denominators sum to 115, to 118.2 and to 119.
- `formatRailValue` yields `'1,498'` for a value with no total, `'—'` for no value, and `'89.1 / 119'` for the May guideway pair.
- `percentLabel(21.1, 21.2) === '99%'`, `percentLabel(11, 11) === '100%'`, `percentLabel(918, 992) === '93%'`, `percentLabel(0, 0) === '—'`.

## Critical files & anchors

- `scripts/lib/cvsr-parser.ts` — `FOOTNOTED_ROWS` (line 32), `parseRowProgress` location handling (119–124), `parseDeliveryTable` heading (547). The three places the July layout breaks.
- `scripts/fetch-cvsr.ts` — `parsePdf` metric assembly (450–521), `parseLocalPdfs` field-failure loop and `buildCvsrInventory` call (588–621). Every snapshot field and every coverage constant is set here.
- `scripts/lib/cvsr-inventory.ts` — `PARCEL_OMISSION_MONTHS` (77) and the gap/transcription construction (144–202). Typed gaps and recovered values are distinguished here, not in the UI.
- `src/App.tsx` — `MetricRail` (319–425). The only consumer of the rail aggregate; the fluctuating denominator is line 373 feeding line 382.
- `scripts/build-segments.ts` — cross-check block (438–531). Hard-coded expectations that a new latest snapshot moves.

## Verification

Run from the repo root, in order. Every command is offline except the first.

1. `npm run resolve:cvsr-urls` — expect `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf: verified https://hsr.ca.gov/wp-content/uploads/2026/07/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf` and `0 unresolved`.
2. `npm run parse:cvsr` — expect `parsed data month 2026-05-01` for the July file and `CVSR parse: 87 monthly snapshots from 88 candidate reports`. Any `CVSR parser failures:` throw means a step above is incomplete.
3. Inspect `data/raw/cvsr/parsed-snapshots.json` for the 2026-05 snapshot: `program` is `{"parcelsDelivered":2288,"parcelsTotal":2288}`; no package carries `parcelsDelivered`; `perPackage.CP1.railroadParcelsAcquired` is 80; `Object.keys(perSegment).length` is 85; `unmatchedCvsrRows.length` is 68. For 2020-01: `perPackage.CP1.parcelsDelivered` is 785 with no `parcelsTotal`. `cvsrInventory.coverageEnd` is `2026-05`, `expectedMonths.length` and `availableMonths.length` are both 87, and `gaps` holds 23 entries — 17 utilities, 4 `related_measure_only`, 1 `total_not_reported`, 1 `package_split_not_reported`, 0 `snapshot`.
4. `npx tsx scripts/build-segments.ts && npx tsx scripts/build-history.ts` — expect `cross-check vs CVSR 2026-05: 35/35 structures, 49 guideways, 68 unmatched rows, 10 disagreements` and `history: months=91 (through 2026-05)`. Do **not** run `npm run fetch`; it re-polls all four ArcGIS layers and rewrites `fetchedAt` (see Assumptions).
5. `npm run fetch:cvsr` — regenerates `MANIFEST.md`; confirm the 2020-01 transcription row carries the April-2020 provenance sentence and that the unresolved-URL list is `- none`.
6. `npm test` and `npm run build`.
7. `npm run dev`, then drive the scrubber and read the rail:
   - **2026-05** (last tick): Guideway `89.1 / 119 mi`; Structures `65 / 92`; Right-of-way `2,288 / 2,288` with the chip "Package split not published" and CP1/CP2-3/CP4 percentages all `—`; Utilities `1,721 / 1,826`; status line "CVSR data through 2026-05" with a working report link.
   - **2025-04**: Guideway total still reads `119`, and the CP4 guideway chip reads `99%`, not `100%` — this is the specific rounding case that hid 0.1 mi of unfinished guideway.
   - **2019-03, 2020-01, 2020-12, 2026-03**: guideway denominator reads `119` at every one. This is the reported bug; 115 or 118 anywhere is a failure.
   - **2020-01**: Right-of-way reads `1,498` with the chip "Total not published".
   - **2019-10**: Right-of-way still reads `—` with "Related measure only".
   - **2026-05**, click a disagreeing guideway such as `Lansing to Cross Creek` in the strip: the detail panel reads `Earthwork · ArcGIS 85% · layer updated 2026-05-04` over `Earthwork · CVSR 100% · 2026-05 data`. Neither row may say "April 2026 data".
   - Below the fold, the notes list shows the three distinct right-of-way gap groups and the unchanged 2019-03…2020-07 utilities group.

## Assumptions & contingencies

- **The ArcGIS layers stay as committed.** `fetch-metadata.json` records a 2026-08-10 poll, but the progress layer itself has not been edited since 2026-05-04 (`editingInfo.lastEditDate`), so re-polling it changes nothing while re-polling the other three might: `build-segments.ts` hard-codes `59` completed + `27` in-progress structures from the Closures and Detours layer, 118–119.5 mi of input geometry, and the 35/49/68/10 cross-check quad, and every structure-evidence date is stamped from `fetchedAt`. Refreshing is a separate change that re-derives all of them together. If `npm run fetch` is run by habit and those assertions trip, restore `data/raw/arcgis/**` and rerun step 4 of Verification.
- **`resolve:cvsr-urls` needs one network request.** If hsr.ca.gov challenges it (`host answered a PDF request with HTML`), fall back to a reviewed entry — append `{ month: '2026-05', file: 'FA-Central-Valley-Status-Report-July-2026-A11Y.pdf', reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2026/07/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf' }` to `REVIEWED_CVSR_REPORTS`; reviewed files are never probed and get their URL directly.
- **119 is a cited constant, not a parsed value.** Parsing the program total per report and asserting it equals 119 was considered and rejected: the earliest reports print it as prose rather than in a table, so a parser would need a constant fallback anyway. If a future report restates the corridor length, `CENTRAL_VALLEY_GUIDEWAY_MILES` is a deliberate one-line edit with its citation attached.
- **CP4's package denominator stays as published** (21.2 in the April 2025 report, 22 in May 2026). Normalising package denominators would rewrite what each report actually said; the fixed total lives only at program level, and the `percentLabel` clamp keeps the inconsistency from rendering as a false 100%.
- **If the disagreement count comes back as something other than 10**, take the number from the thrown message, update line 528 to it, and re-check that the segment list in step 8 still describes the differences — do not weaken the equality into a range or a `>=`. The only cause that moves this number without a CVSR change is a refreshed `data/raw/arcgis/progress.json`.
- **If the Authority later republishes the May package ROW split** (for example in a supplemental report that supersedes the July file), delete the `'2026-05'` entry from `PARCEL_OMISSIONS`; the parse will then fail loudly if the split still is not extractable, which is the intended behaviour.
