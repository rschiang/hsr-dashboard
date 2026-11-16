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

const BASIS_PHRASE = {
  arcgis: (observedAt: string) => `ArcGIS layer last edited ${observedAt.slice(0, 10)}`,
  cvsr: (observedAt: string) => `CVSR ${observedAt.slice(0, 7)} data`,
  announcement: (observedAt: string) => `announced ${observedAt}`,
} as const;

export function structureObservationLabel(structure: Segment['structures'][number], selectedDate: string): string {
  const observed = structure.observedAt.length === 7 ? `${structure.observedAt}-01` : structure.observedAt.slice(0, 10);
  const phrase = `${structure.status}, ${BASIS_PHRASE[structure.basis](structure.observedAt)}`;
  return observed <= selectedDate.slice(0, 10) ? phrase : `Location marker; ${phrase}, after selected date`;
}
