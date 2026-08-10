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

/** Verbatim provenance note attached to every hand-transcribed package value. */
export const TRANSCRIPTION_DETAIL =
  'Reviewed transcription: the published value is a chart image in the source PDF and is not extractable as text.';

/**
 * A published package value the Authority later restated. The superseded month
 * keeps the number its own report published; only the annotation is added.
 */
export type ReviewedCvsrRevision = {
  /** Every month whose published value the correction supersedes. */
  months: readonly string[];
  metric: CvsrInventory['revisions'][number]['metric'];
  packages: readonly CvsrPackage[];
  correctedIn: string;
  reportFile: string;
  detail: string;
};

type BuildCvsrInventoryInput = {
  snapshots: Snapshot[];
  localFiles: ReadonlySet<string>;
  reviewedReports: readonly ReviewedCvsrReport[];
  rejectedReports: CvsrReportDiagnostic[];
  parseFailures: readonly CvsrParseFailure[];
  fieldFailures: readonly CvsrFieldFailure[];
  revisions: readonly ReviewedCvsrRevision[];
  coverageStart: string;
  coverageEnd: string;
  /** Local CVSR candidate filenames with no byte-verified direct PDF URL. */
  unresolvedReportUrls?: readonly string[];
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

/**
 * Audited window in which the reports publish ROW parcel *acquisition* counts
 * but no cumulative parcels-delivered-to-design-builder figure. Acquisition is
 * a different measure, so these months are a source omission, never a parser
 * failure and never a substituted value.
 */
export const PARCEL_OMISSION_MONTHS: readonly string[] = monthRange('2019-09', '2020-01');

export function buildCvsrInventory({
  snapshots,
  localFiles,
  reviewedReports,
  rejectedReports,
  parseFailures,
  fieldFailures,
  revisions,
  coverageStart,
  coverageEnd,
  unresolvedReportUrls = [],
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
      detail: 'Package utility relocation counts are first published in the August-2020-data report; earlier reports publish only third-party agreement schedules and target milestones.',
    });
  }

  for (const month of PARCEL_OMISSION_MONTHS) {
    gaps.push({
      month,
      metric: 'parcel_delivery',
      packages: [...CVSR_PACKAGES],
      cause: 'related_measure_only',
      detail: 'The report publishes package parcel acquisition, needed and remaining counts; it does not publish parcels certified and delivered to the design-builder. The acquisition series is displayed separately.',
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

  // Transcriptions are recovered values, not gaps: every field listed here holds
  // a real published number, so it never enters `gaps`.
  const transcriptions = [...snapshots]
    .sort((a, b) => a.dataMonth.localeCompare(b.dataMonth))
    .flatMap((snapshot) => {
      const fields: Array<'progress' | 'parcels'> = [];
      for (const cp of CVSR_PACKAGES) {
        for (const field of snapshot.perPackage?.[cp]?.transcribedFields ?? []) {
          if (!fields.includes(field)) fields.push(field);
        }
      }
      if (fields.length === 0) return [];
      fields.sort((a, b) => (a === b ? 0 : a === 'progress' ? -1 : 1));
      return [{
        month: snapshot.dataMonth,
        reportFile: snapshot.reportFile ?? '',
        fields,
        detail: TRANSCRIPTION_DETAIL,
      }];
    });

  // Restatements are published values too: the superseded month keeps the number
  // its own report printed, so a revision never enters `gaps` either.
  const flatRevisions = revisions
    .flatMap((entry) => entry.months.map((month) => ({
      month,
      metric: entry.metric,
      packages: [...entry.packages],
      correctedIn: entry.correctedIn,
      reportFile: entry.reportFile,
      detail: entry.detail,
    })))
    .sort((a, b) => a.month.localeCompare(b.month) || a.metric.localeCompare(b.metric));

  return {
    coverageStart,
    coverageEnd,
    expectedMonths,
    availableMonths,
    gaps,
    rejectedReports,
    transcriptions,
    revisions: flatRevisions,
    unresolvedReportUrls: [...unresolvedReportUrls].sort(),
  };
}
