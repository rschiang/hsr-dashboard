import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCES, type SourceId } from './sources';
import type { ConstructionPackage } from './types';
import {
  ACTIVITY_LABELS,
  DELIVERY_CONTEXT_BY_PACKAGE,
  DELIVERY_PROGRAMS,
  M2M_OPTIONS,
  M2M_SCOPE_NOTES,
  M2M_SECTIONS,
  TRACK_FORECAST,
  TRACK_METRIC,
  TSCC_PACKAGES,
  TSCC_PACKAGE_2_MILESTONES,
  bandLabel,
  type DeliveryFactState,
  type Quarter,
} from './delivery-outlook';

const PACKAGES: readonly ConstructionPackage[] = ['M2M', 'CP1', 'CP2-3', 'CP4', 'LGA'];
const STATES: readonly DeliveryFactState[] = ['reported', 'authorized', 'forecast', 'planned'];

/** Quarters compare as a single ordinal; nothing else in this module does date math. */
function ordinal({ year, quarter }: Quarter): number {
  return year * 4 + quarter;
}

test('M2M sections are ordered north to south and sum to the published 30.3 miles', () => {
  assert.deepEqual(M2M_SECTIONS.map((section) => section.id), ['north', 'wye', 'south']);
  // The raw float sums to 30.299999999999997, so the printed total needs the rounding.
  assert.equal(Number(M2M_SECTIONS.reduce((sum, section) => sum + section.miles, 0).toFixed(1)), 30.3);
  assert.deepEqual(M2M_SECTIONS.map((section) => section.miles), [9.6, 6.1, 14.6]);
  assert.deepEqual(M2M_SECTIONS.map((section) => section.approximate), [false, false, true]);
  assert.deepEqual(M2M_SECTIONS.map((section) => section.tracks), ['single', 'single', 'double']);
});

test('M2M station limits are stored exactly as the RFQ prints them, overlap included', () => {
  assert.deepEqual(
    M2M_SECTIONS.map((section) => [section.stationStart, section.stationEnd]),
    [
      ['8097+00', '8602+12.91'],
      ['8602+2.91', '8924+20'],
      ['8924+20', '9694+71.00'],
    ],
  );
  // The ten-foot North/Wye overlap is the source's, not a typo to normalize.
  assert.notEqual(M2M_SECTIONS[0].stationEnd, M2M_SECTIONS[1].stationStart);
});

test('forecast packages carry the printed mileages, in chart order', () => {
  assert.deepEqual(TRACK_FORECAST.packages.map((entry) => entry.cp), ['CP1', 'CP2-3', 'CP4']);
  assert.deepEqual(TRACK_FORECAST.packages.map((entry) => entry.miles), [31.6, 65.6, 21.1]);
  for (const entry of TRACK_FORECAST.packages) {
    const summed = entry.subSegments.reduce((sum, sub) => sum + sub.miles, 0);
    assert.ok(
      Math.abs(summed - entry.miles) <= 0.05,
      `${entry.cp} sub-segments sum to ${summed}, printed total ${entry.miles}`,
    );
  }
});

test('CP4 has no guideway subgrade band', () => {
  const cp4 = TRACK_FORECAST.packages.find((entry) => entry.cp === 'CP4')!;
  assert.equal(cp4.bands.some((band) => band.activity === 'guideway_subgrade'), false);
});

test('every band closes at or after it opens and has a chart label', () => {
  for (const entry of TRACK_FORECAST.packages) {
    for (const band of entry.bands) {
      assert.ok(
        ordinal(band.end) >= ordinal(band.start),
        `${entry.cp} ${band.activity} ends before it starts`,
      );
      assert.ok(ACTIVITY_LABELS[band.activity].length > 0);
    }
  }
});

test('track-laying bands match the transcribed chart', () => {
  const [cp1, , cp4] = TRACK_FORECAST.packages;
  assert.equal(bandLabel(cp4.bands.find((band) => band.activity === 'track_laying')!), 'Q4 2026 – Q2 2027');
  assert.equal(bandLabel(cp1.bands.find((band) => band.activity === 'track_laying')!), 'Q1 2028 – Q4 2028');
});

test('TSCC packages run 1B through 9 with only 1B and 2 authorized', () => {
  assert.deepEqual(
    TSCC_PACKAGES.map((entry) => entry.label),
    ['Package 1B', 'Package 2', 'Package 3', 'Package 4', 'Package 5', 'Package 6', 'Package 7', 'Package 8', 'Package 9'],
  );
  assert.deepEqual(
    TSCC_PACKAGES.filter((entry) => entry.state === 'authorized').map((entry) => entry.id),
    ['tscc-package-1b', 'tscc-package-2'],
  );
  assert.equal(TSCC_PACKAGES.filter((entry) => entry.state === 'planned').length, 7);
});

test('no fact uses a state outside DeliveryFactState', () => {
  const facts = [
    ...TSCC_PACKAGES,
    ...TSCC_PACKAGE_2_MILESTONES,
    ...DELIVERY_PROGRAMS.flatMap((program) => program.facts),
  ];
  for (const fact of facts) assert.ok(STATES.includes(fact.state), `${fact.id}: ${fact.state}`);
});

test('Package 2 milestones carry exactly the three awarded dates', () => {
  assert.deepEqual(
    TSCC_PACKAGE_2_MILESTONES.map((entry) => entry.timing?.kind === 'date' ? entry.timing.date : undefined),
    ['2026-11-30', '2027-06-14', '2027-10-18'],
  );
});

test('the track metric publishes no number, not a zero', () => {
  assert.equal(TRACK_METRIC.value, '—');
  // Years may contain the digit; a standalone `0` or the word would assert a measured zero.
  assert.equal(/\bzero\b/i.test(TRACK_METRIC.ariaLabel), false);
  assert.equal(/(?<!\d)0(?!\d)/.test(TRACK_METRIC.ariaLabel), false);
});

test('delivery context covers every construction package', () => {
  assert.deepEqual(Object.keys(DELIVERY_CONTEXT_BY_PACKAGE).sort(), [...PACKAGES].sort());
});

test('every sourceId in the module resolves in the registry', () => {
  const ids: SourceId[] = [
    ...M2M_SECTIONS.map((section) => section.sourceId),
    ...M2M_OPTIONS.map((option) => option.sourceId),
    ...M2M_SCOPE_NOTES.map((note) => note.sourceId),
    ...TSCC_PACKAGES.map((entry) => entry.sourceId),
    ...TSCC_PACKAGE_2_MILESTONES.map((entry) => entry.sourceId),
    ...DELIVERY_PROGRAMS.map((program) => program.sourceId),
    ...DELIVERY_PROGRAMS.flatMap((program) => program.facts.map((fact) => fact.sourceId)),
    TRACK_FORECAST.sourceId,
    TRACK_METRIC.sourceId,
    ...PACKAGES.map((cp) => DELIVERY_CONTEXT_BY_PACKAGE[cp].sourceId),
  ];
  for (const id of ids) assert.ok(SOURCES[id] !== undefined, `unregistered source: ${id}`);
});
