import type { Calibration, ConstructionPackage, Segment } from '../data/types';

/**
 * UNOFFICIAL HEURISTIC — NOT A CAHSRA METHODOLOGY. No published CAHSRA,
 * FRA, State Auditor, or OIG source assigns relative difficulty factors to
 * individual structures, and CAHSRA does not publish per-structure costs.
 * These editorial factors only distribute each package's published contract
 * total; changing them does not change any official source value.
 */
export const STRUCTURE_TYPE_FACTORS = {
  viaduct: 12,
  trench: 10,
  'tied arch': 8,
  'river bridge': 8,
  bridge: 6,
  underpass: 4,
  overcrossing: 4,
  overhead: 4,
  'grade separation': 4,
  other: 3,
} as const;

const PACKAGE_INPUTS: Record<'CP1' | 'CP2-3' | 'CP4', {
  contractAmountMillions: number;
  publishedMiles: number;
  publishedStructures: number;
}> = {
  CP1: { contractAmountMillions: 4066.619637, publishedMiles: 32, publishedStructures: 33 },
  'CP2-3': { contractAmountMillions: 3808.462483, publishedMiles: 65, publishedStructures: 48 },
  CP4: { contractAmountMillions: 866.093967, publishedMiles: 21.2, publishedStructures: 11 },
};

const EXTENSION_COSTS: Record<'M2M' | 'LGA', number> = {
  M2M: 3391,
  LGA: 2540,
};

function structureFactor(label: string): number {
  const normalized = label.toLowerCase();
  for (const [phrase, factor] of Object.entries(STRUCTURE_TYPE_FACTORS)) {
    if (phrase !== 'other' && normalized.includes(phrase)) return factor;
  }
  return STRUCTURE_TYPE_FACTORS.other;
}

function median(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function assignWeights(segments: Segment[]): Partial<Record<ConstructionPackage, Calibration>> {
  const rawWeight = new Map<string, number>();
  const calibration: Partial<Record<ConstructionPackage, Calibration>> = {};

  for (const cp of Object.keys(PACKAGE_INPUTS) as Array<keyof typeof PACKAGE_INPUTS>) {
    const packageSegments = segments.filter((segment) => segment.cp === cp);
    const dirtPerMile = packageSegments
      .filter((segment) => segment.kind === 'guideway' && segment.baselineDirt !== null && segment.baselineDirt > 0)
      .map((segment) => segment.baselineDirt! / Math.max(0.001, segment.iosMileEnd - segment.iosMileStart));
    const fallbackDirtPerMile = median(dirtPerMile);

    const guideway = packageSegments.filter((segment) => segment.kind !== 'structure');
    const structures = packageSegments.filter((segment) => segment.kind === 'structure');
    for (const segment of guideway) {
      const miles = Math.max(0.001, segment.iosMileEnd - segment.iosMileStart);
      rawWeight.set(segment.id, segment.baselineDirt ?? fallbackDirtPerMile * miles);
    }
    for (const segment of structures) {
      const miles = Math.max(0.001, segment.iosMileEnd - segment.iosMileStart);
      rawWeight.set(segment.id, miles * structureFactor(segment.label));
    }

    const guidewayRaw = guideway.reduce((sum, segment) => sum + (rawWeight.get(segment.id) ?? 0), 0);
    const structureRaw = structures.reduce((sum, segment) => sum + (rawWeight.get(segment.id) ?? 0), 0);
    const input = PACKAGE_INPUTS[cp];
    const modelledStructureShare = structureRaw > 0
      ? Math.min(0.7, input.publishedStructures / (input.publishedStructures + input.publishedMiles))
      : 0;
    const guidewayScale = guidewayRaw > 0 ? input.contractAmountMillions * (1 - modelledStructureShare) / guidewayRaw : 0;
    const structureScale = structureRaw > 0 ? input.contractAmountMillions * modelledStructureShare / structureRaw : 0;
    for (const segment of guideway) segment.weight = (rawWeight.get(segment.id) ?? 0) * guidewayScale;
    for (const segment of structures) segment.weight = (rawWeight.get(segment.id) ?? 0) * structureScale;

    calibration[cp] = {
      ...input,
      modelledStructureShare,
      structureScale: guidewayScale === 0 ? 0 : structureScale / guidewayScale,
    };
  }

  for (const cp of Object.keys(EXTENSION_COSTS) as Array<keyof typeof EXTENSION_COSTS>) {
    const packageSegments = segments.filter((segment) => segment.cp === cp);
    const totalMiles = packageSegments.reduce((sum, segment) => sum + segment.iosMileEnd - segment.iosMileStart, 0);
    for (const segment of packageSegments) {
      segment.weight = EXTENSION_COSTS[cp] * (segment.iosMileEnd - segment.iosMileStart) / totalMiles;
    }
  }

  const total = segments.reduce((sum, segment) => sum + segment.weight, 0);
  if (!(total > 0)) throw new Error('Difficulty weights sum to zero');
  for (const segment of segments) segment.weightShare = segment.weight / total;
  return calibration;
}
