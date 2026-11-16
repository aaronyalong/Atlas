/**
 * Draws the desk's world map texture: `npm run map` (or `node scripts/map.mjs [config-name]`).
 *
 * Natural Earth data (public domain, via the world-atlas package) is projected with the same
 * code the site uses to place pins (src/lib/map/projection.ts), drawn as SVG in the style of an
 * old atlas plate, and rasterised by sharp to public/map/<name>.webp. The output is committed:
 * the build never runs this.
 *
 * Node strips the TypeScript types from the imported modules itself (Node ≥ 23.6), so the
 * script and the site share one source of truth without a build step.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoGraticule, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import sharp from 'sharp';
import * as configs from '../src/lib/map/config.ts';
import { createMapProjection } from '../src/lib/map/projection.ts';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Atlas-plate palette: cream paper, tea-stained land, a paler sea, sepia linework.
const INK = {
	sea: '#dfd6bf',
	land: '#cdb98f',
	coast: '#6a5236',
	border: '#8c7452',
	graticule: '#a8987a',
	neatline: '#4e3a24',
	crease: '#5a4630',
};

export async function drawMap(config) {
	const { projection, width, height } = createMapProjection(config, config.textureWidth);
	const pathOf = geoPath(projection);
	const land = feature(topology, topology.objects.land);
	const borders = mesh(topology, topology.objects.countries, (a, b) => a !== b);
	const graticule = geoGraticule().step([15, 15])();
	const outline = { type: 'Sphere' };
	const s = width / 2048; // stroke widths are tuned at 2048px

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="age" cx="50%" cy="45%" r="75%">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.7" stop-color="#000" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
    </radialGradient>
    <linearGradient id="foldV" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.45" stop-color="#000" stop-opacity="0.1"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.55" stop-color="#000" stop-opacity="0.06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <linearGradient id="foldH" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.45" stop-color="#000" stop-opacity="0.1"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.55" stop-color="#000" stop-opacity="0.06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${INK.sea}"/>
  <path d="${pathOf(outline)}" fill="${INK.sea}"/>
  <path d="${pathOf(graticule)}" fill="none" stroke="${INK.graticule}" stroke-width="${1.2 * s}" stroke-dasharray="${6 * s} ${5 * s}"/>
  <path d="${pathOf(land)}" fill="${INK.land}" stroke="${INK.coast}" stroke-width="${2.2 * s}" stroke-linejoin="round"/>
  <path d="${pathOf(borders)}" fill="none" stroke="${INK.border}" stroke-width="${1.1 * s}" stroke-dasharray="${3 * s} ${3 * s}"/>
  <rect width="${width}" height="${height}" fill="url(#age)"/>
  <rect x="${width / 3 - 40 * s}" width="${80 * s}" height="${height}" fill="url(#foldV)"/>
  <rect x="${(2 * width) / 3 - 40 * s}" width="${80 * s}" height="${height}" fill="url(#foldV)"/>
  <rect y="${height / 2 - 40 * s}" width="${width}" height="${80 * s}" fill="url(#foldH)"/>
  <rect x="${14 * s}" y="${14 * s}" width="${width - 28 * s}" height="${height - 28 * s}" fill="none" stroke="${INK.neatline}" stroke-width="${3 * s}"/>
  <rect x="${24 * s}" y="${24 * s}" width="${width - 48 * s}" height="${height - 48 * s}" fill="none" stroke="${INK.neatline}" stroke-width="${1 * s}"/>
</svg>`;

	const outDir = path.join(root, 'public', 'map');
	await mkdir(outDir, { recursive: true });
	const out = path.join(outDir, `${config.name}.webp`);
	const info = await sharp(Buffer.from(svg)).webp({ quality: 84 }).toFile(out);
	console.log(`${config.name}: ${info.width}×${info.height}, ${(info.size / 1024).toFixed(0)} KB → ${path.relative(root, out)}`);
	return { out, width, height };
}

const wanted = process.argv[2];
const list = wanted ? [configs[wanted.toUpperCase()]] : [configs.MAP];
if (list.some((c) => !c)) {
	console.error(`Unknown map config "${wanted}". Known: ${Object.keys(configs).join(', ')}`);
	process.exit(1);
}
for (const config of list) await drawMap(config);
