import type { SourceId } from './sources';

export type ConstructionPackage = 'M2M' | 'CP1' | 'CP2-3' | 'CP4' | 'LGA';
export type AlignmentStatus =
  | 'not_started'
  | 'no_data'
  | 'preconstruction'
  | 'under_construction'
  | 'guideway_complete'
  | 'track_laid'
  | 'systems_installed';

export type NamedStructure = {
  name: string;
  status: 'Completed' | 'In progress';
  url: string;
  sourceId: 'arcgis_structures';
  locationMethod: 'spatial' | 'package-only';
};

export type Segment = {
  id: string;
  cp: ConstructionPackage;
  kind: 'guideway' | 'structure' | 'no-data';
  label: string;
  iosMileStart: number;
  iosMileEnd: number;
  officialMpStart: string;
  officialMpEnd: string;
  stationStart: number | null;
  stationEnd: number | null;
  stationing: 'published' | 'inferred';
  completion: number | null;
  baselineDirt: number | null;
  deliveredDirt: number | null;
  start: string | null;
  finish: string | null;
  weight: number;
  weightShare: number;
  currentStatus: AlignmentStatus;
  structures: NamedStructure[];
  sourceId: SourceId;
};

export type Calibration = {
  contractAmountMillions: number;
  publishedMiles: number;
  publishedStructures: number;
  modelledStructureShare: number;
  structureScale: number;
};

export type SegmentsArtifact = {
  generatedAt: string;
  model: string;
  calibration: Partial<Record<ConstructionPackage, Calibration>>;
  segments: Segment[];
};

export type PackageMetrics = {
  structuresComplete: number;
  structuresTotal: number;
  guidewayMilesComplete: number;
  guidewayMilesTotal: number;
  utilitiesRelocated?: number;
  utilitiesTotal?: number;
  parcelsDelivered?: number;
  parcelsTotal?: number;
  sourceId: SourceId;
};

export type Snapshot = {
  date: string;
  tier: 1 | 2 | 3;
  sourceId: SourceId;
  reportFile?: string;
  perSegment?: Record<string, { completion: number | null }>;
  perPackage?: Partial<Record<'CP1' | 'CP2-3' | 'CP4', PackageMetrics>>;
  aggregate?: {
    utilitiesRelocated: number;
    utilitiesTotal: number;
    parcelsDelivered: number;
    parcelsTotal: number;
  };
};

export type HistoryArtifact = {
  generatedAt: string;
  snapshots: Snapshot[];
};
