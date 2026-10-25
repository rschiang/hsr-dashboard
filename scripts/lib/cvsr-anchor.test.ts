process.env.TZ = 'America/Los_Angeles';

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Snapshot } from '../../src/data/types';
import { anchorDataMonth, anchorSnapshot } from './cvsr-anchor';

function tierOne(dataMonth: string, guidewayMilesComplete: number): Snapshot {
  return {
    date: `${dataMonth}-01`,
    dataMonth,
    tier: 1,
    sourceId: 'cvsr',
    perPackage: {
      CP1: { structuresComplete: 0, structuresTotal: 33, guidewayMilesComplete: 11, guidewayMilesTotal: 32 },
      'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete, guidewayMilesTotal: 65 },
      CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 21.1, guidewayMilesTotal: 21.2 },
    },
  } as Snapshot;
}

test('an edit inside a month anchors on the last closed month', () => {
  assert.equal(anchorDataMonth('2026-05-04T23:03:48.168Z'), '2026-04');
  assert.equal(anchorDataMonth('2026-05-31T23:59:59.999Z'), '2026-04');
});

test('anchoring rolls the year back and reads the timestamp as UTC', () => {
  assert.equal(anchorDataMonth('2026-01-15T00:00:00.000Z'), '2025-12');
  // 2026-03-01T00:30Z is still February in America/Los_Angeles; the anchor is UTC-based.
  assert.equal(anchorDataMonth('2026-03-01T00:30:00.000Z'), '2026-02');
});

test('an unusable edit timestamp throws rather than guessing a month', () => {
  assert.throws(() => anchorDataMonth('not a date'), /invalid ArcGIS edit timestamp/);
});

test('the anchor snapshot is the newest published month at or before the anchor', () => {
  const snapshots: Snapshot[] = [
    tierOne('2026-03', 52),
    tierOne('2026-05', 57),
    tierOne('2026-04', 55),
    { date: '2026-06-02', tier: 2, polledAt: '2026-06-02T00:00:00.000Z', sourceId: 'arcgis_progress' } as Snapshot,
    tierOne('2026-08', 60),
  ];
  assert.equal(anchorSnapshot(snapshots, '2026-04')?.dataMonth, '2026-04');
  // A month with no report falls back to the newest earlier report, never forward.
  assert.equal(anchorSnapshot(snapshots, '2026-07')?.dataMonth, '2026-05');
  assert.equal(anchorSnapshot(snapshots, '2026-02'), undefined);
});
