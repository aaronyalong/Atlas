import { geoNaturalEarth1, type GeoProjection } from 'd3-geo';
import type { MapConfig } from './config.ts';

/**
 * The map projection, shared by the texture script (scripts/map.mjs) and the page that places
 * the pins (src/pages/index.astro). Both must agree exactly, or pins drift off their cities.
 *
 * Natural Earth is a compromise projection: neither shapes nor areas are exact, but nothing is
 * grossly stretched, which is why atlases use it. The crop rectangle is defined in the rotated
 * lon/lat space; its outline is projected, its bounding box found, and the projection scaled and
 * shifted so that box fills `width` × `height` pixels.
 */
export interface MapGeometry {
	projection: GeoProjection;
	width: number;
	height: number;
	/** width / height of the cropped map. */
	aspect: number;
}

export function createMapProjection(config: MapConfig, width: number): MapGeometry {
	const { rotation, crop } = config;
	const projection = geoNaturalEarth1().rotate(rotation).scale(1).translate([0, 0]);

	// Walk the crop's outline (in absolute lon/lat) and project it to find its extent.
	const toAbsoluteLng = (relative: number) => ((relative - rotation[0] + 540) % 360) - 180;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const sample = (lng: number, lat: number) => {
		const p = projection([toAbsoluteLng(lng), lat]);
		if (!p) return;
		minX = Math.min(minX, p[0]);
		maxX = Math.max(maxX, p[0]);
		minY = Math.min(minY, p[1]);
		maxY = Math.max(maxY, p[1]);
	};
	const STEPS = 180;
	for (let i = 0; i <= STEPS; i++) {
		const t = i / STEPS;
		const lng = crop.lng[0] + (crop.lng[1] - crop.lng[0]) * t;
		const lat = crop.lat[0] + (crop.lat[1] - crop.lat[0]) * t;
		sample(lng, crop.lat[0]);
		sample(lng, crop.lat[1]);
		sample(crop.lng[0], lat);
		sample(crop.lng[1], lat);
	}

	const aspect = (maxX - minX) / (maxY - minY);
	const height = Math.round(width / aspect);
	const scale = width / (maxX - minX);
	projection
		.scale(scale)
		.translate([-minX * scale, -minY * scale])
		.clipExtent([
			[0, 0],
			[width, height],
		]);
	return { projection, width, height, aspect };
}

/**
 * A trip's place on the map, as fractions of its width and height (0–1 from the top-left), or
 * null if it falls outside the crop.
 */
export function locate(geometry: MapGeometry, lat: number, lng: number): [number, number] | null {
	const p = geometry.projection([lng, lat]);
	if (!p) return null;
	const u = p[0] / geometry.width;
	const v = p[1] / geometry.height;
	if (u < 0 || u > 1 || v < 0 || v > 1) return null;
	return [u, v];
}
