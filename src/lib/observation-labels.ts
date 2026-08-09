import type { Segment, StructureEvidence } from '../data/types';

/** Wording that preserves the source's date precision: `on`, `during`, or `by`. */
export function evidenceDateLabel(evidence: StructureEvidence): string {
  const normalized = evidence.date.length === 7 ? `${evidence.date}-01` : evidence.date;
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    ...(evidence.datePrecision === 'day' ? { day: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${normalized}T00:00:00Z`));
  if (evidence.datePrecision === 'month') return `during ${formatted}`;
  if (evidence.datePrecision === 'day') return `on ${formatted}`;
  return `by ${formatted}`;
}

export function structureObservationLabel(
  structure: Segment['structures'][number],
  selectedDate: string,
): string {
  const observed = structure.observedAt.slice(0, 10);
  if (observed <= selectedDate.slice(0, 10)) {
    return `${structure.status}, observed as of ${observed}`;
  }
  return `Location marker; ${structure.status} observed as of ${observed}, after selected date`;
}
