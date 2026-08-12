import type { PackageMetrics } from '../../src/data/types';

export const CVSR_PACKAGES = ['CP1', 'CP2-3', 'CP4'] as const;
export type CvsrPackage = (typeof CVSR_PACKAGES)[number];
export type CountPair = { delivered: number; total: number; remaining?: number };
export type DatedCountPair = CountPair & { asOf: string };
export type ParcelAcquisitionAudit = {
  totalNeeded: number;
  priorAcquired: number;
  modifications: number;
  acquired: number;
  remaining: number;
  asOf: string;
};
type ProgressCount = { complete: number; total: number };

export type CvsrRowKind = 'structure' | 'guideway';
export type CvsrRowTable = 'underway' | 'completed';
export type CvsrRowProgress = {
  cp: CvsrPackage;
  kind: CvsrRowKind;
  table: CvsrRowTable;
  location: string;
  footnote: 'substantially_complete' | 'partially_open' | null;
  start: string;
  finish: string;
  completion: number | null;
  monthlyProgress: number | null;
  quote: string;
};

const FOOTNOTED_ROWS: Readonly<Record<string, readonly string[]>> = {
  'FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf': [
    'Excelsior Ave1',
    'AAAT1',
    'Ave 241',
    'Ave 1561',
    'Lansing1',
    'Cross Creek1',
    'SR 43 Jersey1',
    'Belmont Avenue 1',
  ],
  'FA-Central-Valley-Status-Report-July-2026-A11Y.pdf': [
    'Belmont Avenue1',
    'Road 261',
    'Excelsior Ave1',
    'AAAT 1',
    'Ave 241',
    'Ave 1561',
    'Cross Creek1',
    'SR 43 Tied Arch to Cole Slough (0.36 Miles)1',
    'Conejo Ave to Peach Ave (0.23 Miles)1',
    'Elkhorn Ave to Fowler Ave (0.55 Miles)1',
    'Fowler Ave to Davis Ave (1.35 Miles)1',
    'Cole Slough to Access Road (0.33 Miles) 1',
    'Kings River to Dover Ave (1.29 Miles)1',
    'Dover Ave to Excelsior Ave (1.01 Miles)1',
    'Hanford Armona to Houston Ave (1.04 Miles)1',
    'Ave 156 to SR 43 Tule River (1.58 Miles)1',
    'Alpaugh Bridge to Ave 56 (0.95 Miles)1',
    'Access Road to Dutch John Cut (0.22 Miles) 1',
    'Excelsior Ave to Flint Ave (2.04 Miles)1',
    'Houston Ave to Idaho Ave (2.0 Miles)1',
    'Fargo Ave to Grangeville Ave (1.04 Miles)1',
    'Ave 88 to Deer Creek (2.14 Miles)1',
  ],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function rowMonth(value: string): string {
  const [name, year] = value.split('-');
  const month = MONTHS.indexOf(name as (typeof MONTHS)[number]) + 1;
  if (month === 0) throw new Error(`invalid CVSR row month: ${value}`);
  return `20${year}-${String(month).padStart(2, '0')}`;
}

function rowReportFile(text: string, reportFile?: string): string | undefined {
  if (reportFile) return reportFile;
  return /April 2026 Data/i.test(text)
    ? 'FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf'
    : undefined;
}

/**
 * Parses the Authority's row-level construction-progress tables. Package and
 * table headings are stateful because continued pages do not always repeat the
 * package heading in extracted text.
 */
export function parseRowProgress(text: string, reportFile?: string): CvsrRowProgress[] {
  const normalized = normalizeCvsrText(text);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim());
  const rows: CvsrRowProgress[] = [];
  const summaries = new Map<string, { completed: number; underway: number }>();
  let cp: CvsrPackage | undefined;
  let kind: CvsrRowKind | undefined;
  let table: CvsrRowTable | undefined;
  const reviewedFile = rowReportFile(normalized, reportFile);
  const footnoted = new Set(reviewedFile ? FOOTNOTED_ROWS[reviewedFile] ?? [] : []);
  const rowPattern =
    /^(?<location>\S.*?)\s+(?<start>[A-Z][a-z]{2}-\d{2})\s+(?<finish>[A-Z][a-z]{2}-\d{2})\s+(?<pct>\d+(?:\.\d+)?%|Open)(?:\s+(?<monthly>\d+(?:\.\d+)?%|[\u2013-]))?$/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const packageHeading = /^CP\s*(1|2[-–]3|4)\s*[–—-]\s*Construction Progress\b/i.exec(line);
    if (packageHeading) {
      cp = packageHeading[1] === '1' ? 'CP1' : packageHeading[1] === '4' ? 'CP4' : 'CP2-3';
      table = undefined;
      kind = undefined;
      continue;
    }

    const tableHeading = /^(Structures|Guideways)\s*-\s*(Underway|Completed)(?:\s+\(cont['’]d\))?/i.exec(
      line.replace(/\s+(?:#\s*)+$/, ''),
    );
    if (tableHeading) {
      if (!cp) throw new Error(`CVSR row table has no construction package: ${line}`);
      kind = tableHeading[1].toLowerCase().startsWith('structure') ? 'structure' : 'guideway';
      table = tableHeading[2].toLowerCase() as CvsrRowTable;
      continue;
    }

    if (/^(?:Report Notes|Footnotes|--\s*\d+\s+of\s+\d+\s*--)$/i.test(line)) {
      table = undefined;
      kind = undefined;
      continue;
    }

    if (cp && /\b(?:Structures|Guideways)\s+Complete\b.*\bUnderway\b.*\bNot Started\b/i.test(line)) {
      const summaryKind: CvsrRowKind = /Structures/i.test(line) ? 'structure' : 'guideway';
      for (let lookahead = index + 1; lookahead <= Math.min(index + 3, lines.length - 1); lookahead += 1) {
        const counts = lines[lookahead].match(/\d+/g)?.map(Number);
        if (counts?.length === 3) {
          summaries.set(`${cp}:${summaryKind}`, { completed: counts[0], underway: counts[1] });
          break;
        }
      }
    }

    if (!cp || !kind || !table) continue;
    const match = rowPattern.exec(line);
    if (!match?.groups) continue;
    let location = match.groups.location;
    let footnote: CvsrRowProgress['footnote'] = null;
    if (footnoted.has(location)) {
      location = location.replace(/\s*1$/, '');
      footnote = cp === 'CP1' ? 'partially_open' : 'substantially_complete';
    }
    // July 2026 appends the published span to guideway labels. ArcGIS `Limits` and the
    // structure crosswalk both key on the bare label; `quote` keeps the verbatim line.
    location = location.replace(/\s*\(\d+(?:\.\d+)?\s*Miles\)$/i, '');
    const percent = match.groups.pct;
    const monthly = match.groups.monthly;
    rows.push({
      cp,
      quote: line.replace(/\s+(?:\u2013|-)$/, ''),
      kind,
      table,
      location,
      footnote,
      start: rowMonth(match.groups.start),
      finish: rowMonth(match.groups.finish),
      completion: percent === 'Open' ? null : Number.parseFloat(percent) / 100,
      monthlyProgress: !monthly || monthly === '-' || monthly === '\u2013'
        ? null
        : Number.parseFloat(monthly) / 100,
    });
  }

  if (/(?:Structures|Guideways)\s*-\s*(?:Underway|Completed)/i.test(normalized) && rows.length === 0) {
    throw new Error(`${reviewedFile ?? 'CVSR report'} contains row progress tables but yielded zero rows`);
  }
  for (const [key, summary] of summaries) {
    const [summaryCp, summaryKind] = key.split(':') as [CvsrPackage, CvsrRowKind];
    const completed = rows.filter((row) => row.cp === summaryCp && row.kind === summaryKind && row.table === 'completed').length;
    const underway = rows.filter((row) => row.cp === summaryCp && row.kind === summaryKind && row.table === 'underway').length;
    if (completed !== summary.completed || underway !== summary.underway) {
      throw new Error(
        `${summaryCp} ${summaryKind} row counts ${completed} completed/${underway} underway do not match summary ${summary.completed}/${summary.underway}`,
      );
    }
  }
  return rows;
}

const PACKAGE_LABELS: Record<CvsrPackage, string> = {
  CP1: '1',
  'CP2-3': '2[-–]?3',
  CP4: '4',
};

const EXPLICIT_PACKAGE_ORDER =
  String.raw`CP[-\s]*1(?:\s+Number)?(?![-\d])\s+CP[-\s]*2[-–\s]+3(?:\s+Number)?(?![-\d])\s+CP[-\s]*4(?:\s+Number)?(?![-\d])`;

export function normalizeCvsrText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
}

export function normalizeDataMonth(value: string): string {
  if (/^20\d{2}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/.test(value)) return value.slice(0, 7);
  const named = /^(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{1,2},?)?\s+(20\d{2})$/i.exec(value.trim());
  if (!named) throw new Error(`invalid data month: ${value}`);
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  return `${named[2]}-${String(months.indexOf(named[1].toLowerCase()) + 1).padStart(2, '0')}`;
}

export function parseDataMonth(
  text: string,
  reportFile: string,
  legacyDates: Readonly<Record<string, string>>,
): string {
  const dateMatch = /data\s+through\s*:?[ \n]+([A-Z][a-z]+(?:\s+\d{1,2},?)?\s+20\d{2})/i.exec(text)
    ?? /Central Valley Status Report\s+([A-Z][a-z]+\s+20\d{2})\s+data/i.exec(text);
  const value = dateMatch?.[1] ?? legacyDates[reportFile];
  if (!value) throw new Error('missing data-month date');
  return normalizeDataMonth(value);
}

/**
 * Publication month of a report — the month it was posted under on hsr.ca.gov,
 * which is not the data month. Strict: returns null rather than guessing.
 */
export function parseReportMonth(text: string): string | null {
  const match = /([A-Z][a-z]+)\s+(20\d{2})\s+Report\s*\(\s*data\s+through/i.exec(text)
    ?? /Central Valley Status Report\s*[-\u2013\u2014]?\s*([A-Z][a-z]+)\s+(20\d{2})/i.exec(text);
  if (!match) return null;
  try {
    return normalizeDataMonth(`${match[1]} ${match[2]}`);
  } catch {
    return null;
  }
}

function integer(value: string): number {
  return Number(value.replaceAll(',', ''));
}

export function validateCountPair(pair: CountPair, context: string): CountPair {
  const values = [pair.delivered, pair.total, ...(pair.remaining === undefined ? [] : [pair.remaining])];
  if (values.some((value) => !Number.isFinite(value) || !Number.isInteger(value) || value < 0)) {
    throw new Error(`${context}: counts must be finite nonnegative integers`);
  }
  if (pair.delivered > pair.total) throw new Error(`${context}: delivered exceeds total`);
  if (pair.remaining !== undefined && pair.total - pair.delivered !== pair.remaining) {
    throw new Error(`${context}: total - delivered does not equal remaining`);
  }
  return pair;
}

function sectionBetween(text: string, start: RegExp, end: RegExp): string {
  const startMatch = start.exec(text);
  if (!startMatch) return '';
  const remainder = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(remainder);
  return endMatch ? remainder.slice(0, endMatch.index) : remainder;
}

function packageCounts(
  section: string,
  cp: string,
  fallbackTotal: number,
): ProgressCount | null {
  const prefix = `Construction Package\\s*${cp}\\s*[–—-]`;
  const completeOfTotal = new RegExp(`${prefix}[^\\n]*?([0-9.]+)\\s+of\\s+([0-9.]+)[^\\n]*?complete`, 'i').exec(section);
  if (completeOfTotal) return { complete: Number(completeOfTotal[1]), total: Number(completeOfTotal[2]) };

  const breakdown = new RegExp(`${prefix}[^\\n]*?([0-9.]+)\\s+(?:construction\\s+)?complete(?:d)?[^\\n]*?([0-9.]+)\\s+underway[^\\n]*?([0-9.]+)\\s+not started`, 'i').exec(section);
  if (breakdown) {
    const complete = Number(breakdown[1]);
    return { complete, total: complete + Number(breakdown[2]) + Number(breakdown[3]) };
  }

  const parenthetical = new RegExp(`${prefix}[^\\n]*?\\(\\s*([0-9.]+)\\s+underway\\s*,\\s*([0-9.]+)\\s+completed?\\s*\\)`, 'i').exec(section);
  if (parenthetical) return { complete: Number(parenthetical[2]), total: fallbackTotal };
  const allActive = new RegExp(`${prefix}[^\\n]*?([0-9.]+)\\s+(?:construction\\s+)?complete(?:d)?(?:\\s*\\([^)]*\\))?[^\\n]*?([0-9.]+)\\s+underway[^\\n]*?all\\s+(?:structures|guideway(?:\\s+miles)?)\\s+(?:in\\s+active\\s+construction|started)`, 'i').exec(section);
  if (allActive) return { complete: Number(allActive[1]), total: fallbackTotal };
  return null;
}

function tableCompletedCounts(
  progressText: string,
  kind: 'Structures' | 'Guideway',
  totals: Record<CvsrPackage, number>,
): Record<CvsrPackage, ProgressCount> | null {
  const row = new RegExp(`^${kind}\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+[0-9.]+\\s+[0-9.]+\\s+[0-9.]+\\s*$`, 'im').exec(progressText);
  if (!row) return null;
  return {
    CP1: { complete: Number(row[2]), total: totals.CP1 },
    'CP2-3': { complete: Number(row[4]), total: totals['CP2-3'] },
    CP4: { complete: Number(row[6]), total: totals.CP4 },
  };
}

export function parseProgressMetrics(
  text: string,
  dataMonth: string,
): Record<CvsrPackage, PackageMetrics> {
  const progressStart = /CP Construction(?: Progress|\/Underway)(?:\s*\([^)]*\))?/i.exec(text);
  if (!progressStart) throw new Error('missing completed-progress section');
  const progressText = text.slice(progressStart.index);
  const structuresSection = sectionBetween(progressText, /Structures\s*[–—-]/i, /Guideway\s*[–—-]/i);
  const guidewaySection = sectionBetween(progressText, /Guideway\s*[–—-]/i, /(?:Utility Relocations Status|Report Notes|--\s*\d+\s+of)/i);
  const structureTotals: Record<CvsrPackage, number> = {
    CP1: 33,
    'CP2-3': dataMonth < '2025-01' ? 49 : 48,
    CP4: 11,
  };
  const guidewayTotals: Record<CvsrPackage, number> = { CP1: 32, 'CP2-3': 65, CP4: 22 };
  const tableStructures = tableCompletedCounts(progressText, 'Structures', structureTotals);
  const tableGuideway = tableCompletedCounts(progressText, 'Guideway', guidewayTotals);
  const result = {} as Record<CvsrPackage, PackageMetrics>;
  for (const cp of CVSR_PACKAGES) {
    const label = PACKAGE_LABELS[cp];
    const structures = packageCounts(structuresSection, label, structureTotals[cp]) ?? tableStructures?.[cp];
    const guideway = packageCounts(guidewaySection, label, guidewayTotals[cp]) ?? tableGuideway?.[cp];
    if (!structures) throw new Error(`missing ${cp} structure completed-progress metrics`);
    if (!guideway) throw new Error(`missing ${cp} guideway completed-progress metrics`);
    result[cp] = {
      structuresComplete: structures.complete,
      structuresTotal: structures.total,
      guidewayMilesComplete: guideway.complete,
      guidewayMilesTotal: guideway.total,
      sourceId: 'cvsr',
    };
  }
  return result;
}

function semanticOrder(
  header: string,
  labels: ReadonlyArray<readonly [keyof CountPair, RegExp]>,
): Array<keyof CountPair> | null {
  const positions = labels.map(([key, pattern]) => ({ key, index: pattern.exec(header)?.index ?? -1 }));
  if (positions.some(({ index }) => index < 0)) return null;
  positions.sort((a, b) => a.index - b.index);
  return positions.map(({ key }) => key);
}

function parseSemanticRow(
  text: string,
  cp: CvsrPackage,
  heading: RegExp,
  labels: ReadonlyArray<readonly [keyof CountPair, RegExp]>,
  context: string,
): CountPair | null {
  const headingMatch = heading.exec(text);
  if (!headingMatch) return null;
  const section = text.slice(headingMatch.index, headingMatch.index + 9000);
  const row = new RegExp(
    `CP\\s*${PACKAGE_LABELS[cp]}(?![-\\d])\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)`,
    'i',
  ).exec(section);
  if (row) {
    const header = section.slice(0, row.index);
    const order = semanticOrder(header, labels);
    if (!order || order.length !== 3) return null;
    const pair: Partial<CountPair> = {};
    order.forEach((key, index) => { pair[key] = integer(row[index + 1]); });
    if (pair.delivered === undefined || pair.total === undefined) return null;
    return validateCountPair(pair as CountPair, `${context} ${cp}`);
  }

  const packageOrder = new RegExp(EXPLICIT_PACKAGE_ORDER, 'i');
  if (!packageOrder.test(section)) {
    throw new Error(`${context} ${cp}: semantic table is missing explicit CP 1, CP 2-3, CP 4 order`);
  }
  const pair: Partial<CountPair> = {};
  for (const [key, pattern] of labels) {
    const matches = [...section.matchAll(new RegExp(pattern.source, 'gi'))];
    const columns = matches.flatMap((match) => {
      const start = match.index + match[0].length;
      const nextLabel = labels
        .flatMap(([, candidate]) => {
          const next = new RegExp(candidate.source, 'gi');
          next.lastIndex = start;
          const found = next.exec(section);
          return found ? [found.index] : [];
        })
        .sort((a, b) => a - b)[0] ?? Math.min(start + 500, section.length);
      const values = [
        ...section
          .slice(start, nextLabel)
          .matchAll(/\b[0-9][0-9,]*\b(?!\s*%)/g),
      ].map((value) => integer(value[0]));
      return values.length === 3 ? [values] : [];
    });
    if (columns.length !== 1) {
      throw new Error(`${context} ${cp}: semantic column ${key} must contain exactly three package values`);
    }
    pair[key] = columns[0][CVSR_PACKAGES.indexOf(cp)];
  }
  if (pair.delivered === undefined || pair.total === undefined) return null;
  return validateCountPair(pair as CountPair, `${context} ${cp}`);
}

const UTILITY_STATUSES = [
  ['notStarted', /NOT STARTED/i],
  ['approved', /APPROVED TO START/i],
  ['inProgress', /IN PROGRESS/i],
  ['delivered', /RELOCATED/i],
  ['total', /TOTAL/i],
] as const;

function utilityStatusRows(
  section: string,
  cp: CvsrPackage,
  packageColumns: boolean,
): Record<(typeof UTILITY_STATUSES)[number][0], number> {
  const result = {} as Record<(typeof UTILITY_STATUSES)[number][0], number>;
  for (const [key, label] of UTILITY_STATUSES) {
    const statusLabel = key === 'total'
      ? String.raw`(?:^|\n)\s*TOTAL(?:\s+[A-Za-z]+){0,3}`
      : label.source;
    const row = packageColumns
      ? new RegExp(
          `${statusLabel}\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)(?:\\s+[0-9.]+%)?(?!\\s+[0-9,]+)`,
          'gi',
        )
      : new RegExp(`${statusLabel}\\s+([0-9,]+)\\s+[0-9.]+%`, 'gi');
    const matches = [...section.matchAll(row)];
    if (key === 'approved' && matches.length === 0) {
      result[key] = 0;
      continue;
    }
    if (matches.length === 0) {
      throw new Error(`utilities ${cp}: Summary by Utility Type is missing ${label.source}`);
    }
    const valueIndex = packageColumns ? CVSR_PACKAGES.indexOf(cp) + 1 : 1;
    result[key] = matches.reduce((sum, match) => sum + integer(match[valueIndex]), 0);
  }
  return result;
}

export function parseUtilityTypeStatusPair(text: string, cp: CvsrPackage): CountPair | null {
  if (!/Summary by Utility Type/i.test(text)) return null;

  const combinedHeading = /(?:CP\s*1-4\s*[–—-]\s*Summary by|CP\s*1-4\s*[–—-]\s*Utility Relocation Summary[\s\S]{0,200}?Summary by) Utility Type/i.exec(text);
  let section: string;
  let packageColumns: boolean;
  if (combinedHeading) {
    const remainder = text.slice(combinedHeading.index, combinedHeading.index + 15000);
    const end = /CP\s*1-4\s*[–—-]\s*(?:Real Property|Right-of-Way)/i.exec(
      remainder.slice(combinedHeading[0].length),
    );
    section = end
      ? remainder.slice(0, combinedHeading[0].length + end.index)
      : remainder;
    if (!new RegExp(EXPLICIT_PACKAGE_ORDER, 'i').test(section)) {
      throw new Error(`utilities ${cp}: Summary by Utility Type is missing explicit CP 1, CP 2-3, CP 4 columns`);
    }
    packageColumns = true;
  } else {
    const packageHeading = new RegExp(
      `CP\\s*${PACKAGE_LABELS[cp]}(?![-\\d])\\s*[–—-]\\s*Summary by Utility Type`,
      'i',
    ).exec(text);
    if (!packageHeading) {
      throw new Error(`utilities ${cp}: Summary by Utility Type is missing a package table`);
    }
    const remainder = text.slice(packageHeading.index, packageHeading.index + 12000);
    const nextSection = /\nCP\s*(?:1|2[-–]?3|4)\s*[–—-]\s*(?!Summary by Utility Type)/i.exec(
      remainder.slice(packageHeading[0].length),
    );
    section = nextSection
      ? remainder.slice(0, packageHeading[0].length + nextSection.index)
      : remainder;
    packageColumns = false;
  }

  const statuses = utilityStatusRows(section, cp, packageColumns);
  return validateCountPair(
    {
      delivered: statuses.delivered,
      total: statuses.total,
      remaining: statuses.notStarted + statuses.approved + statuses.inProgress,
    },
    `utilities ${cp} type/status detail`,
  );
}

function constructionPackageSections(text: string, cp: CvsrPackage): string[] {
  const ownHeading = new RegExp(`Construction Package\\s*${PACKAGE_LABELS[cp]}(?![-\\d])`, 'ig');
  const ownMatches = [...text.matchAll(ownHeading)];
  return ownMatches.map((heading) => {
    const start = heading.index + heading[0].length;
    const remainder = text.slice(start);
    const nextPackage = /Construction Package\s*(1|2[-–]?3|4)(?![-\d])/ig;
    let next: RegExpExecArray | null;
    while ((next = nextPackage.exec(remainder)) !== null) {
      const normalized = next[1].replace('–', '-');
      if (normalized !== PACKAGE_LABELS[cp].replace('[-–]?', '-')) {
        return remainder.slice(0, next.index);
      }
    }
    return remainder;
  });
}

export function parseUtilityPair(text: string, cp: CvsrPackage): CountPair | null {
  const direct = new RegExp(
    `Construction Package\\s*${PACKAGE_LABELS[cp]}(?![-\\d])[^\\n]{0,250}?Relocated:\\s*([0-9,]+)[^\\n]{0,250}?Total:\\s*([0-9,]+)`,
    'i',
  ).exec(text);
  const packageMatches = constructionPackageSections(text, cp).flatMap(
    (section) => [...section.matchAll(/Relocated:\s*([0-9,]+)[\s\S]{0,500}?Total:\s*([0-9,]+)/gi)],
  );
  const labelled = direct ?? packageMatches.at(-1);
  const packageSummary = labelled
    ? validateCountPair(
        { delivered: integer(labelled[1]), total: integer(labelled[2]) },
        `utilities ${cp}`,
      )
    : parseSemanticRow(
        text,
        cp,
        /CP\s*1-4\s*[–—-]\s*Utility Relocations(?: Status| Summary)?/i,
        [
          ['total', /Total Relocations/i],
          ['delivered', /Relocated to Date/i],
          ['remaining', /Remaining(?: Utility)?(?: Relocations)?/i],
        ],
        'utilities',
      );

  const detail = parseUtilityTypeStatusPair(text, cp);
  if (!detail) return packageSummary;
  if (!packageSummary) {

    throw new Error(`utilities ${cp}: package-level summary is missing for type/status reconciliation`);
  }
  if (detail.delivered !== packageSummary.delivered || detail.total !== packageSummary.total) {
    throw new Error(
      `utilities ${cp}: type/status detail ${detail.delivered}/${detail.total} does not match package summary ${packageSummary.delivered}/${packageSummary.total}`,
    );
  }
  return packageSummary;
}

function packageProgressSection(text: string, cp: CvsrPackage): string {
  const start = new RegExp(`CP\\s*${PACKAGE_LABELS[cp]}\\s*Progress`, 'ig');
  const matches = [...text.matchAll(start)];
  if (matches.length === 0) return '';
  const first = matches[0].index;
  const nextPackage = /CP\s*(?:1|2[-–]?3|4)\s*Progress/ig;
  nextPackage.lastIndex = first + matches[0][0].length;
  let next: RegExpExecArray | null;
  while ((next = nextPackage.exec(text)) !== null) {
    if (!new RegExp(`CP\\s*${PACKAGE_LABELS[cp]}\\s*Progress`, 'i').test(next[0])) {
      return text.slice(first, next.index);
    }
  }
  return text.slice(first);
}

/**
 * A construction-package section runs from its own heading to the next `CP … –`
 * heading. Without that bound a candidate section reads its row out of the
 * following acquisition, railroad, or package section instead of its own.
 */
function boundedCpSection(text: string, heading: RegExpExecArray, maxLength: number): string {
  const boundary = /(?:^|\r?\n)[ \t]*CP\s*(?:1-4|1|2[-–]?3|4)\s*[–—-]/g;
  boundary.lastIndex = heading.index + heading[0].length;
  const next = boundary.exec(text);
  return text.slice(
    heading.index,
    Math.min(next?.index ?? text.length, heading.index + maxLength),
  );
}

function parseDeliveryTable(text: string, cp: CvsrPackage): CountPair | null {
  const heading = /CP\s*1-4\s*[–—-]\s*Real Property\/Right-of-Way\s*\(ROW\)(?!\s*Railroad)[\s\S]{0,100}?(?:To Be Delivered vs\. Delivered|Parcels Delivered to DB)/i.exec(text);
  if (!heading) return null;
  const section = boundedCpSection(text, heading, 8000);
  const row = new RegExp(
    `CP\\s*${PACKAGE_LABELS[cp]}(?![-\\d])\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)`,
    'i',
  ).exec(section);
  if (!row) return null;
  return validateCountPair(
    { remaining: integer(row[1]), delivered: integer(row[2]), total: integer(row[3]) },
    `parcels ${cp}`,
  );
}

function parseParcelTable(text: string, cp: CvsrPackage): CountPair | null {
  const headings = text.matchAll(
    /CP\s*(1-4|1|2[-–]?3|4)\s*[–—-]\s*(?:Right-of-Way\s*\(ROW\)\s*Summary|ROW Summary)/gi,
  );
  let invalid: Error | undefined;
  for (const heading of headings) {
    const headingPackage = heading[1].replace('–', '-');
    if (headingPackage !== '1-4' && headingPackage !== PACKAGE_LABELS[cp].replace('[-–]?', '-')) {
      continue;
    }
    const remainder = boundedCpSection(text, heading, 12000);
    const railroad = /\bROW\b[^\n]{0,100}\bRailroad\b|\bRailroad\b[^\n]{0,100}\bSummary\b/i.exec(remainder);
    const section = railroad ? remainder.slice(0, railroad.index) : remainder;
    try {
      const pair = parseSemanticRow(
        section,
        cp,
        /(?:Right-of-Way\s*\(ROW\)\s*Summary|ROW Summary)/i,
        [
          ['total', /(?:Estimated\s+)?Total\s+(?:Needed\s+Parcels|Parcels\s+Needed|Needed)\b/i],
          ['delivered', /(?:Total\s+Parcels\s+)?Delivered(?:\s+to\s+Date)?\b/i],
          ['remaining', /Remaining(?:\s+Parcels(?:\s+to\s+be\s+Delivered)?)?\b/i],
        ],
        'parcels',
      );
      if (pair) return pair;
    } catch (error) {
      invalid = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (invalid) throw invalid;
  return null;
}


/**
 * Cumulative parcels delivered to the design-builder, by construction package.
 *
 * Precedence is by how directly a source section names that measure. The
 * package ROW Summary table is the authority; the delivery table is the same
 * measure in the later layout; the narrative forms are the pre-table wording.
 * Acquisition counts are a different measure and are never substituted — a
 * report that publishes no cumulative delivery yields `null`, which the
 * pipeline records as a typed field gap.
 */
export function parseParcelPair(text: string, cp: CvsrPackage): CountPair | null {
  const august2019 = sectionBetween(
    text,
    /ROW Parcels Acquired by Month/i,
    /Central Valley Status Report/i,
  );
  const augustValues = cpTableRow(august2019, cp);
  if (augustValues && augustValues.length >= 7 && /Additional\s+parcels\s+in\s+August/i.test(august2019)) {
    const [publishedTotal, , excludingRailroads, , , additional, currentRemaining] = augustValues.slice(-7);
    const base = cp === 'CP4' ? publishedTotal : excludingRailroads;
    const total = base + additional;
    return validateCountPair(
      { delivered: total - currentRemaining, total, remaining: currentRemaining },
      `2019-08 parcels ${cp}`,
    );
  }
  // An unusable ROW Summary is only fatal when nothing else names the metric,
  // so hold the rejection until the remaining strategies have been tried.
  let invalidTable: Error | undefined;
  try {
    const table = parseParcelTable(text, cp);
    if (table) return table;
  } catch (error) {
    invalidTable = error instanceof Error ? error : new Error(String(error));
  }
  const delivery = parseDeliveryTable(text, cp);
  if (delivery) return delivery;

  const section = packageProgressSection(text, cp);
  const legacyMatches = [
    ...section.matchAll(
      /(?:Total Parcels|Estimated Total Parcels Needed)\s*:\s*([0-9,]+)[\s\S]{0,150}?(?:Parcels Delivered|Total Parcels Delivered to Date)\s*:\s*([0-9,]+)/gi,
    ),
  ];
  const legacy = legacyMatches.at(-1);
  if (legacy) {
    return validateCountPair(
      { delivered: integer(legacy[2]), total: integer(legacy[1]) },
      `parcels ${cp}`,
    );
  }
  const deliveredFirst = new RegExp(
    `Construction Package\\s*${PACKAGE_LABELS[cp]}(?![-\\d])[\\s\\S]{0,300}?Total Parcels Delivered to Date\\s*[–—:-]\\s*([0-9,]+)[\\s\\S]{0,150}?Estimated Total Parcels Needed\\s*[–—:-]\\s*([0-9,]+)`,
    'i',
  ).exec(text);
  if (deliveredFirst) {
    return validateCountPair(
      { delivered: integer(deliveredFirst[1]), total: integer(deliveredFirst[2]) },
      `parcels ${cp}`,
    );
  }
  if (invalidTable) throw invalidTable;
  return null;
}

/**
 * Cumulative parcels delivered to the design-builder as the report states it for
 * CP 1-4. Recorded only when the report prints the pair itself; package tables are
 * never summed into it.
 */
export function parseProgramParcelDelivery(text: string): CountPair | null {
  const match = /All required parcels have been delivered\s*[\u2014\u2013-]\s*([0-9,]+)\s+of\s+([0-9,]+)/i.exec(text);
  if (!match) return null;
  return validateCountPair({ delivered: integer(match[1]), total: integer(match[2]) }, 'program parcels');
}

function cpTableRow(section: string, cp: CvsrPackage): number[] | null {
  const label = cp === 'CP1' ? String.raw`CP\s*1(?![-\d])` : cp === 'CP2-3' ? String.raw`CP\s*2[-–]3` : String.raw`CP\s*4(?![-\d])`;
  const line = section.split(/\r?\n/).find((candidate) => new RegExp(`^\\s*${label}\\s+`, 'i').test(candidate));
  if (!line) return null;
  return [...line.matchAll(/-?[0-9][0-9,]*/g)].map((match) => integer(match[0]));
}

function monthEnd(dataMonth: string): string {
  const [year, month] = dataMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function parseParcelAcquisitionAudit(text: string, cp: CvsrPackage): ParcelAcquisitionAudit | null {
  const section = sectionBetween(
    text,
    /CP\s*1-4\s+ROW Parcel Acquisition Summary/i,
    /CP\s*1-4\s+ROW Railroad|CP\s*1-4\s+[–—-]\s+ROW Acquired/i,
  );
  if (!/November 30,\s*2019[\s\S]*March 9,\s*2020/i.test(section)) return null;
  const values = cpTableRow(section, cp);
  if (!values || values.length < 6) return null;
  const [totalNeeded, priorAcquired, , modifications, acquired, remaining] = values.slice(-6);
  if (totalNeeded !== priorAcquired + remaining) {
    throw new Error(`2020-01 parcel acquisition audit ${cp} does not satisfy A = B + F`);
  }
  return {
    totalNeeded,
    priorAcquired,
    modifications,
    acquired,
    remaining,
    asOf: '2020-03-09',
  };
}

export function parseParcelAcquisitionPair(
  text: string,
  cp: CvsrPackage,
  dataMonth: string,
): DatedCountPair | null {
  const legacy = sectionBetween(
    text,
    /ROW Parcels to be Acquired and Remaining/i,
    /(?:Notes:|ROW Railroad|Land Conveyance)/i,
  );
  if (legacy) {
    const values = cpTableRow(legacy, cp);
    if (values && values.length >= 6) {
      const [priorTotal, priorAcquired, , optimized, acquiredThisMonth, remaining] = values.slice(-6);
      const pair = validateCountPair(
        {
          total: priorTotal - optimized,
          delivered: priorAcquired + acquiredThisMonth,
          remaining,
        },
        `parcel acquisition ${dataMonth} ${cp}`,
      );
      return { ...pair, asOf: monthEnd(dataMonth) };
    }
  }

  if (parseParcelAcquisitionAudit(text, cp)) return null;
  const current = sectionBetween(
    text,
    /ROW Parcel Acquisition Summary/i,
    /ROW Acquired but Not Delivered|Parcel Delivery to DB|ROW Railroad/i,
  );
  if (!current) return null;
  const values = cpTableRow(current, cp);
  if (!values || values.length < 6) return null;
  const [, , total, , , acquired] = values.slice(-6);
  return {
    ...validateCountPair({ delivered: acquired, total }, `parcel acquisition ${dataMonth} ${cp}`),
    asOf: /March 9,\s*2020/i.test(current) ? '2020-03-09' : monthEnd(dataMonth),
  };
}

export function parseRailroadParcelPair(text: string, cp: CvsrPackage): CountPair | null {
  const section = sectionBetween(
    text,
    /(?:Real Property\/Right-of-Way \(ROW\) Railroad|ROW Railroad (?:Parcels|Summary))/i,
    /(?:Actual vs\. Forecast|ROW Railroad Delivery|Report Notes)/i,
  );
  if (!section) return null;
  const values = cpTableRow(section, cp);
  if (!values || values.length < 3) return null;
  const [first, second, third] = values.slice(-3);
  const header = section.slice(0, section.search(/\n\s*CP\s*(?:1|2[-–]3|4)\b/i));
  const remainingIndex = header.search(/Railroad Parcels to be (?:Delivered|Acquired)/i);
  const totalIndex = header.search(/Total (?:Needed )?Railroad Parcels/i);
  const remainingFirst = /To Be Delivered vs\. Delivered/i.test(section)
    || (remainingIndex >= 0 && totalIndex >= 0 && remainingIndex < totalIndex);
  const total = remainingFirst ? third : first;
  const delivered = second;
  const remaining = remainingFirst ? first : third;
  try {
    return validateCountPair({ delivered, total, remaining }, `railroad parcels ${cp}`);
  } catch {
    return null;
  }
}
