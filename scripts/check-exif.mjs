#!/usr/bin/env node
/**
 * Fails if any image carries metadata: EXIF (camera, date, and above all GPS), XMP or IPTC.
 * Checks two places:
 *   - the build (dist/): trip photos are re-encoded by astro:assets, which drops it; this guards
 *     against a photo slipping through untouched (say, dropped straight into public/) or a tool
 *     that copies metadata;
 *   - the trip photos themselves (src/content/trips/): the originals are committed to a public
 *     GitHub repo, so they must be stripped too. Run `npm run check:exif` before committing photos.
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
const originals = join(root, 'src', 'content', 'trips');

if (!existsSync(dist)) {
	console.error('No dist/ folder. Run `npm run build` first, or use `npm run build:deploy`.');
	process.exit(2);
}

const images = [dist, originals].flatMap((dir) =>
	readdirSync(dir, { recursive: true })
		.filter((file) => /\.(jpe?g|png|webp|avif|tiff?|heic)$/i.test(file))
		.sort()
		.map((file) => relative(root, join(dir, file))),
);

const found = [];
for (const file of images) {
	const { exif, xmp, iptc } = await sharp(join(root, file)).metadata();
	const kinds = [exif && 'EXIF', xmp && 'XMP', iptc && 'IPTC'].filter(Boolean);
	if (kinds.length) found.push({ file, kinds });
}

if (found.length === 0) {
	console.log(`✓ No EXIF/XMP/IPTC metadata in ${images.length} image${images.length === 1 ? '' : 's'} (the build and the trip photos).`);
	process.exit(0);
}

console.error(`✗ ${found.length} image(s) carry metadata:`);
for (const { file, kinds } of found) console.error(`  ${file}: ${kinds.join(', ')}`);
process.exit(1);
