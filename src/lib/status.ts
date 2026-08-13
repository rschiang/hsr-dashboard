import type {
  AlignmentStatus,
  Segment,
  SegmentObservation,
  Snapshot,
  StructureEvidence,
} from '../data/types';

export const PHASES = [
  'row_acquired',
  'utilities_relocated',
  'preconstruction',
  'under_construction',
  'guideway_complete',
  'track_laid',
  'systems_installed',
] as const;

export const ALIGNMENT_STATUSES: AlignmentStatus[] = [
  'not_started',
  'no_data',
  'preconstruction',
  'under_construction',
  'structure_complete',
  'guideway_complete',
  'track_laid',
  'systems_installed',
];

export const STATUS_COLORS: Record<AlignmentStatus, string> = {
  not_started: '#d9d9d9',
  no_data: '#f0f0f0',
  preconstruction: '#e6ab02',
  under_construction: '#d95f02',
  structure_complete: '#66a61e',
  guideway_complete: '#1b9e77',
  track_laid: '#1f78b4',
  systems_installed: '#6a3d9a',
};

export const STATUS_LABELS: Record<AlignmentStatus, string> = {
  not_started: 'Not started',
  no_data: 'No alignment-resolved data',
  preconstruction: 'Preconstruction',
  under_construction: 'Under construction',
  structure_complete: 'Structure complete',
  guideway_complete: 'Guideway complete',
  track_laid: 'Track laid',
  systems_installed: 'Systems installed',
};

/**
 * The Authority's own wording, verbatim from the July 2026 Central Valley Status
 * Report (data through May 31, 2026): the structure definition on printed pp. 6 and
 * 30, the guideway definition on printed p. 7. Printed p. 18 carries the structure
 * definition without its trailing "then ready for either track install or open to
 * traffic" clause, which is the form the legend caption quotes.
 */
export const OFFICIAL_DEFINITIONS = {
  structure: 'Structure Completion – all concrete work is complete, ready for punchlist and certification, then ready for either track install or open to traffic.',
  guideway: 'Guideway Completion – earthworks complete with rough grading.',
} as const;

export function statusFromCompletion(
  completion: number | null,
  start: string | null,
  date: string,
): AlignmentStatus {
  if (completion === null) return 'no_data';
  if (completion >= 1) return 'guideway_complete';
  if (completion > 0) return 'under_construction';
  if (start !== null && start.slice(0, 10) <= date.slice(0, 10)) return 'preconstruction';
  return 'not_started';
}

export function scheduledStatus(segment: Segment, date: string): AlignmentStatus {
  if (segment.kind === 'no-data' && segment.completion === null) return 'no_data';
  if (segment.start === null || segment.finish === null) {
    return segment.completion === null
      ? 'no_data'
      : statusFromCompletion(segment.completion, null, date);
  }

  const current = statusFromCompletion(segment.completion, segment.start, date);
  if (date < segment.start) return 'not_started';
  if (date < segment.finish) {
    return current === 'not_started' || current === 'preconstruction' ? current : 'under_construction';
  }
  return current === 'guideway_complete' ? 'guideway_complete' : current;
}

function evidenceDate(evidence: StructureEvidence): string {
  return evidence.date.length === 7 ? `${evidence.date}-01` : evidence.date.slice(0, 10);
}

export function latestStructureEvidence(
  segment: Segment,
  date: string,
): StructureEvidence | undefined {
  const selectedDate = date.slice(0, 10);
  return [...(segment.evidence ?? [])]
    .filter((evidence) => evidenceDate(evidence) <= selectedDate)
    .sort((a, b) => evidenceDate(b).localeCompare(evidenceDate(a)))[0];
}

export type ResolvedSegmentStatus = {
  status: AlignmentStatus;
  evidence?: StructureEvidence;
};

export function resolveSegmentStatus(
  segment: Segment,
  date: string,
  observation?: Pick<SegmentObservation, 'completion' | 'table'>,
): ResolvedSegmentStatus {
  if (observation?.table === 'completed') {
    return {
      status: segment.kind === 'structure' ? 'structure_complete' : 'guideway_complete',
      evidence: latestStructureEvidence(segment, date),
    };
  }
  if (observation !== undefined && observation.completion !== null) {
    return { status: statusFromCompletion(observation.completion, segment.start, date) };
  }

  const evidence = latestStructureEvidence(segment, date);
  if (evidence !== undefined) {
    return {
      status: evidence.claim === 'completed' ? 'structure_complete' : 'under_construction',
      evidence,
    };
  }

  if (observation !== undefined) {
    return { status: 'no_data' };
  }
  return { status: scheduledStatus(segment, date) };
}

export function deriveStatuses(
  history: Snapshot[],
  segments: Segment[],
  date: string,
): {
  statuses: Record<string, AlignmentStatus>;
  evidence: Record<string, StructureEvidence | undefined>;
} {
  const eligible = history
    .filter((snapshot) => snapshot.date <= date && snapshot.perSegment)
    .sort((a, b) => b.date.localeCompare(a.date));
  const statuses: Record<string, AlignmentStatus> = {};
  const evidence: Record<string, StructureEvidence | undefined> = {};
  for (const segment of segments) {
    const observed = eligible.find(
      (snapshot) => snapshot.perSegment !== undefined && Object.hasOwn(snapshot.perSegment, segment.id),
    );
    const observation = observed?.perSegment?.[segment.id];
    const resolved = resolveSegmentStatus(segment, date, observation);
    statuses[segment.id] = resolved.status;
    evidence[segment.id] = resolved.evidence;
  }
  return { statuses, evidence };
}

/**
 * Per-segment earthwork completion at the selected date, read only from the
 * observation. A segment absent from the snapshot yields `null`, never
 * `segment.completion` — that would leak today's value backwards into replay.
 */
export function selectedCompletions(
  segments: Segment[],
  observation: Snapshot | Snapshot[] | undefined,
  date?: string,
): Record<string, number | null> {
  const snapshots = Array.isArray(observation)
    ? observation
        .filter((snapshot) => !date || snapshot.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))
    : observation
      ? [observation]
      : [];
  const result: Record<string, number | null> = {};
  for (const segment of segments) {
    const latest = snapshots.find(
      (snapshot) => snapshot.perSegment !== undefined && Object.hasOwn(snapshot.perSegment, segment.id),
    );
    result[segment.id] = latest?.perSegment?.[segment.id].completion ?? null;
  }
  return result;
}
