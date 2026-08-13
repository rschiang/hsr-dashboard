import assert from 'node:assert/strict';
import test from 'node:test';
import type { Segment } from '../data/types';
import { EDITORIAL_STRUCTURE_SHARE, assignWeights } from './weights';

function segment(overrides: Partial<Segment> & Pick<Segment, 'id' | 'cp' | 'kind'>): Segment {
  return {
    label: overrides.id,
    iosMileStart: 0,
    iosMileEnd: 1,
    officialMpStart: 'S 100',
    officialMpEnd: 'S 101',
    stationStart: null,
    stationEnd: null,
    stationing: 'published',
    completion: null,
    baselineDirt: null,
    deliveredDirt: null,
    start: null,
    finish: null,
    weight: 0,
    weightShare: 0,
    currentStatus: 'no_data',
    structures: [],
    evidence: [],
    stationSourceId: 'arcgis_progress',
    sourceId: 'arcgis_progress',
    ...overrides,
  };
}

test('no-data spans carry no modelled effort', () => {
  const gap = segment({ id: 'CP1:gap:1', cp: 'CP1', kind: 'no-data', iosMileStart: 10, iosMileEnd: 12 });
  const segments = [
    segment({ id: 'CP1:1', cp: 'CP1', kind: 'guideway', iosMileStart: 0, iosMileEnd: 10, baselineDirt: 500 }),
    segment({ id: 'CP1:2', cp: 'CP1', kind: 'structure', iosMileStart: 5, iosMileEnd: 6, label: 'Viaduct' }),
    gap,
  ];

  assignWeights(segments);

  assert.equal(gap.weight, 0);
  assert.equal(gap.weightShare, 0);
  assert.ok(segments[0].weightShare > 0);
  assert.ok(segments[1].weightShare > 0);
});

test('the structure share is the declared editorial constant, not a derived ratio', () => {
  const segments = [
    segment({ id: 'CP1:1', cp: 'CP1', kind: 'guideway', iosMileStart: 0, iosMileEnd: 10, baselineDirt: 500 }),
    segment({ id: 'CP1:2', cp: 'CP1', kind: 'structure', iosMileStart: 5, iosMileEnd: 6, label: 'Viaduct' }),
  ];

  const calibration = assignWeights(segments);

  assert.equal(calibration.CP1?.modelledStructureShare, EDITORIAL_STRUCTURE_SHARE.CP1);
  assert.ok((calibration.CP1?.structurePerGuidewayScale ?? 0) > 0);
});

test('a package with structures but a zero editorial share is a build failure', () => {
  const segments = [
    segment({ id: 'CP4:1', cp: 'CP4', kind: 'guideway', iosMileStart: 131, iosMileEnd: 150, baselineDirt: 300 }),
    segment({ id: 'CP4:2', cp: 'CP4', kind: 'structure', iosMileStart: 140, iosMileEnd: 141, label: 'Overcrossing' }),
  ];

  assert.equal(EDITORIAL_STRUCTURE_SHARE.CP4, 0);
  assert.throws(() => assignWeights(segments), /CP4 has structure segments but a zero editorial structure share/);
});
