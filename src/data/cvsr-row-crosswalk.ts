/** Reviewed CVSR structure-row `Location` → ArcGIS progress segment id.
 * Guideway rows resolve through CVSR_GUIDEWAY_CROSSWALK below, else by exact
 * equality with the ArcGIS `Limits` label.
 */
export const CVSR_ROW_CROSSWALK: Readonly<Record<string, string>> = {
  'Fresno River Viaduct 501': 'CP1:187',
  'Cottonwood Creek': 'CP1:174',
  'South of Pergola Viaduct': 'CP1:176',
  'Herndon HST Bridge': 'CP1:195',
  'Fresno Underpass': 'CP1:197',
  'Tulare Underpass': 'CP1:190',
  'Ventura Underpass': 'CP1:183',
  'Golden State Blvd': 'CP1:184',
  'HST Fresno Viaduct': 'CP1:178',
  'Muscat Ave': 'CP1:199',
  'Fresno Trench': 'CP1:192',
  'Jensen Trench': 'CP1:189',
  'Conejo Ave': 'CP2-3:129',
  'Kings River': 'CP2-3:160',
  'Hanford Viaduct': 'CP2-3:128',
  'Ave 136': 'CP2-3:151',
  'Deer Creek': 'CP2-3:170',
  'Cole Slough': 'CP2-3:117',
  'Access Road': 'CP2-3:114',
  'Lakeland Bridge': 'CP2-3:150',
  'Dutch John Cut': 'CP2-3:137',
  'Alpaugh Bridge': 'CP2-3:110',
  'Grangeville Ave': 'CP2-3:118',
  'Stoil Spur': 'CP2-3:127',
  'SR 43 Tied Arch': 'CP2-3:123',
  '9th Ave': 'CP2-3:143',
  'Cairo Ave': 'CP2-3:112',
  'Peach Ave': 'CP2-3:119',
  AAAT: 'CP2-3:138',
  'Ave 24': 'CP2-3:169',
  'Whitley Ave': 'CP2-3:139',
  'Ave 156': 'CP2-3:144',
  Lansing: 'CP2-3:132',
  'Cross Creek': 'CP2-3:130',
  'SR 43 Tule River': 'CP2-3:131',
};

/**
 * Reviewed CVSR CP1 guideway row → the ArcGIS progress segments it covers. Paired by
 * station arithmetic: `miles` is the span the report prints, checked against the
 * segments' station lengths in cvsr-row-crosswalk.test.ts.
 */
export const CVSR_GUIDEWAY_CROSSWALK: Readonly<Record<string, { segmentIds: readonly string[]; miles: number }>> = {
  'GW North Extension': { segmentIds: ['CP1:175'], miles: 2.6 },
  'N1A Boundary to Viaduct 501': { segmentIds: ['CP1:193'], miles: 1.03 },
  'Viaduct 501 at Fresno River to Cottonwood Creek': { segmentIds: ['CP1:181'], miles: 2.92 },
  'Cottonwood Creek Test Strip to Ave 12': { segmentIds: ['CP1:186'], miles: 1.49 },
  'Ave 12 to Ave 11': { segmentIds: ['CP1:196'], miles: 1.03 },
  'Ave 11 to Ave 10': { segmentIds: ['CP1:188'], miles: 1.02 },
  'Ave 10 to Ave 09': { segmentIds: ['CP1:194'], miles: 1.1 },
  'Ave 9 to Ave 8': { segmentIds: ['CP1:200'], miles: 1.14 },
  'Ave 8 to Viaduct 203 at SJR': { segmentIds: ['CP1:177'], miles: 1.82 },
  'Viaduct 203 at SJR to Herndon Canal': { segmentIds: ['CP1:185', 'CP1:gap:1'], miles: 2.48 },
  'Herndon Canal to Swift Ave': { segmentIds: ['CP1:182'], miles: 1.88 },
  'Caltrans Section': { segmentIds: ['CP1:198'], miles: 2.54 },
  'Clinton Ave Connector to Fresno Trench': { segmentIds: ['CP1:180'], miles: 1.14 },
};

/** Spellings one report used for a row another report names differently. */
export const CVSR_STRUCTURE_LABEL_ALIASES: Readonly<Record<string, string>> = {
  'Corcoran Hwy': 'Corcoran HWY',
};

/**
 * ArcGIS named structure (GlobalID) → the CVSR structure rows that report it. Every
 * listed row must be in the report's completed table for the structure to read complete.
 * Structures that are strip segments are not listed: STRUCTURE_CROSSWALK already ties
 * them to a segment that carries its own CVSR row.
 */
export const NAMED_STRUCTURE_CVSR_ROWS: Readonly<Record<string, readonly string[]>> = {
  '4b135b9b-0265-4bb3-8fdf-c9cba22cd460': ['American Ave'], // American Avenue Grade Separation
  'c3ceec97-6971-418d-912e-3b64c831c777': ['E Central Avenue'], // Central Avenue Overcrossing
  '5c4c543a-97cf-4bf8-b056-be6a37c5d649': ['Church Ave'], // Church Avenue Grade Separation
  '706574fb-83f2-4b37-a0c1-ce9fdbd1efd7': ['Tuolumne Bridge'], // Tuolumne Street Bridge
  'b465c82c-07e5-431b-9be5-34f03a1e21c3': ['Belmont Avenue'], // Belmont Avenue Grade Separation
  '35855fd1-46ac-44b7-a587-7fdb3cb71486': ['McKinley'], // McKinley Avenue Grade Separation
  '4fdf460c-6e3f-4190-9092-9cb278839552': ['Fresno Trench'], // Fresno Trench & State Route 180 Passageway
  '996baabb-f54c-41a0-b58c-ea95bd82515b': ['Avenue 7'], // Avenue 7 Grade Separation
  '9dd208a3-a160-4cf1-9a58-e80b2f4946d9': ['Avenue 8'], // Avenue 8 Overpass
  '6b8c91de-e76f-4c0d-a0b2-f097b433d349': ['Avenue 9'], // Avenue 9 Grade Separation
  '5cec2249-a923-46d1-ab32-cb10d1d416eb': ['Avenue 10'], // Avenue 10 Grade Separation
  'a321a15d-2add-4bbe-8286-d370cf88180b': ['Avenue 11'], // Avenue 11 Grade Separation
  '271a4b3f-079d-42c4-85b7-1bfcf8802bc9': ['Avenue 12 HST', 'Avenue 12 BNSF'], // Avenue 12 Grade Separation
  '96777523-e9dd-45bc-a90a-c7b5df70fcc6': ['Avenue 15'], // Avenue 15 Grade Separation
  '16df7cd4-b458-4c04-a31f-3065a0c96d4e': ['Avenue 15.5'], // Avenue 15 1/2 Grade Separation
  'e2cc637e-57ed-4e28-a62a-17bc722766ee': ['Avenue 17'], // Avenue 17 Grade Separation
  '5a31c2e7-032c-4b24-a601-91d100a29d34': ['Road 27'], // Road 27 Grade Separation
  'e48808cc-570a-476b-ba74-0217ad670886': ['Road 26'], // Road 26 Grade Separation
  '37b3f86e-fab2-46d3-a299-21c5235387cd': ['Fargo Ave'], // Fargo Avenue Grade Separation
  '29c432d7-29ce-4278-ac5a-83c2e891bcbc': ['Flint Ave'], // Flint Avenue Grade Separation
  'af56fa57-ecaf-4252-a03b-faf6cf999e54': ['Excelsior Ave'], // Excelsior Avenue Grade Separation
  'f18165fc-4f7a-4583-ab91-25875834b4fb': ['Dover Ave'], // Dover Avenue Overcrossing
  '2eb51002-fcc2-4ce7-8e40-165129bc020b': ['Davis Ave'], // Davis Avenue Overcrossing
  '74cfef2f-baf3-4fc6-8a44-21e7a17596d1': ['Fowler Ave'], // Fowler Avenue Overcrossing
  '30446461-3764-4ceb-b2da-db9e515a691a': ['Elkhorn Ave'], // Elkhorn Avenue Grade Separation
  '8376a91b-aa51-485b-9cf2-efe28e201522': ['Mt. View'], // Mountain View Avenue Grade Separation
  '09c6365c-3528-47e3-980f-fd992fbd789b': ['Nebraska Ave'], // Nebraska Avenue Grade Separation
  '8db0f6ce-0dbf-4132-8134-ffd39ca8eb37': ['Floral Ave'], // Floral Avenue Grade Separation
  'ada3aaa3-d793-4a1c-8796-731b7e79899b': ['Manning Ave'], // Manning Avenue Overcrossing
  '235eb26c-7879-48d0-9d64-f86d80261e8a': ['South Ave'], // South Avenue Grade Separation
  '8cd42a12-4814-4485-9398-0c2b9492fe9f': ['Adams Ave'], // Adams Avenue Grade Separation
  '1eb82982-9662-4c8f-9031-ab5f6005326d': ['Ave 56'], // Avenue 56 Grade Separation
  '43195a4a-d438-48fb-a793-03730e72e403': ['Ave 88'], // Avenue 88 Grade Separation
  'b1de8484-57cd-4dba-854b-3e759822e786': ['Ave 120'], // Avenue 120 Grade Separation
  '6343dc8a-0041-47e4-b1a9-1bb2cd7db20b': ['Corcoran HWY'], // Corcoran Highway Grade Separation
  'ecd5ef3b-089e-4ea2-9b74-93fa0c090faf': ['SR 43 Curved Bridge'], // SR 43 Curved Bridge
  'dcd4e7da-dfa5-4cf6-baa7-21ee93dc109c': ['Kansas Ave'], // Kansas Avenue Grade Separation
  'c10fe0d1-5a20-4738-bcb2-1d4567944d5b': ['Kent Ave'], // Kent Avenue Grade Separation
  '631c61a9-e20c-42e8-ac16-79df1d868b83': ['SR 43 Jersey'], // State Route 43 Bridge at Jersey Avenue
  '4f63c6ec-f81a-4c46-9b88-4447d0620d29': ['Jackson Ave'], // Jackson Avenue Overcrossing
  '30230ea3-cc03-4eba-a756-445c261736a7': ['Idaho Ave'], // Idaho Avenue Overcrossing
  '3633ed8b-91a5-4751-9449-524cf67275cf': ['Houston Ave'], // Houston Avenue Grade Separation
  '91c87fbd-5d6d-4335-b72b-017cae6867ee': ['Hanford Armona'], // Hanford Armona Grade Separation
};
