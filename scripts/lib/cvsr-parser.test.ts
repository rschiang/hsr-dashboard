import assert from 'node:assert/strict';
import test from 'node:test';
import type { Snapshot } from '../../src/data/types';
import { PARSE_FAILURE_PREFIX, buildCvsrInventory, ingestedReportFiles } from './cvsr-inventory';
import {
  normalizeDataMonth,
  parseDataMonth,
  parseParcelAcquisitionAudit,
  parseParcelAcquisitionPair,
  parseParcelPair,
  parseProgramParcelDelivery,
  parseRailroadParcelPair,
  parseReportMonth,
  parseRowProgress,
  parseUtilityPair,
  parseUtilityTypeStatusPair,
  validateCountPair,
} from './cvsr-parser';

test('normalizes named and ISO data months without date-parser timezone ambiguity', () => {
  assert.equal(normalizeDataMonth('August 2020'), '2020-08');
  assert.equal(normalizeDataMonth('August 31, 2020'), '2020-08');
  assert.equal(normalizeDataMonth('2024-06-01'), '2024-06');
  assert.throws(() => normalizeDataMonth('Spring 2024'), /invalid data month/);
});

test('requires an explicit data month or reviewed legacy mapping', () => {
  assert.equal(
    parseDataMonth('Central Valley Status Report\nApril 2026 Data', 'report.pdf', {}),
    '2026-04',
  );
  assert.equal(parseDataMonth('legacy text', 'legacy.pdf', { 'legacy.pdf': '2019-03' }), '2019-03');
  assert.throws(() => parseDataMonth('undated report', 'unknown.pdf', {}), /missing data-month date/);
});

test('derives duplicate upstream basenames independently from internal report headings', () => {
  const file = 'CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf';
  assert.equal(
    parseDataMonth('June 2023 Report (data through April 2023)', file, {}),
    '2023-04',
  );
  assert.equal(
    parseDataMonth('July 2023 Report (data through May 2023)', `${file}.archive-20230725.pdf`, {}),
    '2023-05',
  );
});

test('reads the publication month from a data-through report heading', () => {
  assert.equal(parseReportMonth('July 2023 Report (data through May 2023)'), '2023-07');
  assert.equal(parseReportMonth('MARCH 2026 REPORT ( DATA THROUGH JANUARY 2026 )'), '2026-03');
});

test('reads the publication month from a titled status-report heading', () => {
  assert.equal(parseReportMonth('Central Valley Status Report \u2013 December 2021'), '2021-12');
  assert.equal(parseReportMonth('Central Valley Status Report September 2019'), '2019-09');
});

test('returns null rather than guessing a publication month', () => {
  assert.equal(parseReportMonth('Central Valley Status Report'), null);
  assert.equal(parseReportMonth('Spring 2024 Report (data through March 2024)'), null);
  assert.equal(parseReportMonth(''), null);
});

test('parses row progress decimals, dash variants, Open, and completed rows without monthly values', () => {
  const rows = parseRowProgress(`
    CP 1 – Construction Progress
    Structures - Underway # # #
    Kings River to Dover Ave Sep-20 May-26 98.0% 0%
    Herndon HST Bridge Aug-26 Feb-27 0% –
    Fresno Underpass Apr-26 Feb-27 0% -
    Report Notes
    CP 1 – Construction Progress
    Structures - Completed
    Golden State Blvd Jan-20 Apr-22 Open
    Location Start Finish Complete %
  `);
  assert.deepEqual(rows.map(({ completion, monthlyProgress }) => [completion, monthlyProgress]), [
    [0.98, 0],
    [0, null],
    [0, null],
    [null, null],
  ]);
});

test('carries the package across a bare continued row table heading', () => {
  const rows = parseRowProgress(`
    CP 2-3 – Construction Progress
    Structures - Underway
    Conejo Ave Apr-20 Apr-26 96% 2%
    Report Notes
    Structures - Underway (cont'd) # # #
    Alpaugh Bridge Oct-24 Jul-26 32% 2%
  `);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.cp === 'CP2-3' && row.kind === 'structure'));
});

/**
 * Ingestion resolves structure rows through the fixed crosswalk and guideway rows
 * through ArcGIS `Limits`; the parser only learns which labels those sources know.
 */
const KNOWN_LABELS: Readonly<Record<'structure' | 'guideway', readonly string[]>> = {
  structure: ['Ave 24', 'Cross Creek', 'Lansing'],
  guideway: ['Fowler Ave to Davis Ave', 'Peach Ave to Elkhorn Ave'],
};
const isKnownLabel = (kind: 'structure' | 'guideway', label: string) =>
  KNOWN_LABELS[kind].includes(label);

test('strips a footnote anchor only when the bare label is one ingestion can resolve', () => {
  const rows = parseRowProgress(
    `
    CP 2-3 – Construction Progress
    Structures - Completed
    Ave 24 1 Jun-23 Aug-24 90%
    Cross Creek1 Apr-21 Apr-26 97%
    Fresno River Viaduct 501 Sep-17 Jul-20 100%
    CP 1 – Construction Progress
    Structures - Completed
    Lansing1 Sep-17 Jul-20 100%
    Avenue 11 Sep-17 Jul-20 100%
  `,
    undefined,
    isKnownLabel,
  );
  assert.deepEqual(
    rows.map((row) => [row.cp, row.location, row.footnote]),
    [
      // Spaced and glued anchors are both extraction artifacts of the same marker.
      ['CP2-3', 'Ave 24', 'substantially_complete'],
      ['CP2-3', 'Cross Creek', 'substantially_complete'],
      // Genuine numeric names survive: `Fresno River Viaduct 50` and `Avenue 1` are
      // not labels ingestion resolves, so the trailing digit stays part of the name.
      ['CP2-3', 'Fresno River Viaduct 501', null],
      ['CP1', 'Lansing', 'partially_open'],
      ['CP1', 'Avenue 11', null],
    ],
  );
});

test('rejects header and legend lines that do not match the row grammar', () => {
  const rows = parseRowProgress(`
    CP 1 – Construction Progress
    Guideways - Underway
    Location Start Finish Complete %
    2026 2027
    Q1 Q2 Q3 Q4
    ■ Not Started ■ Completed ■ Underway
    Herndon Canal to Swift Ave Jun-26 Sep-26 0% –
  `);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].location, 'Herndon Canal to Swift Ave');
});

test('maps utility values by semantic headers, including reordered columns', () => {
  const text = `
    CP 1-4 – Utility Relocations Summary
    Remaining Utility Relocations  Relocated to Date  Total Relocations
    CP 1  20  80  100
    CP 2-3  10  190  200
    CP 4  0  50  50
  `;

  assert.deepEqual(parseUtilityPair(text, 'CP1'), { remaining: 20, delivered: 80, total: 100 });
  assert.deepEqual(parseUtilityPair(text, 'CP2-3'), { remaining: 10, delivered: 190, total: 200 });
});

test('parses column-grouped semantic summaries only with explicit package order', () => {
  const text = `
    CP 1-4 – Utility Relocations Summary
    CP 1  CP 2-3  CP 4
    Total Relocations
    100
    200
    50
    Relocated to Date
    80
    190
    50
    Remaining Utility Relocations
    20
    10
    0
  `;

  assert.deepEqual(parseUtilityPair(text, 'CP1'), { total: 100, delivered: 80, remaining: 20 });
  assert.deepEqual(parseUtilityPair(text, 'CP2-3'), { total: 200, delivered: 190, remaining: 10 });
  assert.throws(
    () => parseUtilityPair(text.replace('CP 1  CP 2-3  CP 4', 'Packages'), 'CP1'),
    /missing explicit CP 1, CP 2-3, CP 4 order/,
  );
  assert.throws(
    () => parseUtilityPair(text.replace('100\n    200\n    50', '100\n    200\n    50\n    999'), 'CP1'),
    /must contain exactly three package values/,
  );
});

test('scopes narrative utility values to the requested construction package', () => {
  const text = `
    Construction Package 1 Overview
    Utility Relocations Status - Relocated: 239 (20%); In Progress: 100; Total: 1,210.
    Construction Package 2-3 Overview
    Utility Relocations Status - Relocated: 301 (43%); In Progress: 40; Total: 694.
    Construction Package 4 Overview
    Utility Relocations Status - Relocated: 35 (20%); In Progress: 11; Total: 161.
  `;

  assert.deepEqual(parseUtilityPair(text, 'CP1'), { delivered: 239, total: 1210 });
  assert.deepEqual(parseUtilityPair(text, 'CP2-3'), { delivered: 301, total: 694 });
  assert.deepEqual(parseUtilityPair(text, 'CP4'), { delivered: 35, total: 161 });
});

test('reconciles utility type/status details with the package summary', () => {
  const text = `
    Construction Package 1 – Relocated: 80; Total: 100.
    Construction Package 2-3 – Relocated: 190; Total: 200.
    Construction Package 4 – Relocated: 50; Total: 50.
    CP 1-4 – Summary by Utility Type
    Utility Status CP 1 CP 2-3 CP 4 CP 1-4 Total Percentage
    NOT STARTED 10 5 0 15 8%
    APPROVED TO START 0 0 0 0 0%
    Electric IN PROGRESS 10 5 0 15 8%
    RELOCATED 80 190 50 320 84%
    TOTAL 100 200 50 350 100%
    CP 1-4 – Real Property/Right-of-Way (ROW)
  `;

  assert.deepEqual(parseUtilityTypeStatusPair(text, 'CP1'), {
    delivered: 80,
    total: 100,

    remaining: 20,
  });
  assert.deepEqual(parseUtilityPair(text, 'CP2-3'), { delivered: 190, total: 200 });

  const mismatch = text
    .replace('NOT STARTED 10', 'NOT STARTED 11')
    .replace('RELOCATED 80', 'RELOCATED 79');
  assert.throws(
    () => parseUtilityPair(mismatch, 'CP1'),
    /type\/status detail 79\/100 does not match package summary 80\/100/,
  );
});
test('derives the audited 2019 acquisition layout and preserves the December re-baseline', () => {
  const september = `
    CP 1-4 – ROW Parcels to be Acquired and Remaining
    Total Needed Total Acquired Remaining Optimized Parcels Acquired in September Total Remaining
    CP 1 932 827 105 4 0 101
    CP 2-3 854 547 307 4 12 291
    CP 4 223 166 57 0 0 57
    Notes:
  `;
  assert.deepEqual(parseParcelAcquisitionPair(september, 'CP1', '2019-09'), {
    delivered: 827,
    total: 928,
    remaining: 101,
    asOf: '2019-09-30',
  });
  const december = september.replace('932 827 105 4 0 101', '928 827 101 20 -23 104');
  assert.deepEqual(parseParcelAcquisitionPair(december, 'CP1', '2019-12'), {
    delivered: 804,
    total: 908,
    remaining: 104,
    asOf: '2019-12-31',
  });
});

test('keeps the exceptional January acquisition table as a March 9 audit', () => {
  const text = `
    CP 1-4 ROW Parcel Acquisition Summary
    November 30, 2019 March 9, 2020
    CP 1 919 827 101 -2 7 92
    CP 2-3 956 573 277 118 12 383
    CP 4 263 172 51 40 0 91
    CP 1-4 ROW Railroad Parcels to be Acquired and Remaining
  `;
  assert.equal(parseParcelAcquisitionPair(text, 'CP1', '2020-01'), null);
  assert.deepEqual(parseParcelAcquisitionAudit(text, 'CP1'), {
    totalNeeded: 919,
    priorAcquired: 827,
    modifications: -2,
    acquired: 7,
    remaining: 92,
    asOf: '2020-03-09',
  });
});

test('parses acquisition independently from delivery and railroad parcels', () => {
  const text = `
    CP 1-4 – ROW Parcel Acquisition Summary
    March 9, 2020
    CP 1 919 147 1066 827 1 828
    CP 2-3 956 55 1011 573 31 604
    CP 4 263 -10 253 172 -12 160
    CP 1-4 – ROW Acquired but Not Delivered to Design-Builder (DB)
    CP 1-4 – Real Property/Right-of-Way (ROW) Railroad
    Railroad Parcels to be Delivered Delivered to Date Total Railroad Parcels
    CP 1 9 80 89
    CP 2-3 3 55 58
    CP 4 0 29 29
    Report Notes
  `;
  assert.deepEqual(parseParcelAcquisitionPair(text, 'CP1', '2020-02'), {
    delivered: 828,
    total: 1066,
    asOf: '2020-03-09',
  });
  assert.equal(parseParcelPair(text, 'CP1'), null);
  assert.deepEqual(parseRailroadParcelPair(text, 'CP2-3'), {
    delivered: 55,
    total: 58,
    remaining: 3,
  });
});

test('derives 2019-08 delivery with the reviewed CP4 base-column exception', () => {
  const text = `
    CP 1-4 – ROW Parcels Acquired by Month
    Additional parcels in August
    CP1 893 54 839 827 12 93 105
    CP2-3 756 42 714 547 167 140 307
    CP4 210 10 200 166 44 13 57
    Central Valley Status Report
  `;
  assert.deepEqual(parseParcelPair(text, 'CP1'), { delivered: 827, total: 932, remaining: 105 });
  assert.deepEqual(parseParcelPair(text, 'CP2-3'), { delivered: 547, total: 854, remaining: 307 });
  assert.deepEqual(parseParcelPair(text, 'CP4'), { delivered: 166, total: 223, remaining: 57 });
});

test('parses current parcel delivery tables by labelled column meaning', () => {
  const text = `
    CP 1-4 – Real Property/Right-of-Way (ROW)
    To Be Delivered vs. Delivered
    Segment  Parcels to be Delivered  Delivered to Date  Total Parcels  Delivery Percentage
    CP 1  2  1,080  1,082  99.8%
    CP 2-3  6  981  987  99.4%
    CP 4  0  223  223  100%
  `;

  assert.deepEqual(parseParcelPair(text, 'CP1'), { remaining: 2, delivered: 1080, total: 1082 });
  assert.deepEqual(parseParcelPair(text, 'CP2-3'), { remaining: 6, delivered: 981, total: 987 });
});

test('parses exact legacy parcel narrative labels', () => {
  const text = `
    CP 1 Progress
    Estimated Total Parcels Needed: 1,083
    Total Parcels Delivered to Date: 1,062
    CP 2-3 Progress
  `;
  assert.deepEqual(parseParcelPair(text, 'CP1'), { delivered: 1062, total: 1083 });
});

test('parses ROW Summary labels and excludes the following railroad section', () => {
  const text = `
    CP 1-4 – Real Property/Right-of-Way (ROW)
    CP 1-4 – ROW Summary
    Construction Package  Total Needed  Delivered to Date  Remaining
    CP 1  1,083  1,062  21
    CP 2-3  987  942  45
    CP 4  223  221  2
    CP 1-4 – ROW Railroad Summary
    CP 1  200  190  10
  `;
  assert.deepEqual(parseParcelPair(text, 'CP1'), {
    total: 1083,
    delivered: 1062,
    remaining: 21,
  });

  const railroadOnly = text.replace('CP 1  1,083  1,062  21', '');
  assert.throws(
    () => parseParcelPair(railroadOnly, 'CP1'),
    /semantic table is missing explicit CP 1, CP 2-3, CP 4 order/,
  );
});

// Verbatim section order of the June 2020 report: the narrative ROW heading and
// two acquisition tables precede the authoritative cumulative-delivery table.
const JUNE_2020 = `
    CP 1-4 – Right-of-Way (ROW) Summary
    ROW established metrics to track the following:
    • Acquisition Tracking
    CP 1-4 – ROW Parcel Acquisition Summary
    Construction Package
    May 31, 2020 Total Needed
    Modifications
    June 30, 2020 Total Needed
    May 31, 2020 Total Acquired
    June 30, 2020 Acquired
    June 30, 2020 Total Acquired
    CP 1 1,080 -7 1,073 830 1 831
    CP 2-3 995 19 1,014 622 48 670
    CP 4 266 0 266 163 0 163
    Total 2,341 12 2,353 1,615 49 1,664
    CP 1-4 – ROW Acquired but Not Delivered to Design-Builder (DB)
    Construction Package
    June 30, 2020 Total Acquired
    June 30, 2020 Delivered to DB
    June 30, 2020 Total Delivered to DB
    June 30, 2020 Total Acquired, Remaining to Deliver to DB
    CP 1 831 1 830 1
    CP 2-3 670 20 629 41
    CP 4 163 4 163 0
    Total 1,664 25 1,622 42
    CP 1-4 – ROW Summary
    Construction Package Total Needed Parcels
    June 30, 2020
    Total Parcels Delivered to Date
    June 30, 2020
    Remaining Parcels to be Delivered
    June 30, 2020
    CP 1 1,073 830 243
    CP 2-3 1,014 629 385
    CP 4 266 163 103
    Total 2,353 1,622 731
    CP 1-4 – Parcel Delivery to DB Summary
  `;

const JULY_2020 = `
    CP 1-4 – Right-of-Way (ROW) Summary
    ROW established metrics to track the following:
    • Acquisition Tracking
    CP 1-4 – ROW Acquired but Not Delivered to Design-Builder (DB)
    Construction Package
    July 31, 2020 Total Acquired
    July 31, 2020 Delivered to DB
    July 31, 2020 Total Delivered to DB
    July 31, 2020 Total Acquired, Remaining to Deliver to DB
    CP 4 163 0 163 0
    Total 1,672 8 1,640 32
    CP 1-4 – ROW Summary
    Construction Package Total Needed Parcels
    July 31, 2020
    Total Parcels Delivered to Date
    July 31, 2020
    Remaining Parcels to be Delivered
    July 31, 2020
    CP 1 1,072 832 240
    CP 2-3 1,011 645 366
    CP 4 239 163 76
    Total 2,322 1,640 682
    CP 1-4 – Parcel Delivery to DB Summary
  `;

test('reads cumulative delivery from the ROW Summary, not the acquisition tables', () => {
  assert.deepEqual(parseParcelPair(JUNE_2020, 'CP1'), { total: 1073, delivered: 830, remaining: 243 });
  assert.deepEqual(parseParcelPair(JUNE_2020, 'CP2-3'), { total: 1014, delivered: 629, remaining: 385 });
  assert.deepEqual(parseParcelPair(JUNE_2020, 'CP4'), { total: 266, delivered: 163, remaining: 103 });
  assert.deepEqual(parseParcelPair(JULY_2020, 'CP4'), { total: 239, delivered: 163, remaining: 76 });
});

test('keeps a published total that falls when the Authority rescopes a package', () => {
  // CP4 drops from 266 to 239 needed parcels between June and July 2020. The
  // parser reports what each report published; it never clamps a series.
  assert.equal(parseParcelPair(JUNE_2020, 'CP4')?.total, 266);
  assert.equal(parseParcelPair(JULY_2020, 'CP4')?.total, 239);
});

test('never reads a CP 1-4 aggregate row as a package pair', () => {
  const april2021 = `
    - Construction Package 4 – Relocated: 40 (24%); In Progress: 24 (14%); Approved to Start: 35 (21%); Not Started: 69 (41%); Total: 168.
    CP Real Property/Right-of-Way (ROW) (Page 9 through 11)
    • Total Parcels Delivered to Date – 1,837 parcels compared to an Estimated Total Parcels Needed – 2,306 parcels.
    • Total Acquired Parcels – 26 parcels.
    CP 1-4 – Right-of-Way (ROW) Summary
    Construction Package Total Needed Parcels
    April 30, 2021
    Total Parcels Delivered to Date
    April 30, 2021
    Remaining Parcels to be Delivered
    April 30, 2021
    CP 1 1,069 901 168
    CP 2-3 1,000 754 246
    CP 4 237 182 55
    Total 2,306 1,837 469
    CP 1-4 – Parcel Delivery to DB Summary
  `;
  assert.deepEqual(parseParcelPair(april2021, 'CP1'), { total: 1069, delivered: 901, remaining: 168 });
  assert.deepEqual(parseParcelPair(april2021, 'CP2-3'), { total: 1000, delivered: 754, remaining: 246 });
  assert.deepEqual(parseParcelPair(april2021, 'CP4'), { total: 237, delivered: 182, remaining: 55 });
});

test('stops a package ROW Summary at the next package heading', () => {
  const text = `
    CP 1 – ROW Summary
    Construction Package Total Needed Parcels
    Total Parcels Delivered to Date
    Remaining Parcels to be Delivered
    CP 1 1,073 830 243
    CP 1 – Parcel Delivery to DB Summary
    Notes: actual cumulative line reflects delivered parcels forecast in future months.
    CP 4 – ROW Summary
    Construction Package Total Needed Parcels
    Total Parcels Delivered to Date
    Remaining Parcels to be Delivered
    CP 4 266 163 103
    CP 4 – Parcel Delivery to DB Summary
  `;
  assert.deepEqual(parseParcelPair(text, 'CP1'), { total: 1073, delivered: 830, remaining: 243 });
  assert.deepEqual(parseParcelPair(text, 'CP4'), { total: 266, delivered: 163, remaining: 103 });
});

test('returns null when a report publishes acquisition but no cumulative delivery', () => {
  const acquisitionOnly = `
    CP 1-4 ROW Parcels to be Acquired and Remaining
    Construction Package
    Total Needed Parcels as of August 31
    Total Acquired to Date as of August 31
    Remaining Parcels to be Acquired as of August 31
    Optimized Parcels
    Parcels Acquired in September
    Total Parcels Remaining as of September 30
    CP 1 932 827 105 4 0 101
    CP 2-3 854 547 307 4 12 291
    CP 4 223 166 57 0 0 57
  `;
  assert.equal(parseParcelPair(acquisitionOnly, 'CP1'), null);
  assert.equal(parseParcelPair(acquisitionOnly, 'CP2-3'), null);
  assert.equal(parseParcelPair(acquisitionOnly, 'CP4'), null);
});

test('rejects swapped semantic columns and does not guess an unknown layout', () => {
  const swapped = `
    CP 1-4 – Utility Relocations Summary
    Total Relocations  Relocated to Date  Remaining Utility Relocations
    CP 1  20  80  100
  `;
  assert.throws(() => parseUtilityPair(swapped, 'CP1'), /delivered exceeds total/);
  assert.equal(parseUtilityPair('CP1 utilities: 80 done from a program of 100', 'CP1'), null);
});

test('rejects impossible count invariants instead of emitting partial values', () => {
  assert.throws(
    () => validateCountPair({ delivered: 101, total: 100 }, 'utilities CP1'),
    /delivered exceeds total/,
  );
  assert.throws(
    () => validateCountPair({ delivered: 80, total: 100, remaining: 30 }, 'parcels CP1'),
    /total - delivered does not equal remaining/,
  );
});

test('classifies the audited utility omission boundary without inventing later gaps', () => {
  const inventory = buildCvsrInventory({
    snapshots: [],
    localFiles: new Set(),
    reviewedReports: [],
    rejectedReports: [],
    parseFailures: [],
    fieldFailures: [],
    revisions: [],
    coverageStart: '2019-03',
    coverageEnd: '2020-08',
  });
  const utilityGaps = inventory.gaps.filter((gap) => gap.metric === 'utilities');
  assert.equal(utilityGaps.length, 17);
  assert.equal(utilityGaps[0].month, '2019-03');
  assert.equal(utilityGaps.at(-1)?.month, '2020-07');
  assert.equal(utilityGaps.some((gap) => gap.month === '2020-08'), false);
  assert.deepEqual(utilityGaps[0].packages, ['CP1', 'CP2-3', 'CP4']);
});

test('records each audited parcel-delivery omission with the cause its own source states', () => {
  const inventory = buildCvsrInventory({
    snapshots: [],
    localFiles: new Set(),
    reviewedReports: [],
    rejectedReports: [],
    parseFailures: [],
    fieldFailures: [],
    revisions: [],
    coverageStart: '2019-03',
    coverageEnd: '2026-05',
  });
  const parcelGaps = inventory.gaps.filter((gap) => gap.metric === 'parcel_delivery');
  assert.deepEqual(parcelGaps.map((gap) => [gap.month, gap.cause]), [
    ['2019-09', 'related_measure_only'],
    ['2019-10', 'related_measure_only'],
    ['2019-11', 'related_measure_only'],
    ['2019-12', 'related_measure_only'],
    ['2020-01', 'total_not_reported'],
  ]);
  assert.deepEqual(parcelGaps[0].packages, ['CP1', 'CP2-3', 'CP4']);
  // 2026-05 publishes no split either, but the program total pins it, so it is a
  // determined value rather than a gap.
  assert.equal(parcelGaps.some((gap) => gap.month === '2026-05'), false);
});

test('flattens a reviewed restatement to one annotated month without creating a gap', () => {
  const inventory = buildCvsrInventory({
    snapshots: [],
    localFiles: new Set(),
    reviewedReports: [],
    rejectedReports: [],
    parseFailures: [],
    fieldFailures: [],
    revisions: [{
      months: ['2022-02', '2022-01'],
      metric: 'progress',
      packages: ['CP4'],
      correctedIn: '2022-04',
      reportFile: 'CVSR-2206-2204-Data-FINAL-V0-A11Y.pdf',
      detail: 'A discrepancy has been identified for CP4 in the previous months reporting of the guideway progress.',
    }],
    coverageStart: '2022-01',
    coverageEnd: '2022-02',
  });
  assert.deepEqual(
    inventory.revisions.map((entry) => [entry.month, entry.metric, entry.packages.join(',')]),
    [['2022-01', 'progress', 'CP4'], ['2022-02', 'progress', 'CP4']],
  );
  // A restated value is still a published value, so it never becomes a gap.
  assert.equal(
    inventory.gaps.some((gap) => gap.metric !== 'snapshot' && gap.month.startsWith('2022-')),
    false,
  );
});

test('assigns one snapshot gap cause using parser, download, then location precedence', () => {
  const snapshot: Snapshot = {
    date: '2023-05-01',
    dataMonth: '2023-05',
    tier: 1,
    sourceId: 'cvsr',
  };
  const inventory = buildCvsrInventory({
    snapshots: [snapshot],
    localFiles: new Set(['june.pdf']),
    reviewedReports: [
      { month: '2023-06', file: 'june.pdf', reportUrl: 'https://hsr.ca.gov/june.pdf' },
      { month: '2023-07', file: 'july.pdf', reportUrl: 'https://hsr.ca.gov/july.pdf' },
    ],
    rejectedReports: [],
    parseFailures: [{ file: 'june.pdf', dataMonth: '2023-06', reason: 'bad table' }],
    fieldFailures: [],
    revisions: [],
    coverageStart: '2023-05',
    coverageEnd: '2023-08',
  });
  const snapshotGaps = inventory.gaps.filter((gap) => gap.metric === 'snapshot');
  assert.deepEqual(
    snapshotGaps.map((gap) => [gap.month, gap.cause]),
    [
      ['2023-06', 'parser_failure'],
      ['2023-07', 'report_not_downloaded'],
      ['2023-08', 'report_not_located'],
    ],
  );
  assert.equal(new Set(snapshotGaps.map((gap) => gap.month)).size, snapshotGaps.length);
});

test('never reads a railroad delivery table as ordinary right-of-way delivery', () => {
  // July 2026 retires the ordinary CP 1-4 ROW delivery page, so the railroad table is
  // the first heading match. Reading it here would publish 164/176 rail parcels as the
  // program's right-of-way delivery.
  const july2026 = `
    CP 1-4 – Real Property/Right-of-Way (ROW) Railroad
    To Be Delivered vs. Delivered
    Segment Railroad Parcels to be Delivered Delivered to Date Total Railroad Parcels
    CP 1 9 80 89
    CP 2-3 3 55 58
    CP 4 0 29 29
    Total 12 164 176
    Actual vs. Forecast – Railroad Parcel Delivery to Design-Builder (DB)
  `;
  assert.equal(parseParcelPair(july2026, 'CP1'), null);
  assert.equal(parseParcelPair(july2026, 'CP2-3'), null);
  assert.equal(parseParcelPair(july2026, 'CP4'), null);
  assert.deepEqual(parseRailroadParcelPair(july2026, 'CP1'), { delivered: 80, total: 89, remaining: 9 });
});

test('reads a program parcel total only from the sentence that publishes it', () => {
  assert.deepEqual(
    parseProgramParcelDelivery(
      '• All required parcels have been delivered — 2,288 of 2,288. This achievement marks a major program milestone.',
    ),
    { delivered: 2288, total: 2288 },
  );
  assert.equal(
    parseProgramParcelDelivery('CP 1 1,069 901 168\nCP 2-3 1,000 754 246\nCP 4 237 182 55'),
    null,
  );
});

test('keys July guideway rows on the bare label while the quote keeps the published span', () => {
  const july2026 = `
    CP 2-3 – Construction Progress
    Guideways - Underway
    Peach Ave to Elkhorn Ave (1.86 Miles) Aug-18 Jun-26 93% 0%
    Guideways - Completed
    Fowler Ave to Davis Ave (1.35 Miles)1 Aug-18 Jun-26 95% 1%
  `;
  const rows = parseRowProgress(july2026, undefined, isKnownLabel);
  assert.deepEqual(rows.map((row) => row.location), [
    'Peach Ave to Elkhorn Ave',
    'Fowler Ave to Davis Ave',
  ]);
  assert.equal(rows[0].quote, 'Peach Ave to Elkhorn Ave (1.86 Miles) Aug-18 Jun-26 93% 0%');
  assert.equal(rows[0].footnote, null);
  // The footnote digit sits outside the parenthesis, so it is stripped first.
  assert.equal(rows[1].footnote, 'substantially_complete');
  assert.equal(rows[1].quote, 'Fowler Ave to Davis Ave (1.35 Miles)1 Aug-18 Jun-26 95% 1%');
});

test('treats merged, reviewed and deliberately excluded reports as ingested, but never a parser failure', () => {
  const snapshot: Snapshot = {
    date: '2026-06-01',
    dataMonth: '2026-06',
    tier: 1,
    sourceId: 'cvsr',
    reportFile: 'august-2026.pdf',
  };
  const ingested = ingestedReportFiles(
    [snapshot],
    [
      { reportFile: 'duplicate.pdf', reason: 'Duplicate monthly snapshot; retained other.pdf.' },
      { reportFile: 'unparsed.pdf', reason: `${PARSE_FAILURE_PREFIX}resolved 29 of 35 structure rows` },
      { reason: 'Non-CVSR alternative report ignored; it is not a combined monthly Central Valley Status Report.' },
    ],
    ['reviewed.pdf'],
  );
  assert.equal(ingested.has('august-2026.pdf'), true);
  assert.equal(ingested.has('reviewed.pdf'), true);
  assert.equal(ingested.has('duplicate.pdf'), true);
  // The regression this predicate exists for: a parser fix must be able to retry this file,
  // so discovery has to keep offering it.
  assert.equal(ingested.has('unparsed.pdf'), false);
  assert.equal(ingested.size, 3);
});
