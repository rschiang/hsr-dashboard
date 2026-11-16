import assert from 'node:assert/strict';
import test from 'node:test';
import { sameArcgisPayload } from './arcgis-payload';

function payload(latitude: number, completion = '21%') {
  return {
    features: [
      {
        attributes: { OBJECTID: 128, Completion: completion },
        geometry: { paths: [[[-119.6543210987654, latitude], [-119.65, 36.87]]] },
      },
    ],
  };
}

test('last-digit coordinate noise is the same payload', () => {
  assert.equal(sameArcgisPayload(payload(36.8652918969205), payload(36.8652918969206)), true);
});

test('a coordinate that moved is a different payload', () => {
  assert.equal(sameArcgisPayload(payload(36.865291), payload(36.865292)), false);
});

test('an attribute change is a different payload', () => {
  assert.equal(sameArcgisPayload(payload(36.8652918969205, '21%'), payload(36.8652918969205, '22%')), false);
});
