import { geoNaturalEarth1, type GeoProjection } from 'd3-geo';
import type { MapConfig } from './config.ts';

/**
 * The map projection and the sheet it's printed on, shared by the texture script
 * (scripts/map.mjs), the page that places the pins (src/pages/index.astro) and the link-preview
 * card. They must all agree exactly, or pins drift off their cities.
 *
 * Natural Earth is a compromise projection: neither shapes nor areas are exact, but nothing is
 * grossly stretched, which is why atlases use it.
 *
 * The sheet is the chart (the projected world, cropped) plus margins: a band at the top for the
 * title, a band at the bottom for the scale, and narrow sides. All measurements are in texture
 * pixels; `uv` positions are fractions of the whole sheet from its top-left corner.
 */
export interface MapSheet {
	/** Projects [lng, lat] to sheet pixels. */
	projection: GeoProjection;
	/** The whole sheet, in pixels. */
	width: number;
	height: number;
	/** The chart's rectangle on the sheet, in pixels. */
	chart: { x: number; y: number; width: number; height: number };
	/** width / height of the whole sheet. */
	aspect: number;
}

export function createMapSheet(config: MapConfig, width = config.textureWidth): MapSheet {
	const { rotation, crop, margins } = config;
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

	const chartWidth = width * (1 - 2 * margins.side);
	const chartHeight = chartWidth * ((maxY - minY) / (maxX - minX));
	const chartX = width * margins.side;
	const chartY = chartHeight * margins.top;
	const height = Math.round(chartY + chartHeight + chartHeight * margins.bottom);
	const scale = chartWidth / (maxX - minX);
	projection
		.scale(scale)
		.translate([chartX - minX * scale, chartY - minY * scale])
		.clipExtent([
			[chartX, chartY],
			[chartX + chartWidth, chartY + chartHeight],
		]);
	return {
		projection,
		width,
		height,
		chart: { x: chartX, y: chartY, width: chartWidth, height: chartHeight },
		aspect: width / height,
	};
}

/**
 * A place's position on the sheet, as fractions of its width and height (0–1 from the top-left),
 * or null if it falls outside the chart's crop.
 */
export function locate(sheet: MapSheet, lat: number, lng: number): [number, number] | null {
	const p = sheet.projection([lng, lat]);
	if (!p) return null;
	const { x, y, width, height } = sheet.chart;
	if (p[0] < x || p[0] > x + width || p[1] < y || p[1] > y + height) return null;
	return [p[0] / sheet.width, p[1] / sheet.height];
}
