import type {
  CvsrGap,
  CvsrInventory,
  CvsrReportDiagnostic,
  Snapshot,
} from '../../src/data/types';
import { CVSR_PACKAGES, type CvsrPackage } from './cvsr-parser';

export type ReviewedCvsrReport = {
  month: string;
  file: string;
  reportUrl: string;
  originalReportUrl?: string;
};

export type CvsrParseFailure = {
  file: string;
  dataMonth?: string;
  reason: string;
};

export type CvsrFieldFailure = {
  month: string;
  cp: CvsrPackage;
  metric: 'utilities' | 'parcels';
};

type BuildCvsrInventoryInput = {
  snapshots: Snapshot[];
  localFiles: ReadonlySet<string>;
  reviewedReports: readonly ReviewedCvsrReport[];
  rejectedReports: CvsrReportDiagnostic[];
  parseFailures: readonly CvsrParseFailure[];
  fieldFailures: readonly CvsrFieldFailure[];
  coverageStart: string;
  coverageEnd: string;
};

function monthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const cursor = new Date(`${start}-01T00:00:00Z`);
  const last = new Date(`${end}-01T00:00:00Z`);
  while (cursor <= last) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function buildCvsrInventory({
  snapshots,
  localFiles,
  reviewedReports,
  rejectedReports,
  parseFailures,
  fieldFailures,
  coverageStart,
  coverageEnd,
}: BuildCvsrInventoryInput): CvsrInventory {
  const expectedMonths = monthRange(coverageStart, coverageEnd);
  const availableMonths = snapshots.map((snapshot) => snapshot.dataMonth);
  const available = new Set(availableMonths);
  const gaps: CvsrGap[] = [];

  for (const month of expectedMonths) {
    if (available.has(month)) continue;

    const report = reviewedReports.find((candidate) => candidate.month === month);
    const parseFailure = parseFailures.find(
      (failure) => failure.dataMonth === month || failure.file === report?.file,
    );

    if (report && localFiles.has(report.file) && parseFailure) {
      gaps.push({
        month,
        metric: 'snapshot',
        packages: [...CVSR_PACKAGES],
        cause: 'parser_failure',
        reportFile: report.file,
        reportUrl: report.reportUrl,
        detail: parseFailure.reason,
      });
    } else if (report && !localFiles.has(report.file)) {
      gaps.push({
        month,
        metric: 'snapshot',
        packages: [...CVSR_PACKAGES],
        cause: 'report_not_downloaded',
        reportFile: report.file,
        reportUrl: report.reportUrl,
        detail: 'A valid Authority report URL is known, but the PDF is absent from the local inventory.',
      });
    } else if (parseFailure?.dataMonth === month) {
      gaps.push({
        month,
        metric: 'snapshot',
        packages: [...CVSR_PACKAGES],
        cause: 'parser_failure',
        reportFile: parseFailure.file,
        detail: parseFailure.reason,
      });
    } else {
      gaps.push({
        month,
        metric: 'snapshot',
        packages: [...CVSR_PACKAGES],
        cause: 'report_not_located',
        detail: 'No valid Authority report was located for this data month.',
      });
    }
  }

  for (const month of monthRange('2019-03', '2020-07')) {
    gaps.push({
      month,
      metric: 'utilities',
      packages: [...CVSR_PACKAGES],
      cause: 'source_not_reported',
      detail: 'The report does not publish package utility relocated and total counts in the later CVSR format.',
    });
  }

  for (const failure of fieldFailures) {
    const existing = gaps.find(
      (gap) => gap.month === failure.month
        && gap.metric === failure.metric
        && gap.cause === 'parser_failure',
    );
    if (existing) {
      if (!existing.packages.includes(failure.cp)) existing.packages.push(failure.cp);
      continue;
    }
    gaps.push({
      month: failure.month,
      metric: failure.metric,
      packages: [failure.cp],
      cause: 'parser_failure',
      detail: 'The report is present, but the parser could not extract this published package metric.',
    });
  }

  return {
    coverageStart,
    coverageEnd,
    expectedMonths,
    availableMonths,
    gaps,
    rejectedReports,
  };
}
