/**
 * Registry-shape constraint. `partOf` is `string` here and only here: `SourceId` is
 * derived from this table's keys, so naming it in the constraint would make the type
 * circular. `as const` keeps each entry's `partOf` a literal, so a parent that does
 * not exist fails at the callsite that resolves it.
 */
type SourceRecord = {
  title: string;
  publisher: string;
  url: string;
  date?: string;
  accessed?: string;
  /** Parent entry this one pinpoints. The parent carries the footnote number; children get letters. */
  partOf?: string;
  /** Printed location inside the parent document, e.g. 'p. 47', 'pp. 78–79'. */
  page?: string;
  /** Provenance or status the reader needs; rendered under the entry. */
  note?: string;
};

const REGISTRY = {
  ts1_alignment: {
    title: 'Track and Systems Contract 1 (TS1) 3.0 – Alignment Segments and Lengths',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20210921082559/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-3_TS1_3-0-Alignment_Segments_and_Lengths-2019-0501.pdf',
    note: 'Industry draft, footer “TS1 – INDUSTRY DRAFT – 2019-0501”; sheets dated 3/29/2019. Archived copy — hsr.ca.gov serves this path behind bot protection.',
  },
  ts1_schematic: {
    title: 'Track and Systems Contract 1 (TS1) 2.1 – Systemwide Alignment Schematic',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20221126054952/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-2-1_TS1_2-1-Systemwide_Alignment_Schematic-2019-0501.pdf',
    note: 'Industry draft, footer “TS1 – INDUSTRY DRAFT – 2019-0501”. Archived copy — hsr.ca.gov serves this path behind bot protection.',
  },

  geoplatform: {
    title: 'Interactive Map',
    publisher: 'California High-Speed Rail Authority (BuildHSR)',
    url: 'https://buildhsr.com/map/',
    accessed: '2026-08-10',
    note: 'The Authority’s public map embeds its own ArcGIS GeoPlatform layers — portal account GeoPlatform_CHSRA, experience “BuildHSR Interactive Map (V2)” (item b2ab11d536da42c8bbe03f3e1458c0a2). The map exposes no per-layer permalink, so each layer service is cited directly below; every one is an Authority publication, not a third-party mirror.',
  },
  arcgis_progress: {
    partOf: 'geoplatform',
    title: 'BuildHSR Guideways Construction Progress view — layer 0, Guideway_Structures_ConstructionProgress',
    date: '2026-05-04',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/BuildHSR_Guideways_Construction_Progress_view/FeatureServer/0',
    accessed: '2026-08-10',
  },
  arcgis_alignment: {
    partOf: 'geoplatform',
    title: 'HSR Statewide Alignment and Stations — layer 1, HSR Statewide Alignment',
    date: '2026-04-07',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/HSR_Statewide_Alignment/FeatureServer/1',
    accessed: '2026-08-10',
  },
  arcgis_structures: {
    partOf: 'geoplatform',
    title: 'Closures and Construction Projects (Read-Only) — layer 0, construction_project_points',
    date: '2026-06-04',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/Closures_and_Detours_Public/FeatureServer/0',
    accessed: '2026-08-10',
  },
  arcgis_stations: {
    partOf: 'geoplatform',
    title: 'ALL CHSRA MULTIMEDIA LAYERS — layer 0, Stations',
    date: '2025-03-18',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/0',
    accessed: '2026-08-10',
  },

  cvsr: {
    title: 'Central Valley Status Reports',
    publisher: 'California High-Speed Rail Authority, Finance & Audit Committee',
    url: 'https://hsr.ca.gov/about/board-of-directors/finance-audit-committee/',
    accessed: '2026-08-10',
    note: 'Monthly series published with the committee’s meeting materials; the dashboard keys each report by its data month. Reports that carry a specific figure cited on this page are listed below.',
  },
  cvsr_2020_03: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, March 2020 (January 2020 data)',
    date: '2020-01-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_031720_FA_Central_Valley_Status_Report.pdf',
    page: 'p. 11',
  },
  cvsr_2020_06: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, August 2020 (data through June 2020)',
    date: '2020-06-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_081320_FA_Central_Valley_Status_Report.pdf',
  },
  cvsr_2022_04: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, June 2022 (April 2022 data)',
    date: '2022-04-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2022/06/CVSR-2206-2204-Data-FINAL-V0-A11Y.pdf',
  },
  cvsr_2026_06_24: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, June 24, 2026 (April 2026 data)',
    date: '2026-04-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/FA-Central-Valley-Status-Report-June-24-2026-A11Y.pdf',
  },
  cvsr_2026_07: {
    partOf: 'cvsr',
    title: 'Central Valley Status Report, July 2026 (data through May 31, 2026)',
    date: '2026-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/07/FA-Central-Valley-Status-Report-July-2026-A11Y.pdf',
  },

  sb1029_2017: {
    title: 'SB 1029 Project Update Report, February 2017',
    date: '2017-02-03',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2024/01/SB1029-ProjectUpdate-FINAL_020317-A11Y.pdf',
  },
  sb1029_2019: {
    title: 'SB 1029 Project Update Report, May 2019',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/docs/about/legislative_affairs/SB1029_Project_Update_Report_050119.pdf',
  },

  buildhsr_muscat: {
    title: 'Muscat Avenue Viaduct',
    date: '2019-07-01',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/muscat-avenue-viaduct/',
  },
  buildhsr_san_joaquin: {
    title: 'San Joaquin River Viaduct & Pergola',
    date: '2021-02-01',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/san-joaquin-river-viaduct-pergola/',
  },
  buildhsr_cedar: {
    title: 'Cedar Viaduct',
    date: '2023-05-10',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/cedar-viaduct/',
  },
  buildhsr_cairo: {
    title: 'Cairo Avenue Viaduct',
    date: '2022-12-20',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/cairo-avenue-viaduct/',
  },
  buildhsr_peach: {
    title: 'Peach Avenue Grade Separation',
    date: '2024-12-06',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/peach-avenue-grade-separation/',
  },
  buildhsr_whitley: {
    title: 'Whitley Avenue Underpass',
    date: '2025-04-24',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/whitley-avenue-underpass/',
  },

  hsr_tulare_2025: {
    title: 'High-Speed Rail’s Completed Tulare Street Grade Separation Project Reconnects Fresno’s Chinatown and Downtown',
    date: '2025-07-31',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/2025/07/31/photo-release-high-speed-rail-celebrates-completion-of-tulare-street-grade-separation-project-in-fresno/',
  },
  hsr_ventura_2026: {
    title: 'High-Speed Rail Completes Underpass Reconnecting Downtown and Southwest Fresno',
    date: '2026-03-13',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/2026/03/13/photo-release-high-speed-rail-completes-underpass-reconnecting-downtown-and-southwest-fresno/',
    note: 'Updated 2026-05-11 to rename the street throughout; the release carries the editor’s note.',
  },

  business_plan_2026: {
    title: '2026 Business Plan',
    date: '2026-06-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf',
  },
  bp2026_milestones: {
    partOf: 'business_plan_2026',
    title: 'Letter from the CEO — “Looking Ahead: Anticipated 2026 Milestones”',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf#page=13',
    page: 'p. XIII',
  },
  bp2026_costs: {
    partOf: 'business_plan_2026',
    title: 'Appendix B, Table B.1: Merced – Bakersfield Capital Cost Estimates (YOE $ in millions)',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf#page=75',
    page: 'p. 47',
  },
  bp2026_schedule: {
    partOf: 'business_plan_2026',
    title: 'Appendix D, Exhibit D.0: Merced – Bakersfield Timeline for Major Scope Items',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf#page=106',
    page: 'pp. 78–79',
  },
} as const satisfies Record<string, SourceRecord>;

export type SourceId = keyof typeof REGISTRY;
/** A registry entry with `partOf` narrowed to a key that exists. */
export type Source = SourceRecord & { partOf?: SourceId };
export const SOURCES: Record<SourceId, Source> = REGISTRY;
