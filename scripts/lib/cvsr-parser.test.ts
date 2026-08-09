import assert from 'node:assert/strict';
import test from 'node:test';
import type { Snapshot } from '../../src/data/types';
import { buildCvsrInventory } from './cvsr-inventory';
import {
  normalizeDataMonth,
  parseDataMonth,
  parseParcelPair,
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

test('assigns one snapshot gap cause using parser, download, then location precedence', () => {
  const snapshot: Snapshot = {
    date: '2023-05-01',
    dataMonth: '2023-05',
    tier: 2,
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
