/**
 * Draws the desk's world map texture: `npm run map` (or `node scripts/map.mjs [config-name]`).
 *
 * Natural Earth data (public domain, via the world-atlas package) is projected with the same
 * code the site uses to place pins (src/lib/map/projection.ts), drawn as SVG in the style of a
 * dark navy chart, and rasterised by sharp to public/map/<name>.webp. The output is committed:
 * the build never runs this.
 *
 * The style, from the back: a navy sea with a soft vignette; a faint graticule; engraved water
 * lines rippling out from every coast (the coast stroked several times, each a little wider,
 * with sea painted back over all but a hairline); sand-coloured land with dashed borders; the
 * globe's outline; then the sheet's dressing: a gold double border graduated every 10°, a title
 * band, a compass rose in the empty South Pacific, and a scale bar.
 *
 * Node strips the TypeScript types from the imported modules itself (Node ≥ 22.18), so the
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
import { createMapSheet } from '../src/lib/map/projection.ts';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Navy chart palette.
const INK = {
	sheet: '#0d1626',
	sea: '#12233b',
	seaEdge: '#0b1729',
	waterLine: '#2e4a6e',
	graticule: '#22395a',
	equator: '#8a7448',
	land: '#c7b28a',
	landShade: '#b29c73',
	coast: '#e9dcb8',
	border: '#8a7656',
	gold: '#c9a75e',
	goldDim: '#8f7642',
	text: '#e6d6ad',
	textDim: '#9e8c66',
};

const SANS = 'DejaVu Sans, Helvetica, Arial, sans-serif';
const SERIF = 'DejaVu Serif, Georgia, serif';

export async function drawMap(config) {
	const sheet = createMapSheet(config);
	const { projection, width, height, chart } = sheet;
	const pathOf = geoPath(projection);
	const land = feature(topology, topology.objects.land);
	const borders = mesh(topology, topology.objects.countries, (a, b) => a !== b);
	const graticule = geoGraticule().step([15, 15])();
	const parallel = (lat) => ({ type: 'LineString', coordinates: Array.from({ length: 361 }, (_, i) => [i - 180, lat]) });
	const outline = { type: 'Sphere' };
	const s = width / 4096; // line widths and text sizes are tuned at 4096px
	const landPath = pathOf(land);
	const centre = -config.rotation[0]; // the central meridian

	// Engraved water lines: widest first, each stroked in line colour then painted back with sea
	// colour a hair narrower, leaving concentric hairlines around every coast.
	const ripples = [64, 46, 32, 20, 11]
		.map(
			(w, i) =>
				`<path d="${landPath}" fill="none" stroke="${INK.waterLine}" stroke-opacity="${0.35 + i * 0.12}" stroke-width="${w * s}" stroke-linejoin="round"/>` +
				`<path d="${landPath}" fill="none" stroke="${INK.sea}" stroke-width="${(w - 2.4) * s}" stroke-linejoin="round"/>`,
		)
		.join('');

	// Graduated border: alternating gold segments every 10° of longitude along the top and bottom
	// (measured at the equator), every 10° of latitude down the sides (on the central meridian).
	const ticks = [];
	const bx0 = chart.x - 18 * s;
	const bx1 = chart.x + chart.width + 18 * s;
	const by0 = chart.y - 18 * s;
	const by1 = chart.y + chart.height + 18 * s;
	const xs = [];
	for (let lng = -180; lng < 180; lng += 10) {
		const p = projection([lng, 0]);
		if (p) xs.push(p[0]);
	}
	xs.sort((a, b) => a - b);
	xs.forEach((x, i) => {
		if (i % 2) return;
		const next = xs[i + 1] ?? chart.x + chart.width;
		ticks.push(`<rect x="${x}" y="${by0}" width="${next - x}" height="${8 * s}" fill="${INK.gold}"/>`);
		ticks.push(`<rect x="${x}" y="${by1 - 8 * s}" width="${next - x}" height="${8 * s}" fill="${INK.gold}"/>`);
	});
	const ys = [];
	for (let lat = -90; lat <= 90; lat += 10) {
		const p = projection([centre, lat]);
		if (p) ys.push(p[1]);
	}
	ys.sort((a, b) => a - b);
	ys.forEach((y, i) => {
		if (i % 2) return;
		const next = ys[i + 1] ?? chart.y + chart.height;
		ticks.push(`<rect x="${bx0}" y="${y}" width="${8 * s}" height="${next - y}" fill="${INK.gold}"/>`);
		ticks.push(`<rect x="${bx1 - 8 * s}" y="${y}" width="${8 * s}" height="${next - y}" fill="${INK.gold}"/>`);
	});

	// Compass rose, in the empty ocean west of South America.
	const rosePos = projection([-120, -38]) ?? [chart.x + chart.width * 0.7, chart.y + chart.height * 0.75];
	const R = 150 * s;
	const point = (angle, long, short, light, dark) => {
		const a = (angle * Math.PI) / 180;
		const tip = [Math.sin(a) * long, -Math.cos(a) * long];
		const l = [Math.sin(a - Math.PI / 2) * short, -Math.cos(a - Math.PI / 2) * short];
		const r = [Math.sin(a + Math.PI / 2) * short, -Math.cos(a + Math.PI / 2) * short];
		return `<path d="M0 0 L${l[0]} ${l[1]} L${tip[0]} ${tip[1]} Z" fill="${light}"/><path d="M0 0 L${r[0]} ${r[1]} L${tip[0]} ${tip[1]} Z" fill="${dark}"/>`;
	};
	const rose = `<g transform="translate(${rosePos[0]} ${rosePos[1]})">
	  <circle r="${R * 1.05}" fill="none" stroke="${INK.goldDim}" stroke-width="${2 * s}"/>
	  <circle r="${R * 0.97}" fill="none" stroke="${INK.goldDim}" stroke-width="${1 * s}" stroke-dasharray="${3 * s} ${6 * s}"/>
	  ${[45, 135, 225, 315].map((a) => point(a, R * 0.6, R * 0.08, INK.goldDim, '#6e5a33')).join('')}
	  ${[0, 90, 180, 270].map((a) => point(a, R, R * 0.13, INK.gold, INK.goldDim)).join('')}
	  <circle r="${R * 0.06}" fill="${INK.sheet}" stroke="${INK.gold}" stroke-width="${2 * s}"/>
	  <text y="${-R * 1.18}" text-anchor="middle" font-family="${SERIF}" font-size="${46 * s}" font-weight="700" fill="${INK.text}">N</text>
	</g>`;

	// Scale bar in the bottom band: 5,000 km of longitude at the equator.
	const a = projection([centre, 0]);
	const b = projection([centre + 44.966, 0]);
	const scaleLen = a && b ? Math.abs(b[0] - a[0]) : chart.width * 0.12;
	const band = height - (chart.y + chart.height);
	const sx = chart.x + chart.width - scaleLen;
	const sy = chart.y + chart.height + band * 0.55;
	const scale = `<g>
	  ${[0, 1, 2, 3, 4].map((i) => `<rect x="${sx + (i * scaleLen) / 5}" y="${sy}" width="${scaleLen / 5}" height="${10 * s}" fill="${i % 2 ? INK.sheet : INK.gold}" stroke="${INK.gold}" stroke-width="${1.5 * s}"/>`).join('')}
	  <text x="${sx}" y="${sy - 14 * s}" font-family="${SANS}" font-size="${26 * s}" fill="${INK.textDim}">0</text>
	  <text x="${sx + scaleLen}" y="${sy - 14 * s}" text-anchor="end" font-family="${SANS}" font-size="${26 * s}" fill="${INK.textDim}">5,000 km at the equator</text>
	</g>`;
	const note = `<text x="${chart.x}" y="${sy + 8 * s}" font-family="${SANS}" font-size="${24 * s}" letter-spacing="${4 * s}" fill="${INK.textDim}">DATA: NATURAL EARTH (PUBLIC DOMAIN)</text>`;

	// Title band.
	const ty = chart.y * 0.58;
	const title = `<g text-anchor="middle">
	  <text x="${width / 2}" y="${ty}" font-family="${SERIF}" font-size="${118 * s}" font-weight="700" letter-spacing="${28 * s}" fill="${INK.text}">TRAVELS</text>
	  <line x1="${width / 2 - 640 * s}" y1="${ty - 40 * s}" x2="${width / 2 - 380 * s}" y2="${ty - 40 * s}" stroke="${INK.gold}" stroke-width="${2 * s}"/>
	  <line x1="${width / 2 + 380 * s}" y1="${ty - 40 * s}" x2="${width / 2 + 640 * s}" y2="${ty - 40 * s}" stroke="${INK.gold}" stroke-width="${2 * s}"/>
	  <text x="${width / 2}" y="${ty + 62 * s}" font-family="${SANS}" font-size="${30 * s}" letter-spacing="${10 * s}" fill="${INK.textDim}">AARON YALONG · NATURAL EARTH PROJECTION</text>
	</g>`;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="deep" cx="50%" cy="55%" r="70%">
      <stop offset="0" stop-color="${INK.sea}"/><stop offset="1" stop-color="${INK.seaEdge}"/>
    </radialGradient>
    <radialGradient id="age" cx="50%" cy="45%" r="75%">
      <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.75" stop-color="#000" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/>
    </radialGradient>
    <clipPath id="globe"><path d="${pathOf(outline)}"/></clipPath>
  </defs>
  <rect width="${width}" height="${height}" fill="${INK.sheet}"/>
  <g clip-path="url(#globe)">
    <rect width="${width}" height="${height}" fill="url(#deep)"/>
    <path d="${pathOf(graticule)}" fill="none" stroke="${INK.graticule}" stroke-width="${1.6 * s}"/>
    ${[23.44, -23.44].map((lat) => `<path d="${pathOf(parallel(lat))}" fill="none" stroke="${INK.goldDim}" stroke-opacity="0.5" stroke-width="${1.4 * s}" stroke-dasharray="${10 * s} ${10 * s}"/>`).join('')}
    <path d="${pathOf(parallel(0))}" fill="none" stroke="${INK.equator}" stroke-width="${2.2 * s}" stroke-dasharray="${18 * s} ${8 * s}"/>
    ${ripples}
    <path d="${landPath}" fill="${INK.land}"/>
    <path d="${landPath}" fill="none" stroke="${INK.landShade}" stroke-width="${10 * s}" stroke-opacity="0.6" stroke-linejoin="round"/>
    <path d="${pathOf(borders)}" fill="none" stroke="${INK.border}" stroke-width="${1.4 * s}" stroke-dasharray="${4 * s} ${4 * s}"/>
    <path d="${landPath}" fill="none" stroke="${INK.coast}" stroke-width="${2 * s}" stroke-linejoin="round"/>
  </g>
  <path d="${pathOf(outline)}" fill="none" stroke="${INK.gold}" stroke-width="${3 * s}"/>
  ${rose}
  <rect x="${bx0}" y="${by0}" width="${bx1 - bx0}" height="${by1 - by0}" fill="none" stroke="${INK.gold}" stroke-width="${2 * s}"/>
  <rect x="${bx0 + 8 * s}" y="${by0 + 8 * s}" width="${bx1 - bx0 - 16 * s}" height="${by1 - by0 - 16 * s}" fill="none" stroke="${INK.goldDim}" stroke-width="${1.5 * s}"/>
  ${ticks.join('')}
  <rect x="${bx0 - 14 * s}" y="${by0 - 14 * s}" width="${bx1 - bx0 + 28 * s}" height="${by1 - by0 + 28 * s}" fill="none" stroke="${INK.goldDim}" stroke-width="${3 * s}"/>
  ${title}
  ${scale}
  ${note}
  <rect width="${width}" height="${height}" fill="url(#age)"/>
</svg>`;

	const outDir = path.join(root, 'public', 'map');
	await mkdir(outDir, { recursive: true });
	const out = path.join(outDir, `${config.name}.webp`);
	const info = await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(out);
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
