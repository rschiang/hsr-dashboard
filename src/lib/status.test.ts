import assert from 'node:assert/strict';
import test from 'node:test';
import type { Segment, Snapshot, StructureEvidence } from '../data/types';
import { deriveStatuses, resolveSegmentStatus, selectedCompletions } from './status';

function segment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'CP1:176',
    cp: 'CP1',
    kind: 'structure',
    label: 'San Joaquin River Viaduct & Pergola',
    iosMileStart: 49,
    iosMileEnd: 50,
    officialMpStart: 'S 173',
    officialMpEnd: 'S 174',
    stationStart: null,
    stationEnd: null,
    stationing: 'published',
    completion: null,
    baselineDirt: null,
    deliveredDirt: null,
    start: null,
    finish: null,
    weight: 1,
    weightShare: 0.01,
    currentStatus: 'no_data',
    structures: [],
    evidence: [],
    sourceId: 'arcgis_progress',
    ...overrides,
  };
}

const progressEvidence: StructureEvidence = {
  id: 'san-joaquin-progress-2020-08',
  segmentId: 'CP1:176',
  claim: 'in_progress',
  date: '2020-08',
  datePrecision: 'month',
  label: 'San Joaquin River Viaduct & Pergola',
  sourceTitle: 'Central Valley Status Report, August 2020',
  sourceUrl: 'https://example.test/cvsr-2020-08.pdf',
  sourceId: 'cvsr_2020_08',
  quote: 'Finishing touches on the Arch Span and clean-up work.',
};

const completionEvidence: StructureEvidence = {
  ...progressEvidence,
  id: 'san-joaquin-complete-2021-02',
  claim: 'completed',
  date: '2021-02',
  sourceTitle: 'San Joaquin River Viaduct & Pergola',
  sourceUrl: 'https://example.test/san-joaquin-river-viaduct',
  sourceId: 'buildhsr_san_joaquin',
  quote: 'The San Joaquin River Viaduct was completed in February 2021.',
};

test('dated evidence changes categorical status without inventing completion', () => {
  const subject = segment({ evidence: [progressEvidence, completionEvidence] });

  assert.equal(resolveSegmentStatus(subject, '2020-07-01').status, 'no_data');
  assert.equal(resolveSegmentStatus(subject, '2020-08-01').status, 'under_construction');
  assert.equal(resolveSegmentStatus(subject, '2021-02-01').status, 'structure_complete');
  assert.equal(subject.completion, null);
});

test('numeric observations take precedence over categorical evidence', () => {
  const subject = segment({ evidence: [completionEvidence] });
  const resolved = resolveSegmentStatus(subject, '2021-03-01', { completion: 0.4 });

  assert.equal(resolved.status, 'under_construction');
  assert.equal(resolved.evidence, undefined);
  assert.equal(resolved.provenance, 'observed');
});

test('null observations allow dated evidence and produce mixed replay provenance', () => {
  const evidenced = segment({ evidence: [progressEvidence] });
  const scheduled = segment({
    id: 'CP1:177',
    kind: 'guideway',
    completion: 0,
    start: '2022-01-01',
    finish: '2023-01-01',
    currentStatus: 'not_started',
  });
  const result = deriveStatuses([], [evidenced, scheduled], '2020-08-01');

  assert.equal(result.statuses['CP1:176'], 'under_construction');
  assert.equal(result.statuses['CP1:177'], 'not_started');
  assert.equal(result.provenance, 'mixed');
});


test('an absent observation yields null, never today\u2019s completion', () => {
  const built = segment({ id: 'CP1:200', kind: 'guideway', completion: 0.82 });
  const untouched = segment({ id: 'CP1:201', kind: 'guideway', completion: 0 });

  assert.deepEqual(selectedCompletions([built, untouched], undefined), {
    'CP1:200': null,
    'CP1:201': null,
  });
});

test('only segments present in the snapshot read from it', () => {
  const observed = segment({ id: 'CP1:200', kind: 'guideway', completion: 0.82 });
  const missing = segment({ id: 'CP1:201', kind: 'guideway', completion: 0.4 });
  const snapshot: Snapshot = {
    date: '2022-06-01',
    tier: 3,
    sourceId: 'arcgis_progress',
    perSegment: { 'CP1:200': { completion: 0.31, sourceId: 'arcgis_progress' } },
  };

  assert.deepEqual(selectedCompletions([observed, missing], snapshot), {
    'CP1:200': 0.31,
    'CP1:201': null,
  });
});

test('published completion without schedule fields is not hatched', () => {
  assert.equal(
    resolveSegmentStatus(segment({ kind: 'guideway', completion: 0.68 }), '2024-01-01').status,
    'under_construction',
  );
  assert.equal(
    resolveSegmentStatus(segment({ kind: 'guideway', completion: null }), '2024-01-01').status,
    'no_data',
  );
});

test('uses the latest per-segment observation across snapshot tiers', () => {
  const subject = segment({ kind: 'structure' });
  const history: Snapshot[] = [
    {
      date: '2026-03-01',
      dataMonth: '2026-03',
      tier: 2,
      sourceId: 'cvsr',
      perSegment: { [subject.id]: { completion: 0.4, sourceId: 'cvsr', table: 'underway' } },
    },
    {
      date: '2026-04-01',
      tier: 3,
      sourceId: 'arcgis_progress',
      perSegment: { 'CP1:other': { completion: 0.8, sourceId: 'arcgis_progress' } },
    },
  ];
  assert.equal(deriveStatuses(history, [subject], '2026-04-01').statuses[subject.id], 'under_construction');
});

test('a completed CVSR table row resolves categorically even below 100 percent', () => {
  assert.equal(
    resolveSegmentStatus(segment(), '2026-04-01', { completion: 0.96, table: 'completed' }).status,
    'structure_complete',
  );
});