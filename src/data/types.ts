import type { SourceId } from './sources';

export type ConstructionPackage = 'M2M' | 'CP1' | 'CP2-3' | 'CP4' | 'LGA';
export type AlignmentStatus =
  | 'not_started'
  | 'no_data'
  | 'preconstruction'
  | 'under_construction'
  | 'structure_complete'
  | 'guideway_complete'
  | 'track_laid'
  | 'systems_installed';

export type NamedStructure = {
  name: string;
  status: 'Completed' | 'In progress';
  url: string;
  sourceId: 'arcgis_structures';
  objectId: number;
  globalId: string;
  observedAt: string;
  locationMethod: 'crosswalk' | 'spatial' | 'package-only';
};

export type StructureEvidence = {
  id: string;
  segmentId: string;
  claim: 'in_progress' | 'substantially_complete' | 'completed';
  date: string;
  datePrecision: 'day' | 'month' | 'as_of';
  label: string;
  sourceTitle: string;
  sourceUrl: string;
  reportFile?: string;
  sourceId: SourceId;
  quote: string;
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
  evidence: StructureEvidence[];
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

type SnapshotFields = {
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

export type Snapshot = SnapshotFields & ({
  date: string;
  tier: 1 | 3;
  dataMonth?: never;
  reportUrl?: never;
} | {
  date: string;
  dataMonth: string;
  tier: 2;
  reportUrl?: string;
  originalReportUrl?: string;
});

export type CvsrGapCause =
  | 'report_not_downloaded'
  | 'report_not_located'
  | 'source_not_reported'
  | 'parser_failure';

export type CvsrGap = {
  month: string;
  metric: 'snapshot' | 'utilities' | 'parcels';
  packages: Array<'CP1' | 'CP2-3' | 'CP4'>;
  cause: CvsrGapCause;
  reportFile?: string;
  reportUrl?: string;
  detail: string;
};

export type CvsrReportDiagnostic = {
  reportFile?: string;
  reportUrl?: string;
  dataMonth?: string;
  reason: string;
};

export type CvsrInventory = {
  coverageStart: string;
  coverageEnd: string;
  expectedMonths: string[];
  availableMonths: string[];
  gaps: CvsrGap[];
  rejectedReports: CvsrReportDiagnostic[];
};

export type ReplayProvenance = 'scheduled' | 'observed' | 'mixed';

export type HistoryArtifact = {
  generatedAt: string;
  snapshots: Snapshot[];
  cvsrInventory: CvsrInventory;
};
