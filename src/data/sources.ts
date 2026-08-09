export type Source = {
  title: string;
  date: string;
  publisher: string;
  url: string;
  accessed?: string;
};

export const SOURCES = {
  ts1_alignment: {
    title: 'TS1 3.0 – Alignment Segments and Lengths',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20210921082559/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-3_TS1_3-0-Alignment_Segments_and_Lengths-2019-0501.pdf',
  },
  ts1_schematic: {
    title: 'TS1 2.1 – Systemwide Alignment Schematic',
    date: '2019-05-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://web.archive.org/web/20221126054952/https://hsr.ca.gov/wp-content/uploads/docs/programs/track/Part_B-2-2-1_TS1_2-1-Systemwide_Alignment_Schematic-2019-0501.pdf',
  },
  arcgis_progress: {
    title: 'BuildHSR Guideways Construction Progress',
    date: '2026-05-04',
    publisher: 'California High-Speed Rail Authority GeoPlatform',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/BuildHSR_Guideways_Construction_Progress_view/FeatureServer/0',
    accessed: '2026-08-09',
  },
  arcgis_alignment: {
    title: 'HSR Statewide Alignment, layer 1',
    date: '2026-08-09',
    publisher: 'California High-Speed Rail Authority GeoPlatform',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/HSR_Statewide_Alignment/FeatureServer/1',
    accessed: '2026-08-09',
  },
  arcgis_structures: {
    title: 'Closures and Detours Public, layer 0',
    date: '2026-08-09',
    publisher: 'California High-Speed Rail Authority GeoPlatform',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/Closures_and_Detours_Public/FeatureServer/0',
    accessed: '2026-08-09',
  },
  arcgis_stations: {
    title: 'ALL CHSRA Multimedia Layers — Stations',
    date: '2026-08-09',
    publisher: 'California High-Speed Rail Authority GeoPlatform',
    url: 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services/ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/0',
    accessed: '2026-08-09',
  },
  cvsr: {
    title: 'Central Valley Status Report, April 2026',
    date: '2026-04-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/04/FA-Central-Valley-Status-Report-April-2026.pdf',
  },
  business_plan_2026: {
    title: '2026 Final Business Plan, Table B.1',
    date: '2026-06-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
