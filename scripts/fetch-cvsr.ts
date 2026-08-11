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
  parseProgressMetrics,
  parseRailroadParcelPair,
  parseReportMonth,
  parseRowProgress,
  parseUtilityPair,
  type CvsrPackage,
} from './lib/cvsr-parser';
import {
  buildCvsrInventory,
  PARCEL_OMISSION_MONTHS,
  type CvsrFieldFailure,
  type CvsrParseFailure,
  type ReviewedCvsrReport,
  type ReviewedCvsrRevision,
} from './lib/cvsr-inventory';

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

/** A direct hsr.ca.gov PDF URL proven to serve the exact local file. */
type ResolvedReportUrl = {
  url: string;
  bytes: number;
  prefixSha256: string;
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
// Reviewed transcriptions from package ROW charts whose blue labels are vector
// outlines rather than extractable PDF text. Each pair is the report's current
// month, not a value carried from the comparison month.
const LEGACY_PARCELS: Readonly<Record<string, Record<CvsrPackage, {
  delivered: number;
  total: number;
}>>> = {
  'brdmtg_082019_FA_Central_Valley_Status_Report.pdf': {
    CP1: { delivered: 819, total: 892 },
    'CP2-3': { delivered: 533, total: 755 },
    CP4: { delivered: 164, total: 208 },
  },
  'brdmtg_091719_FA_Central_Valley_Status_Report.pdf': {
    CP1: { delivered: 823, total: 893 },
    'CP2-3': { delivered: 540, total: 756 },
    CP4: { delivered: 165, total: 210 },
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
  const rowProgress = parseRowProgress(text, reportFile);
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
  if (dataMonth === '2026-04' && rowProgress.length > 0) {
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
    const transcribedParcels = LEGACY_PARCELS[reportFile]?.[cp];
    const parcels = transcribedParcels ?? parseParcelPair(text, cp);
    if (parcels) {
      perPackage[cp].parcelsDelivered = parcels.delivered;
      perPackage[cp].parcelsTotal = parcels.total;
      if (transcribedParcels) (perPackage[cp].transcribedFields ??= []).push('parcels');
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

  const packageMetrics = Object.values(perPackage);
  const utilitiesRelocated = packageMetrics.reduce(
    (sum, metrics) => sum + (metrics.utilitiesRelocated ?? 0),
    0,
  );
  const utilitiesTotal = packageMetrics.reduce(
    (sum, metrics) => sum + (metrics.utilitiesTotal ?? 0),
    0,
  );
  const parcelsDelivered = packageMetrics.reduce(
    (sum, metrics) => sum + (metrics.parcelsDelivered ?? 0),
    0,
  );
  const parcelsTotal = packageMetrics.reduce(
    (sum, metrics) => sum + (metrics.parcelsTotal ?? 0),
    0,
  );
  const aggregate = utilitiesTotal > 0 && parcelsTotal > 0
    ? { utilitiesRelocated, utilitiesTotal, parcelsDelivered, parcelsTotal }
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
    aggregate,
  };
}

async function parseLocalPdfs(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const reportUrls = await loadReportUrls();
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
        const existingPayload = JSON.stringify({ perPackage: existing.perPackage, aggregate: existing.aggregate });
        const candidatePayload = JSON.stringify({ perPackage: snapshot.perPackage, aggregate: snapshot.aggregate });
        const existingScore = (existing.reportFile?.toLowerCase().includes('draft') ? -10 : 0) + (existing.reportFile?.toLowerCase().includes('final') ? 2 : 0);
        const candidateScore = (file.toLowerCase().includes('draft') ? -10 : 0) + (file.toLowerCase().includes('final') ? 2 : 0);
        const candidateWins = existingPayload !== candidatePayload && candidateScore > existingScore;
        const rejected = candidateWins ? existing : snapshot;
        rejectedReports.push({
          reportFile: rejected.reportFile,
          reportUrl: rejected.reportUrl,
          dataMonth: rejected.dataMonth,
          reason: rejected.reportFile === REJECTED_OVERWRITTEN_REPORT.file
            ? 'Rejected as May data: the document header says data through April 2023 and duplicates the retained April snapshot; the Authority overwrote the original URL.'
            : existingPayload === candidatePayload
              ? `Duplicate monthly snapshot; retained ${candidateWins ? file : existing.reportFile}.`
              : `Conflicting monthly snapshot; retained ${candidateWins ? file : existing.reportFile} by final-over-draft precedence.`,
        });
        if (existingPayload !== candidatePayload) {
          console.warn(`${file}: conflicts with ${existing.reportFile} for ${snapshot.date}; ${candidateWins ? 'using candidate' : 'keeping existing'}`);
        }
        if (candidateWins) snapshotsByDate.set(snapshot.date, snapshot);
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
      if (metrics?.parcelsTotal === undefined && !PARCEL_OMISSION_MONTHS.includes(snapshot.dataMonth)) {
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
      reason: `Parser failure: ${failure.reason}`,
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
    coverageEnd: '2026-04',
    unresolvedReportUrls: candidates.filter(
      (file) => !reportMetadata(file) && !reportUrls[file],
    ),
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

/**
 * Resolve a direct, byte-verified hsr.ca.gov PDF URL for every local report.
 *
 * This is the only network path in this file, and the policy is deliberately narrow.
 *
 * 1. `data/raw/cvsr/report-urls.json` is the committed registry. Any file already in it
 *    is skipped with zero requests, so anything already proven costs nothing to re-run.
 *    Files carrying reviewed metadata already have a canonical URL and are never probed.
 * 2. Each unresolved local PDF gets at most eight ordered, deduped candidates, every one
 *    of them built from evidence already in hand: the publication month printed inside
 *    the PDF, then the data month plus two, three and one month, then every `20YY` + `MM`
 *    pair in the filename, and for `brdmtg_*` files the legacy
 *    `uploads/docs/brdmeetings/{year}/` layout. Months are never brute-forced.
 * 3. Every probe is one `GET` with `Range: bytes=0-262143` and a single fixed
 *    User-Agent, with a hard 1000 ms gap between requests — including across files.
 *    No URL is requested twice in a run.
 * 4. A candidate is accepted only when all of these hold: status 200 or 206; content type
 *    `application/pdf`; the advertised full length (Content-Range total, else
 *    Content-Length) equals the local byte size; and SHA-256 of the returned prefix
 *    equals SHA-256 of the local file's first 262144 bytes. An unverified URL is never
 *    recorded.
 * 5. `wp-json` and HTML pages are Incapsula-gated and are never requested. An HTML answer
 *    to a PDF request means the host is challenging us, so the file's remaining
 *    candidates are abandoned and it is recorded unresolved. A `404` with an HTML body is
 *    the site's ordinary not-found page, which is a miss, not a challenge.
 */
async function resolveReportUrls(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const registry = await loadReportUrls();
  const files = (await readdir(DIRECTORY)).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
  const attempted = new Set<string>();
  const unresolved: string[] = [];
  let requests = 0;
  let lastRequestAt = 0;

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
    const addUpload = (month: string): void => {
      const url = `https://hsr.ca.gov/wp-content/uploads/${month.slice(0, 4)}/${month.slice(5, 7)}/${file}`;
      if (!urls.includes(url)) urls.push(url);
    };
    if (reportMonth) addUpload(reportMonth);
    if (dataMonth) for (const delta of [2, 3, 1]) addUpload(shiftMonth(dataMonth, delta));
    for (const [, year, month] of file.matchAll(/(20\d{2})[-_]?(0[1-9]|1[0-2])/g)) addUpload(`${year}-${month}`);
    const boardMeeting = /^brdmtg_\d{4}(\d{2})_/.exec(file);
    if (boardMeeting) {
      const url = `https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/20${boardMeeting[1]}/${file}`;
      if (!urls.includes(url)) urls.push(url);
    }
    const ordered = urls.slice(0, 8);

    let resolved: ResolvedReportUrl | undefined;
    let challenged = false;
    for (const url of ordered) {
      if (attempted.has(url)) continue;
      attempted.add(url);
      const idle = REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
      if (idle > 0) {
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, idle);
        await promise;
      }
      lastRequestAt = Date.now();
      requests += 1;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Range: `bytes=0-${PREFIX_BYTES - 1}`, 'User-Agent': USER_AGENT },
        });
      } catch (error) {
        console.warn(`  ${url}: request failed (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      const contentType = response.headers.get('content-type') ?? '';
      const body = Buffer.from(await response.arrayBuffer());
      if (contentType.startsWith('text/html') && response.status !== 404) {
        challenged = true;
        break;
      }
      if (response.status !== 200 && response.status !== 206) continue;
      if (!contentType.startsWith('application/pdf')) continue;
      const contentRange = response.headers.get('content-range');
      const total = Number(
        contentRange?.split('/')[1] ?? response.headers.get('content-length') ?? Number.NaN,
      );
      if (total !== bytes) continue;
      const prefixSha256 = createHash('sha256').update(body.subarray(0, PREFIX_BYTES)).digest('hex');
      if (prefixSha256 !== localPrefixSha256) continue;
      resolved = { url, bytes, prefixSha256, verifiedAt: new Date().toISOString() };
      break;
    }

    if (resolved) {
      registry[file] = resolved;
      console.log(`${file}: verified ${resolved.url}`);
    } else {
      unresolved.push(file);
      console.log(
        `${file}: unresolved after ${ordered.length} candidate${ordered.length === 1 ? '' : 's'}${challenged ? ' (host answered a PDF request with HTML; remaining candidates abandoned)' : ''}`,
      );
    }
  }

  const sorted = Object.fromEntries(Object.keys(registry).sort().map((file) => [file, registry[file]]));
  await writeFile(REPORT_URLS, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `CVSR report URLs: ${Object.keys(sorted).length} verified, ${unresolved.length} unresolved; network requests: ${requests}`,
  );
  for (const file of unresolved) console.log(`  unresolved: ${file}`);
  console.log(`CVSR report URLs → ${REPORT_URLS}`);
}

const parseMode = process.argv.includes('--parse');
const resolveMode = process.argv.includes('--resolve-urls');
if (resolveMode) await resolveReportUrls();
else if (parseMode) await parseLocalPdfs();
else await writeManifest();
