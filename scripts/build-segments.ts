import { readFile, writeFile } from 'node:fs/promises';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineString, point, type Feature, type LineString, type Position } from '@turf/helpers';
import type { ConstructionPackage, CvsrPackageId, Segment, SegmentsArtifact, Snapshot } from '../src/data/types';
import { CVSR_ROW_CROSSWALK } from '../src/data/cvsr-row-crosswalk';
import { STRUCTURE_CROSSWALK, STRUCTURE_EVIDENCE } from '../src/data/structure-evidence';
import { SOURCES } from '../src/data/sources';
import { formatOfficialMp, stationToIosMile } from '../src/lib/mileposts';
import { resolveSegmentStatus } from '../src/lib/status';
import { assignWeights } from '../src/lib/weights';

type Attributes = {
  OBJECTID: number;
  Section: 'CP1' | 'CP2-3' | 'CP4';
  Limits: string | null;
  Start: number | null;
  Finish: number | null;
  BaselineDirtQnty: number | null;
  DeliveredDirtQnty: number | null;
  Completion: string | null;
  StructureType: string | null;
  Station: number | null;
  StationEnd: number | null;
};
type ProgressResponse = { features: Array<{ attributes: Attributes; geometry: { paths: Position[][] } }> };
type StructureResponse = {
  features: Array<{
    attributes: {
      OBJECTID: number;
      GlobalID: string;
      name: string;
      status: 'Completed' | 'In progress';
      projectPageURL: string;
      longitude: number | null;
      latitude: number | null;
    };
    geometry?: { x: number; y: number };
  }>;
};

type MilepostArtifact = { iosMiles: number[] };

const CP_SPANS: Record<'CP1' | 'CP2-3' | 'CP4', [number, number]> = {
  CP1: [34, 65],
  'CP2-3': [65, 131],
  CP4: [131, 152],
};

const STRUCTURE_ALIASES: Record<string, string[]> = {
  'road 26 overcrossing': ['road 26 overhead'],
  'ventura avenue underpass': ['cesar chavez boulevard underpass', 'ventura street underpass'],
  'grade separation': ['overcrossing', 'overhead'],
};

/** Reviewed locations for projects that provide context but no HSR progress evidence. */
export const CONTEXT_PROJECTS: Readonly<Record<string, {
  segmentId: string;
  scope: 'enabling-works' | 'third-party';
}>> = {
  '938432eb-f888-4450-ab52-e9a6b2141a4a': { segmentId: 'CP1:gap:1', scope: 'enabling-works' },
  '84e93d1f-9100-4fff-8e61-f3bfec1425ab': { segmentId: 'CP1:gap:1', scope: 'third-party' },
};

function parseCompletion(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number.parseInt(value.replace('%', ''), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(1, Math.max(0, parsed / 100));
}

function toIso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString().slice(0, 10);
}

function makeGap(cp: ConstructionPackage, start: number, end: number, index: number): Segment {
  return {
    id: `${cp}:gap:${index}`,
    cp,
    kind: 'no-data',
    label: 'No alignment-resolved progress data',
    iosMileStart: start,
    iosMileEnd: end,
    officialMpStart: formatOfficialMp(start),
    officialMpEnd: formatOfficialMp(end),
    stationStart: null,
    stationEnd: null,
    stationing: 'inferred',
    completion: null,
    baselineDirt: null,
    deliveredDirt: null,
    start: null,
    finish: null,
    weight: 0,
    weightShare: 0,
    currentStatus: 'no_data',
    structures: [],
    evidence: [],
    sourceId: 'arcgis_progress',
  };
}

function projectedMile(cp: 'CP1' | 'CP2-3', station: number, edge: 'start' | 'end'): number {
  const projected = stationToIosMile(cp, station);
  if (Number.isFinite(projected)) return projected;
  const [start, end] = CP_SPANS[cp];
  const publishedRows = cp === 'CP1' ? [962039.57, 1129998.9] : [58730.67, 404555.69];
  if (station < publishedRows[0]) return start;
  if (station > publishedRows[1]) return end;
  throw new Error(`${cp} ${edge} station ${station} falls inside an unresolved datum gap`);
}

const progress = JSON.parse(await readFile('data/raw/arcgis/progress.json', 'utf8')) as ProgressResponse;
if (progress.features.length !== 102) throw new Error(`Expected 102 progress features, received ${progress.features.length}`);
const segments: Segment[] = [];

for (const cp of ['CP1', 'CP2-3'] as const) {
  const projected: Segment[] = [];
  for (const { attributes } of progress.features.filter((feature) => feature.attributes.Section === cp)) {
    if (attributes.Station === null || attributes.StationEnd === null) {
      throw new Error(`${cp}:${attributes.OBJECTID} has no published station range`);
    }
    if (attributes.StationEnd < attributes.Station) {
      console.warn(`${cp}:${attributes.OBJECTID}: dropping backwards station range`);
      continue;
    }
    const iosMileStart = projectedMile(cp, attributes.Station, 'start');
    const iosMileEnd = projectedMile(cp, attributes.StationEnd, 'end');
    const completion = parseCompletion(attributes.Completion);
    const structureType = attributes.StructureType?.trim().toLowerCase() ?? '';
    projected.push({
      id: `${cp}:${attributes.OBJECTID}`,
      cp,
      kind: structureType === 'guideway' ? 'guideway' : 'structure',
      label: attributes.Limits?.trim() || `Feature ${attributes.OBJECTID}`,
      iosMileStart,
      iosMileEnd,
      officialMpStart: formatOfficialMp(iosMileStart),
      officialMpEnd: formatOfficialMp(iosMileEnd),
      stationStart: attributes.Station,
      stationEnd: attributes.StationEnd,
      stationing: 'published',
      completion,
      baselineDirt: attributes.BaselineDirtQnty,
      deliveredDirt: attributes.DeliveredDirtQnty,
      start: toIso(attributes.Start),
      finish: toIso(attributes.Finish),
      weight: 0,
      weightShare: 0,
      currentStatus: 'no_data',
      structures: [],
      evidence: [],
      sourceId: 'arcgis_progress',
    });
  }
  projected.sort((a, b) => a.iosMileStart - b.iosMileStart || a.iosMileEnd - b.iosMileEnd);
  let cursor = CP_SPANS[cp][0];
  let gapIndex = 0;
  for (const segment of projected) {
    if (segment.iosMileStart > cursor + 0.001) {
      segments.push(makeGap(cp, cursor, segment.iosMileStart, gapIndex));
      gapIndex += 1;
    }
    segments.push(segment);
    cursor = Math.max(cursor, segment.iosMileEnd);
  }
  if (cursor < CP_SPANS[cp][1] - 0.001) segments.push(makeGap(cp, cursor, CP_SPANS[cp][1], gapIndex));

  if (cp === 'CP2-3' && gapIndex !== 0) throw new Error(`CP2-3 must tile without gaps; emitted ${gapIndex}`);
}

const stationPattern = /(\d+)\+(\d+(?:\.\d+)?)\s*-\s*(\d+)\+(\d+(?:\.\d+)?)/;
const cp4Features = progress.features.filter((feature) => feature.attributes.Section === 'CP4');
const parsedCp4: Segment[] = [];
let inferredCp4: Attributes | null = null;
for (const { attributes } of cp4Features) {
  const match = attributes.Limits?.match(stationPattern);
  if (!match) {
    inferredCp4 = attributes;
    continue;
  }
  const stationStart = Number(match[1]) * 100 + Number(match[2]);
  const stationEnd = Number(match[3]) * 100 + Number(match[4]);
  const iosMileStart = stationToIosMile('CP4', stationStart);
  const iosMileEnd = stationToIosMile('CP4', stationEnd);
  if (!Number.isFinite(iosMileStart) || !Number.isFinite(iosMileEnd)) throw new Error(`CP4:${attributes.OBJECTID} station parse is outside TS1`);
  const completion = parseCompletion(attributes.Completion);
  parsedCp4.push({
    id: `CP4:${attributes.OBJECTID}`,
    cp: 'CP4',
    kind: 'guideway',
    label: attributes.Limits?.trim() ?? `Feature ${attributes.OBJECTID}`,
    iosMileStart,
    iosMileEnd,
    officialMpStart: formatOfficialMp(iosMileStart),
    officialMpEnd: formatOfficialMp(iosMileEnd),
    stationStart,
    stationEnd,
    stationing: 'published',
    completion,
    baselineDirt: attributes.BaselineDirtQnty,
    deliveredDirt: attributes.DeliveredDirtQnty,
    start: '2016-02-01',
    finish: completion === 1 ? '2024-01-31' : null,
    weight: 0,
    weightShare: 0,
    currentStatus: 'no_data',
    structures: [],
    evidence: [],
    sourceId: 'arcgis_progress',
  });
}
if (parsedCp4.length !== 2 || inferredCp4 === null) throw new Error('Expected two published and one inferred CP4 ranges');
parsedCp4.sort((a, b) => a.iosMileStart - b.iosMileStart);
const inferredStartStation = parsedCp4[0].stationEnd!;
const inferredEndStation = parsedCp4[1].stationStart!;
const inferredStart = stationToIosMile('CP4', inferredStartStation);
const inferredEnd = stationToIosMile('CP4', inferredEndStation);
const inferredCompletion = parseCompletion(inferredCp4.Completion);
parsedCp4.push({
  id: `CP4:${inferredCp4.OBJECTID}`,
  cp: 'CP4',
  kind: 'guideway',
  label: inferredCp4.Limits?.trim() ?? 'North Kern Incomplete Guideway',
  iosMileStart: inferredStart,
  iosMileEnd: inferredEnd,
  officialMpStart: formatOfficialMp(inferredStart),
  officialMpEnd: formatOfficialMp(inferredEnd),
  stationStart: inferredStartStation,
  stationEnd: inferredEndStation,
  stationing: 'inferred',
  completion: inferredCompletion,
  baselineDirt: null,
  deliveredDirt: null,
  start: null,
  finish: null,
  weight: 0,
  weightShare: 0,
  currentStatus: 'no_data',
  structures: [],
  evidence: [],
  sourceId: 'arcgis_progress',
});
segments.push(...parsedCp4);
segments.push({ ...makeGap('M2M', 0, 34, 0), label: 'Merced to Madera extension — civil construction not started', completion: 0, currentStatus: 'not_started' });
segments.push({ ...makeGap('LGA', 152, 175, 0), label: 'Poplar Avenue to Bakersfield extension — civil construction not started', completion: 0, currentStatus: 'not_started' });
segments.sort((a, b) => a.iosMileStart - b.iosMileStart || a.iosMileEnd - b.iosMileEnd);
const northCp1Gap = segments.find((segment) => segment.id === 'CP1:gap:0');
const herndonCp1Gap = segments.find((segment) => segment.id === 'CP1:gap:1');
if (!northCp1Gap || !herndonCp1Gap) throw new Error('Expected both reviewed CP1 gaps');
northCp1Gap.label = 'North of the first published ArcGIS CP1 row — TS1 places the CVY/CP1 equation at station 962039.57 (MP S 158); the layer’s first row starts at 964055';
herndonCp1Gap.label = 'Herndon Avenue to Golden State Boulevard realignment — guideway not started';
herndonCp1Gap.completion = 0;
herndonCp1Gap.currentStatus = 'not_started';
herndonCp1Gap.sourceId = 'cvsr';
herndonCp1Gap.coveringCvsrRows = ['Viaduct 203 at SJR to Herndon Canal', 'Herndon Canal to Swift Ave'];

const centerline = JSON.parse(await readFile('public/data/centerline.geojson', 'utf8')) as Feature<LineString>;
const mileposts = JSON.parse(await readFile('public/data/mileposts.json', 'utf8')) as MilepostArtifact;
if (centerline.geometry.coordinates.length !== mileposts.iosMiles.length) throw new Error('Centerline/milepost array length mismatch');
const cumulative = [0];
for (let index = 1; index < centerline.geometry.coordinates.length; index += 1) {
  const twoPointLine: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [centerline.geometry.coordinates[index - 1], centerline.geometry.coordinates[index]] },
  };
  cumulative.push(cumulative[index - 1] + length(twoPointLine, { units: 'miles' }));
}

function geodesicDistanceToIosMile(distance: number): number {
  let low = 0;
  let high = cumulative.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (cumulative[middle] <= distance) low = middle;
    else high = middle;
  }
  const span = cumulative[high] - cumulative[low];
  const fraction = span === 0 ? 0 : (distance - cumulative[low]) / span;
  return mileposts.iosMiles[low] + fraction * (mileposts.iosMiles[high] - mileposts.iosMiles[low]);
}

function iosMileToGeodesicDistance(iosMile: number): number {
  let low = 0;
  let high = mileposts.iosMiles.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (mileposts.iosMiles[middle] <= iosMile) low = middle;
    else high = middle;
  }
  const span = mileposts.iosMiles[high] - mileposts.iosMiles[low];
  const fraction = span === 0 ? 0 : (iosMile - mileposts.iosMiles[low]) / span;
  return cumulative[low] + fraction * (cumulative[high] - cumulative[low]);
}

const metadata = JSON.parse(await readFile('data/raw/arcgis/fetch-metadata.json', 'utf8')) as { fetchedAt: string };
const structures = JSON.parse(await readFile('data/raw/arcgis/structures.json', 'utf8')) as StructureResponse;
for (const [globalId, segmentId] of Object.entries(STRUCTURE_CROSSWALK)) {
  const matchingFeatures = structures.features.filter(
    (feature) => feature.attributes.GlobalID.toLowerCase() === globalId,
  );
  const matchingSegments = segments.filter((segment) => segment.id === segmentId);
  if (matchingFeatures.length !== 1 || matchingSegments.length !== 1) {
    throw new Error(
      `Crosswalk ${globalId} → ${segmentId} resolved to ${matchingFeatures.length} source records and ${matchingSegments.length} segments`,
    );
  }
}
const evidenceIds = new Set<string>();
for (const evidence of STRUCTURE_EVIDENCE) {
  const matchingSegments = segments.filter((segment) => segment.id === evidence.segmentId);
  if (matchingSegments.length !== 1 || evidenceIds.has(evidence.id)) {
    throw new Error(
      `Evidence ${evidence.id} resolved to ${matchingSegments.length} segments or has a duplicate ID`,
    );
  }
  evidenceIds.add(evidence.id);
  matchingSegments[0].evidence.push({ ...evidence });
}

let completedStructures = 0;
let inProgressStructures = 0;
for (const feature of structures.features) {
  const globalId = feature.attributes.GlobalID.toLowerCase();
  const reviewedTargetId = STRUCTURE_CROSSWALK[globalId];
  const contextProject = CONTEXT_PROJECTS[globalId];
  let target: Segment;
  let locationMethod: 'crosswalk' | 'spatial' | 'package-only' | 'reviewed-context';
  if (contextProject) {
    target = segments.find((segment) => segment.id === contextProject.segmentId)!;
    locationMethod = 'reviewed-context';
  } else if (reviewedTargetId !== undefined) {
    target = segments.find((segment) => segment.id === reviewedTargetId)!;
    locationMethod = 'crosswalk';
  } else {
    let candidates: Segment[];
    if (feature.geometry && Number.isFinite(feature.geometry.x) && Number.isFinite(feature.geometry.y)) {
      const coordinate: Position = [feature.geometry.x, feature.geometry.y];
      const snap = nearestPointOnLine(centerline, point(coordinate), { units: 'miles' });
      const totalDistance = snap.properties.totalDistance;
      if (typeof totalDistance !== 'number') throw new Error(`Structure ${feature.attributes.OBJECTID} has no totalDistance`);
      const iosMile = geodesicDistanceToIosMile(totalDistance);
      candidates = segments.filter((segment) => iosMile >= segment.iosMileStart - 0.001 && iosMile <= segment.iosMileEnd + 0.001);
      if (candidates.length === 0) throw new Error(`No segment contains ${feature.attributes.name} at iosMile ${iosMile}`);
      locationMethod = 'spatial';
    } else {
      candidates = segments.filter((segment) => segment.cp === 'CP2-3' && 98 >= segment.iosMileStart && 98 <= segment.iosMileEnd);
      locationMethod = 'package-only';
    }
    const normalizedName = feature.attributes.name.toLowerCase();
    const aliases = [normalizedName, ...(STRUCTURE_ALIASES[normalizedName] ?? [])];
    target = candidates.find((segment) => segment.kind !== 'no-data' && aliases.some((alias) => segment.label.toLowerCase().includes(alias)))
      ?? candidates.filter((segment) => segment.kind === 'structure').sort((a, b) => (a.iosMileEnd - a.iosMileStart) - (b.iosMileEnd - b.iosMileStart))[0];
    if (!target) {
      target = candidates[0];
      locationMethod = 'package-only';
    }
  }
  target.structures.push({
    name: feature.attributes.name,
    status: feature.attributes.status,
    url: feature.attributes.projectPageURL,
    sourceId: 'arcgis_structures',
    objectId: feature.attributes.OBJECTID,
    globalId,
    observedAt: metadata.fetchedAt,
    locationMethod,
    ...(contextProject ? { contextScope: contextProject.scope } : {}),
  });
  if (locationMethod === 'crosswalk') {
    target.evidence.push({
      id: `arcgis-structure-${globalId}-${metadata.fetchedAt.slice(0, 10)}`,
      segmentId: target.id,
      claim: feature.attributes.status === 'Completed' ? 'completed' : 'in_progress',
      date: metadata.fetchedAt.slice(0, 10),
      datePrecision: 'as_of',
      label: feature.attributes.name,
      sourceTitle: SOURCES.arcgis_structures.title,
      sourceUrl: SOURCES.arcgis_structures.url,
      sourceId: 'arcgis_structures',
      quote: feature.attributes.status,
    });
  }
  if (!contextProject) {
    if (feature.attributes.status === 'Completed') completedStructures += 1;
    else inProgressStructures += 1;
  }
}
for (const segment of segments) {
  segment.currentStatus = resolveSegmentStatus(
    segment,
    metadata.fetchedAt,
    { completion: segment.completion },
  ).status;
}
if (completedStructures !== 59 || inProgressStructures !== 27) {
  throw new Error(
    `Structure status count changed after excluding reviewed context projects ${Object.keys(CONTEXT_PROJECTS).join(', ')}: ${completedStructures} completed + ${inProgressStructures} in progress`,
  );
}

const calibration = assignWeights(segments);

// Overlap invariant. CP1 publishes structure rows nested inside the guideway
// rows they sit on, so those miles are counted twice by the difficulty model.
// Every overlap must be exactly one guideway containing one structure; anything
// else means the milepost projection has drifted.
const overlaps: SegmentsArtifact['overlaps'] = [];
for (const cp of ['CP1', 'CP2-3', 'CP4'] as const) {
  const cpSegments = segments.filter((segment) => segment.cp === cp);
  let cpOverlaps = 0;
  for (let left = 0; left < cpSegments.length; left += 1) {
    for (let right = left + 1; right < cpSegments.length; right += 1) {
      const first = cpSegments[left];
      const second = cpSegments[right];
      const miles = Math.min(first.iosMileEnd, second.iosMileEnd) - Math.max(first.iosMileStart, second.iosMileStart);
      if (miles <= 0.001) continue;
      const guidewaySegment = first.kind === 'guideway' ? first : second.kind === 'guideway' ? second : null;
      const structureSegment = first.kind === 'structure' ? first : second.kind === 'structure' ? second : null;
      if (!guidewaySegment || !structureSegment) {
        throw new Error(`${cp}: ${first.id} (${first.kind}) and ${second.id} (${second.kind}) overlap by ${miles.toFixed(3)} mi without being a guideway containing a structure`);
      }
      if (structureSegment.iosMileStart < guidewaySegment.iosMileStart - 0.001
        || structureSegment.iosMileEnd > guidewaySegment.iosMileEnd + 0.001) {
        throw new Error(`${cp}: structure ${structureSegment.id} is not contained by guideway ${guidewaySegment.id}`);
      }
      cpOverlaps += 1;
      overlaps.push({ guidewayId: guidewaySegment.id, structureId: structureSegment.id, miles });
    }
  }
  if (cp === 'CP2-3' && cpOverlaps > 0) throw new Error(`CP2-3 must tile without overlap; found ${cpOverlaps}`);
}
const overlapMiles = overlaps.reduce((sum, overlap) => sum + overlap.miles, 0);
if (!(overlapMiles < 3)) throw new Error(`Nested structure corridor ${overlapMiles.toFixed(2)} mi exceeds the 3 mi ceiling`);

// Per-package cross-check against the latest published CVSR. Earthwork-equivalent
// miles (Σ span × ArcGIS completion) and the CVSR's "guideway miles complete"
// are independent measures of the same thing, so they must land close; a strict
// 100%-complete count is not the same measure and would be vacuous here.
const CVSR_PACKAGE_IDS = ['CP1', 'CP2-3', 'CP4'] as const satisfies readonly CvsrPackageId[];
const equivalentByPackage = Object.fromEntries(CVSR_PACKAGE_IDS.map((cp) => [
  cp,
  segments
    .filter((segment) => segment.cp === cp && segment.kind === 'guideway')
    .reduce((sum, segment) => sum + (segment.iosMileEnd - segment.iosMileStart) * (segment.completion ?? 0), 0),
])) as Record<CvsrPackageId, number>;
const equivalentTotal = CVSR_PACKAGE_IDS.reduce((sum, cp) => sum + equivalentByPackage[cp], 0);

const parsedSnapshotsRaw = await readFile('data/raw/cvsr/parsed-snapshots.json', 'utf8').catch(
  (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  },
);
let crossCheck: SegmentsArtifact['crossCheck'];
if (parsedSnapshotsRaw === null) {
  console.warn('data/raw/cvsr/parsed-snapshots.json absent; skipping the per-package CVSR cross-check');
} else {
  const parsed = JSON.parse(parsedSnapshotsRaw) as { snapshots?: Snapshot[] };
  const allSnapshots = parsed.snapshots ?? [];
  const latest = allSnapshots
    .filter((snapshot) => snapshot.tier === 2 && snapshot.perPackage !== undefined)
    .sort((a, b) => a.dataMonth!.localeCompare(b.dataMonth!))
    .at(-1);
  if (!latest) throw new Error('parsed-snapshots.json holds no tier-2 CVSR snapshot with package metrics');
  const perPackage = {} as NonNullable<SegmentsArtifact['crossCheck']>['perPackage'];
  for (const cp of CVSR_PACKAGE_IDS) {
    const metrics = latest.perPackage?.[cp];
    if (!metrics) throw new Error(`CVSR ${latest.dataMonth} is missing ${cp} package metrics`);
    const delta = equivalentByPackage[cp] - metrics.guidewayMilesComplete;
    if (Math.abs(delta) > 1.5) {
      throw new Error(`${cp} earthwork-equivalent ${equivalentByPackage[cp].toFixed(2)} mi differs from CVSR ${latest.dataMonth} guideway complete ${metrics.guidewayMilesComplete} mi by ${delta.toFixed(2)} mi`);
    }
    perPackage[cp] = {
      equivalentMiles: equivalentByPackage[cp],
      cvsrMilesComplete: metrics.guidewayMilesComplete,
      cvsrMilesTotal: metrics.guidewayMilesTotal,
    };
  }
  const cvsrTotalComplete = CVSR_PACKAGE_IDS.reduce((sum, cp) => sum + perPackage[cp].cvsrMilesComplete, 0);
  if (Math.abs(equivalentTotal - cvsrTotalComplete) > 2) {
    throw new Error(`Earthwork-equivalent ${equivalentTotal.toFixed(2)} mi does not reconcile with CVSR ${latest.dataMonth} total ${cvsrTotalComplete.toFixed(2)} mi`);
  }

  const unmatchedCvsrRows = latest.unmatchedCvsrRows ?? [];
  const disagreements: NonNullable<SegmentsArtifact['crossCheck']>['disagreements'] = [];
  const arcgisCompletion = new Map(segments.map((segment) => [segment.id, segment.completion]));
  for (const evidence of allSnapshots.flatMap((snapshot) => snapshot.structureEvidence ?? [])) {
    if (evidenceIds.has(evidence.id)) continue;
    const segment = segments.find((candidate) => candidate.id === evidence.segmentId);
    if (!segment) throw new Error(`CVSR evidence ${evidence.id} has no segment ${evidence.segmentId}`);
    segment.evidence.push(evidence);
    evidenceIds.add(evidence.id);
  }
  for (const [segmentId, observation] of Object.entries(latest.perSegment ?? {})) {
    const segment = segments.find((candidate) => candidate.id === segmentId);
    if (!segment) throw new Error(`CVSR observation has no segment ${segmentId}`);
    const arcgis = arcgisCompletion.get(segmentId);
    if (
      typeof arcgis === 'number'
      && typeof observation.completion === 'number'
      && Math.abs(arcgis - observation.completion) > 0.005
    ) {
      disagreements.push({
        segmentId,
        arcgis,
        cvsr: observation.completion,
        cvsrMonth: latest.dataMonth!,
        reportFile: observation.reportFile!,
      });
    }
    segment.completion = observation.completion;
    segment.sourceId = observation.sourceId;
    segment.currentStatus = resolveSegmentStatus(segment, metadata.fetchedAt, observation).status;
  }
  const structureIds = new Set(segments.filter((segment) => segment.kind === 'structure').map((segment) => segment.id));
  const crosswalkIds = new Set(Object.values(CVSR_ROW_CROSSWALK));
  if (structureIds.size !== 35 || crosswalkIds.size !== 35 || [...structureIds].some((id) => !crosswalkIds.has(id))) {
    throw new Error(`CVSR structure crosswalk does not cover all ${structureIds.size} structure segments`);
  }
  const matchedGuideways = Object.keys(latest.perSegment ?? {}).filter(
    (id) => segments.find((segment) => segment.id === id)?.kind === 'guideway',
  ).length;
  if (matchedGuideways !== 49) throw new Error(`Expected 49 exact-label CVSR guideway matches, received ${matchedGuideways}`);
  if (unmatchedCvsrRows.length !== 68) throw new Error(`Expected 68 unmatched CVSR rows, received ${unmatchedCvsrRows.length}`);
  if (disagreements.length !== 6) throw new Error(`Expected 6 ArcGIS/CVSR disagreements, received ${disagreements.length}`);
  crossCheck = { cvsrDataMonth: latest.dataMonth!, perPackage, unmatchedCvsrRows, disagreements };
  console.log(`cross-check vs CVSR ${latest.dataMonth}: 35/35 structures, ${matchedGuideways} guideways, ${unmatchedCvsrRows.length} unmatched rows, ${disagreements.length} disagreements`);
}

const artifact: SegmentsArtifact = {
  generatedAt: metadata.fetchedAt,
  model: 'Package and extension totals are published contract values; the structure/guideway split and structure type factors are editorial with no published basis',
  calibration,
  ...(crossCheck ? { crossCheck } : {}),
  overlaps,
  segments,
};
await writeFile('public/data/segments.json', `${JSON.stringify(artifact)}\n`);

const geojson = {
  type: 'FeatureCollection',
  features: segments.map((segment) => {
    const from = iosMileToGeodesicDistance(segment.iosMileStart);
    const to = iosMileToGeodesicDistance(segment.iosMileEnd);
    const geometry = lineSliceAlong(centerline, Math.max(0, from), Math.min(cumulative.at(-1)!, to), { units: 'miles' }).geometry;
    return {
      type: 'Feature',
      id: segment.id,
      properties: { id: segment.id, cp: segment.cp, status: segment.currentStatus, sourceId: segment.sourceId },
      geometry,
    };
  }),
};
await writeFile('public/data/segments.geojson', `${JSON.stringify(geojson)}\n`);

const cp1Gaps = segments.filter((segment) => segment.cp === 'CP1' && segment.kind === 'no-data');
const largeHole = cp1Gaps.find((segment) => segment.iosMileEnd - segment.iosMileStart > 1.5);
if (!largeHole) throw new Error('CP1 expected ~2-mile no-data hole was not emitted');
const coveredMiles = (['CP1', 'CP2-3', 'CP4'] as const).reduce((sum, cp) => {
  const cpSegments = segments.filter((segment) => segment.cp === cp && segment.kind !== 'no-data');
  const intervals = cpSegments.map((segment) => [segment.iosMileStart, segment.iosMileEnd] as [number, number]).sort((a, b) => a[0] - b[0]);
  let cpTotal = 0;
  let cursor = intervals[0][0];
  let end = intervals[0][1];
  for (const interval of intervals.slice(1)) {
    if (interval[0] > end) {
      cpTotal += end - cursor;
      cursor = interval[0];
      end = interval[1];
    } else end = Math.max(end, interval[1]);
  }
  return sum + cpTotal + end - cursor;
}, 0);
const inputGeometryMiles = progress.features.reduce(
  (sum, feature) => sum + feature.geometry.paths.reduce(
    (pathSum, path) => path.length < 2 ? pathSum : pathSum + length(lineString(path), { units: 'miles' }),
    0,
  ),
  0,
);
if (!(inputGeometryMiles > 118 && inputGeometryMiles < 119.5)) {
  throw new Error(`Input guideway geometry ${inputGeometryMiles.toFixed(2)} mi outside 118–119.5`);
}

const completeByPackage: Partial<Record<ConstructionPackage, number>> = {};
for (const cp of ['CP1', 'CP2-3', 'CP4'] as const) {
  completeByPackage[cp] = segments
    .filter((segment) => segment.cp === cp && segment.kind === 'guideway' && segment.completion === 1)
    .reduce((sum, segment) => sum + segment.iosMileEnd - segment.iosMileStart, 0);
}
const totalComplete = Object.values(completeByPackage).reduce((sum, value) => sum + value, 0);
console.log(`segments: 102 inputs → ${segments.length} outputs; CP1 no-data gaps: ${cp1Gaps.length}`);
console.log(`coverage: ${coveredMiles.toFixed(2)} mi; strict 100% guideway ${JSON.stringify(completeByPackage)} = ${totalComplete.toFixed(1)} mi`);
console.log(`overlaps: ${overlaps.length} nested structure/guideway pairs totalling ${overlapMiles.toFixed(2)} mi of double-counted corridor`);
console.log(`structures: ${completedStructures} completed + ${inProgressStructures} in progress`);
