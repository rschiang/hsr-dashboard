import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const ROOT = 'https://services3.arcgis.com/rGGp0aiv6Rf11t2H/arcgis/rest/services';
const USER_AGENT = 'hsr-dashboard/1.0 (public-data-pipeline)';

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

async function fetchTarget(target: Target): Promise<void> {
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
  } catch (error) {
    try {
      const cached = JSON.parse(await readFile(output, 'utf8')) as { features?: unknown[] };
      if (!Array.isArray(cached.features)) throw new Error('invalid cache');
      console.warn(`${target.name}: network failed; using ${cached.features.length}-feature cache (${String(error)})`);
    } catch {
      throw new Error(`${target.name}: fetch failed and no valid cache exists: ${String(error)}`);
    }
  }
}

for (const target of targets) await fetchTarget(target);
await writeFile(
  'data/raw/arcgis/fetch-metadata.json',
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), sources: targets.map(({ name, path }) => ({ name, url: `${ROOT}/${path}` })) }, null, 2)}\n`,
);
