import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CVSR_GUIDEWAY_CROSSWALK, NAMED_STRUCTURE_CVSR_ROWS } from './cvsr-row-crosswalk';
import { STRUCTURE_CROSSWALK } from './structure-evidence';

type ProgressAttributes = { OBJECTID: number; Section: string; Station: number; StationEnd: number };

const progressLayer = JSON.parse(readFileSync('data/raw/arcgis/progress.json', 'utf8')) as {
  features: Array<{ attributes: ProgressAttributes }>;
};
const structuresLayer = JSON.parse(readFileSync('data/raw/arcgis/structures.json', 'utf8')) as {
  features: Array<{ attributes: { GlobalID: string } }>;
};
const progress = progressLayer.features.map((feature) => feature.attributes);
const structures = structuresLayer.features.map((feature) => feature.attributes);

function byObjectId(objectId: number): ProgressAttributes {
  const found = progress.find((attributes) => attributes.OBJECTID === objectId);
  assert.ok(found, `progress layer has no OBJECTID ${objectId}`);
  return found;
}

/** Station length in miles; `CP1:gap:1` is the unpublished stretch between OBJECTID 195 and 182. */
function stationMiles(segmentId: string): number {
  if (segmentId === 'CP1:gap:1') return (byObjectId(182).Station - byObjectId(195).StationEnd) / 5280;
  const match = /^CP1:(\d+)$/.exec(segmentId);
  assert.ok(match, `unexpected segment id ${segmentId}`);
  const attributes = byObjectId(Number(match[1]));
  assert.equal(attributes.Section, 'CP1');
  return (attributes.StationEnd - attributes.Station) / 5280;
}

test('each paired CP1 guideway row spans the station length of its segments', () => {
  for (const [label, { segmentIds, miles }] of Object.entries(CVSR_GUIDEWAY_CROSSWALK)) {
    const sum = segmentIds.reduce((total, segmentId) => total + stationMiles(segmentId), 0);
    assert.ok(Math.abs(sum - miles) <= 0.15, `${label}: report prints ${miles} mi, segments span ${sum.toFixed(3)} mi`);
  }
});

test('no segment is claimed by two guideway rows', () => {
  const claimed = Object.values(CVSR_GUIDEWAY_CROSSWALK).flatMap((entry) => entry.segmentIds);
  assert.equal(new Set(claimed).size, claimed.length);
});

test('named-structure pairings key on ArcGIS GlobalIDs that are not strip segments', () => {
  const globalIds = new Set(structures.map((attributes) => attributes.GlobalID.toLowerCase()));
  for (const globalId of Object.keys(NAMED_STRUCTURE_CVSR_ROWS)) {
    assert.ok(globalIds.has(globalId), `${globalId} is not a structures-layer GlobalID`);
    assert.equal(STRUCTURE_CROSSWALK[globalId], undefined, `${globalId} already resolves through STRUCTURE_CROSSWALK`);
  }
});
