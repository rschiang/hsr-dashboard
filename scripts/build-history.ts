import { readFile, writeFile } from 'node:fs/promises';
import type { CvsrInventory, HistoryArtifact, Segment, SegmentsArtifact, Snapshot } from '../src/data/types';

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

/**
 * The one observation the ArcGIS progress layer can honestly produce: its present state,
 * dated by the layer's own last edit. It holds only the segments whose completion still
 * comes from the layer, so it can never shadow a CVSR row.
 */
function observedSnapshot(observedAt: string, polledAt: string, segments: Segment[]): Snapshot {
  return {
    date: observedAt.slice(0, 10),
    tier: 2,
    polledAt,
    sourceId: 'arcgis_progress',
    perSegment: Object.fromEntries(
      segments
        .filter((segment) => segment.kind !== 'no-data' && segment.sourceId === 'arcgis_progress' && segment.completion !== null)
        .map((segment) => [segment.id, { completion: segment.completion, sourceId: 'arcgis_progress' as const }]),
    ),
  };
}

const artifact = JSON.parse(await readFile('public/data/segments.json', 'utf8')) as SegmentsArtifact;
const snapshots: Snapshot[] = [];

const parsed = JSON.parse(await readFile('data/raw/cvsr/parsed-snapshots.json', 'utf8')) as {
  snapshots?: Snapshot[];
  cvsrInventory?: CvsrInventory;
};
if (!parsed.cvsrInventory) {
  throw new Error('CVSR parsed snapshots are missing the required cvsrInventory');
}
for (const snapshot of parsed.snapshots ?? []) {
  if (snapshot.tier === 1) snapshots.push(snapshot);
}
snapshots.sort((a, b) => a.date.localeCompare(b.date));
const lastPublishedMonth = snapshots.at(-1)?.date;
if (lastPublishedMonth === undefined) {
  throw new Error('No tier 1 CVSR snapshots: the replay axis has no published month to end on');
}

// Per-segment precedence in deriveStatuses (the newest snapshot containing the segment)
// ranks the layer observation against the reports; it holds none of the segments a
// report covers.
snapshots.push(observedSnapshot(artifact.arcgisProgressEditedAt ?? artifact.generatedAt, artifact.generatedAt, artifact.segments));
snapshots.sort((a, b) => a.date.localeCompare(b.date) || a.tier - b.tier);

// The replay ends on the last month CVSR actually published. A month past it has
// neither a report nor a poll behind it, so a tick there could only redraw the
// month before — carry-forward wearing a date. Replay colours before the first
// observation come from published Start/Finish dates via scheduledStatus; no
// completion number is invented.
const replayMonths = monthSequence('2018-11-01', lastPublishedMonth);
// The final 'Current' tick exists only when dated evidence is newer than the last report.
const currentDate = artifact.currentAsOf.slice(0, 7) > lastPublishedMonth.slice(0, 7) ? artifact.currentAsOf : undefined;

const history: HistoryArtifact = {
  generatedAt: artifact.generatedAt,
  replayMonths,
  snapshots,
  ...(currentDate ? { currentDate } : {}),
  cvsrInventory: parsed.cvsrInventory,
};
await writeFile('public/data/history.json', `${JSON.stringify(history)}\n`);
const counts = snapshots.reduce<Record<number, number>>((result, snapshot) => {
  result[snapshot.tier] = (result[snapshot.tier] ?? 0) + 1;
  return result;
}, {});
console.log(`history: months=${replayMonths.length} (through ${lastPublishedMonth.slice(0, 7)}), tier 1=${counts[1] ?? 0}, tier 2=${counts[2] ?? 0}${currentDate ? `, current ${currentDate}` : ''}`);
