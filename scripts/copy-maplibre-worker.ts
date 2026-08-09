import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sourceDirectory = 'node_modules/maplibre-gl/dist';
const targetDirectory = 'public/vendor';
await mkdir(targetDirectory, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await writeFile(`${targetDirectory}/${file}`, await readFile(`${sourceDirectory}/${file}`));
}
console.log(`MapLibre worker assets → ${targetDirectory}`);
