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
  locationMethod: 'crosswalk' | 'spatial' | 'package-only' | 'reviewed-context';
  contextScope?: 'enabling-works' | 'third-party';
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

export type SegmentObservation = {
  completion: number | null;
  sourceId: 'arcgis_progress' | 'cvsr';
  reportFile?: string;
  reportUrl?: string;
  dataMonth?: string;
  scheduleStart?: string;
  scheduleFinish?: string;
  table?: 'underway' | 'completed';
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
  coveringCvsrRows?: string[];
  sourceId: SourceId;
};

export type Calibration = {
  contractAmountMillions: number;
  publishedMiles: number;
  publishedStructures: number;
  modelledStructureShare: number;
  structurePerGuidewayScale: number;
};

export type CvsrPackageId = 'CP1' | 'CP2-3' | 'CP4';

export type SegmentsArtifact = {
  generatedAt: string;
  model: string;
  calibration: Partial<Record<ConstructionPackage, Calibration>>;
  crossCheck?: {
    cvsrDataMonth: string;
    perPackage: Record<CvsrPackageId, {
      equivalentMiles: number;
      cvsrMilesComplete: number;
      cvsrMilesTotal: number;
    }>;
    unmatchedCvsrRows: Array<{ cp: CvsrPackageId; kind: 'structure' | 'guideway'; location: string }>;
    disagreements: Array<{
      segmentId: string;
      arcgis: number;
      cvsr: number;
      cvsrMonth: string;
      reportFile: string;
    }>;
  };
  overlaps: Array<{ guidewayId: string; structureId: string; miles: number }>;
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
  parcelsAcquired?: number;
  parcelsAcquisitionTotal?: number;
  parcelAcquisitionAsOf?: string;
  railroadParcelsAcquired?: number;
  railroadParcelsTotal?: number;
  acquisitionAudit?: {
    totalNeeded: number;
    priorAcquired: number;
    modifications: number;
    acquired: number;
    remaining: number;
    asOf: string;
  };
  /** Fields hand-transcribed from a chart image because the PDF exposes no extractable text for them. */
  transcribedFields?: Array<'progress' | 'parcels'>;
  sourceId: SourceId;
};

type SnapshotFields = {
  sourceId: SourceId;
  reportFile?: string;
  perSegment?: Record<string, SegmentObservation>;
  structureEvidence?: StructureEvidence[];
  unmatchedCvsrRows?: Array<{ cp: CvsrPackageId; kind: 'structure' | 'guideway'; location: string }>;
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
  tier: 3;
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
  | 'related_measure_only'
  | 'parser_failure';

export type CvsrGap = {
  month: string;
  metric: 'snapshot' | 'utilities' | 'parcels' | 'parcel_delivery';
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
  /** Hand-transcribed package values, recorded because the PDF exposes no extractable text for them. */
  transcriptions: Array<{
    month: string;
    reportFile: string;
    fields: Array<'progress' | 'parcels'>;
    detail: string;
  }>;
  /** Package values the Authority later restated. The superseded month keeps its published value. */
  revisions: Array<{
    month: string;
    metric: 'progress' | 'parcels' | 'utilities';
    packages: Array<'CP1' | 'CP2-3' | 'CP4'>;
    correctedIn: string;
    reportFile: string;
    detail: string;
  }>;
  /** Local report filenames with no byte-verified direct PDF URL. */
  unresolvedReportUrls: string[];
};

export type ReplayProvenance = 'scheduled' | 'observed' | 'mixed';

export type HistoryArtifact = {
  generatedAt: string;
  /** Every scrubbable month as YYYY-MM-01, independent of whether any snapshot exists for it. */
  replayMonths: string[];
  snapshots: Snapshot[];
  cvsrInventory: CvsrInventory;
};
