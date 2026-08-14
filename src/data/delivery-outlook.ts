import type { SourceId } from './sources';
import type { ConstructionPackage } from './types';

/**
 * Procurement and forecast facts the Authority publishes for work that has no
 * observed construction progress yet. This module is deliberately outside the
 * status pipeline: nothing here is read by `deriveStatuses` or
 * `selectedCompletions`, mapped to an `AlignmentStatus`, or written into
 * `public/data/*`. A procurement scope is not a built mile and a forecast
 * quarter is not an observation.
 */

/** How firm a fact is: observed, board-authorized, forecast, or awaiting authorization. */
export type DeliveryFactState = 'reported' | 'authorized' | 'forecast' | 'planned';
export type Quarter = { year: number; quarter: 1 | 2 | 3 | 4 };
export type DeliveryTiming =
  | { kind: 'date'; date: string }
  | { kind: 'quarters'; year: number; quarters: readonly (1 | 2 | 3 | 4)[] }
  /** The source publishes prose, not a date; print it unchanged. */
  | { kind: 'verbatim'; label: string };
export type DeliveryFact = {
  id: string;
  label: string;
  state: DeliveryFactState;
  timing?: DeliveryTiming;
  value?: string;
  sourceId: SourceId;
};
export type SourcedNote = { id: string; text: string; sourceId: SourceId };
export type M2MSection = {
  id: 'north' | 'wye' | 'south';
  label: string;
  miles: number;
  approximate: boolean;
  tracks: 'single' | 'double';
  stationStart: string;
  stationEnd: string;
  features: readonly string[];
  sourceId: SourceId;
};
export type M2MOption = { id: 'sr152' | 'downtown-merced'; label: string; features: readonly string[]; sourceId: SourceId };
export type M2MLegendEntry = { abbr: 'BR' | 'OH' | 'UP'; expansion: string };
export type DeliveryProgram = {
  id: 'm2m' | 'lga' | 'tscc';
  heading: string;
  status: string;
  sourceId: SourceId;
  facts: readonly DeliveryFact[];
};
export type ForecastActivity =
  | 'guideway_subgrade'
  | 'survey'
  | 'track_ocs_design'
  | 'mobilization'
  | 'pre_track_work'
  | 'track_laying'
  | 'ocs_installation'
  | 'system_installation';
export type ForecastBand = { activity: ForecastActivity; start: Quarter; end: Quarter };
export type ForecastPackage = {
  cp: 'CP1' | 'CP2-3' | 'CP4';
  miles: number;
  subSegments: readonly { id: string; label: string; miles: number }[];
  anchors: readonly string[];
  bands: readonly ForecastBand[];
};
export type TrackForecast = {
  title: string;
  asOf: string;
  sourceId: SourceId;
  riskWindow: { start: Quarter; end: Quarter };
  packages: readonly ForecastPackage[];
};
export type TrackMetricSummary = { value: '—'; unit: 'mi'; chip: string; ariaLabel: string; sourceId: SourceId };
export type DeliveryContext = {
  anchor: '#delivery-m2m' | '#delivery-lga' | '#delivery-track';
  state: string;
  summary: string;
  sourceId: SourceId;
};

/** Date every live procurement page in this module was last checked. */
export const DELIVERY_OUTLOOK_AS_OF = '2026-08-14';

/**
 * RFQ HSR26-16 design sections, north to south. The ten-foot North/Wye station
 * overlap (`8602+12.91` against `8602+2.91`) is printed that way in Addendum 1
 * and is stored unnormalized: the RFQ, not this dashboard, owns the stationing.
 * These are procurement sections with no verified transform to the TS1/IOS axis,
 * so they never become map or strip geometry.
 */
export const M2M_SECTIONS: readonly M2MSection[] = [
  {
    id: 'north',
    label: 'North Segment',
    miles: 9.6,
    approximate: false,
    tracks: 'single',
    stationStart: '8097+00',
    stationEnd: '8602+12.91',
    features: [
      'Miles Creek BR',
      'Owens Creek BR',
      'Duck Slough BR',
      'Hydraulic BR3',
      'Hydraulic BR4',
      'Hydraulic BR5',
      'Hydraulic BR6',
      'Le Grand OH',
      'Deadman Creek BR',
      'Sandy Mush Rd UP',
      'Dutchman Creek BR',
    ],
    sourceId: 'm2m_rfq_sections_2026',
  },
  {
    id: 'wye',
    label: 'Wye Segment',
    miles: 6.1,
    approximate: false,
    tracks: 'single',
    stationStart: '8602+2.91',
    stationEnd: '8924+20',
    features: [
      'Ave 26 UP',
      'Chowchilla River BR #1',
      'Washington Rd (Ave 25) UP',
      'Ash Slough BR, NB',
      'Ave 23 1/2 UP, NB',
      'Road 12 UP, NB',
      'Ash Slough BR, SB',
      'Ave 23 1/2 UP, SB',
      'Road 12 UP, SB',
      'Aerial #3',
    ],
    sourceId: 'm2m_rfq_sections_2026',
  },
  {
    id: 'south',
    label: 'South Segment',
    miles: 14.6,
    approximate: true,
    tracks: 'double',
    stationStart: '8924+20',
    stationEnd: '9694+71.00',
    features: [
      'Berenda Slough BR',
      'Aerial #2',
      'Road 19 1/2 Multiuse Trail UP',
      'Road 20 UP',
      'Road 22 UP',
      'Berenda Creek BR',
      'Ave 20 1/2 UP',
      'Dry Creek BR',
    ],
    sourceId: 'm2m_rfq_sections_2026',
  },
];

/** Discretionary work the RFQ keeps out of base scope. */
export const M2M_OPTIONS: readonly M2MOption[] = [
  {
    id: 'sr152',
    label: 'SR-152 improvements',
    // The RFQ's own sentences, not a transcription of the diagram's overlapping callouts.
    features: [
      'SR 152/SR 233 grade separation with tight diamond interchange',
      'SR 152/Road 16 separation',
      'SR 152/Road 17 1/2 overhead',
    ],
    sourceId: 'm2m_rfq_sections_2026',
  },
  {
    id: 'downtown-merced',
    label: 'Extension to Downtown Merced',
    features: [],
    sourceId: 'm2m_board_presentation_2026',
  },
];

export const M2M_LEGEND: readonly M2MLegendEntry[] = [
  { abbr: 'BR', expansion: 'bridge' },
  { abbr: 'OH', expansion: 'overhead structure (Type 2)' },
  { abbr: 'UP', expansion: 'underpass structure (Type 1)' },
];

export const M2M_SCOPE_NOTES: readonly SourcedNote[] = [
  {
    id: 'm2m-features-preliminary',
    text: 'Structure names come from the RFQ reference design and are preliminary; spelling and scope may change when the construction contract is awarded.',
    sourceId: 'm2m_rfq_sections_2026',
  },
  {
    id: 'm2m-limits-caveat',
    text: 'The RFP will more clearly delineate the Project limits and lengths of major work elements.',
    sourceId: 'm2m_rfq_sections_2026',
  },
  {
    id: 'm2m-reference-design-caveat',
    text: 'The approximately 30% reference design may change during the collaborative pre-proposal phase.',
    sourceId: 'm2m_prebid_2026',
  },
  {
    id: 'm2m-civil-exclusions',
    text: 'Civil scope excludes track work and track-level permanent drainage, passenger stations, geotechnical investigations, third-party utility design and relocations, right-of-way engineering and acquisition, sound walls, and systems work.',
    sourceId: 'm2m_rfq_sections_2026',
  },
  {
    id: 'm2m-wye-label',
    text: 'The board presentation legend labels this the Wye/Mid Segment; the RFQ text calls it the Wye Segment.',
    sourceId: 'm2m_board_presentation_2026',
  },
];

/**
 * The nine TSCC packages in contract order. Packages 8 and 9 are base scope of
 * the 171-mile contract awaiting a notice to proceed, not contract options;
 * `planned` therefore renders as "Not yet authorized", never as "optional".
 */
export const TSCC_PACKAGES: readonly DeliveryFact[] = [
  {
    id: 'tscc-package-1b',
    label: 'Package 1B',
    state: 'authorized',
    value: '$118,110,340 time-and-materials/not-to-exceed · design development for OEM procurement, estimating for Packages 5-7, preconstruction and program management',
    sourceId: 'tscc_award_packages_2026',
  },
  {
    id: 'tscc-package-2',
    label: 'Package 2',
    state: 'authorized',
    value: '$260,843,101 lump sum · civil, track, and OCS construction within CP4',
    sourceId: 'tscc_award_packages_2026',
  },
  {
    id: 'tscc-package-3',
    label: 'Package 3',
    state: 'planned',
    value: 'Civil, track, and OCS construction within CP2-3',
    sourceId: 'tscc_2025_packages',
  },
  {
    id: 'tscc-package-4',
    label: 'Package 4',
    state: 'planned',
    value: 'Civil, track, and OCS construction within CP1',
    sourceId: 'tscc_2025_packages',
  },
  {
    id: 'tscc-package-5',
    label: 'Package 5',
    state: 'planned',
    value: 'Mobilization of traction power, train control, telecommunications, and SCADA installation and testing teams, with long-lead systems procurement',
    sourceId: 'tscc_2025_term_sheet',
  },
  {
    id: 'tscc-package-6',
    label: 'Package 6',
    state: 'planned',
    value: 'Train control and communications systems for the 119-mile First Construction Section',
    sourceId: 'tscc_2025_term_sheet',
  },
  {
    id: 'tscc-package-7',
    label: 'Package 7',
    state: 'planned',
    value: 'Traction power system',
    sourceId: 'tscc_2025_term_sheet',
  },
  {
    id: 'tscc-package-8',
    label: 'Package 8',
    state: 'planned',
    value: 'Merced Extension',
    sourceId: 'tscc_2025_term_sheet',
  },
  {
    id: 'tscc-package-9',
    label: 'Package 9',
    state: 'planned',
    value: 'Bakersfield Extension',
    sourceId: 'tscc_2025_term_sheet',
  },
];

export const TSCC_PACKAGE_2_MILESTONES: readonly DeliveryFact[] = [
  {
    id: 'cp4-track-start',
    label: 'Commence laying track',
    state: 'forecast',
    timing: { kind: 'date', date: '2026-11-30' },
    sourceId: 'tscc_award_packages_2026',
  },
  {
    id: 'cp4-track-completion',
    label: 'Complete track construction',
    state: 'forecast',
    timing: { kind: 'date', date: '2027-06-14' },
    sourceId: 'tscc_award_packages_2026',
  },
  {
    id: 'cp4-ocs-completion',
    label: 'Complete OCS construction',
    state: 'forecast',
    timing: { kind: 'date', date: '2027-10-18' },
    sourceId: 'tscc_award_packages_2026',
  },
];

export const DELIVERY_PROGRAMS: readonly DeliveryProgram[] = [
  {
    id: 'm2m',
    heading: 'M2M civil works',
    status: 'Active procurement',
    sourceId: 'm2m_procurement_2026',
    facts: [
      {
        id: 'm2m-rfq-release',
        label: 'RFQ HSR26-16 released',
        state: 'reported',
        timing: { kind: 'date', date: '2026-07-09' },
        sourceId: 'm2m_procurement_2026',
      },
      {
        id: 'm2m-scope',
        label: 'Guideway scope',
        state: 'reported',
        value: 'Approximately 30.3 miles, Merced to the CP1 interface in Madera County',
        sourceId: 'm2m_rfq_sections_2026',
      },
      {
        id: 'm2m-soq-due',
        label: 'Statements of qualifications due',
        state: 'forecast',
        timing: { kind: 'date', date: '2026-09-29' },
        sourceId: 'm2m_procurement_2026',
      },
      {
        id: 'm2m-shortlist',
        label: 'Shortlist of two teams',
        state: 'forecast',
        timing: { kind: 'verbatim', label: 'Late October 2026' },
        sourceId: 'm2m_procurement_2026',
      },
      {
        id: 'm2m-rfp-ppca',
        label: 'RFP issued and collaboration agreements awarded',
        state: 'forecast',
        timing: { kind: 'verbatim', label: 'December 2026' },
        sourceId: 'm2m_procurement_2026',
      },
      {
        id: 'm2m-proposals-due',
        label: 'Proposals due',
        state: 'forecast',
        timing: { kind: 'verbatim', label: 'October 2027' },
        sourceId: 'm2m_procurement_2026',
      },
      {
        id: 'm2m-nopa',
        label: 'Notice of proposed award',
        state: 'forecast',
        timing: { kind: 'verbatim', label: 'November 2027' },
        sourceId: 'm2m_procurement_2026',
      },
      {
        id: 'm2m-estimated-value',
        label: 'Estimated design and construction value',
        state: 'forecast',
        value: '$2.4 billion including collaboration agreements',
        sourceId: 'm2m_prebid_2026',
      },
      {
        id: 'm2m-ppca-ceiling',
        label: 'Pre-proposal collaboration agreements',
        state: 'authorized',
        value: 'Two agreements, $17 million each ($34 million total)',
        sourceId: 'm2m_resolution_2026',
      },
      {
        id: 'm2m-reference-design',
        label: 'Authority reference design furnished to bidders',
        state: 'reported',
        value: 'Approximately 30% design level',
        sourceId: 'm2m_prebid_2026',
      },
    ],
  },
  {
    id: 'lga',
    heading: 'LGA civil works',
    status: 'Developing scope',
    sourceId: 'procurement_schedule_2026',
    facts: [
      {
        id: 'lga-environmental-alignment',
        label: 'Approved environmental alignment',
        state: 'reported',
        value: '23.13 miles, Poplar Avenue in Shafter to Bakersfield',
        sourceId: 'lga_environmental_record',
      },
      {
        id: 'lga-station',
        label: 'Station location',
        state: 'reported',
        value: 'F Street at State Route 204',
        sourceId: 'lga_environmental_record',
      },
      {
        id: 'lga-delivery-method',
        label: 'Delivery method',
        state: 'reported',
        value: 'Progressive design-build',
        sourceId: 'procurement_schedule_2026',
      },
      {
        id: 'lga-solicitation',
        label: 'Solicitation',
        state: 'forecast',
        timing: { kind: 'quarters', year: 2026, quarters: [3, 4] },
        sourceId: 'procurement_schedule_2026',
      },
      {
        id: 'lga-award',
        label: 'Tentative award',
        state: 'forecast',
        timing: { kind: 'quarters', year: 2027, quarters: [1, 2] },
        sourceId: 'procurement_schedule_2026',
      },
    ],
  },
  {
    id: 'tscc',
    heading: 'Track & Systems',
    status: 'Awarded · Packages 1B and 2 authorized',
    sourceId: 'tscc_resolution_2026',
    facts: [
      {
        id: 'tscc-award',
        label: 'Contract HSR25-89 awarded',
        state: 'reported',
        value: 'Kiewit, Stacy Witbeck, Herzog - A Joint Venture',
        sourceId: 'tscc_resolution_2026',
      },
      {
        id: 'tscc-ceiling',
        label: 'Contract ceiling',
        state: 'authorized',
        value: '$3.5 billion not-to-exceed',
        sourceId: 'tscc_resolution_2026',
      },
      {
        id: 'tscc-scope',
        label: 'Contract scope',
        state: 'reported',
        value: 'Track, overhead contact system, and related work on the 171-mile Early Operating Segment',
        sourceId: 'tscc_2025_term_sheet',
      },
      {
        id: 'tscc-future-approval',
        label: 'Later packages',
        state: 'reported',
        value: 'Each remaining notice to proceed requires a further Board approval',
        sourceId: 'tscc_resolution_2026',
      },
      {
        id: 'tscc-track-start-backstop',
        label: 'Contract track-start requirement',
        state: 'reported',
        value: 'Start track construction no later than December 15, 2026',
        sourceId: 'tscc_2025_packages',
      },
    ],
  },
];

/**
 * The chart on p. 11 of the August 2026 CVSR, and nothing else. Bands are the
 * envelope of an activity across a package: the chart draws some preparatory
 * work per sub-segment and draws pre-track work and track laying as diagonal
 * progress lines, so a package-level start/end quarter is the only reading that
 * does not require guessing interior cell boundaries. CP4 carries no
 * `guideway_subgrade` band — the same report records CP4 final completion in
 * August 2025.
 */
export const TRACK_FORECAST = {
  title: 'CVS 119 Track and System Installation Forecast',
  asOf: '2026-06-30',
  sourceId: 'cvsr_2026_08_forecast',
  riskWindow: { start: { year: 2029, quarter: 3 }, end: { year: 2029, quarter: 4 } },
  packages: [
    {
      cp: 'CP1',
      miles: 31.6,
      subSegments: [
        { id: '1a', label: '1A', miles: 23.8 },
        { id: '1b', label: '1B', miles: 2.7 },
        { id: '1c', label: '1C', miles: 5.1 },
      ],
      anchors: ['Madera Station', 'Fresno Station'],
      bands: [
        { activity: 'guideway_subgrade', start: { year: 2025, quarter: 1 }, end: { year: 2026, quarter: 3 } },
        { activity: 'survey', start: { year: 2026, quarter: 3 }, end: { year: 2026, quarter: 4 } },
        { activity: 'track_ocs_design', start: { year: 2026, quarter: 4 }, end: { year: 2027, quarter: 4 } },
        { activity: 'pre_track_work', start: { year: 2027, quarter: 4 }, end: { year: 2028, quarter: 2 } },
        { activity: 'track_laying', start: { year: 2028, quarter: 1 }, end: { year: 2028, quarter: 4 } },
        { activity: 'ocs_installation', start: { year: 2028, quarter: 3 }, end: { year: 2029, quarter: 1 } },
        { activity: 'system_installation', start: { year: 2029, quarter: 1 }, end: { year: 2029, quarter: 2 } },
      ],
    },
    {
      cp: 'CP2-3',
      miles: 65.6,
      subSegments: [
        { id: 's1', label: 'S1', miles: 16.9 },
        { id: 's2', label: 'S2', miles: 22.3 },
        { id: 's3', label: 'S3', miles: 26.4 },
      ],
      anchors: ['Fresno Railhead', 'Kings/Tulare Station'],
      bands: [
        { activity: 'guideway_subgrade', start: { year: 2025, quarter: 1 }, end: { year: 2026, quarter: 4 } },
        { activity: 'survey', start: { year: 2026, quarter: 2 }, end: { year: 2026, quarter: 3 } },
        { activity: 'track_ocs_design', start: { year: 2026, quarter: 3 }, end: { year: 2027, quarter: 4 } },
        { activity: 'pre_track_work', start: { year: 2027, quarter: 1 }, end: { year: 2028, quarter: 1 } },
        { activity: 'track_laying', start: { year: 2027, quarter: 4 }, end: { year: 2028, quarter: 3 } },
        { activity: 'ocs_installation', start: { year: 2027, quarter: 4 }, end: { year: 2028, quarter: 4 } },
        { activity: 'system_installation', start: { year: 2029, quarter: 1 }, end: { year: 2029, quarter: 2 } },
      ],
    },
    {
      cp: 'CP4',
      miles: 21.1,
      subSegments: [
        { id: 'north', label: 'North', miles: 15.0 },
        { id: 'south', label: 'South', miles: 6.1 },
      ],
      anchors: ['Southern Railhead'],
      bands: [
        { activity: 'survey', start: { year: 2025, quarter: 1 }, end: { year: 2025, quarter: 4 } },
        { activity: 'track_ocs_design', start: { year: 2026, quarter: 1 }, end: { year: 2026, quarter: 2 } },
        { activity: 'mobilization', start: { year: 2026, quarter: 3 }, end: { year: 2026, quarter: 3 } },
        { activity: 'pre_track_work', start: { year: 2026, quarter: 3 }, end: { year: 2027, quarter: 1 } },
        { activity: 'track_laying', start: { year: 2026, quarter: 4 }, end: { year: 2027, quarter: 2 } },
        { activity: 'ocs_installation', start: { year: 2027, quarter: 2 }, end: { year: 2027, quarter: 3 } },
        { activity: 'system_installation', start: { year: 2029, quarter: 1 }, end: { year: 2029, quarter: 2 } },
      ],
    },
  ],
} as const satisfies TrackForecast;

/** The chart's own wording for each row. */
export const ACTIVITY_LABELS: Readonly<Record<ForecastActivity, string>> = {
  guideway_subgrade: 'Guideway subgrade completion',
  survey: 'Survey',
  track_ocs_design: 'Track and OCS detailed design',
  mobilization: 'Mobilization',
  pre_track_work: 'Pre-track work',
  track_laying: 'Track laying',
  ocs_installation: 'OCS installation',
  system_installation: 'System installation',
};

/** A band prints `Q4 2026 – Q2 2027`, or one quarter when it opens and closes in the same one. */
export function bandLabel({ start, end }: { start: Quarter; end: Quarter }): string {
  const from = `Q${start.quarter} ${start.year}`;
  return start.year === end.year && start.quarter === end.quarter
    ? from
    : `${from} – Q${end.quarter} ${end.year}`;
}

/**
 * The Authority publishes railhead completion and future track milestones but no
 * installed-track mileage, so the rail's headline stays an em dash. Never
 * substitute CP4's 21.1-mile package extent or a sum of forecast mileages.
 */
export const TRACK_METRIC: TrackMetricSummary = {
  value: '—',
  unit: 'mi',
  chip: 'CP4 track laying forecast Q4 2026',
  ariaLabel: 'Track installed: not published. The Authority forecasts CP4 track laying beginning in the fourth quarter of 2026 and requires track construction to start no later than December 15, 2026, but publishes no installed-track mileage total and no monthly track-installation series.',
  sourceId: 'cvsr_2026_08_forecast',
};

/** Total over `ConstructionPackage`, so the detail panel has no missing-key path. */
export const DELIVERY_CONTEXT_BY_PACKAGE: Readonly<Record<ConstructionPackage, DeliveryContext>> = {
  M2M: {
    anchor: '#delivery-m2m',
    state: 'Active procurement',
    summary: 'RFQ HSR26-16 covers this extension as North, Wye, and South design sections. Procurement scope, not construction progress.',
    sourceId: 'm2m_rfq_sections_2026',
  },
  LGA: {
    anchor: '#delivery-lga',
    state: 'Developing scope',
    summary: 'Progressive design-build procurement not yet released; no construction sections published.',
    sourceId: 'procurement_schedule_2026',
  },
  CP4: {
    anchor: '#delivery-track',
    state: 'TSCC Package 2 authorized',
    summary: 'Track laying forecast Q4 2026 - Q2 2027; OCS installation Q2 - Q3 2027.',
    sourceId: 'tscc_award_packages_2026',
  },
  'CP2-3': {
    anchor: '#delivery-track',
    state: 'TSCC Package 3 not yet authorized',
    summary: 'Track laying forecast Q4 2027 - Q3 2028; OCS installation Q4 2027 - Q4 2028.',
    sourceId: 'cvsr_2026_08_forecast',
  },
  CP1: {
    anchor: '#delivery-track',
    state: 'TSCC Package 4 not yet authorized',
    summary: 'Track laying forecast Q1 2028 - Q4 2028; OCS installation Q3 2028 - Q1 2029.',
    sourceId: 'cvsr_2026_08_forecast',
  },
};

/** The LGA alignment has no published construction sections; the strip shows one span. */
export const LGA_UNSEGMENTED_NOTE = 'The Authority publishes no construction sections or civil-works contract for this alignment yet, so the dashboard shows it as one unsegmented span.';
