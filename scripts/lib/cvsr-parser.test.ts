import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeDataMonth,
  parseDataMonth,
  parseParcelPair,
  parseUtilityPair,
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
