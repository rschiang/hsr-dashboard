import type {
  CvsrGap,
  CvsrGapCause,
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
  /** Byte-verified direct PDF URLs by filename, as written to `report-urls.json`. */
  reportUrls?: Readonly<Record<string, { url: string }>>;
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
 * Audited months where the reports publish no per-package cumulative
 * parcels-delivered-to-design-builder pair. Each entry says what the source
 * published instead, so a withheld measure is never a parser failure and never a
 * substituted value.
 */
export type ReviewedParcelOmission = {
  months: readonly string[];
  packages: readonly CvsrPackage[];
  cause: Extract<CvsrGapCause, 'related_measure_only' | 'source_not_reported' | 'total_not_reported'>;
  detail: string;
  /** The report the detail names, when one report carries the recovered figures. */
  reportUrl?: string;
};

export const PARCEL_OMISSIONS: readonly ReviewedParcelOmission[] = [
  {
    months: monthRange('2019-09', '2019-12'),
    packages: [...CVSR_PACKAGES],
    cause: 'related_measure_only',
    detail: 'The report publishes package parcel acquisition, needed and remaining counts; it does not publish parcels certified and delivered to the design-builder. The acquisition series is displayed separately.',
  },
  {
    months: ['2020-01'],
    packages: [...CVSR_PACKAGES],
    cause: 'total_not_reported',
    detail: 'Cumulative parcels delivered to the design-builder for January 2020 are recovered from the April 2020 report (data through February 2020), which publishes them only as chart images: 1,498 program total on page 13, CP 1 785 on page 25, CP 2-3 557 on page 34, CP 4 156 on page 43. That report publishes no January total-needed count — its 1,066 / 1,011 / 253 figures are a March 9, 2020 count — so no denominator is recorded for this month.',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_042120_FA_Central_Valley_Status_Report.pdf',
  },
];

export function parcelOmission(month: string, cp: CvsrPackage): ReviewedParcelOmission | undefined {
  return PARCEL_OMISSIONS.find((entry) => entry.months.includes(month) && entry.packages.includes(cp));
}

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
  reportUrls = {},
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
      detail: 'Package utility relocation counts are first published in the August-2020-data report; earlier reports publish only third-party agreement schedules and target milestones against a different denominator — the April 2020 report counts 20 of 87 CP 2-3 relocations where the first standardized report counts 187 of 692. The two are not the same series and are not merged.',
    });
  }

  for (const entry of PARCEL_OMISSIONS) {
    for (const month of entry.months) {
      gaps.push({
        month,
        metric: 'parcel_delivery',
        packages: [...entry.packages],
        cause: entry.cause,
        detail: entry.detail,
        ...(entry.reportUrl ? { reportUrl: entry.reportUrl } : {}),
      });
    }
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
      let detail: string | undefined;
      for (const cp of CVSR_PACKAGES) {
        const metrics = snapshot.perPackage?.[cp];
        for (const field of metrics?.transcribedFields ?? []) {
          if (!fields.includes(field)) fields.push(field);
        }
        detail ??= metrics?.transcriptionDetail;
      }
      if (fields.length === 0) return [];
      fields.sort((a, b) => (a === b ? 0 : a === 'progress' ? -1 : 1));
      return [{
        month: snapshot.dataMonth,
        reportFile: snapshot.reportFile ?? '',
        fields,
        detail: detail ?? TRANSCRIPTION_DETAIL,
      }];
    });

  // Derived values are determined values, not gaps: the report pins a program total that
  // leaves the package split with nothing free to assume.
  const derivations = [...snapshots]
    .sort((a, b) => a.dataMonth.localeCompare(b.dataMonth))
    .flatMap((snapshot) => {
      const fields: Array<'parcels'> = [];
      let detail: string | undefined;
      for (const cp of CVSR_PACKAGES) {
        const metrics = snapshot.perPackage?.[cp];
        for (const field of metrics?.derivedFields ?? []) {
          if (!fields.includes(field)) fields.push(field);
        }
        detail ??= metrics?.derivationDetail;
      }
      if (fields.length === 0 || detail === undefined) return [];
      return [{
        month: snapshot.dataMonth,
        reportFile: snapshot.reportFile ?? '',
        fields,
        detail,
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
      ...(reportUrls[entry.reportFile] ? { reportUrl: reportUrls[entry.reportFile].url } : {}),
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
    derivations,
    revisions: flatRevisions,
    unresolvedReportUrls: [...unresolvedReportUrls].sort(),
  };
}
