import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const ROOT = 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services';
const USER_AGENT = 'hsr-dashboard/1.0 (public-data-pipeline)';
const METADATA = 'data/raw/arcgis/fetch-metadata.json';

type Target = { name: string; path: string; params: Record<string, string> };

const targets: Target[] = [
  {
    name: 'alignment',
    path: 'HSR_Statewide_Alignment/FeatureServer/1/query',
    params: {
      where: "Section IN ('M2M','CP1','CP2-3','CP4','LGA')",
      outFields: 'Section,PROJECT_SECTION',
      returnGeometry: 'true',
      returnM: 'true',
      outSR: '4326',
      f: 'json',
    },
  },
  {
    name: 'progress',
    path: 'BuildHSR_Guideways_Construction_Progress_view/FeatureServer/0/query',
    params: {
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    },
  },
  {
    name: 'structures',
    path: 'Closures_and_Detours_Public/FeatureServer/0/query',
    params: {
      where: '1=1',
      outFields: 'OBJECTID,GlobalID,name,location,description,constructionUpdate,status,projectPageURL,latitude,longitude',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    },
  },
  {
    name: 'stations',
    path: 'ALL_CHSRA_MULTIMEDIA_LAYERS/FeatureServer/0/query',
    params: {
      where: 'Stat_Name IS NOT NULL',
      outFields: 'OBJECTID,Stat_Name,X_Streets,SECTION,PHASE,LAT,LONG',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    },
  },
];

/** Returns `true` when the payload came from the network, `false` when the committed cache was reused. */
async function fetchTarget(target: Target): Promise<boolean> {
  const url = new URL(`${ROOT}/${target.path}`);
  for (const [key, value] of Object.entries(target.params)) url.searchParams.set(key, value);
  const output = `data/raw/arcgis/${target.name}.json`;

  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const body = (await response.json()) as { error?: { message?: string }; features?: unknown[] };
    if (body.error) throw new Error(body.error.message ?? 'ArcGIS query error');
    if (!Array.isArray(body.features)) throw new Error('ArcGIS response contains no features array');
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(body)}\n`);
    console.log(`${target.name}: fetched ${body.features.length} features → ${output}`);
    return true;
  } catch (error) {
    try {
      const cached = JSON.parse(await readFile(output, 'utf8')) as { features?: unknown[] };
      if (!Array.isArray(cached.features)) throw new Error('invalid cache');
      console.warn(`${target.name}: network failed; using ${cached.features.length}-feature cache (${String(error)})`);
      return false;
    } catch {
      throw new Error(`${target.name}: fetch failed and no valid cache exists: ${String(error)}`);
    }
  }
}

const fetched: boolean[] = [];
for (const target of targets) fetched.push(await fetchTarget(target));
const anyStale = fetched.includes(false);

// A poll that observed nothing must not claim freshness: `fetchedAt` propagates into
// `segments.json:generatedAt` and reaches users as "Last updated", so when any target fell
// back to its committed cache the recorded timestamp is carried forward unchanged.
let fetchedAt = new Date().toISOString();
if (anyStale) {
  try {
    const previous = JSON.parse(await readFile(METADATA, 'utf8')) as { fetchedAt?: unknown };
    if (typeof previous.fetchedAt === 'string') fetchedAt = previous.fetchedAt;
  } catch {
    // Absent or unparseable metadata leaves the current timestamp in place.
  }
}
await writeFile(
  METADATA,
  `${JSON.stringify(
    {
      fetchedAt,
      sources: targets.map(({ name, path }, index) => ({
        name,
        url: `${ROOT}/${path}`,
        stale: !fetched[index],
      })),
    },
    null,
    2,
  )}\n`,
);
if (anyStale) {
  console.warn(
    `arcgis: ${fetched.filter((ok) => !ok).length} of ${targets.length} sources served from cache; fetchedAt held at ${fetchedAt}`,
  );
}
