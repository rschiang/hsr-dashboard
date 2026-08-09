import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type { Snapshot } from '../src/data/types';

const DIRECTORY = 'data/raw/cvsr';
const MANIFEST = `${DIRECTORY}/MANIFEST.md`;
const PARSED = `${DIRECTORY}/parsed-snapshots.json`;
const USER_AGENT = 'hsr-dashboard/1.0 (public-data-pipeline; no bot-protection bypass)';
const CURRENT_INDEX = 'https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/';
const YEAR_INDEXES = Array.from({ length: 8 }, (_, index) => {
  const year = 2018 + index;
  return `https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/${year}-finance-audit-committee-meetings/`;
});

type MediaItem = {
  id: number;
  date: string;
  title: { rendered: string };
  source_url: string;
  mime_type: string;
};

function monthKey(value: string): string {
  const namedMonth = /^(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{1,2},?)?\s+(20\d{2})$/i.exec(value.trim());
  if (namedMonth) {
    const monthByName: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };
    return `${namedMonth[2]}-${String(monthByName[namedMonth[1].toLowerCase()]).padStart(2, '0')}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid date: ${value}`);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function expectedDataMonth(reportDate: string): string {
  const date = new Date(reportDate);
  date.setUTCMonth(date.getUTCMonth() - 2);
  return monthKey(date.toISOString());
}

async function fetchMedia(search: string): Promise<MediaItem[]> {
  const url = new URL('https://hsr.ca.gov/wp-json/wp/v2/media');
  url.searchParams.set('search', search);
  url.searchParams.set('per_page', '100');
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'asc');
  url.searchParams.set('_fields', 'id,date,title,source_url,mime_type');
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('json')) {
    throw new Error(`Authority media index returned ${response.status} ${contentType || 'unknown content type'}; bot challenge or index unavailable`);
  }
  const result = await response.json() as unknown;
  if (!Array.isArray(result)) throw new Error('Authority media index did not return an array');
  return result as MediaItem[];
}

async function writeManifest(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  let media: MediaItem[] = [];
  let failure: string | null = null;
  try {
    const shortName = await fetchMedia('CVSR');
    const { promise: delay, resolve: finishDelay } = Promise.withResolvers<void>();
    setTimeout(finishDelay, 1000);
    await delay;
    const longName = await fetchMedia('Central Valley Status');
    const union = new Map<number, MediaItem>();
    for (const item of [...shortName, ...longName]) {
      if (item.mime_type === 'application/pdf') union.set(item.id, item);
    }
    media = [...union.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    failure = String(error);
    console.warn(failure);
  }

  const lines = [
    '# Central Valley Status Report download manifest',
    '',
    'Human download required. Place PDFs in this directory, then run `npm run parse:cvsr`.',
    'This pipeline does not evade or automate around hsr.ca.gov bot protection.',
    '',
  ];
  if (failure !== null) {
    lines.push(`Index API unavailable: ${failure}`, '', '## Canonical meeting indexes', '');
    for (const url of [CURRENT_INDEX, ...YEAR_INDEXES]) lines.push(`- ${url}`);
    lines.push(
      '',
      'Known filename families:',
      '- `FA-Central-Valley-Status-Report-{Month}-{Year}.pdf`',
      '- `CVSR-{Year}-{Month}-Data-{Year}-{Month}-FINAL-V0-A11Y.pdf`',
      '- Legacy board-meeting attachments under `/wp-content/uploads/docs/brdmeetings/`',
    );
  } else {
    lines.push(`Documents indexed: ${media.length}`, '');
    for (const item of media) {
      lines.push(`- [ ] ${monthKey(item.date)} report (expected data month ${expectedDataMonth(item.date)}): ${item.source_url}`);
    }
  }
  await writeFile(MANIFEST, `${lines.join('\n')}\n`);
  console.log(`CVSR manifest: ${MANIFEST}`);
  console.log(`Current F&A index: ${CURRENT_INDEX}`);
  console.log(`Prior-year indexes: ${YEAR_INDEXES[0]} … ${YEAR_INDEXES.at(-1)}`);
}

function sectionBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = start.exec(text);
  if (!startMatch) return '';
  const remainder = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(remainder);
  return endMatch ? remainder.slice(0, endMatch.index) : remainder;
}

type CountMetric = { complete: number; total: number };

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

function packageCounts(section: string, cp: '1' | '2-3' | '4', fallbackTotal: number): CountMetric | null {
  const escaped = cp.replace('-', '[-–]?');
  const prefix = `Construction Package\\s*${escaped}\\s*[–—-]`;
  const completeOfTotal = new RegExp(`${prefix}[^\\n]*?([0-9.]+)\\s+of\\s+([0-9.]+)[^\\n]*?complete`, 'i').exec(section);
  if (completeOfTotal) return { complete: Number(completeOfTotal[1]), total: Number(completeOfTotal[2]) };

  const completeUnderwayNotStarted = new RegExp(`${prefix}[^\\n]*?([0-9.]+)\\s+(?:construction\\s+)?complete(?:d)?[^\\n]*?([0-9.]+)\\s+underway[^\\n]*?([0-9.]+)\\s+not started`, 'i').exec(section);
  if (completeUnderwayNotStarted) {
    const complete = Number(completeUnderwayNotStarted[1]);
    return { complete, total: complete + Number(completeUnderwayNotStarted[2]) + Number(completeUnderwayNotStarted[3]) };
  }

  const parentheticalBreakdown = new RegExp(`${prefix}[^\\n]*?\\(\\s*([0-9.]+)\\s+underway\\s*,\\s*([0-9.]+)\\s+completed?\\s*\\)`, 'i').exec(section);
  if (parentheticalBreakdown) return { complete: Number(parentheticalBreakdown[2]), total: fallbackTotal };
  const allActive = new RegExp(`${prefix}[^\\n]*?([0-9.]+)\\s+(?:construction\\s+)?complete(?:d)?(?:\\s*\\([^)]*\\))?[^\\n]*?([0-9.]+)\\s+underway[^\\n]*?all\\s+(?:structures|guideway(?:\\s+miles)?)\\s+(?:in\\s+active\\s+construction|started)`, 'i').exec(section);
  if (allActive) return { complete: Number(allActive[1]), total: fallbackTotal };

  return null;
}

function tableCompletedCounts(progressText: string, kind: 'Structures' | 'Guideway', totals: Record<'CP1' | 'CP2-3' | 'CP4', number>): Record<'CP1' | 'CP2-3' | 'CP4', CountMetric> | null {
  const row = new RegExp(`^${kind}\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+[0-9.]+\\s+[0-9.]+\\s+[0-9.]+\\s*$`, 'im').exec(progressText);
  if (!row) return null;
  return {
    CP1: { complete: Number(row[2]), total: totals.CP1 },
    'CP2-3': { complete: Number(row[4]), total: totals['CP2-3'] },
    CP4: { complete: Number(row[6]), total: totals.CP4 },
  };
}

async function parsePdf(path: string): Promise<Snapshot> {
  const parser = new PDFParse({ data: await readFile(path) });
  let text: string;
  try {
    text = (await parser.getText()).text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  } finally {
    await parser.destroy();
  }

  const reportFile = basename(path);
  const dateMatch = /data\s+through\s*:?[ \n]+([A-Z][a-z]+(?:\s+\d{1,2},?)?\s+20\d{2})/i.exec(text)
    ?? /Central Valley Status Report\s+([A-Z][a-z]+\s+20\d{2})\s+data/i.exec(text);
  const date = dateMatch ? monthKey(dateMatch[1]) : LEGACY_DATES[reportFile];
  if (!date) throw new Error('missing data-month date');
  const manualProgress = LEGACY_PROGRESS[reportFile];
  const perPackage: Snapshot['perPackage'] = {};
  if (manualProgress) {
    for (const [key, metrics] of Object.entries(manualProgress)) {
      perPackage[key as keyof ManualProgress] = { ...metrics, sourceId: 'cvsr' };
    }
  } else {
    const progressStart = /CP Construction(?: Progress|\/Underway)(?:\s*\([^)]*\))?/i.exec(text);
    if (!progressStart) throw new Error('missing completed-progress section');
    const progressText = text.slice(progressStart.index);
    const structuresSection = sectionBetween(progressText, /Structures\s*[–—-]/i, /Guideway\s*[–—-]/i);
    const guidewaySection = sectionBetween(progressText, /Guideway\s*[–—-]/i, /(?:Utility Relocations Status|Report Notes|--\s*\d+\s+of)/i);
    const structureTotals: Record<'CP1' | 'CP2-3' | 'CP4', number> = {
      CP1: 33,
      'CP2-3': date < '2025-01' ? 49 : 48,
      CP4: 11,
    };
    const guidewayTotals: Record<'CP1' | 'CP2-3' | 'CP4', number> = { CP1: 32, 'CP2-3': 65, CP4: 22 };
    const tableStructures = tableCompletedCounts(progressText, 'Structures', structureTotals);
    const tableGuideway = tableCompletedCounts(progressText, 'Guideway', guidewayTotals);
    const packageIds = [['CP1', '1'], ['CP2-3', '2-3'], ['CP4', '4']] as const;
    for (const [key, label] of packageIds) {
      const structures = packageCounts(structuresSection, label, structureTotals[key]) ?? tableStructures?.[key];
      const guideway = packageCounts(guidewaySection, label, guidewayTotals[key]) ?? tableGuideway?.[key];
      if (!structures) throw new Error(`missing ${key} structure completed-progress metrics`);
      if (!guideway) throw new Error(`missing ${key} guideway completed-progress metrics`);
      perPackage[key] = {
        structuresComplete: structures.complete,
        structuresTotal: structures.total,
        guidewayMilesComplete: guideway.complete,
        guidewayMilesTotal: guideway.total,
        sourceId: 'cvsr',
      };
    }
  }

  const packageIds = [['CP1', '1'], ['CP2-3', '2-3'], ['CP4', '4']] as const;

  for (const [key, label] of packageIds) {
    const executiveUtility = new RegExp(`Construction Package\\s*${label.replace('-', '[-–]?')}\\s*[–—-][^.\\n]*?Relocated:\\s*([0-9,]+)[^.\\n]*?Total:\\s*([0-9,]+)`, 'i').exec(text);
    if (executiveUtility) {
      perPackage[key]!.utilitiesRelocated = Number(executiveUtility[1].replaceAll(',', ''));
      perPackage[key]!.utilitiesTotal = Number(executiveUtility[2].replaceAll(',', ''));
    }
  }

  const utilityHeading = /CP 1-4\s*[–—-]\s*Utility Relocations(?! Status)/i.exec(text);
  const utilityTable = utilityHeading ? text.slice(utilityHeading.index, utilityHeading.index + 7000) : '';
  const utilityRemainingFirst = /Remaining Relocations\s+Relocated to Date\s+Total Relocations/i.test(utilityTable);
  for (const [key, label] of packageIds) {
    if (perPackage[key]!.utilitiesTotal !== undefined) continue;
    const row = new RegExp(`CP\\s*${label.replace('-', '[-–]?')}(?![-\\d])\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)`, 'i').exec(utilityTable);
    if (!row) continue;
    perPackage[key]!.utilitiesRelocated = Number(row[2].replaceAll(',', ''));
    perPackage[key]!.utilitiesTotal = Number((utilityRemainingFirst ? row[3] : row[1]).replaceAll(',', ''));
  }

  const rowHeading = /CP 1-4\s*[–—-]\s*Real Property\/Right-of-Way(?: \(ROW\))?/i.exec(text)
    ?? /CP 1-4\s*[–—-]\s*ROW Summary/i.exec(text);
  const rowTable = rowHeading ? text.slice(rowHeading.index, rowHeading.index + 7000) : '';
  for (const [key, label] of packageIds) {
    const row = new RegExp(`CP\\s*${label.replace('-', '[-–]?')}(?![-\\d])\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)`, 'i').exec(rowTable);
    if (!row) continue;
    const first = Number(row[1].replaceAll(',', ''));
    const delivered = Number(row[2].replaceAll(',', ''));
    const third = Number(row[3].replaceAll(',', ''));
    perPackage[key]!.parcelsDelivered = delivered;
    perPackage[key]!.parcelsTotal = first >= delivered && first >= third ? first : third;
  }

  const utilities = /Relocated:\s*([0-9,]+)[^;]*;\s*In Progress:\s*([0-9,]+)[^;]*;\s*(?:(?:Approved to Start|Scheduled(?: to Start)?):\s*[0-9,]+[^;]*;\s*)?Not Started:\s*([0-9,]+)[^;]*;\s*Total:\s*([0-9,]+)/i.exec(text);
  const parcels = /Total Parcels Delivered to Date\s*[–—-]\s*(?:[0-9.]+%\s+or\s+)?([0-9,]+)\s+parcels(?:\s+delivered)?[\s\S]{0,180}?([0-9,]+)\s+(?:total\s+)?parcels/i.exec(text)
    ?? /All required parcels have been delivered\s*[—–-]\s*([0-9,]+)\s+of\s+([0-9,]+)/i.exec(text);
  const packageMetrics = Object.values(perPackage);
  const utilitiesRelocated = utilities
    ? Number(utilities[1].replaceAll(',', ''))
    : packageMetrics.reduce((sum, metrics) => sum + (metrics.utilitiesRelocated ?? 0), 0);
  const utilitiesTotal = utilities
    ? Number(utilities[4].replaceAll(',', ''))
    : packageMetrics.reduce((sum, metrics) => sum + (metrics.utilitiesTotal ?? 0), 0);
  const parcelsDelivered = parcels
    ? Number(parcels[1].replaceAll(',', ''))
    : packageMetrics.reduce((sum, metrics) => sum + (metrics.parcelsDelivered ?? 0), 0);
  const parcelsTotal = parcels
    ? Number(parcels[2].replaceAll(',', ''))
    : packageMetrics.reduce((sum, metrics) => sum + (metrics.parcelsTotal ?? 0), 0);
  const aggregate = utilitiesTotal > 0 && parcelsTotal > 0
    ? { utilitiesRelocated, utilitiesTotal, parcelsDelivered, parcelsTotal }
    : undefined;
  return {
    date,
    tier: 2,
    sourceId: 'cvsr',
    reportFile,
    perPackage,
    aggregate,
  };
}

async function parseLocalPdfs(): Promise<void> {
  await mkdir(DIRECTORY, { recursive: true });
  const files = (await readdir(DIRECTORY)).filter((file) => file.toLowerCase().endsWith('.pdf')).sort();
  const candidates = files.filter((file) => /CVSR|Central[_ -]Valley[_ -]Status[_ -](?:Report|Update)/i.test(file));
  const alternativeCount = files.length - candidates.length;
  const snapshotsByDate = new Map<string, Snapshot>();
  const failureCounts = new Map<string, number>();
  for (const file of candidates) {
    try {
      const snapshot = await parsePdf(`${DIRECTORY}/${file}`);
      const existing = snapshotsByDate.get(snapshot.date);
      if (existing) {
        const existingPayload = JSON.stringify({ perPackage: existing.perPackage, aggregate: existing.aggregate });
        const candidatePayload = JSON.stringify({ perPackage: snapshot.perPackage, aggregate: snapshot.aggregate });
        if (existingPayload !== candidatePayload) {
          const existingScore = (existing.reportFile?.toLowerCase().includes('draft') ? -10 : 0) + (existing.reportFile?.toLowerCase().includes('final') ? 2 : 0);
          const candidateScore = (file.toLowerCase().includes('draft') ? -10 : 0) + (file.toLowerCase().includes('final') ? 2 : 0);
          console.warn(`${file}: conflicts with ${existing.reportFile} for ${snapshot.date}; ${candidateScore > existingScore ? 'using candidate' : 'keeping existing'}`);
          if (candidateScore > existingScore) snapshotsByDate.set(snapshot.date, snapshot);
        }
      } else {
        snapshotsByDate.set(snapshot.date, snapshot);
      }
      console.log(`${file}: parsed data month ${snapshot.date}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
      console.warn(`${file}: skipped (${reason})`);
    }
  }
  const snapshots = [...snapshotsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  await writeFile(PARSED, `${JSON.stringify({ snapshots }, null, 2)}\n`);
  console.log(`CVSR parse: ${snapshots.length} monthly snapshots from ${candidates.length} candidate reports; ${alternativeCount} non-CVSR alternatives ignored; network requests: 0`);
  for (const [reason, count] of [...failureCounts].sort((a, b) => b[1] - a[1])) console.log(`  skipped ${count}: ${reason}`);
  console.log(`CVSR snapshots → ${PARSED}`);
}

const parseMode = process.argv.includes('--parse');
if (parseMode) await parseLocalPdfs();
else await writeManifest();
