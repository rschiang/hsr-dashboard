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
  /** Who published the station range. Never overwritten by a completion observation. */
  stationSourceId: SourceId;
  /** Who published the earthwork completion currently on the segment. */
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
      reportUrl: string;
    }>;
  };
  stations: Array<{
    /** Display label on the strip axis. */
    label: string;
    /** ArcGIS `Stat_Name`, verbatim. */
    officialName: string;
    /** ArcGIS `X_Streets`, verbatim; empty string when the layer leaves it blank. */
    crossStreets: string;
    iosMile: number;
    officialMp: string;
    /** Perpendicular distance from the published point to the centerline, miles. */
    offsetMi: number;
    /** Length of the centerline chord the point projects onto, miles. */
    chordMi: number;
  }>;
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
  /** Overrides TRANSCRIPTION_DETAIL when the transcribed value came from a later report. */
  transcriptionDetail?: string;
  /**
   * Fields carried from an earlier report because this report pins the program total
   * that produced them, leaving the split determined rather than assumed.
   */
  derivedFields?: Array<'parcels'>;
  /** What pins a derived field, and to which report it is pinned. */
  derivationDetail?: string;
  sourceId: SourceId;
};

type SnapshotFields = {
  sourceId: SourceId;
  reportFile?: string;
  perSegment?: Record<string, SegmentObservation>;
  structureEvidence?: StructureEvidence[];
  unmatchedCvsrRows?: Array<{ cp: CvsrPackageId; kind: 'structure' | 'guideway'; location: string }>;
  perPackage?: Partial<Record<'CP1' | 'CP2-3' | 'CP4', PackageMetrics>>;
  /** Values the report prints for CP 1-4 as a program total, never a sum of packages. */
  program?: {
    parcelsDelivered?: number;
    parcelsTotal?: number;
  };
};

export type Snapshot = SnapshotFields & ({
  date: string;
  dataMonth: string;
  tier: 1;
  reportUrl?: string;
  originalReportUrl?: string;
} | {
  /** The poll day, `polledAt` truncated; the key every replay comparison uses. */
  date: string;
  tier: 2;
  /**
   * When the ArcGIS feature services were polled. They expose only their current
   * state, so a tier-2 snapshot claims nothing beyond "this is what the server
   * returned at this instant". Polls are sparse and irregular, and no value is
   * ever carried forward between them.
   */
  polledAt: string;
  dataMonth?: never;
  reportUrl?: never;
});

export type CvsrGapCause =
  | 'report_not_downloaded'
  | 'report_not_located'
  | 'source_not_reported'
  | 'related_measure_only'
  | 'total_not_reported'
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
  /** Package values determined by a published program total rather than reprinted by the report. */
  derivations: Array<{
    month: string;
    reportFile: string;
    fields: Array<'parcels'>;
    detail: string;
  }>;
  /** Package values the Authority later restated. The superseded month keeps its published value. */
  revisions: Array<{
    month: string;
    metric: 'progress' | 'parcels' | 'utilities';
    packages: Array<'CP1' | 'CP2-3' | 'CP4'>;
    correctedIn: string;
    reportFile: string;
    reportUrl?: string;
    detail: string;
  }>;
  /** Local report filenames with no byte-verified direct PDF URL. */
  unresolvedReportUrls: string[];
};

export type HistoryArtifact = {
  generatedAt: string;
  /**
   * Every scrubbable month as YYYY-MM-01, from the start of the replay through
   * the last month CVSR published. Months past that carry no evidence at all, so
   * they are omitted rather than redrawing the previous month; they reappear on
   * their own once a later report is fetched.
   */
  replayMonths: string[];
  snapshots: Snapshot[];
  cvsrInventory: CvsrInventory;
};
