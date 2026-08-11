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
 * The one observation a fetch can honestly produce. The ArcGIS feature services
 * expose only their present state, so each poll yields exactly one snapshot and
 * nothing reconstructs a poll that was never taken.
 */
function observedSnapshot(polledAt: string, segments: Segment[]): Snapshot {
  return {
    date: polledAt.slice(0, 10),
    tier: 2,
    polledAt,
    sourceId: 'arcgis_progress',
    perSegment: Object.fromEntries(segments.map((segment) => [
      segment.id,
      {
        completion: segment.completion,
        sourceId: segment.sourceId === 'cvsr' ? 'cvsr' : 'arcgis_progress',
        ...(segment.sourceId === 'cvsr' && (segment.currentStatus === 'structure_complete' || segment.currentStatus === 'guideway_complete')
          ? { table: 'completed' as const }
          : {}),
      },
    ])),
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

// A poll is the leading edge only until CVSR publishes a report covering its month.
// After that the report is the controlling verdict and the poll has no UI role, so it
// never reaches the browser artifact — which keeps the supersession rule out of
// deriveStatuses and selectedCompletions entirely.
const poll = observedSnapshot(artifact.generatedAt, artifact.segments);
const pollSuperseded = poll.date.slice(0, 7) <= lastPublishedMonth.slice(0, 7);
if (!pollSuperseded) snapshots.push(poll);
snapshots.sort((a, b) => a.date.localeCompare(b.date) || a.tier - b.tier);

// The replay ends on the last month CVSR actually published. A month past it has
// neither a report nor a poll behind it, so a tick there could only redraw the
// month before — carry-forward wearing a date. Replay colours before the first
// observation come from published Start/Finish dates via scheduledStatus; no
// completion number is invented.
const replayMonths = monthSequence('2018-11-01', lastPublishedMonth);

const history: HistoryArtifact = {
  generatedAt: artifact.generatedAt,
  replayMonths,
  snapshots,
  cvsrInventory: parsed.cvsrInventory,
};
await writeFile('public/data/history.json', `${JSON.stringify(history)}\n`);
const counts = snapshots.reduce<Record<number, number>>((result, snapshot) => {
  result[snapshot.tier] = (result[snapshot.tier] ?? 0) + 1;
  return result;
}, {});
console.log(`history: months=${replayMonths.length} (through ${lastPublishedMonth.slice(0, 7)}), tier 1=${counts[1] ?? 0}, tier 2=${counts[2] ?? 0}${pollSuperseded ? ` (poll ${poll.date} superseded, dropped)` : ''}`);
