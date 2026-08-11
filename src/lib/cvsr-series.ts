import type { Snapshot } from '../data/types';

export type NumericPackageMetric =
  | 'structuresComplete'
  | 'structuresTotal'
  | 'guidewayMilesComplete'
  | 'guidewayMilesTotal'
  | 'utilitiesRelocated'
  | 'utilitiesTotal'
  | 'parcelsDelivered'
  | 'parcelsTotal'
  | 'parcelsAcquired'
  | 'parcelsAcquisitionTotal'
  | 'railroadParcelsAcquired'
  | 'railroadParcelsTotal';

export type CvsrSeriesPoint = { month: string; value: number; total: number; ratio: number };

/**
 * One entry per requested month, in order. A month yields a point only when a
 * tier-1 CVSR snapshot reports that exact data month and both fields are finite
 * numbers with a positive total; otherwise `null`. Nothing is interpolated and
 * nothing is carried forward — the `null` runs are the visible evidence of the
 * months the Authority did not publish the metric.
 */
export function buildCvsrSeries(
  snapshots: Snapshot[],
  months: string[],
  cp: 'CP1' | 'CP2-3' | 'CP4',
  valueKey: NumericPackageMetric,
  totalKey: NumericPackageMetric,
): Array<CvsrSeriesPoint | null> {
  const byMonth = new Map<string, Snapshot>();
  for (const snapshot of snapshots) {
    if (snapshot.tier === 1) byMonth.set(snapshot.dataMonth, snapshot);
  }
  return months.map((month) => {
    const metrics = byMonth.get(month)?.perPackage?.[cp];
    const value = metrics?.[valueKey];
    const total = metrics?.[totalKey];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return null;
    return { month, value, total, ratio: value / total };
  });
}

/** Screen-reader text for one sparkline: the endpoints and how many months are simply not published. */
export function sparklineLabel(
  metric: string,
  cp: string,
  points: Array<CvsrSeriesPoint | null>,
): string {
  const published = points.filter((point): point is CvsrSeriesPoint => point !== null);
  const nullCount = points.length - published.length;
  if (published.length === 0) return `${metric} ${cp}: not published in any of the ${points.length} months`;
  const first = published[0];
  const last = published[published.length - 1];
  const percent = (point: CvsrSeriesPoint): string => Math.round(point.ratio * 100).toString();
  return `${metric} ${cp}: ${first.month} ${percent(first)}% to ${last.month} ${percent(last)}%; ${nullCount} of ${points.length} months not published`;
}
