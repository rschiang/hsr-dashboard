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
    url: 'https://www.buildhsr.com/project/muscat-avenue-viaduct/',
  },
  cvsr_2020_08: {
    title: 'Central Valley Status Report, August 2020',
    date: '2020-08-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/docs/brdmeetings/2020/brdmtg_081320_FA_Central_Valley_Status_Report.pdf',
  },
  buildhsr_san_joaquin: {
    title: 'San Joaquin River Viaduct & Pergola',
    date: '2021-02-01',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://www.buildhsr.com/project/san-joaquin-river-viaduct-pergola/',
  },
  buildhsr_cedar: {
    title: 'Cedar Viaduct',
    date: '2023-05-10',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/cedar-viaduct/',
  },
  buildhsr_peach: {
    title: 'Peach Avenue Grade Separation',
    date: '2024-12-06',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://www.buildhsr.com/project/peach-avenue-grade-separation/',
  },
  buildhsr_cairo: {
    title: 'Cairo Avenue Viaduct',
    date: '2022-12-20',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/cairo-avenue-viaduct/',
  },
  buildhsr_whitley: {
    title: 'Whitley Avenue Underpass',
    date: '2025-04-24',
    publisher: 'California High-Speed Rail Authority / BuildHSR',
    url: 'https://buildhsr.com/project/whitley-avenue-underpass/',
  },
  authority_tulare_2025: {
    title: 'High-Speed Rail Authority Completes Another Structure in Fresno',
    date: '2025-09-30',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/2025/09/30/news-release-high-speed-rail-authority-completes-another-structure-in-fresno/',
  },
  authority_ventura_2026: {
    title: 'High-Speed Rail Authority Completes Ventura Street Underpass',
    date: '2026-01-23',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/2026/01/23/news-release-high-speed-rail-authority-completes-ventura-street-underpass/',
  },
  business_plan_2026: {
    title: '2026 Final Business Plan, Table B.1',
    date: '2026-06-01',
    publisher: 'California High-Speed Rail Authority',
    url: 'https://hsr.ca.gov/wp-content/uploads/2026/06/2026-Final-Business-Plan-060126-A11Y.pdf',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
