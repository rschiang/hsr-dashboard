import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type {
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
import {
  buildCvsrInventory,
  type CvsrFieldFailure,
  type CvsrParseFailure,
  type ReviewedCvsrReport,
} from './lib/cvsr-inventory';

const DIRECTORY = 'data/raw/cvsr';
const MANIFEST = `${DIRECTORY}/MANIFEST.md`;
const PARSED = `${DIRECTORY}/parsed-snapshots.json`;
const CURRENT_INDEX = 'https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/';

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


function reportMetadata(file: string): ReviewedCvsrReport | undefined {
  if (file === REJECTED_OVERWRITTEN_REPORT.file) return REJECTED_OVERWRITTEN_REPORT;
  return REVIEWED_CVSR_REPORTS.find((report) => report.file === file);
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
    sourceId: 'cvsr',
    reportFile,
    ...(report
      ? {
          reportUrl: report.reportUrl,
          ...(report.originalReportUrl ? { originalReportUrl: report.originalReportUrl } : {}),
        }
      : {}),
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
  const parseFailures: CvsrParseFailure[] = [];
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
    coverageStart: '2019-03',
    coverageEnd: '2026-04',
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

const parseMode = process.argv.includes('--parse');
if (parseMode) await parseLocalPdfs();
else await writeManifest();
