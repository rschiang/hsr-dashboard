import { readFile, writeFile, mkdir } from 'node:fs/promises';
import length from '@turf/length';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineString, point, type Position } from '@turf/helpers';
import { assertMilepostModel, stationToIosMile } from '../src/lib/mileposts';

type Vertex = [number, number, number | null];
type ArcFeature = {
  attributes: { Section: 'M2M' | 'CP1' | 'CP2-3' | 'CP4' | 'LGA' };
  geometry: { paths: Vertex[][] };
};
type ArcResponse = { features: ArcFeature[] };

const SECTION_SPANS: Record<ArcFeature['attributes']['Section'], [number, number]> = {
  M2M: [0, 34],
  CP1: [34, 65],
  'CP2-3': [65, 131],
  CP4: [131, 152],
  LGA: [152, 175],
};

function haversineMiles(a: Position, b: Position): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(h));
}

function cumulativeMiles(vertices: Vertex[]): number[] {
  const result = [0];
  for (let index = 1; index < vertices.length; index += 1) {
    result.push(result[index - 1] + haversineMiles(vertices[index - 1], vertices[index]));
  }
  return result;
}

function distribute(vertices: Vertex[], start: number, end: number): number[] {
  const cumulative = cumulativeMiles(vertices);
  const total = cumulative.at(-1) ?? 0;
  if (total === 0) throw new Error('Cannot distribute mileposts over zero-length geometry');
  return cumulative.map((distance) => start + (distance / total) * (end - start));
}

function interpolateMissing(values: number[]): number[] {
  const result = [...values];
  for (let index = 0; index < result.length; index += 1) {
    if (Number.isFinite(result[index])) continue;
    let before = index - 1;
    let after = index + 1;
    while (before >= 0 && !Number.isFinite(result[before])) before -= 1;
    while (after < result.length && !Number.isFinite(result[after])) after += 1;
    if (before < 0 || after >= result.length) throw new Error('Unbracketed stationing gap');
    const fraction = (index - before) / (after - before);
    result[index] = result[before] + fraction * (result[after] - result[before]);
  }
  return result;
}


assertMilepostModel();
const raw = JSON.parse(await readFile('data/raw/arcgis/alignment.json', 'utf8')) as ArcResponse;
if (raw.features.length !== 5) throw new Error(`Expected 5 alignment features, received ${raw.features.length}`);
const bySection = Object.fromEntries(raw.features.map((feature) => [feature.attributes.Section, feature])) as Record<ArcFeature['attributes']['Section'], ArcFeature>;

const m2mPaths = bySection.M2M.geometry.paths;
if (m2mPaths.length !== 2) throw new Error(`Expected two M2M paths, received ${m2mPaths.length}`);
const maxFirstM = Math.max(...m2mPaths[0].map((vertex) => vertex[2]).filter((m): m is number => Number.isFinite(m)));
const secondUnique = m2mPaths[1].filter((vertex) => vertex[2] !== null && vertex[2] > maxFirstM);
if (secondUnique.length === 0) throw new Error('M2M M-value deduplication removed its second path');
const m2mUntrimmed = [...m2mPaths[0], ...secondUnique];
const mercedStation: Position = [-120.4913, 37.3019];
let mercedVertexIndex = 0;
let mercedVertexDistance = Number.POSITIVE_INFINITY;
for (let index = 0; index < m2mUntrimmed.length; index += 1) {
  const distance = haversineMiles(mercedStation, m2mUntrimmed[index]);
  if (distance < mercedVertexDistance) {
    mercedVertexIndex = index;
    mercedVertexDistance = distance;
  }
}
const m2m = m2mUntrimmed.slice(mercedVertexIndex);

const sectionVertices: Record<ArcFeature['attributes']['Section'], Vertex[]> = {
  M2M: m2m,
  CP1: bySection.CP1.geometry.paths[0],
  'CP2-3': bySection['CP2-3'].geometry.paths[0],
  CP4: bySection.CP4.geometry.paths[0],
  LGA: bySection.LGA.geometry.paths[0],
};

const order: ArcFeature['attributes']['Section'][] = ['M2M', 'CP1', 'CP2-3', 'CP4', 'LGA'];
for (let index = 1; index < order.length; index += 1) {
  const north = order[index - 1];
  const south = order[index];
  const gap = haversineMiles(sectionVertices[north].at(-1)!, sectionVertices[south][0]);
  const limit = north === 'M2M' ? 1 : 0.01;
  if (gap >= limit) throw new Error(`${north}→${south} joint gap is ${gap.toFixed(3)} mi; expected < ${limit}`);
  console.log(`${north}→${south} joint gap: ${gap.toFixed(4)} mi`);
}

const sectionMileposts: Record<ArcFeature['attributes']['Section'], number[]> = {
  M2M: distribute(sectionVertices.M2M, ...SECTION_SPANS.M2M),
  CP1: interpolateMissing(sectionVertices.CP1.map((vertex) => vertex[2] === null ? Number.NaN : stationToIosMile('CP1', vertex[2]))),
  'CP2-3': interpolateMissing(sectionVertices['CP2-3'].map((vertex) => vertex[2] === null ? Number.NaN : stationToIosMile('CP2-3', vertex[2]))),
  CP4: distribute(sectionVertices.CP4, ...SECTION_SPANS.CP4),
  LGA: distribute(sectionVertices.LGA, ...SECTION_SPANS.LGA),
};

const coordinates: Position[] = [];
const iosMiles: number[] = [];
for (const section of order) {
  const vertices = sectionVertices[section];
  const miles = sectionMileposts[section];
  const skipFirst = coordinates.length > 0 && haversineMiles(coordinates.at(-1)!, vertices[0]) < 0.0001;
  for (let index = skipFirst ? 1 : 0; index < vertices.length; index += 1) {
    coordinates.push([vertices[index][0], vertices[index][1]]);
    iosMiles.push(miles[index]);
  }
}

for (let index = 1; index < iosMiles.length; index += 1) {
  if (iosMiles[index] + 0.001 < iosMiles[index - 1]) {
    throw new Error(`Non-monotonic iosMile at vertex ${index}: ${iosMiles[index - 1]} → ${iosMiles[index]}`);
  }
}
const centerline = lineString(coordinates, {
  name: 'CAHSR Merced–Oswell TS1 alignment',
  sourceId: 'arcgis_alignment',
  milepostSourceId: 'ts1_alignment',
});
const geometryMiles = length(centerline, { units: 'miles' });
if (!(geometryMiles > 174 && geometryMiles < 175.5)) {
  throw new Error(`Assembled geometry length ${geometryMiles.toFixed(3)} mi is outside 174.0–175.5`);
}

const anchors = [
  { name: 'Downtown Merced', coordinate: [-120.4913, 37.3019] as Position, min: 0, max: 1 },
  { name: 'Bakersfield – F Street', coordinate: [-119.0236, 35.3913] as Position, min: 170.5, max: 171.5 },
];
for (const anchor of anchors) {
  const snap = nearestPointOnLine(centerline, point(anchor.coordinate), { units: 'miles' });
  const distance = snap.properties.totalDistance;
  if (typeof distance !== 'number' || distance < anchor.min || distance > anchor.max) {
    throw new Error(`${anchor.name} snapped to ${String(distance)} mi; expected ${anchor.min}–${anchor.max}`);
  }
  console.log(`${anchor.name} geodesic snap: ${distance.toFixed(2)} mi`);
}

await mkdir('public/data', { recursive: true });
await writeFile('public/data/centerline.geojson', `${JSON.stringify(centerline)}\n`);
await writeFile('public/data/mileposts.json', `${JSON.stringify({ iosMiles, sourceId: 'ts1_alignment' })}\n`);
console.log(`centerline: ${coordinates.length} vertices, ${geometryMiles.toFixed(2)} geodesic miles`);
