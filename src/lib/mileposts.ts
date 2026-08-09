import {
  BAKERSFIELD_IOS_MILE,
  IOS_AXIS_MILES,
  TS1_SEGMENTS,
  type Subdivision,
  type Ts1Section,
} from '../data/ts1-alignment';

const MP_ORIGIN = 124;

function officialMpToIosMile(subdivision: Subdivision, mp: number): number {
  if (subdivision === 'D') return BAKERSFIELD_IOS_MILE + (mp - 295);
  return mp - MP_ORIGIN;
}

/** Converts engineering stationing only within a published TS1 datum row. */
export function stationToIosMile(section: Ts1Section, station: number): number {
  const candidates = TS1_SEGMENTS.filter((segment) => segment.section === section);
  for (const segment of candidates) {
    const low = Math.min(segment.startSta, segment.endSta);
    const high = Math.max(segment.startSta, segment.endSta);
    if (station < low - 0.01 || station > high + 0.01) continue;

    const stationSpan = segment.endSta - segment.startSta;
    if (stationSpan === 0) return Number.NaN;
    const fraction = (station - segment.startSta) / stationSpan;
    const start = officialMpToIosMile(segment.subdivision, segment.startMp);
    const end = officialMpToIosMile(segment.subdivision, segment.endMp);
    return start + fraction * (end - start);
  }
  return Number.NaN;
}

export function iosMileToOfficialMp(iosMile: number): {
  subdivision: Subdivision;
  mp: number;
} {
  if (!Number.isFinite(iosMile) || iosMile < 0 || iosMile > IOS_AXIS_MILES) {
    return { subdivision: 'C', mp: Number.NaN };
  }
  if (iosMile <= 20) return { subdivision: 'C', mp: 124 + iosMile };
  if (iosMile <= BAKERSFIELD_IOS_MILE) return { subdivision: 'S', mp: 124 + iosMile };
  return { subdivision: 'D', mp: 295 + iosMile - BAKERSFIELD_IOS_MILE };
}

export function formatOfficialMp(iosMile: number): string {
  const { subdivision, mp } = iosMileToOfficialMp(iosMile);
  if (!Number.isFinite(mp)) return '—';
  const rounded = Math.round(mp * 10) / 10;
  return `${subdivision} ${rounded}`;
}

export function assertMilepostModel(): void {
  const close = (actual: number, expected: number, tolerance = 0.1) => {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Milepost assertion failed: expected ${expected}, got ${actual}`);
    }
  };

  close(stationToIosMile('CP1', 962039.57), 34);
  close(stationToIosMile('CP2-3', 58730.67), 65);
  close(stationToIosMile('CP4', 1476922.54), 131);

  const merced = iosMileToOfficialMp(0);
  const bakersfield = iosMileToOfficialMp(171);
  const oswell = iosMileToOfficialMp(175);
  if (merced.subdivision !== 'C' || merced.mp !== 124) throw new Error('Merced must be C 124');
  if (bakersfield.subdivision !== 'S' || bakersfield.mp !== 295) throw new Error('Bakersfield must be S 295');
  if (oswell.subdivision !== 'D' || oswell.mp !== 299) throw new Error('Oswell must be D 299');

  const publishedTotals: Record<string, number> = {
    'Merced to Madera': 33,
    CP1: 32,
    'CP2-3': 65,
    CP4: 21,
    'Poplar Ave to Bakersfield': 23,
  };
  const totals = new Map<string, number>();
  for (const row of TS1_SEGMENTS) {
    const group = row.section === 'CVY' ? 'Merced to Madera' : row.section;
    totals.set(group, (totals.get(group) ?? 0) + row.lengthMi);
  }
  for (const [section, expected] of Object.entries(publishedTotals)) {
    close(totals.get(section) ?? 0, expected, 1);
  }
}
