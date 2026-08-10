import assert from 'node:assert/strict';
import test from 'node:test';
import type { PackageMetrics, Snapshot } from '../data/types';
import { buildCvsrSeries } from './cvsr-series';

function metrics(overrides: Partial<PackageMetrics> = {}): PackageMetrics {
  return {
    structuresComplete: 1,
    structuresTotal: 10,
    guidewayMilesComplete: 4,
    guidewayMilesTotal: 32,
    sourceId: 'cvsr',
    ...overrides,
  };
}

function snapshot(dataMonth: string, cp1: PackageMetrics): Snapshot {
  return {
    date: `${dataMonth}-01`,
    dataMonth,
    tier: 2,
    sourceId: 'cvsr',
    perPackage: { CP1: cp1 },
  };
}

test('a month without a snapshot yields null and is never interpolated', () => {
  const series = buildCvsrSeries(
    [snapshot('2021-01', metrics()), snapshot('2021-03', metrics({ guidewayMilesComplete: 8 }))],
    ['2021-01', '2021-02', '2021-03'],
    'CP1',
    'guidewayMilesComplete',
    'guidewayMilesTotal',
  );

  assert.deepEqual(series.map((point) => point?.value ?? null), [4, null, 8]);
  assert.equal(series[0]?.ratio, 4 / 32);
});

test('an unpublished metric yields null even when the month has a snapshot', () => {
  const series = buildCvsrSeries(
    [snapshot('2020-06', metrics())],
    ['2020-06'],
    'CP1',
    'utilitiesRelocated',
    'utilitiesTotal',
  );

  assert.deepEqual(series, [null]);
});

test('a zero total yields null rather than a divide-by-zero ratio', () => {
  const series = buildCvsrSeries(
    [snapshot('2022-05', metrics({ parcelsDelivered: 0, parcelsTotal: 0 }))],
    ['2022-05'],
    'CP1',
    'parcelsDelivered',
    'parcelsTotal',
  );

  assert.deepEqual(series, [null]);
});

test('tier-3 observations never contribute points', () => {
  const observed: Snapshot = {
    date: '2023-04-01',
    tier: 3,
    sourceId: 'arcgis_progress',
    perSegment: { 'CP1:1': { completion: 1, sourceId: 'arcgis_progress' } },
  };

  assert.deepEqual(
    buildCvsrSeries([observed], ['2023-04'], 'CP1', 'guidewayMilesComplete', 'guidewayMilesTotal'),
    [null],
  );
});

test('ratios above one are reported unclamped', () => {
  const series = buildCvsrSeries(
    [snapshot('2024-02', metrics({ structuresComplete: 12, structuresTotal: 10 }))],
    ['2024-02'],
    'CP1',
    'structuresComplete',
    'structuresTotal',
  );

  assert.equal(series[0]?.ratio, 1.2);
});
