import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type {
  CvsrGap,
  CvsrInventory,
  CvsrReportDiagnostic,
  PackageMetrics,
  Snapshot,
} from '../src/data/types';
import {
  CVSR_PACKAGES,
  normalizeCvsrText,
  parseDataMonth,
  parseParcelPair,
  parseProgressMetrics,
  parseUtilityPair,
  type CvsrPackage,
} from './lib/cvsr-parser';

const DIRECTORY = 'data/raw/cvsr';
const MANIFEST = `${DIRECTORY}/MANIFEST.md`;
const PARSED = `${DIRECTORY}/parsed-snapshots.json`;
const CURRENT_INDEX = 'https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/';

type KnownMissingReport = {
  month: string;
  file: string;
  url: string;
};

const KNOWN_MISSING_REPORTS: readonly KnownMissingReport[] = [
  {
    month: '2023-10',
    file: 'CVSR-2312-2310-Data-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2024/01/CVSR-2312-2310-Data-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2024-01',
    file: 'CVSR_2403_2401_Data-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2024/03/CVSR_2403_2401_Data-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2024-05',
    file: 'Supplemental-CVSR-2024-08-Data-2024-05-FINAL-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2024/08/Supplemental-CVSR-2024-08-Data-2024-05-FINAL-A11Y.pdf',
  },
  {
    month: '2024-06',
    file: 'CVSR-2024-08-Data-2024-06-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2024/08/CVSR-2024-08-Data-2024-06-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2024-09',
    file: 'CVSR-2024-11-Data-2024-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2024/12/CVSR-2024-11-Data-2024-A11Y.pdf',
  },
  {
    month: '2025-01',
    file: 'CVSR-2025-03-20-Data-2025-01-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2025/03/CVSR-2025-03-20-Data-2025-01-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2025-04',
    file: 'CVSR-2025-06-Data-2025-04-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2025/06/CVSR-2025-06-Data-2025-04-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2025-08',
    file: 'CVSR-2025-10-Data-2025-08-Supplemental-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2025/10/CVSR-2025-10-Data-2025-08-Supplemental-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2025-10',
    file: 'CVSR-2025-12-Data-2025-10-FINAL-V0-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2025/12/CVSR-2025-12-Data-2025-10-FINAL-V0-A11Y.pdf',
  },
  {
    month: '2026-01',
    file: 'FA-Central-Valley-Status-Report-Supplemental-March-2026-A11Y.pdf',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/03/FA-Central-Valley-Status-Report-Supplemental-March-2026-A11Y.pdf',
  },
];

const REJECTED_MAY_REPORT = {
  month: '2023-05',
  file: 'CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf',
  url: 'https://hsr.ca.gov/wp-content/uploads/2023/07/CVSR-2307-2305-Data-FINAL-V0-A11Y.pdf',
} as const;

async function writeManifest(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const localFiles = new Set(await readdir(DIRECTORY));
  const lines = [
    '# Central Valley Status Report download manifest',
    '',
    'Human download required. Place PDFs in this directory, then run `npm run parse:cvsr`.',
    'This pipeline does not evade or automate around hsr.ca.gov bot protection.',
    '',
    '| Data month | Expected local filename | State | Canonical report or audit evidence |',
    '|---|---|---|---|',
  ];
  for (const report of KNOWN_MISSING_REPORTS) {
    const state = localFiles.has(report.file) ? 'downloaded' : 'missing';
    lines.push(`| \`${report.month}\` | \`${report.file}\` | ${state} | ${report.url} |`);
  }
  lines.push(
    `| \`${REJECTED_MAY_REPORT.month}\` | \`${REJECTED_MAY_REPORT.file}\` | rejected-duplicate | ${REJECTED_MAY_REPORT.url} — document says data through April 2023 |`,
    '',
    `Canonical Finance & Audit index: ${CURRENT_INDEX}`,
  );
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
  'brdmtg_101519_FA_Central_Valley_Status_Report.pdf': {
    CP1: { delivered: 827, total: 932 },
    'CP2-3': { delivered: 547, total: 854 },
    CP4: { delivered: 166, total: 223 },
  },
};


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


function reportMetadata(file: string): KnownMissingReport | undefined {
  if (file === REJECTED_MAY_REPORT.file) return REJECTED_MAY_REPORT;
  return KNOWN_MISSING_REPORTS.find((report) => report.file === file);
}

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

function buildInventory(
  snapshots: Snapshot[],
  localFiles: Set<string>,
  rejectedReports: CvsrReportDiagnostic[],
  parseFailures: Array<{ file: string; reason: string }>,
  fieldFailures: Array<{ month: string; cp: CvsrPackage; metric: 'utilities' | 'parcels' }>,
): CvsrInventory {
  const coverageStart = '2019-03';
  const coverageEnd = '2026-04';
  const expectedMonths = monthRange(coverageStart, coverageEnd);
  const availableMonths = snapshots.map((snapshot) => snapshot.dataMonth);
  const available = new Set(availableMonths);
  const gaps: CvsrGap[] = [];

  for (const month of expectedMonths) {
    if (available.has(month)) continue;
    const known = KNOWN_MISSING_REPORTS.find((report) => report.month === month);
    if (known && !localFiles.has(known.file)) {
      gaps.push({
        month,
        metric: 'snapshot',
        packages: [...CVSR_PACKAGES],
        cause: 'report_not_downloaded',
        reportFile: known.file,
        reportUrl: known.url,
        detail: 'A valid Authority report URL is known, but the PDF is absent from the local inventory.',
      });
      continue;
    }
    if (month === REJECTED_MAY_REPORT.month) {
      gaps.push({
        month,
        metric: 'snapshot',
        packages: [...CVSR_PACKAGES],
        cause: 'report_not_located',
        reportFile: REJECTED_MAY_REPORT.file,
        reportUrl: REJECTED_MAY_REPORT.url,
        detail: 'The apparent May report states that its data are through April 2023; no valid May-data report was located.',
      });
      continue;
    }
    gaps.push({
      month,
      metric: 'snapshot',
      packages: [...CVSR_PACKAGES],
      cause: 'report_not_located',
      detail: 'No valid Authority report was located for this data month.',
    });
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
      (gap) => gap.month === failure.month && gap.metric === failure.metric && gap.cause === 'parser_failure',
    );
    if (existing) existing.packages.push(failure.cp);
    else {
      gaps.push({
        month: failure.month,
        metric: failure.metric,
        packages: [failure.cp],
        cause: 'parser_failure',
        detail: 'The report is present, but the parser could not extract this published package metric.',
      });
    }
  }

  for (const failure of parseFailures) {
    const known = reportMetadata(failure.file) ?? (
      LEGACY_DATES[failure.file]
        ? { month: LEGACY_DATES[failure.file], file: failure.file, url: '' }
        : undefined
    );
    if (!known || gaps.some((gap) => gap.month === known.month && gap.cause === 'parser_failure')) continue;
    gaps.push({
      month: known.month,
      metric: 'snapshot',
      packages: [...CVSR_PACKAGES],
      cause: 'parser_failure',
      reportFile: failure.file,
      ...(known.url ? { reportUrl: known.url } : {}),
      detail: failure.reason,
    });
  }

  return { coverageStart, coverageEnd, expectedMonths, availableMonths, gaps, rejectedReports };
}

async function parsePdf(path: string): Promise<Snapshot> {
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
  const manualProgress = LEGACY_PROGRESS[reportFile];
  const perPackage = (manualProgress
    ? Object.fromEntries(
        Object.entries(manualProgress).map(([cp, metrics]) => [cp, { ...metrics, sourceId: 'cvsr' }]),
      )
    : parseProgressMetrics(text, dataMonth)) as Record<CvsrPackage, PackageMetrics>;

  for (const cp of CVSR_PACKAGES) {
    if (dataMonth >= '2020-08') {
      const utilities = parseUtilityPair(text, cp);
      if (utilities) {
        perPackage[cp].utilitiesRelocated = utilities.delivered;
        perPackage[cp].utilitiesTotal = utilities.total;
      }
    }
    const parcels = LEGACY_PARCELS[reportFile]?.[cp] ?? parseParcelPair(text, cp);
    if (parcels) {
      perPackage[cp].parcelsDelivered = parcels.delivered;
      perPackage[cp].parcelsTotal = parcels.total;
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
    tier: 2,
    reportFile,
    ...(report ? { reportUrl: report.url } : {}),
    perPackage,
    aggregate,
  };
}

async function parseLocalPdfs(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const files = (await readdir(DIRECTORY)).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
  const candidates = files.filter((file) => /CVSR|Central[_ -]Valley[_ -]Status[_ -](?:Report|Update)/i.test(file));
  const alternativeFiles = files.filter((file) => !candidates.includes(file));
  const rejectedReports: CvsrReportDiagnostic[] = alternativeFiles.map((reportFile) => ({
    reportFile,
    reason: 'Non-CVSR alternative report ignored; it is not a combined monthly Central Valley Status Report.',
  }));
  const snapshotsByDate = new Map<string, Snapshot>();
  const failureCounts = new Map<string, number>();
  const parseFailures: Array<{ file: string; reason: string }> = [];
  for (const file of candidates) {
    try {
      const snapshot = await parsePdf(`${DIRECTORY}/${file}`);
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
          reason: rejected.reportFile === REJECTED_MAY_REPORT.file
            ? 'Rejected as May data: the document header says data through April 2023 and duplicates the April snapshot.'
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
      parseFailures.push({ file, reason });
      console.warn(`${file}: skipped (${reason})`);
    }
  }
  const snapshots = [...snapshotsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const fieldFailures: Array<{ month: string; cp: CvsrPackage; metric: 'utilities' | 'parcels' }> = [];
  for (const snapshot of snapshots) {
    for (const cp of CVSR_PACKAGES) {
      const metrics = snapshot.perPackage?.[cp];
      if (metrics?.parcelsTotal === undefined) {
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
      reportUrl: reportMetadata(failure.file)?.url,
      dataMonth: reportMetadata(failure.file)?.month ?? LEGACY_DATES[failure.file],
      reason: `Parser failure: ${failure.reason}`,
    });
  }
  const cvsrInventory = buildInventory(
    snapshots,
    new Set(files),
    rejectedReports,
    parseFailures,
    fieldFailures,
  );
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

const parseMode = process.argv.includes('--parse');
if (parseMode) await parseLocalPdfs();
else await writeManifest();
