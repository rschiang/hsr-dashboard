import type { CvsrGap, CvsrGapCause, CvsrInventory } from '../data/types';

export type CvsrGapGroup = CvsrGap & { endMonth: string };
export type RevisionGroup = {
  key: string;
  metric: CvsrInventory['revisions'][number]['metric'];
  packages: string;
  month: string;
  endMonth: string;
  correctedIn: string;
  detail: string;
};

function nextMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function groupCvsrGaps(gaps: CvsrGap[]): CvsrGapGroup[] {
  const keyFor = (gap: CvsrGap) => [
    gap.metric,
    gap.cause,
    [...gap.packages].sort().join(','),
    gap.detail,
  ].join('|');
  const sorted = [...gaps].sort((left, right) => (
    keyFor(left).localeCompare(keyFor(right)) || left.month.localeCompare(right.month)
  ));
  const groups: CvsrGapGroup[] = [];
  for (const gap of sorted) {
    const previous = groups.at(-1);
    if (previous && keyFor(previous) === keyFor(gap) && nextMonth(previous.endMonth) === gap.month) {
      previous.endMonth = gap.month;
    } else {
      groups.push({ ...gap, packages: [...gap.packages], endMonth: gap.month });
    }
  }
  return groups;
}

export function groupRevisions(entries: CvsrInventory['revisions']): RevisionGroup[] {
  const sorted = [...entries].sort((left, right) => left.month.localeCompare(right.month));
  const groups: RevisionGroup[] = [];
  for (const entry of sorted) {
    const key = `${entry.metric}|${entry.packages.join(', ')}|${entry.correctedIn}`;
    const previous = groups.at(-1);
    if (previous && previous.key === key && nextMonth(previous.endMonth) === entry.month) {
      previous.endMonth = entry.month;
    } else {
      groups.push({
        key,
        metric: entry.metric,
        packages: entry.packages.join(', '),
        month: entry.month,
        endMonth: entry.month,
        correctedIn: entry.correctedIn,
        detail: entry.detail,
      });
    }
  }
  return groups;
}

export const GAP_LABELS: Record<CvsrGapCause, string> = {
  report_not_downloaded: 'Report not downloaded',
  report_not_located: 'No valid report located',
  source_not_reported: 'Not published in source',
  related_measure_only: 'Related measure only',
  total_not_reported: 'Total not published',
  parser_failure: 'Parser failed — report available',
};

export const GAP_METRIC_LABELS: Record<CvsrGap['metric'], string> = {
  snapshot: 'Monthly report',
  utilities: 'Utilities',
  parcels: 'Right-of-way acquisition',
  parcel_delivery: 'Right-of-way delivery',
};

export const REVISION_METRIC_LABELS: Record<CvsrInventory['revisions'][number]['metric'], string> = {
  progress: 'Guideway and structure progress',
  parcels: 'Right-of-way delivery',
  utilities: 'Utilities',
};
