import type { AlignmentStatus, Segment, Snapshot } from '../data/types';

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
  'guideway_complete',
  'track_laid',
  'systems_installed',
];

export const STATUS_COLORS: Record<AlignmentStatus, string> = {
  not_started: '#d9d9d9',
  no_data: '#f0f0f0',
  preconstruction: '#e6ab02',
  under_construction: '#d95f02',
  guideway_complete: '#1b9e77',
  track_laid: '#1f78b4',
  systems_installed: '#6a3d9a',
};

export const STATUS_LABELS: Record<AlignmentStatus, string> = {
  not_started: 'Not started',
  no_data: 'No alignment-resolved data',
  preconstruction: 'Preconstruction',
  under_construction: 'Under construction',
  guideway_complete: 'Guideway complete',
  track_laid: 'Track laid',
  systems_installed: 'Systems installed',
};

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
    return segment.completion === 0 ? 'not_started' : 'no_data';
  }

  const current = statusFromCompletion(segment.completion, segment.start, date);
  if (date < segment.start) return 'not_started';
  if (date < segment.finish) {
    return current === 'not_started' || current === 'preconstruction' ? current : 'under_construction';
  }
  return current === 'guideway_complete' ? 'guideway_complete' : current;
}

export function deriveStatuses(
  history: Snapshot[],
  segments: Segment[],
  date: string,
): { statuses: Record<string, AlignmentStatus>; tier: 1 | 2 | 3 } {
  const observed = history
    .filter((snapshot) => snapshot.tier === 3 && snapshot.date <= date && snapshot.perSegment)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const statuses: Record<string, AlignmentStatus> = {};
  for (const segment of segments) {
    const observedCompletion = observed?.perSegment?.[segment.id]?.completion;
    if (observedCompletion === undefined) statuses[segment.id] = scheduledStatus(segment, date);
    else if (observedCompletion === null && segment.structures.length > 0) statuses[segment.id] = segment.currentStatus;
    else statuses[segment.id] = statusFromCompletion(observedCompletion, segment.start, date);
  }
  return { statuses, tier: observed ? 3 : 1 };
}
