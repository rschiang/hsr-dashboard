import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { CVSR_ROW_CROSSWALK } from '../src/data/cvsr-row-crosswalk';
import type {
  CvsrInventory,
  CvsrReportDiagnostic,
  PackageMetrics,
  Snapshot,
} from '../src/data/types';
import {
  CVSR_PACKAGES,
  normalizeCvsrText,
  parseDataMonth,
  parseParcelAcquisitionAudit,
  parseParcelAcquisitionPair,
  parseParcelPair,
  parseProgramParcelDelivery,
  parseProgressMetrics,
  parseRailroadParcelPair,
  parseReportMonth,
  parseRowProgress,
  parseUtilityPair,
  type CvsrPackage,
} from './lib/cvsr-parser';
import {
  PARSE_FAILURE_PREFIX,
  buildCvsrInventory,
  ingestedReportFiles,
  parcelOmission,
  type CvsrFieldFailure,
  type CvsrParseFailure,
  type ReviewedCvsrReport,
  type ReviewedCvsrRevision,
} from './lib/cvsr-inventory';
import { assertPdfResponse } from './lib/cvsr-download';

const DIRECTORY = 'data/raw/cvsr';
const MANIFEST = `${DIRECTORY}/MANIFEST.md`;
const PARSED = `${DIRECTORY}/parsed-snapshots.json`;
const REPORT_URLS = `${DIRECTORY}/report-urls.json`;
const CURRENT_INDEX = 'https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/';
const CVSR_CANDIDATE = /CVSR|Central[_ -]Valley[_ -]Status[_ -](?:Report|Update)/i;
/** Prefix probed and hashed to prove a remote PDF is byte-identical to the local copy. */
const PREFIX_BYTES = 262144;
const USER_AGENT = 'hsr-dashboard/1.0 (+https://github.com/rschiang/hsr-dashboard)';
const REQUEST_INTERVAL_MS = 1000;
/**
 * Gaps waited out when the host answers a PDF request with HTML. It throttles well before
 * it blocks, so the fixed 1 s gap is not always enough and a single refusal proves nothing.
 */
const CHALLENGE_BACKOFF_MS = [5_000, 15_000, 45_000] as const;
/** How far back `--ingest` looks for a new report. Fixed, so no bookkeeping can drift. */
const DISCOVERY_WINDOW_DAYS = 180;
/** The observed data-to-publication lag is ~2 months, so four leaves a month of slack. */
const EXPECTED_LAG_MONTHS = 4;
const MEDIA_API = 'https://hsr.ca.gov/wp-json/wp/v2/media';
/** `CVSR` matches report titles; the phrase catches `FA-Central-Valley-Status-Report-*`. */
const MEDIA_SEARCH_TERMS = ['CVSR', 'Central Valley Status Report'] as const;
/** Decks, executive summaries and remediation re-postings are not the monthly report. */
const VARIANT_REPORT = /Executive[_ -]Summary|PRESENTATION|PPT|with[_ -]Flash|Remediation/i;

/** A direct hsr.ca.gov PDF URL proven to serve the exact local file. */
type ResolvedReportUrl = {
  url: string;
  bytes: number;
  prefixSha256: string;
  /** Upload date reported by the media API, recorded as provenance only. */
  publishedAt?: string;
  verifiedAt: string;
};
type ReportUrlRegistry = Record<string, ResolvedReportUrl>;

async function loadReportUrls(): Promise<ReportUrlRegistry> {
  try {
    return JSON.parse(await readFile(REPORT_URLS, 'utf8')) as ReportUrlRegistry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

const REVIEWED_CVSR_REPORTS: readonly ReviewedCvsrReport[] = [
  {
    month: '2023-05',
    file: 'CVSR-2307-2305-Data-FINAL-V0-A11Y.archive-20230725.pdf',
    reportUrl: 'https://web.archive.org/web/20230725134531id_/https://hsr.ca.gov/wp-content/uploads/2023/07/CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf',
    originalReportUrl: 'https://hsr.ca.gov/wp-content/uploads/2023/07/CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2023-10',
    file: 'CVSR-2312-2310-Data-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2024/01/CVSR-2312-2310-Data-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2024-01',
    file: 'CVSR_2403_2401_Data-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2024/03/CVSR_2403_2401_Data-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2024-05',
    file: 'Supplemental-CVSR-2024-08-Data-2024-05-FINAL-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2024/08/Supplemental-CVSR-2024-08-Data-2024-05-FINAL-A11Y.pdf',
  },
  {
    month: '2024-06',
    file: 'CVSR-2024-08-Data-2024-06-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2024/08/CVSR-2024-08-Data-2024-06-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2024-09',
    file: 'CVSR-2024-11-Data-2024-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2024/12/CVSR-2024-11-Data-2024-A11Y.pdf',
  },
  {
    month: '2025-01',
    file: 'CVSR-2025-03-20-Data-2025-01-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2025/03/CVSR-2025-03-20-Data-2025-01-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2025-04',
    file: 'CVSR-2025-06-Data-2025-04-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2025/06/CVSR-2025-06-Data-2025-04-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2025-08',
    file: 'CVSR-2025-10-Data-2025-08-Supplemental-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2025/10/CVSR-2025-10-Data-2025-08-Supplemental-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2025-10',
    file: 'CVSR-2025-12-Data-2025-10-FINAL-V0-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2025/12/CVSR-2025-12-Data-2025-10-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2026-01',
    file: 'FA-Central-Valley-Status-Report-Supplemental-March-2026-A11Y.pdf',
    reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2026/03/FA-Central-Valley-Status-Report-Supplemental-March-2026-A11Y.pdf',
  },
];

const REJECTED_OVERWRITTEN_REPORT: ReviewedCvsrReport = {
  month: '2023-04',
  file: 'CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf',
  reportUrl: 'https://hsr.ca.gov/wp-content/uploads/2023/07/CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf',
};

/**
 * Extra candidate URLs for reports the resolver's month heuristics cannot reach, because
 * the Authority filed them under an upload month no month in or derivable from the report
 * implies: `CVSR-2025-07-…` sits in `uploads/2023/03/`, and the January and February 2021
 * board-meeting reports (data through November and December 2020) sit in `uploads/2021/04/`.
 *
 * A hint is only a place to look. It is probed and byte-verified like every other
 * candidate, so a wrong or stale hint resolves nothing instead of publishing an
 * unverified citation.
 */
const REPORT_URL_HINTS: Readonly<Record<string, readonly string[]>> = {
  'CVSR-2025-07-Data-2025-05-FINAL-V2-A11Y.pdf': [
    'https://hsr.ca.gov/wp-content/uploads/2023/03/CVSR-2025-07-Data-2025-05-FINAL-V2-A11Y.pdf',
  ],
  'brdmtg_012121_FA_CVSR_2011_Data.pdf': [
    'https://hsr.ca.gov/wp-content/uploads/2021/04/brdmtg_012121_FA_CVSR_2011_Data.pdf',
  ],
  'brdmtg_020921_FA_CVSR_2102_2012_Data.pdf': [
    'https://hsr.ca.gov/wp-content/uploads/2021/04/brdmtg_020921_FA_CVSR_2102_2012_Data.pdf',
  ],
};

async function writeManifest(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const localFiles = new Set(await readdir(DIRECTORY));
  const lines = [
    '# Central Valley Status Report download manifest',
    '',
    'Reviewed official reports recovered outside the original local corpus.',
    'Run `npm run parse:cvsr` after adding or replacing a reviewed PDF.',
    '',
    '| Data month | Expected local filename | State | Canonical report or audit evidence |',
    '|---|---|---|---|',
  ];
  for (const report of REVIEWED_CVSR_REPORTS) {
    const state = localFiles.has(report.file) ? 'downloaded' : 'missing';
    const evidence = report.originalReportUrl
      ? `${report.reportUrl} — archived capture of ${report.originalReportUrl}`
      : report.reportUrl;
    lines.push(`| \`${report.month}\` | \`${report.file}\` | ${state} | ${evidence} |`);
  }
  lines.push(
    `| \`${REJECTED_OVERWRITTEN_REPORT.month}\` | \`${REJECTED_OVERWRITTEN_REPORT.file}\` | rejected-duplicate | ${REJECTED_OVERWRITTEN_REPORT.reportUrl} — URL was overwritten; current document says data through April 2023 and duplicates the retained April report |`,
    '',
    `Canonical Finance & Audit index: ${CURRENT_INDEX}`,
  );

  // Offline enrichment: the parse artifact is the only source of transcription and
  // URL-resolution state, and it may legitimately be absent on a fresh checkout.
  let inventory: CvsrInventory | undefined;
  try {
    // Our own artifact, written by parseLocalPdfs in this file.
    const artifact = JSON.parse(await readFile(PARSED, 'utf8')) as { cvsrInventory: CvsrInventory };
    inventory = artifact.cvsrInventory;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (inventory) {
    lines.push(
      '',
      '## Transcribed values',
      '',
      'Package values read by hand from chart images in the source PDF. They are published',
      'Authority figures, not estimates, and they are not gaps.',
      '',
      '| Data month | Report filename | Transcribed fields | Detail |',
      '|---|---|---|---|',
    );
    for (const record of inventory.transcriptions) {
      lines.push(`| \`${record.month}\` | \`${record.reportFile}\` | ${record.fields.join(', ')} | ${record.detail} |`);
    }
    lines.push(
      '',
      '## Derived values',
      '',
      'Package values the report stopped printing but pinned through a published program',
      'total, leaving the split determined. The parse re-checks each pin against the report',
      'it reads and fails if the total moves or the split is published again.',
      '',
      '| Data month | Report filename | Derived fields | Detail |',
      '|---|---|---|---|',
    );
    for (const record of inventory.derivations) {
      lines.push(`| \`${record.month}\` | \`${record.reportFile}\` | ${record.fields.join(', ')} | ${record.detail} |`);
    }
    lines.push(
      '',
      '## Unresolved report URLs',
      '',
      'No direct hsr.ca.gov PDF URL could be byte-verified for these local files; the dashboard',
      'falls back to the CVSR registry link and shows the filename instead of a per-report link.',
      '',
    );
    if (inventory.unresolvedReportUrls.length === 0) lines.push('- none');
    for (const file of inventory.unresolvedReportUrls) lines.push(`- \`${file}\``);
  }
  await writeFile(MANIFEST, `${lines.join('\n')}\n`);
  console.log(`CVSR manifest: ${MANIFEST}`);
}


type ManualProgress = Record<'CP1' | 'CP2-3' | 'CP4', {
  structuresComplete: number;
  structuresTotal: number;
  guidewayMilesComplete: number;
  guidewayMilesTotal: number;
}>;

const LEGACY_DATES: Record<string, string> = {
  'brdmtg_052119_FA_Central_Valley_Status_Update.pdf': '2019-03',
  'brdmtg_061819_FA_Central_Valley_Status_Report.pdf': '2019-04',
  'brdmtg_071619_FA_Central_Valley_Status_Report.pdf': '2019-05',
  'brdmtg_082019_FA_Central_Valley_Status_Report.pdf': '2019-06',
  'brdmtg_091719_FA_Central_Valley_Status_Report.pdf': '2019-07',
};
// Reviewed transcriptions from ROW charts whose blue labels are vector outlines
// rather than extractable PDF text. Every entry is the keyed report's own data
// month, never a value carried from a comparison month; `detail` records the cases
// where the chart publishing that month appears in a later report.
const LEGACY_PARCELS: Readonly<Record<string, {
  /** Replaces TRANSCRIPTION_DETAIL when the value comes from a later report. */
  detail?: string;
  values: Record<CvsrPackage, { delivered: number; total?: number }>;
}>> = {
  'brdmtg_082019_FA_Central_Valley_Status_Report.pdf': {
    values: {
      CP1: { delivered: 819, total: 892 },
      'CP2-3': { delivered: 533, total: 755 },
      CP4: { delivered: 164, total: 208 },
    },
  },
  'brdmtg_091719_FA_Central_Valley_Status_Report.pdf': {
    values: {
      CP1: { delivered: 823, total: 893 },
      'CP2-3': { delivered: 540, total: 756 },
      CP4: { delivered: 165, total: 210 },
    },
  },
  'brdmtg_031720_FA_Central_Valley_Status_Report.pdf': {
    detail: 'Reviewed transcription from a later report: January 2020 cumulative parcels delivered to the design-builder are published only as chart images in the April 2020 report (data through February 2020) — program total 1,498 on page 13, CP 1 785 on page 25, CP 2-3 557 on page 34, CP 4 156 on page 43. https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_042120_FA_Central_Valley_Status_Report.pdf. That report publishes no January total-needed count, so no denominator is recorded.',
    values: {
      CP1: { delivered: 785 },
      'CP2-3': { delivered: 557 },
      CP4: { delivered: 156 },
    },
  },
};

/**
 * Months whose per-package split the report stops printing while still pinning the
 * program total that produced it.
 *
 * This is not a carry-forward. A carry-forward asserts an unverified value; a pin
 * leaves no value free to assert. The April 2026 report publishes the split as
 * 1,080 + 985 + 223 = 2,288 with **zero** parcels to be delivered in every package, and
 * every later report — which prints no split at all — states "All required parcels
 * have been delivered — 2,288 of 2,288". With the program total unmoved and every
 * package already at zero remaining, the split is determined.
 *
 * `parsePdf` re-derives that pin from the report it is reading and throws if the total
 * moves or if the report resumes publishing its own split, so a stale entry fails loudly
 * instead of ageing into a fabricated value.
 */
const PINNED_PARCELS: Readonly<Record<string, {
  /** Report whose published split this month's program total pins. */
  source: string;
  detail: string;
  values: Record<CvsrPackage, { delivered: number; total: number }>;
}>> = {
  'FA-Central-Valley-Status-Report-July-2026-A11Y.pdf': {
    source: 'FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf',
    detail: 'The authority officially marked 100% acquisition milestone for parcels required for CP1–4 guideway construction in the July 2026 report (data through May 2026). The separate values are sourced from June 2026 report (data through April 2026) which publishes that same total.',
    values: {
      CP1: { delivered: 1080, total: 1080 },
      'CP2-3': { delivered: 985, total: 985 },
      CP4: { delivered: 223, total: 223 },
    },
  },
  'FA-Central-Valley-Status-Report-August-2026-A11Y.pdf': {
    source: 'FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf',
    detail: 'The August 2026 report (data through June 2026) prints no package parcel split and restates the completed program total, "All required parcels have been delivered — 2,288 of 2,288". The separate values are sourced from June 2026 report (data through April 2026) which publishes that same total.',
    values: {
      CP1: { delivered: 1080, total: 1080 },
      'CP2-3': { delivered: 985, total: 985 },
      CP4: { delivered: 223, total: 223 },
    },
  },
};


// Reviewed restatement register. The Authority published the correction as
// prose, not as a parsable table, so it is a reviewed constant exactly like the
// legacy transcription registers. The superseded months keep their published
// values; only the annotation is added.
const REVIEWED_REVISIONS: readonly ReviewedCvsrRevision[] = [{
  months: ['2021-08', '2021-09', '2021-10', '2021-11', '2021-12', '2022-01', '2022-02', '2022-03'],
  metric: 'progress',
  packages: ['CP4'],
  correctedIn: '2022-04',
  reportFile: 'CVSR-2206-2204-Data-FINAL-V0-A11Y.pdf',
  detail: 'A discrepancy has been identified for CP4 in the previous months reporting of the guideway progress. This has been corrected for the April 2022 Data report.',
}];

// Transcribed from each report's package Construction Progress charts. These
// vector charts expose the completed/underway split visually but not in PDF text.
const LEGACY_PROGRESS: Record<string, ManualProgress> = {
  'brdmtg_052119_FA_Central_Valley_Status_Update.pdf': {
    CP1: { structuresComplete: 4, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_061819_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 4, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_071619_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 4, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_082019_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 5, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_091719_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 5, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_101519_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 6, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_111919_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 6, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 50, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_121019_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 6, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_011420_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 6, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_021820_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 0, guidewayMilesTotal: 29.2 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_031720_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_042120_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_051420_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_062520_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_071620_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_081320_FA_Central_Valley_Status_Report.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_090920_FA_CVSR_2009_2007_Data.pdf': {
    CP1: { structuresComplete: 7, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_101520_FA_CVSR_2010_2008_Data.pdf': {
    CP1: { structuresComplete: 12, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_111920_FA_CVSR_2011_2009_Data.pdf': {
    CP1: { structuresComplete: 12, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_121020_FA_CVSR_2012_2010_Data.pdf': {
    CP1: { structuresComplete: 12, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
  'brdmtg_012121_FA_CVSR_2011_Data.pdf': {
    CP1: { structuresComplete: 13, structuresTotal: 33, guidewayMilesComplete: 2, guidewayMilesTotal: 32 },
    'CP2-3': { structuresComplete: 0, structuresTotal: 49, guidewayMilesComplete: 19, guidewayMilesTotal: 65 },
    CP4: { structuresComplete: 0, structuresTotal: 11, guidewayMilesComplete: 0, guidewayMilesTotal: 21 },
  },
};


function reportMetadata(file: string): ReviewedCvsrReport | undefined {
  if (file === REJECTED_OVERWRITTEN_REPORT.file) return REJECTED_OVERWRITTEN_REPORT;
  return REVIEWED_CVSR_REPORTS.find((report) => report.file === file);
}


async function parsePdf(
  path: string,
  reportUrls: ReportUrlRegistry,
  guidewayByLabel: ReadonlyMap<string, string>,
): Promise<Snapshot> {
  const parser = new PDFParse({ data: await readFile(path) });
  let text: string;
  try {
    text = normalizeCvsrText((await parser.getText()).text);
  } finally {
    await parser.destroy();
  }

  const reportFile = basename(path);
  const dataMonth = parseDataMonth(text, reportFile, LEGACY_DATES);
  const report = reportMetadata(reportFile);
  const reportUrl = report?.reportUrl ?? reportUrls[reportFile]?.url;
  const manualProgress = LEGACY_PROGRESS[reportFile];
  const perPackage = (manualProgress
    ? Object.fromEntries(
        Object.entries(manualProgress).map(([cp, metrics]) => [
          cp,
          { ...metrics, transcribedFields: ['progress'], sourceId: 'cvsr' },
        ]),
      )
    : parseProgressMetrics(text, dataMonth)) as Record<CvsrPackage, PackageMetrics>;
  const rowProgress = parseRowProgress(text, reportFile, (kind, label) =>
    kind === 'structure'
      ? Boolean(CVSR_ROW_CROSSWALK[label])
      : label === 'Herndon Canal to Swift Ave' || guidewayByLabel.has(label));
  const perSegment: NonNullable<Snapshot['perSegment']> = {};
  const unmatchedRows: typeof rowProgress = [];
  for (const row of rowProgress) {
    const segmentId = row.kind === 'structure'
      ? CVSR_ROW_CROSSWALK[row.location]
      : row.location === 'Herndon Canal to Swift Ave'
        ? 'CP1:gap:1'
        : guidewayByLabel.get(row.location);
    if (!segmentId) {
      unmatchedRows.push(row);
      continue;
    }
    if (perSegment[segmentId]) {
      throw new Error(`${reportFile}: multiple CVSR rows resolve to ${segmentId}`);
    }
    perSegment[segmentId] = {
      completion: row.completion,
      sourceId: 'cvsr',
      reportFile,
      ...(reportUrl ? { reportUrl } : {}),
      dataMonth,
      scheduleStart: row.start,
      scheduleFinish: row.finish,
      table: row.table,
    };
  }
  if (dataMonth >= '2026-04' && rowProgress.length > 0) {
    const resolvedStructures = rowProgress.filter(
      (row) => row.kind === 'structure' && CVSR_ROW_CROSSWALK[row.location],
    ).length;
    if (resolvedStructures !== 35) {
      throw new Error(`${reportFile}: resolved ${resolvedStructures} of 35 structure rows`);
    }
  }
  const structureEvidence = rowProgress.flatMap((row) => {
    const segmentId = row.kind === 'structure'
      ? CVSR_ROW_CROSSWALK[row.location]
      : row.location === 'Herndon Canal to Swift Ave'
        ? 'CP1:gap:1'
        : guidewayByLabel.get(row.location);
    if (
      !segmentId
      || row.table !== 'completed'
      || row.finish > dataMonth
      || (row.completion !== 1 && row.footnote !== 'substantially_complete')
      || row.footnote === 'partially_open'
      || !reportUrl
    ) return [];
    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const quote = row.quote;
    return [{
      id: `cvsr-row-${slug(reportFile.replace(/\.pdf$/i, ''))}-${slug(row.location)}`,
      segmentId,
      claim: row.footnote === 'substantially_complete' ? 'substantially_complete' as const : 'completed' as const,
      date: row.finish,
      datePrecision: 'month' as const,
      label: row.location,
      sourceTitle: 'Central Valley Status Report',
      sourceUrl: reportUrl,
      reportFile,
      sourceId: 'cvsr' as const,
      quote,
    }];
  });

  for (const cp of CVSR_PACKAGES) {
    if (dataMonth >= '2020-08') {
      const utilities = parseUtilityPair(text, cp);
      if (utilities) {
        perPackage[cp].utilitiesRelocated = utilities.delivered;
        perPackage[cp].utilitiesTotal = utilities.total;
      }
    }
    const transcribed = LEGACY_PARCELS[reportFile];
    const transcribedParcels = transcribed?.values[cp];
    if (transcribedParcels) {
      perPackage[cp].parcelsDelivered = transcribedParcels.delivered;
      if (transcribedParcels.total !== undefined) perPackage[cp].parcelsTotal = transcribedParcels.total;
      (perPackage[cp].transcribedFields ??= []).push('parcels');
      if (transcribed.detail !== undefined) perPackage[cp].transcriptionDetail = transcribed.detail;
    } else {
      const parcels = parseParcelPair(text, cp);
      if (parcels) {
        perPackage[cp].parcelsDelivered = parcels.delivered;
        perPackage[cp].parcelsTotal = parcels.total;
      }
    }
    const acquisition = parseParcelAcquisitionPair(text, cp, dataMonth);
    if (acquisition) {
      perPackage[cp].parcelsAcquired = acquisition.delivered;
      perPackage[cp].parcelsAcquisitionTotal = acquisition.total;
      perPackage[cp].parcelAcquisitionAsOf = acquisition.asOf;
    }
    const acquisitionAudit = parseParcelAcquisitionAudit(text, cp);
    if (acquisitionAudit) perPackage[cp].acquisitionAudit = acquisitionAudit;
    const railroad = parseRailroadParcelPair(text, cp);
    if (railroad) {
      perPackage[cp].railroadParcelsAcquired = railroad.delivered;
      perPackage[cp].railroadParcelsTotal = railroad.total;
    }
  }

  const pinned = PINNED_PARCELS[reportFile];
  if (pinned) {
    const programPin = parseProgramParcelDelivery(text);
    if (!programPin) {
      throw new Error(`${reportFile}: a pinned parcel split needs this report's own program total, which it does not publish`);
    }
    for (const cp of CVSR_PACKAGES) {
      if (perPackage[cp].parcelsTotal !== undefined) {
        throw new Error(`${reportFile}: ${cp} publishes its own parcel split; retire the pinned entry`);
      }
    }
    const delivered = CVSR_PACKAGES.reduce((sum, cp) => sum + pinned.values[cp].delivered, 0);
    const total = CVSR_PACKAGES.reduce((sum, cp) => sum + pinned.values[cp].total, 0);
    if (programPin.delivered !== delivered || programPin.total !== total) {
      throw new Error(
        `${reportFile}: program parcels ${programPin.delivered}/${programPin.total} no longer pin the ${pinned.source} split ${delivered}/${total}`,
      );
    }
    for (const cp of CVSR_PACKAGES) {
      perPackage[cp].parcelsDelivered = pinned.values[cp].delivered;
      perPackage[cp].parcelsTotal = pinned.values[cp].total;
      (perPackage[cp].derivedFields ??= []).push('parcels');
      perPackage[cp].derivationDetail = pinned.detail;
    }
  }

  const packageMetrics = Object.values(perPackage);
  const packageSum = (key: 'parcelsDelivered' | 'parcelsTotal'): number | undefined => {
    let total = 0;
    for (const metrics of packageMetrics) {
      const value = metrics[key];
      if (typeof value !== 'number') return undefined;
      total += value;
    }
    return total;
  };
  const programParcels = parseProgramParcelDelivery(text);
  const summedDelivered = packageSum('parcelsDelivered');
  const summedTotal = packageSum('parcelsTotal');
  if (
    programParcels
    && summedDelivered !== undefined
    && summedTotal !== undefined
    && (programParcels.delivered !== summedDelivered || programParcels.total !== summedTotal)
  ) {
    throw new Error(
      `${reportFile}: published program parcels ${programParcels.delivered}/${programParcels.total} disagree with the package sum ${summedDelivered}/${summedTotal}`,
    );
  }
  const program = programParcels
    ? { parcelsDelivered: programParcels.delivered, parcelsTotal: programParcels.total }
    : undefined;
  return {
    date: `${dataMonth}-01`,
    dataMonth,
    tier: 1,
    sourceId: 'cvsr',
    reportFile,
    ...(report
      ? {
          reportUrl: report.reportUrl,
          ...(report.originalReportUrl ? { originalReportUrl: report.originalReportUrl } : {}),
        }
      : reportUrl
        ? { reportUrl }
        : {}),
    perPackage,
    ...(Object.keys(perSegment).length > 0 ? { perSegment } : {}),
    ...(structureEvidence.length > 0 ? { structureEvidence } : {}),
    ...(unmatchedRows.length > 0
      ? { unmatchedCvsrRows: unmatchedRows.map(({ cp, kind, location }) => ({ cp, kind, location })) }
      : {}),
    ...(program ? { program } : {}),
  };
}

async function loadGuidewayLabels(): Promise<Map<string, string>> {
  const arcgis = JSON.parse(await readFile('data/raw/arcgis/progress.json', 'utf8')) as {
    features: Array<{ attributes: { OBJECTID: number; Section: string; Limits: string | null; StructureType: string | null } }>;
  };
  const guidewayByLabel = new Map<string, string>();
  for (const { attributes } of arcgis.features) {
    if (attributes.StructureType?.trim().toLowerCase() !== 'guideway' || !attributes.Limits) continue;
    const label = attributes.Limits.trim();
    if (guidewayByLabel.has(label)) throw new Error(`Duplicate ArcGIS guideway label: ${label}`);
    guidewayByLabel.set(label, `${attributes.Section}:${attributes.OBJECTID}`);
  }
  return guidewayByLabel;
}

/**
 * Final-over-draft precedence between two reports claiming the same data month. A
 * candidate replaces the incumbent only when it publishes different values *and* scores
 * higher, so a re-posting never silently rewrites a retained snapshot and a draft never
 * displaces a final.
 */
function preferSnapshot(
  existing: Snapshot,
  candidate: Snapshot,
  candidateFile: string,
): { winner: Snapshot; loser: Snapshot; identical: boolean } {
  const existingFile = existing.reportFile?.toLowerCase() ?? '';
  const candidateLower = candidateFile.toLowerCase();
  const existingScore = (existingFile.includes('draft') ? -10 : 0) + (existingFile.includes('final') ? 2 : 0);
  const candidateScore = (candidateLower.includes('draft') ? -10 : 0) + (candidateLower.includes('final') ? 2 : 0);
  const identical =
    JSON.stringify({ perPackage: existing.perPackage, program: existing.program })
    === JSON.stringify({ perPackage: candidate.perPackage, program: candidate.program });
  return !identical && candidateScore > existingScore
    ? { winner: candidate, loser: existing, identical }
    : { winner: existing, loser: candidate, identical };
}

/**
 * Which filenames the local corpus contains, answered without reading the directory: every
 * parsed snapshot's report, every byte-verified registry entry, every reviewed report, and
 * the reviewed duplicate the Authority overwrote. For the committed artifact this union
 * equals the corpus exactly, which is what lets the inventory label reports downloaded or
 * missing where CI has no PDFs on disk. It is *not* proof of ingestion — see
 * `ingestedReportFiles`.
 */
function corpusReportFiles(snapshots: readonly Snapshot[], reportUrls: ReportUrlRegistry): Set<string> {
  const files = new Set<string>([REJECTED_OVERWRITTEN_REPORT.file]);
  for (const snapshot of snapshots) if (snapshot.reportFile) files.add(snapshot.reportFile);
  for (const file of Object.keys(reportUrls)) files.add(file);
  for (const report of REVIEWED_CVSR_REPORTS) files.add(report.file);
  return files;
}

async function parseLocalPdfs(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const reportUrls = await loadReportUrls();
  const guidewayByLabel = await loadGuidewayLabels();
  const files = (await readdir(DIRECTORY)).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
  const candidates = files.filter((file) => CVSR_CANDIDATE.test(file));
  const alternativeFiles = files.filter((file) => !candidates.includes(file));
  const rejectedReports: CvsrReportDiagnostic[] = alternativeFiles.map((reportFile) => ({
    reportFile,
    reason: 'Non-CVSR alternative report ignored; it is not a combined monthly Central Valley Status Report.',
  }));
  const snapshotsByDate = new Map<string, Snapshot>();
  const failureCounts = new Map<string, number>();
  const parseFailures: CvsrParseFailure[] = [];
  for (const file of candidates) {
    try {
      const snapshot = await parsePdf(`${DIRECTORY}/${file}`, reportUrls, guidewayByLabel);
      const existing = snapshotsByDate.get(snapshot.date);
      if (existing) {
        const { winner, loser, identical } = preferSnapshot(existing, snapshot, file);
        rejectedReports.push({
          reportFile: loser.reportFile,
          reportUrl: loser.reportUrl,
          dataMonth: loser.dataMonth,
          reason: loser.reportFile === REJECTED_OVERWRITTEN_REPORT.file
            ? 'Rejected as May data: the document header says data through April 2023 and duplicates the retained April snapshot; the Authority overwrote the original URL.'
            : identical
              ? `Duplicate monthly snapshot; retained ${winner.reportFile}.`
              : `Conflicting monthly snapshot; retained ${winner.reportFile} by final-over-draft precedence.`,
        });
        if (!identical) {
          console.warn(`${file}: conflicts with ${existing.reportFile} for ${snapshot.date}; ${winner === snapshot ? 'using candidate' : 'keeping existing'}`);
        }
        if (winner === snapshot) snapshotsByDate.set(snapshot.date, snapshot);
      } else {
        snapshotsByDate.set(snapshot.date, snapshot);
      }
      console.log(`${file}: parsed data month ${snapshot.date}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
      parseFailures.push({
        file,
        dataMonth: reportMetadata(file)?.month ?? LEGACY_DATES[file],
        reason,
      });
      console.warn(`${file}: skipped (${reason})`);
    }
  }
  const snapshots = [...snapshotsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const fieldFailures: CvsrFieldFailure[] = [];
  for (const snapshot of snapshots) {
    for (const cp of CVSR_PACKAGES) {
      const metrics = snapshot.perPackage?.[cp];
      if (metrics?.parcelsTotal === undefined && !parcelOmission(snapshot.dataMonth, cp)) {
        fieldFailures.push({ month: snapshot.dataMonth, cp, metric: 'parcels' });
      }
      if (snapshot.dataMonth >= '2020-08' && metrics?.utilitiesTotal === undefined) {
        fieldFailures.push({ month: snapshot.dataMonth, cp, metric: 'utilities' });
      }
    }
  }
  for (const failure of parseFailures) {
    rejectedReports.push({
      reportFile: failure.file,
      reportUrl: reportMetadata(failure.file)?.reportUrl,
      dataMonth: failure.dataMonth,
      reason: `${PARSE_FAILURE_PREFIX}${failure.reason}`,
    });
  }
  const cvsrInventory = buildCvsrInventory({
    snapshots,
    localFiles: new Set(files),
    reviewedReports: REVIEWED_CVSR_REPORTS,
    rejectedReports,
    parseFailures,
    fieldFailures,
    revisions: REVIEWED_REVISIONS,
    coverageStart: '2019-03',
    coverageEnd: snapshots.reduce((latest, snapshot) => (snapshot.dataMonth > latest ? snapshot.dataMonth : latest), '2019-03'),
    unresolvedReportUrls: candidates.filter((file) => !reportMetadata(file) && !reportUrls[file]),
    reportUrls,
  });
  await writeFile(PARSED, `${JSON.stringify({ snapshots, cvsrInventory, diagnostics: { parseFailures, fieldFailures } }, null, 2)}\n`);
  console.log(`CVSR parse: ${snapshots.length} monthly snapshots from ${candidates.length} candidate reports; ${alternativeFiles.length} non-CVSR alternatives ignored; network requests: 0`);
  for (const [reason, count] of [...failureCounts].sort((a, b) => b[1] - a[1])) console.log(`  skipped ${count}: ${reason}`);
  console.log(`CVSR snapshots → ${PARSED}`);
  if (parseFailures.length > 0 || fieldFailures.length > 0) {
    throw new Error(
      `CVSR parser failures: ${parseFailures.length} reports and ${fieldFailures.length} package fields; see ${PARSED}`,
    );
  }
}

function shiftMonth(month: string, delta: number): string {
  const cursor = new Date(`${month}-01T00:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() + delta);
  return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  await promise;
}

/** The fixed gap kept between hsr.ca.gov requests, shared by every network mode here. */
let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const idle = REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (idle > 0) await sleep(idle);
  lastRequestAt = Date.now();
}

/** A PDF upload observed upstream, keyed by the filename the local corpus would use. */
type DiscoveredReport = { file: string; url: string; publishedAt?: string };

/**
 * Report PDFs the Authority published inside the discovery window.
 *
 * Both media-search terms are required: `CVSR` matches titles and misses
 * `FA-Central-Valley-Status-Report-July-2026-A11Y.pdf`, which only the phrase returns.
 * If neither term answers with JSON, the committee index is scraped once as a fallback;
 * if that is also unusable the run is told discovery is unavailable and ends quietly.
 * That page carries intermittent bot protection, and a blocked read is weather — it is
 * never retried, and no header is rotated to work around it.
 */
async function discoverReports(): Promise<DiscoveredReport[]> {
  const after = new Date(Date.now() - DISCOVERY_WINDOW_DAYS * 86_400_000).toISOString();
  const byFile = new Map<string, DiscoveredReport>();
  let mediaAnswered = false;

  for (const term of MEDIA_SEARCH_TERMS) {
    const query = `${MEDIA_API}?search=${encodeURIComponent(term)}&per_page=100&after=${after}&orderby=date&order=desc&_fields=date,source_url`;
    await throttle();
    try {
      const response = await fetch(query, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const items = (await response.json()) as Array<{ date?: unknown; source_url?: unknown }>;
      if (!Array.isArray(items)) throw new Error('media search did not return an array');
      mediaAnswered = true;
      for (const item of items) {
        if (typeof item.source_url !== 'string') continue;
        const file = decodeURIComponent(basename(new URL(item.source_url).pathname));
        if (!file.toLowerCase().endsWith('.pdf') || byFile.has(file)) continue;
        byFile.set(file, {
          file,
          url: item.source_url,
          ...(typeof item.date === 'string' ? { publishedAt: item.date } : {}),
        });
      }
    } catch (error) {
      console.warn(`cvsr: media search "${term}" unusable (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  if (mediaAnswered) return [...byFile.values()];

  await throttle();
  try {
    const response = await fetch(CURRENT_INDEX, { headers: { 'User-Agent': USER_AGENT } });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    if (!contentType.startsWith('text/html')) throw new Error(`answered as ${contentType || '(no content type)'}`);
    const html = await response.text();
    for (const [, href] of html.matchAll(/href="([^"]+\.pdf)"/gi)) {
      const url = new URL(href, CURRENT_INDEX).toString();
      const file = decodeURIComponent(basename(new URL(url).pathname));
      if (!byFile.has(file)) byFile.set(file, { file, url });
    }
    if (byFile.size === 0) throw new Error('index page carries no PDF links');
    return [...byFile.values()];
  } catch (error) {
    console.warn(`cvsr: committee index unusable (${error instanceof Error ? error.message : String(error)})`);
    console.log('cvsr: discovery unavailable');
    return [];
  }
}

/**
 * Add newly published reports to the tracked artifacts without a local PDF corpus.
 *
 * `--parse` rebuilds `parsed-snapshots.json` from every PDF on disk, which a CI checkout
 * does not have; this mode merges one new observation into the committed artifact
 * instead. `--ingest --file <name>` skips discovery and download and merges an
 * already-local report. The `cvsr-ingested:`, `cvsr-overdue:` and
 * `cvsr: discovery unavailable` lines are a stdout contract with
 * `.github/workflows/ingest-cvsr.yml`; keep them exact.
 */
async function ingestCvsr(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const registry = await loadReportUrls();
  const artifact = JSON.parse(await readFile(PARSED, 'utf8')) as {
    snapshots: Snapshot[];
    cvsrInventory: CvsrInventory;
    diagnostics: { parseFailures: CvsrParseFailure[]; fieldFailures: CvsrFieldFailure[] };
  };
  const snapshots = [...artifact.snapshots];

  const fileFlag = process.argv.indexOf('--file');
  const requested = fileFlag === -1 ? undefined : process.argv[fileFlag + 1];
  if (fileFlag !== -1 && (!requested || requested.startsWith('--'))) {
    throw new Error('--file requires the name of a report already present in data/raw/cvsr');
  }

  const skipList = new Set(
    (process.env.HSR_CVSR_SKIP ?? '').split(',').map((entry) => entry.trim()).filter(Boolean),
  );

  let candidates: DiscoveredReport[];
  if (requested) {
    // Without a citation the merged snapshot could not link its own source, so the
    // maintainer resolves the URL beside the local corpus before ingesting by hand.
    const url = registry[requested]?.url ?? reportMetadata(requested)?.reportUrl;
    if (!url) {
      throw new Error(
        `${requested}: no report-urls.json entry and no reviewed-report citation; run \`npm run resolve:cvsr-urls\` first`,
      );
    }
    candidates = [{ file: requested, url }];
  } else {
    const ingestedFiles = ingestedReportFiles(
      snapshots,
      artifact.cvsrInventory.rejectedReports,
      [REJECTED_OVERWRITTEN_REPORT.file, ...REVIEWED_CVSR_REPORTS.map((report) => report.file)],
    );
    const discovered = await discoverReports();
    candidates = discovered
      .filter((report) => CVSR_CANDIDATE.test(report.file)
        && !VARIANT_REPORT.test(report.file)
        && !ingestedFiles.has(report.file)
        && !skipList.has(report.file))
      .sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
    console.log(`CVSR discovery: ${discovered.length} upstream PDFs in window, ${candidates.length} new`);

    for (const report of candidates) {
      await throttle();
      const response = await fetch(report.url, { headers: { 'User-Agent': USER_AGENT } });
      const body = new Uint8Array(await response.arrayBuffer());
      // A page served where a PDF was promised is a challenge or a dead link, and the
      // throw is the point: it needs a human, not a fallback.
      assertPdfResponse(report.file, report.url, response.status, response.headers.get('content-type') ?? '', body);
      const prefixSha256 = createHash('sha256').update(body.subarray(0, PREFIX_BYTES)).digest('hex');
      // A filename already in the registry must serve the same bytes. If the Authority
      // legitimately republished a corrected PDF under this name, delete that file's
      // report-urls.json entry and re-run, which registers the new bytes deliberately.
      const prior = registry[report.file];
      if (prior && (prior.bytes !== body.byteLength || prior.prefixSha256 !== prefixSha256)) {
        throw new Error(
          `${report.file}: ${report.url} now serves ${body.byteLength} bytes/${prefixSha256.slice(0, 12)}, not the registered ${prior.bytes} bytes/${prior.prefixSha256.slice(0, 12)}`,
        );
      }
      await writeFile(`${DIRECTORY}/${report.file}`, body);
      registry[report.file] = {
        url: report.url,
        bytes: body.byteLength,
        prefixSha256,
        ...(report.publishedAt ? { publishedAt: report.publishedAt } : {}),
        verifiedAt: new Date().toISOString(),
      };
      console.log(`${report.file}: downloaded ${body.byteLength} bytes from ${report.url}`);
    }
    if (candidates.length > 0) {
      const sorted = Object.fromEntries(Object.keys(registry).sort().map((file) => [file, registry[file]]));
      await writeFile(REPORT_URLS, `${JSON.stringify(sorted, null, 2)}\n`);
      console.log(`CVSR report URLs → ${REPORT_URLS}`);
    }
  }

  const guidewayByLabel = candidates.length > 0 ? await loadGuidewayLabels() : new Map<string, string>();
  const newRejections: CvsrReportDiagnostic[] = [];
  const ingested: Snapshot[] = [];
  for (const report of candidates) {
    const snapshot = await parsePdf(`${DIRECTORY}/${report.file}`, registry, guidewayByLabel);
    const index = snapshots.findIndex((entry) => entry.date === snapshot.date);
    if (index === -1) snapshots.push(snapshot);
    else {
      const { winner, loser, identical } = preferSnapshot(snapshots[index], snapshot, report.file);
      newRejections.push({
        reportFile: loser.reportFile,
        reportUrl: loser.reportUrl,
        dataMonth: loser.dataMonth,
        reason: identical
          ? `Duplicate monthly snapshot; retained ${winner.reportFile}.`
          : `Conflicting monthly snapshot; retained ${winner.reportFile} by final-over-draft precedence.`,
      });
      if (!identical) {
        console.warn(`${report.file}: conflicts with ${winner === snapshot ? loser.reportFile : winner.reportFile} for ${snapshot.date}; ${winner === snapshot ? 'using candidate' : 'keeping existing'}`);
      }
      snapshots[index] = winner;
    }
    ingested.push(snapshot);
    console.log(`cvsr-ingested: ${snapshot.dataMonth} ${report.file}`);
  }
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  const maxDataMonth = snapshots.reduce(
    (latest, snapshot) => (snapshot.dataMonth > latest ? snapshot.dataMonth : latest),
    '2019-03',
  );

  const fieldFailures = [...artifact.diagnostics.fieldFailures];
  if (ingested.length > 0) {
    const recorded = new Set(fieldFailures.map((failure) => `${failure.month}|${failure.cp}|${failure.metric}`));
    for (const snapshot of ingested) {
      // A candidate that lost on precedence publishes no value in the artifact.
      if (!snapshots.includes(snapshot)) continue;
      for (const cp of CVSR_PACKAGES) {
        const metrics = snapshot.perPackage?.[cp];
        const failures: CvsrFieldFailure[] = [];
        if (metrics?.parcelsTotal === undefined && !parcelOmission(snapshot.dataMonth, cp)) {
          failures.push({ month: snapshot.dataMonth, cp, metric: 'parcels' });
        }
        if (snapshot.dataMonth >= '2020-08' && metrics?.utilitiesTotal === undefined) {
          failures.push({ month: snapshot.dataMonth, cp, metric: 'utilities' });
        }
        for (const failure of failures) {
          const key = `${failure.month}|${failure.cp}|${failure.metric}`;
          if (recorded.has(key)) continue;
          recorded.add(key);
          fieldFailures.push(failure);
        }
      }
    }
    const { parseFailures } = artifact.diagnostics;
    // Every input the local-corpus parse derives from disk is carried forward from the
    // persisted inventory instead; `transcriptions` and `derivations` are recomputed by
    // the builder from the merged snapshots and must not be carried.
    const cvsrInventory = buildCvsrInventory({
      snapshots,
      localFiles: corpusReportFiles(snapshots, registry),
      reviewedReports: REVIEWED_CVSR_REPORTS,
      rejectedReports: [...artifact.cvsrInventory.rejectedReports, ...newRejections],
      parseFailures,
      fieldFailures,
      revisions: REVIEWED_REVISIONS,
      coverageStart: '2019-03',
      coverageEnd: maxDataMonth,
      unresolvedReportUrls: artifact.cvsrInventory.unresolvedReportUrls,
      reportUrls: registry,
    });
    await writeFile(PARSED, `${JSON.stringify({ snapshots, cvsrInventory, diagnostics: { parseFailures, fieldFailures } }, null, 2)}\n`);
    console.log(`CVSR ingest: ${ingested.length} merged; ${snapshots.length} monthly snapshots through ${maxDataMonth}`);
    console.log(`CVSR snapshots → ${PARSED}`);
  }

  if (!requested) {
    const merged = ingestedReportFiles(
      snapshots,
      [...artifact.cvsrInventory.rejectedReports, ...newRejections],
      [REJECTED_OVERWRITTEN_REPORT.file, ...REVIEWED_CVSR_REPORTS.map((report) => report.file)],
    );
    const orphans = Object.keys(registry).filter((file) => CVSR_CANDIDATE.test(file)
      && !VARIANT_REPORT.test(file)
      && !merged.has(file)
      && !skipList.has(file));
    if (orphans.length > 0) {
      throw new Error(`CVSR reports cited in ${REPORT_URLS} with no snapshot: ${orphans.join(', ')}`);
    }
  }

  // The overdue report always runs, including on blocked discovery, and never fails on
  // its own; the workflow decides when an absence has persisted long enough to escalate.
  const now = new Date();
  const expectedLatest = shiftMonth(
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    -EXPECTED_LAG_MONTHS,
  );
  for (let month = shiftMonth(maxDataMonth, 1); month <= expectedLatest; month = shiftMonth(month, 1)) {
    console.log(`cvsr-overdue: ${month}`);
  }

  if (ingested.length > 0 && fieldFailures.length > 0) {
    throw new Error(
      `CVSR ingest: ${fieldFailures.length} package fields missing after merge; see ${PARSED}`,
    );
  }
}

/**
 * Resolve a direct, byte-verified hsr.ca.gov PDF URL for every local report.
 *
 * One of the two network paths in this file (the other is `--ingest`), and the policy
 * here is deliberately narrow.
 *
 * 1. `data/raw/cvsr/report-urls.json` is the committed registry. Any file already in it
 *    is skipped with zero requests, so anything already proven costs nothing to re-run.
 *    Files carrying reviewed report metadata already have a citation and are never probed.
 * 2. Each unresolved local PDF gets at most eight ordered, deduped candidates, every one
 *    of them built from evidence already in hand: any `REPORT_URL_HINTS` path recorded for
 *    the file, the publication month printed inside the PDF, then the data month plus two,
 *    three and one month, then every `20YY` + `MM` pair in the filename, and for `brdmtg_*`
 *    files the legacy `uploads/docs/brdmeetings/{year}/` layout. Months are never
 *    brute-forced, and a hint earns nothing beyond being probed first.
 * 3. Every probe is one `GET` with `Range: bytes=0-262143` and a single fixed
 *    User-Agent, with a hard 1000 ms gap between requests — including across files.
 *    No URL is requested twice, except to retry a throttled answer.
 * 4. A candidate is accepted only when all of these hold: status 200 or 206; content type
 *    `application/pdf`; the advertised full length (Content-Range total, else
 *    Content-Length) equals the local byte size; and SHA-256 of the returned prefix
 *    equals SHA-256 of the local file's first 262144 bytes. An unverified URL is never
 *    added to the byte-verified registry.
 * 5. `wp-json` and HTML pages are Incapsula-gated and are never requested. A `404` is the
 *    site's ordinary not-found answer: the URL is wrong, or the Authority retired an old
 *    upload. Either way it is a miss, the file is reported unresolved, and the run still
 *    succeeds — an absent report is a fact about the site, not a failure.
 * 6. Any other HTML answer to a PDF request is the host throttling us, which is not
 *    evidence about the URL. Each such answer is retried on `CHALLENGE_BACKOFF_MS`, and a
 *    file whose budget runs out is reported *inconclusive* and fails the run instead of
 *    joining the unresolved list. A throttle must never be recorded as proof that no
 *    canonical URL exists.
 */
async function resolveReportUrls(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const registry = await loadReportUrls();
  const files = (await readdir(DIRECTORY)).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
  const attempted = new Set<string>();
  const unresolved: string[] = [];
  const inconclusive: string[] = [];
  let requests = 0;

  for (const file of files) {
    if (registry[file]) {
      console.log(`${file}: already verified`);
      continue;
    }
    if (reportMetadata(file)) {
      console.log(`${file}: reviewed metadata URL, not probed`);
      continue;
    }

    const data = await readFile(`${DIRECTORY}/${file}`);
    const bytes = data.length;
    const localPrefixSha256 = createHash('sha256').update(data.subarray(0, PREFIX_BYTES)).digest('hex');

    let reportMonth: string | null = null;
    let dataMonth: string | null = null;
    const parser = new PDFParse({ data });
    try {
      const text = normalizeCvsrText((await parser.getText()).text);
      reportMonth = parseReportMonth(text);
      try {
        dataMonth = parseDataMonth(text, file, LEGACY_DATES);
      } catch {
        dataMonth = null;
      }
    } catch {
      // An unreadable PDF still has filename-derived candidates.
    } finally {
      await parser.destroy();
    }

    const urls: string[] = [];
    const add = (url: string): void => {
      if (!urls.includes(url)) urls.push(url);
    };
    const addUpload = (month: string): void => {
      add(`https://hsr.ca.gov/wp-content/uploads/${month.slice(0, 4)}/${month.slice(5, 7)}/${file}`);
    };
    for (const hint of REPORT_URL_HINTS[file] ?? []) add(hint);
    if (reportMonth) addUpload(reportMonth);
    if (dataMonth) for (const delta of [2, 3, 1]) addUpload(shiftMonth(dataMonth, delta));
    for (const [, year, month] of file.matchAll(/(20\d{2})[-_]?(0[1-9]|1[0-2])/g)) addUpload(`${year}-${month}`);
    const boardMeeting = /^brdmtg_\d{4}(\d{2})_/.exec(file);
    if (boardMeeting) {
      add(`https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/20${boardMeeting[1]}/${file}`);
    }
    const ordered = urls.slice(0, 8);

    let resolved: ResolvedReportUrl | undefined;
    // One budget per file, so a throttled host cannot stretch the run without bound.
    let backoffs = 0;
    let throttled = false;
    for (const url of ordered) {
      if (attempted.has(url)) continue;
      attempted.add(url);

      // Retries re-request this same candidate; a straight answer always breaks out.
      while (!resolved && !throttled) {
        await throttle();
        requests += 1;

        let response: Response;
        try {
          response = await fetch(url, {
            headers: { Range: `bytes=0-${PREFIX_BYTES - 1}`, 'User-Agent': USER_AGENT },
          });
        } catch (error) {
          console.warn(`  ${url}: request failed (${error instanceof Error ? error.message : String(error)})`);
          break;
        }
        const contentType = response.headers.get('content-type') ?? '';
        const body = Buffer.from(await response.arrayBuffer());
        if (contentType.startsWith('text/html') && response.status !== 404) {
          const wait = CHALLENGE_BACKOFF_MS[backoffs];
          if (wait === undefined) {
            throttled = true;
            break;
          }
          backoffs += 1;
          console.warn(`  ${url}: HTML answered a PDF request; retrying in ${wait / 1000}s`);
          await sleep(wait);
          continue;
        }
        if (response.status === 200 || response.status === 206) {
          const contentRange = response.headers.get('content-range');
          const total = Number(
            contentRange?.split('/')[1] ?? response.headers.get('content-length') ?? Number.NaN,
          );
          const prefixSha256 = contentType.startsWith('application/pdf') && total === bytes
            ? createHash('sha256').update(body.subarray(0, PREFIX_BYTES)).digest('hex')
            : undefined;
          if (prefixSha256 === localPrefixSha256) {
            resolved = { url, bytes, prefixSha256, verifiedAt: new Date().toISOString() };
          }
        }
        break;
      }
      if (resolved || throttled) break;
    }

    if (resolved) {
      registry[file] = resolved;
      console.log(`${file}: verified ${resolved.url}`);
    } else if (throttled) {
      inconclusive.push(file);
      console.log(`${file}: inconclusive — hsr.ca.gov answered PDF requests with HTML through ${CHALLENGE_BACKOFF_MS.length} retries`);
    } else {
      unresolved.push(file);
      console.log(`${file}: unresolved after ${ordered.length} candidate${ordered.length === 1 ? '' : 's'}`);
    }
  }

  const sorted = Object.fromEntries(Object.keys(registry).sort().map((file) => [file, registry[file]]));
  await writeFile(REPORT_URLS, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `CVSR report URLs: ${Object.keys(sorted).length} verified, ${unresolved.length} unresolved, ${inconclusive.length} inconclusive; network requests: ${requests}`,
  );
  for (const file of unresolved) console.log(`  unresolved: ${file}`);
  console.log(`CVSR report URLs → ${REPORT_URLS}`);
  if (inconclusive.length > 0) {
    throw new Error(
      `CVSR report URLs: ${inconclusive.length} file(s) got no straight answer from hsr.ca.gov (${inconclusive.join(', ')}); ` +
        'the host was throttling, so this run proves nothing about their URLs — re-run later instead of recording them unresolved',
    );
  }
}

const parseMode = process.argv.includes('--parse');
const resolveMode = process.argv.includes('--resolve-urls');
const ingestMode = process.argv.includes('--ingest');
if (ingestMode) await ingestCvsr();
else if (resolveMode) await resolveReportUrls();
else if (parseMode) await parseLocalPdfs();
else await writeManifest();
