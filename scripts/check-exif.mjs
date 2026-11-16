#!/usr/bin/env node
/**
 * Fails if any image in the build carries metadata: EXIF (camera, date, and above all GPS), XMP or
 * IPTC. Trip photos are re-encoded by astro:assets, which drops it; this guards against a photo
 * slipping through untouched (say, dropped straight into public/) or a tool that copies metadata.
 * Run after `astro build` (`npm run build:deploy` does both).
 *
 * Colour profiles (ICC) are allowed: they carry no personal data.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
	console.error('No dist/ folder. Run `npm run build` first, or use `npm run build:deploy`.');
	process.exit(2);
}

const images = readdirSync(dist, { recursive: true })
	.filter((file) => /\.(jpe?g|png|webp|avif|tiff?|heic)$/i.test(file))
	.sort();

const found = [];
for (const file of images) {
	const { exif, xmp, iptc } = await sharp(join(dist, file)).metadata();
	const kinds = [exif && 'EXIF', xmp && 'XMP', iptc && 'IPTC'].filter(Boolean);
	if (kinds.length) found.push({ file, kinds });
}

if (found.length === 0) {
	console.log(`✓ No EXIF/XMP/IPTC metadata in ${images.length} image${images.length === 1 ? '' : 's'}.`);
	process.exit(0);
}

console.error(`✗ ${found.length} image(s) in ${relative(root, dist)}/ carry metadata:`);
for (const { file, kinds } of found) console.error(`  ${file}: ${kinds.join(', ')}`);
process.exit(1);
