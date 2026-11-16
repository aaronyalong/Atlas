/**
 * Draws the default link-preview card, public/og/home.jpg (1200 × 630): `npm run og`.
 *
 * A dark warm background, the desk's map print laid on it at a slight angle with the trips'
 * pins, and the site's name. Drawn from the map texture and the trips' coordinates, so it never
 * shows placeholder content. Rasterised by sharp (already installed with Astro). Re-run after
 * adding trips or changing the map.
 */
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { MAP } from '../src/lib/map/config.ts';
import { createMapSheet, locate } from '../src/lib/map/projection.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;

// Trip coordinates straight from the content files' frontmatter (lat: / lng: lines).
const dir = path.join(root, 'src', 'content', 'trips');
const trips = [];
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.md'))) {
	const text = await readFile(path.join(dir, file), 'utf8');
	const lat = Number(text.match(/^lat:\s*(-?[\d.]+)/m)?.[1]);
	const lng = Number(text.match(/^lng:\s*(-?[\d.]+)/m)?.[1]);
	if (Number.isFinite(lat) && Number.isFinite(lng)) trips.push({ lat, lng });
}

const sheet = createMapSheet(MAP);
const mapW = 900;
const mapH = Math.round(mapW / sheet.aspect);
const mapPng = await sharp(path.join(root, 'public', 'map', `${MAP.name}.webp`)).resize(mapW, mapH).png().toBuffer();
const pins = trips
	.map(({ lat, lng }) => locate(sheet, lat, lng))
	.filter(Boolean)
	.map(([u, v]) => {
		const x = (u * mapW).toFixed(1);
		const y = (v * mapH).toFixed(1);
		// Brass pins with a gold ripple, as on the desk.
		return `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="#e8b85c" stroke-opacity="0.5" stroke-width="2"/><circle cx="${x}" cy="${y}" r="8" fill="#c29a4b" stroke="#6f4f1d" stroke-width="1.5"/><circle cx="${x - 2.5}" cy="${y - 2.5}" r="2.5" fill="#fff1c9" opacity="0.8"/>`;
	})
	.join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
  <defs>
    <radialGradient id="lamp" cx="38%" cy="42%" r="70%">
      <stop offset="0" stop-color="#2a2d33"/><stop offset="0.55" stop-color="#16181c"/><stop offset="1" stop-color="#0b0c0e"/>
    </radialGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#lamp)"/>
  <g transform="translate(${(W - mapW) / 2 + 40} 150) rotate(-2 ${mapW / 2} ${mapH / 2})">
    <rect x="6" y="16" width="${mapW}" height="${mapH}" fill="#000" opacity="0.6" filter="url(#blur)"/>
    <image width="${mapW}" height="${mapH}" xlink:href="data:image/png;base64,${mapPng.toString('base64')}"/>
    ${pins}
  </g>
  <text x="60" y="88" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="54" font-weight="700" fill="#ececef">Travel</text>
  <text x="62" y="124" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="24" fill="#a0a0aa">Aaron Yalong's travel scrapbook</text>
  <text x="${W - 60}" y="${H - 44}" text-anchor="end" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="22" fill="#a0a0aa">travel.aaronyalong.com</text>
</svg>`;

await mkdir(path.join(root, 'public', 'og'), { recursive: true });
const out = path.join(root, 'public', 'og', 'home.jpg');
const info = await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
console.log(`home.jpg: ${info.width}×${info.height}, ${(info.size / 1024).toFixed(0)} KB, ${trips.length} pins → ${path.relative(root, out)}`);
