import type { CvsrGap, CvsrPackageId, Snapshot } from '../data/types';
import type { NumericPackageMetric } from './cvsr-series';

/**
 * The Central Valley construction segment, CP 1-4, is 119 miles. Every report in the
 * corpus states it — `brdmtg_052119` (March 2019 data) as "Central Valley 119 Miles",
 * the April 2025 report as `Total Guideway : 119`, the July 2026 report as
 * `Overall 9 21 89 119`. Package denominators move with contract scope and with which
 * sentence a given report happens to print, so their sum is not the corridor length.
 */
export const CENTRAL_VALLEY_GUIDEWAY_MILES = 119;

export type ProgramMetric = keyof NonNullable<Snapshot['program']>;

export type RailMetric = {
  label: string;
  value: NumericPackageMetric;
  total: NumericPackageMetric;
  /** Published program value, preferred over the package sum when the report printed one. */
  programValue?: ProgramMetric;
  programTotal?: ProgramMetric;
  /** Program denominator that does not vary by report. */
  fixedTotal?: number;
  unit?: string;
  /**
   * CVSR metric family. Matches package-level provenance from the pipeline: revisions
   * mark a restated cell, derivations mark one the report pinned rather than reprinted.
   */
  family?: 'progress' | 'parcels' | 'utilities';
  /** CVSR gap metric that explains a blank or partial month for this block. */
  gapMetric?: CvsrGap['metric'];
  format: (value: number, total: number) => string;
  /** Rendering when the source published a count but no denominator. */
  formatPartial?: (value: number) => string;
};

export const RAIL_METRICS: readonly RailMetric[] = [
  {
    label: 'Guideway complete',
    value: 'guidewayMilesComplete',
    total: 'guidewayMilesTotal',
    fixedTotal: CENTRAL_VALLEY_GUIDEWAY_MILES,
    unit: 'mi',
    family: 'progress',
    format: (value, total) => `${value.toFixed(1)} / ${total.toFixed(0)}`,
  },
  {
    label: 'Structures complete',
    value: 'structuresComplete',
    total: 'structuresTotal',
    family: 'progress',
    format: (value, total) => `${value} / ${total}`,
  },
  {
    label: 'Utilities relocated',
    value: 'utilitiesRelocated',
    total: 'utilitiesTotal',
    family: 'utilities',
    gapMetric: 'utilities',
    format: (value, total) => `${value.toLocaleString()} / ${total.toLocaleString()}`,
  },
  {
    label: 'Right-of-way delivered',
    value: 'parcelsDelivered',
    total: 'parcelsTotal',
    programValue: 'parcelsDelivered',
    programTotal: 'parcelsTotal',
    family: 'parcels',
    gapMetric: 'parcel_delivery',
    format: (value, total) => `${value.toLocaleString()} / ${total.toLocaleString()}`,
    formatPartial: (value) => value.toLocaleString(),
  },
];

/** Sum over the packages that reported the metric; `undefined` unless every one did. */
export function sumPackages(
  snapshot: Snapshot | undefined,
  key: NumericPackageMetric,
): number | undefined {
  const packages = Object.values(snapshot?.perPackage ?? {});
  if (packages.length === 0) return undefined;
  let total = 0;
  for (const metrics of packages) {
    const value = metrics[key];
    if (typeof value !== 'number') return undefined;
    total += value;
  }
  return total;
}

/** A published program value beats a package sum; a fixed corridor total beats both. */
export function railMetricValues(
  snapshot: Snapshot | undefined,
  metric: RailMetric,
): { value: number | undefined; total: number | undefined } {
  const program = snapshot?.program;
  return {
    value: (metric.programValue ? program?.[metric.programValue] : undefined)
      ?? sumPackages(snapshot, metric.value),
    total: metric.fixedTotal
      ?? (metric.programTotal ? program?.[metric.programTotal] : undefined)
      ?? sumPackages(snapshot, metric.total),
  };
}

export function formatRailValue(
  metric: RailMetric,
  value: number | undefined,
  total: number | undefined,
): string {
  if (value === undefined) return '—';
  if (total === undefined) return metric.formatPartial?.(value) ?? '—';
  return metric.format(value, total);
}

/** 21.1 of 21.2 miles is not a finished package: never round an incomplete measure to 100%. */
export function percentLabel(value: number, total: number): string {
  if (!(total > 0)) return '—';
  const rounded = Math.round((value / total) * 100);
  return `${value < total ? Math.min(rounded, 99) : rounded}%`;
}

/**
 * The percentage to print for one package, and whether it is the report's own.
 *
 * The pipeline settles what a value is: `derivedFields` marks a package whose split the
 * report stopped printing but pinned through a published program total, and carries the
 * citation that determines it. The rail renders that distinction rather than recomputing
 * it — a view that inferred completeness from a program pair would keep asserting it
 * long after the parse stopped being able to prove it.
 */
export function packagePercent(
  snapshot: Snapshot | undefined,
  metric: RailMetric,
  cp: CvsrPackageId,
): { percent: string; derivedTitle?: string } {
  const metrics = snapshot?.perPackage?.[cp];
  const value = metrics?.[metric.value];
  const total = metrics?.[metric.total];
  if (value === undefined || total === undefined) return { percent: '—' };
  const derived = metric.family === 'parcels' && metrics?.derivedFields?.includes('parcels');
  return {
    percent: percentLabel(value, total),
    ...(derived && metrics?.derivationDetail ? { derivedTitle: metrics.derivationDetail } : {}),
  };
}
