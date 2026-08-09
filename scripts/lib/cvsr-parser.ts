import type { PackageMetrics } from '../../src/data/types';

export const CVSR_PACKAGES = ['CP1', 'CP2-3', 'CP4'] as const;
export type CvsrPackage = (typeof CVSR_PACKAGES)[number];
export type CountPair = { delivered: number; total: number; remaining?: number };
type ProgressCount = { complete: number; total: number };

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
function parseAcquisitionTable(text: string, cp: CvsrPackage): CountPair | null {
  const heading = /CP\s*1-4\s*(?:[–—-]\s*)?ROW Parcels to be Acquired and Remaining/i.exec(text);
  if (!heading) return null;
  const section = text.slice(heading.index, heading.index + 12000);
  const row = new RegExp(
    `CP\\s*${PACKAGE_LABELS[cp]}(?![-\\d])\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)\\s+([0-9,]+)`,
    'i',
  ).exec(section);
  if (!row) return null;
  const total = integer(row[1]) - integer(row[4]);
  const delivered = integer(row[2]) + integer(row[5]);
  return validateCountPair(
    { total, delivered, remaining: integer(row[6]) },
    `parcels ${cp}`,
  );
}
function parseAcquisitionSummary(text: string, cp: CvsrPackage): CountPair | null {
  const heading = /CP\s*1-4\s*ROW Parcel Acquisition Summary/i.exec(text);
  if (!heading) return null;
  const section = text.slice(heading.index, heading.index + 12000);
  const row = new RegExp(
    `CP\\s*${PACKAGE_LABELS[cp]}(?![-\\d])\\s+(-?[0-9,]+)\\s+(-?[0-9,]+)\\s+(-?[0-9,]+)\\s+(-?[0-9,]+)\\s+(-?[0-9,]+)\\s+(-?[0-9,]+)`,
    'i',
  ).exec(section);
  if (!row) return null;
  const total = integer(row[1]);
  const remaining = integer(row[6]);
  return validateCountPair(
    { total, delivered: total - remaining, remaining },
    `parcels ${cp}`,
  );
}


function parseDeliveryTable(text: string, cp: CvsrPackage): CountPair | null {
  const heading = /CP\s*1-4\s*[–—-]\s*Real Property\/Right-of-Way\s*\(ROW\)[\s\S]{0,100}?(?:To Be Delivered vs\. Delivered|Parcels Delivered to DB)/i.exec(text);
  if (!heading) return null;
  const section = text.slice(heading.index, heading.index + 8000);
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
    const remainder = text.slice(heading.index, heading.index + 12000);
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


export function parseParcelPair(text: string, cp: CvsrPackage): CountPair | null {
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
  const acquisition = parseAcquisitionTable(text, cp);
  const summary = parseAcquisitionSummary(text, cp);
  if (summary) return summary;
  if (acquisition) return acquisition;
  const delivery = parseDeliveryTable(text, cp);
  if (delivery) return delivery;
  return parseParcelTable(text, cp);
}
