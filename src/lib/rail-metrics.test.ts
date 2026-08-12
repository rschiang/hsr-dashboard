import assert from 'node:assert/strict';
import test from 'node:test';
import type { PackageMetrics, Snapshot } from '../data/types';
import {
  CENTRAL_VALLEY_GUIDEWAY_MILES,
  formatRailValue,
  packagePercent,
  percentLabel,
  RAIL_METRICS,
  railMetricValues,
  type RailMetric,
} from './rail-metrics';

function metric(label: string): RailMetric {
  const found = RAIL_METRICS.find((candidate) => candidate.label === label);
  if (!found) throw new Error(`no rail metric labelled ${label}`);
  return found;
}

const GUIDEWAY = metric('Guideway complete');
const RIGHT_OF_WAY = metric('Right-of-way delivered');

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

function snapshot(fields: Partial<Snapshot> = {}): Snapshot {
  return {
    date: '2026-05-01',
    dataMonth: '2026-05',
    tier: 1,
    sourceId: 'cvsr',
    ...fields,
  };
}

function guidewaySnapshot(cp1: number, cp23: number, cp4: number): Snapshot {
  return snapshot({
    perPackage: {
      CP1: metrics({ guidewayMilesTotal: cp1 }),
      'CP2-3': metrics({ guidewayMilesTotal: cp23 }),
      CP4: metrics({ guidewayMilesTotal: cp4 }),
    },
  });
}

test('a published program value outranks the sum over packages', () => {
  const may2026 = snapshot({
    program: { parcelsDelivered: 2288, parcelsTotal: 2288 },
    perPackage: {
      CP1: metrics({ parcelsDelivered: 1080, parcelsTotal: 1080 }),
      'CP2-3': metrics({ parcelsDelivered: 985, parcelsTotal: 985 }),
      CP4: metrics({ parcelsDelivered: 223, parcelsTotal: 223 }),
    },
  });
  assert.deepEqual(railMetricValues(may2026, RIGHT_OF_WAY), { value: 2288, total: 2288 });

  const packagesOnly = snapshot({
    perPackage: {
      CP1: metrics({ parcelsDelivered: 901, parcelsTotal: 1069 }),
      'CP2-3': metrics({ parcelsDelivered: 754, parcelsTotal: 1000 }),
      CP4: metrics({ parcelsDelivered: 182, parcelsTotal: 237 }),
    },
  });
  assert.deepEqual(railMetricValues(packagesOnly, RIGHT_OF_WAY), { value: 1837, total: 2306 });
});

test('a recovered count with no published denominator keeps the count and drops the ratio', () => {
  // January 2020: the April 2020 charts publish deliveries but no needed-parcel count.
  const january2020 = snapshot({
    dataMonth: '2020-01',
    perPackage: {
      CP1: metrics({ parcelsDelivered: 785 }),
      'CP2-3': metrics({ parcelsDelivered: 557 }),
      CP4: metrics({ parcelsDelivered: 156 }),
    },
  });
  assert.deepEqual(railMetricValues(january2020, RIGHT_OF_WAY), { value: 1498, total: undefined });
});

test('the guideway denominator is the corridor length, not the sum of package denominators', () => {
  assert.equal(CENTRAL_VALLEY_GUIDEWAY_MILES, 119);
  // 2019-03 sums to 115.2, 2025-04 to 118.2, 2026-05 to 119; the corridor never moved.
  for (const [cp1, cp23, cp4] of [[29.2, 65, 21], [32, 65, 21.2], [32, 65, 22]]) {
    assert.equal(railMetricValues(guidewaySnapshot(cp1, cp23, cp4), GUIDEWAY).total, 119);
  }
});

test('a partial package sum is never shown as a program value', () => {
  const partial = snapshot({
    perPackage: {
      CP1: metrics({ utilitiesRelocated: 918, utilitiesTotal: 992 }),
      'CP2-3': metrics(),
      CP4: metrics({ utilitiesRelocated: 133, utilitiesTotal: 133 }),
    },
  });
  assert.deepEqual(
    railMetricValues(partial, metric('Utilities relocated')),
    { value: undefined, total: undefined },
  );
});

test('formats a partial measure as the bare count and a missing one as an em dash', () => {
  assert.equal(formatRailValue(RIGHT_OF_WAY, 1498, undefined), '1,498');
  assert.equal(formatRailValue(RIGHT_OF_WAY, undefined, 2288), '—');
  assert.equal(formatRailValue(GUIDEWAY, 89.1, 119), '89.1 / 119');
  // Guideway publishes no partial rendering: a mileage with no denominator says nothing.
  assert.equal(formatRailValue(GUIDEWAY, 89.1, undefined), '—');
});

test('an incomplete measure never rounds up to a finished one', () => {
  assert.equal(percentLabel(21.1, 21.2), '99%');
  assert.equal(percentLabel(11, 11), '100%');
  assert.equal(percentLabel(918, 992), '93%');
  assert.equal(percentLabel(0, 0), '—');
});

test('a package prints its own published ratio whenever the report gives one', () => {
  const april2026 = snapshot({
    dataMonth: '2026-04',
    program: { parcelsDelivered: 2288, parcelsTotal: 2288 },
    perPackage: { CP1: metrics({ parcelsDelivered: 1080, parcelsTotal: 1080 }) },
  });
  assert.deepEqual(packagePercent(april2026, RIGHT_OF_WAY, 'CP1'), { percent: '100%' });

  const cp4April2025 = snapshot({
    dataMonth: '2025-04',
    perPackage: { CP4: metrics({ guidewayMilesComplete: 21.1, guidewayMilesTotal: 21.2 }) },
  });
  assert.deepEqual(packagePercent(cp4April2025, GUIDEWAY, 'CP4'), { percent: '99%' });
});

test('a pinned split renders as a normal ratio carrying the citation that determines it', () => {
  const may2026 = snapshot({
    program: { parcelsDelivered: 2288, parcelsTotal: 2288 },
    perPackage: {
      CP1: metrics({
        parcelsDelivered: 1080,
        parcelsTotal: 1080,
        derivedFields: ['parcels'],
        derivationDetail: 'Determined, not reprinted: the April 2026 report publishes CP 1 1,080 of 1,080.',
      }),
    },
  });
  assert.deepEqual(packagePercent(may2026, RIGHT_OF_WAY, 'CP1'), {
    percent: '100%',
    derivedTitle: 'Determined, not reprinted: the April 2026 report publishes CP 1 1,080 of 1,080.',
  });
  // The marker belongs to the family the pipeline derived, not to every block on the rail.
  assert.deepEqual(packagePercent(may2026, GUIDEWAY, 'CP1'), { percent: '13%' });
});

test('the rail never infers a package ratio the pipeline did not establish', () => {
  // A complete program pair is not, on its own, a package value: the parse decides that
  // and records the citation. Without it the cell stays an em dash.
  const unsplit = snapshot({ program: { parcelsDelivered: 2288, parcelsTotal: 2288 } });
  assert.deepEqual(packagePercent(unsplit, RIGHT_OF_WAY, 'CP1'), { percent: '—' });
  assert.deepEqual(packagePercent(undefined, RIGHT_OF_WAY, 'CP1'), { percent: '—' });
});