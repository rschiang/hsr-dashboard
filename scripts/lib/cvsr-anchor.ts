import type { Snapshot } from '../../src/data/types';

export type TierOneSnapshot = Extract<Snapshot, { tier: 1 }>;

/**
 * The last CVSR data month that had fully closed when the ArcGIS layer was last edited.
 * A CVSR data month is a month-end measure, so an edit made on 2026-05-04 cannot carry
 * May progress: the report it is comparable with is `2026-04`.
 */
export function anchorDataMonth(arcgisEditedAt: string): string {
  const edited = new Date(arcgisEditedAt);
  if (Number.isNaN(edited.getTime())) {
    throw new Error(`invalid ArcGIS edit timestamp: ${arcgisEditedAt}`);
  }
  const month = new Date(Date.UTC(edited.getUTCFullYear(), edited.getUTCMonth() - 1, 1));
  return month.toISOString().slice(0, 7);
}

/** The newest tier-1 snapshot carrying package metrics at or before `month`. */
export function anchorSnapshot(
  snapshots: readonly Snapshot[],
  month: string,
): TierOneSnapshot | undefined {
  return snapshots
    .filter((snapshot): snapshot is TierOneSnapshot => snapshot.tier === 1 && snapshot.perPackage !== undefined)
    .filter((snapshot) => snapshot.dataMonth <= month)
    .sort((a, b) => a.dataMonth.localeCompare(b.dataMonth))
    .at(-1);
}
