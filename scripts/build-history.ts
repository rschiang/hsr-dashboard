import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import type { HistoryArtifact, Segment, SegmentsArtifact, Snapshot } from '../src/data/types';

function monthSequence(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const last = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  while (cursor <= last) {
    result.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-01`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

function scheduledCompletion(segment: Segment, date: string): number | null {
  if (segment.completion === null) return null;
  if (segment.start === null || segment.finish === null) return segment.completion === 0 ? 0 : null;
  if (date < segment.start) return 0;
  if (date < segment.finish) return segment.completion <= 0 ? 0 : Math.min(segment.completion, 0.5);
  return segment.completion;
}

function observedSnapshot(date: string, segments: Segment[]): Snapshot {
  return {
    date: date.slice(0, 10),
    tier: 3,
    sourceId: 'arcgis_progress',
    perSegment: Object.fromEntries(segments.map((segment) => [segment.id, { completion: segment.completion }])),
  };
}

const artifact = JSON.parse(await readFile('public/data/segments.json', 'utf8')) as SegmentsArtifact;
const scheduledDates = monthSequence('2018-11-01', artifact.generatedAt.slice(0, 10));
const snapshots: Snapshot[] = scheduledDates.map((date) => ({
  date,
  tier: 1,
  sourceId: 'arcgis_progress',
  perSegment: Object.fromEntries(artifact.segments.map((segment) => [segment.id, { completion: scheduledCompletion(segment, date) }])),
}));

try {
  const parsed = JSON.parse(await readFile('data/raw/cvsr/parsed-snapshots.json', 'utf8')) as { snapshots?: Snapshot[] };
  for (const snapshot of parsed.snapshots ?? []) {
    if (snapshot.tier === 2) snapshots.push(snapshot);
  }
} catch {
  console.warn('CVSR: no parsed snapshots; tier 2 omitted');
}

const tier3 = new Map<string, Snapshot>();
try {
  const log = execFileSync('git', ['log', '--format=%H|%cI', '--', 'public/data/segments.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  for (const line of log.split('\n').filter(Boolean)) {
    const separator = line.indexOf('|');
    const hash = line.slice(0, separator);
    const committedAt = line.slice(separator + 1, separator + 11);
    try {
      const content = execFileSync('git', ['show', `${hash}:public/data/segments.json`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 20 * 1024 * 1024,
      });
      const committed = JSON.parse(content) as SegmentsArtifact;
      tier3.set(committedAt, observedSnapshot(committedAt, committed.segments));
    } catch (error) {
      console.warn(`git snapshot ${hash.slice(0, 8)} skipped: ${String(error)}`);
    }
  }
} catch {
  console.warn('Git history unavailable; tier 3 starts with the current fetched artifact');
}
const currentDate = artifact.generatedAt.slice(0, 10);
tier3.set(currentDate, observedSnapshot(currentDate, artifact.segments));
snapshots.push(...tier3.values());
snapshots.sort((a, b) => a.date.localeCompare(b.date) || a.tier - b.tier);

const history: HistoryArtifact = { generatedAt: artifact.generatedAt, snapshots };
await writeFile('public/data/history.json', `${JSON.stringify(history)}\n`);
const counts = snapshots.reduce<Record<number, number>>((result, snapshot) => {
  result[snapshot.tier] = (result[snapshot.tier] ?? 0) + 1;
  return result;
}, {});
console.log(`history: tier 1=${counts[1] ?? 0}, tier 2=${counts[2] ?? 0}, tier 3=${counts[3] ?? 0}`);
