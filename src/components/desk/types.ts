import type { EmblemName } from '../../lib/emblems';

/**
 * A trip as the 3D desk sees it: plain, serialisable data prepared at build time by
 * src/pages/index.astro (photo already processed, map position already projected). Only what the
 * pin, the preview and the world clock need: dates, the journal and the rest of the photos are on
 * the trip's page.
 */
export interface DeskTrip {
	/** URL slug and stable id, e.g. "tokyo". */
	slug: string;
	title: string;
	place: string;
	/** The one photo in its preview: the cover, processed WebP (metadata stripped). Null until added. */
	photo: { src: string; alt: string } | null;
	/** The picture on its design card (TripEmblem.tsx); null gets a compass rose. */
	emblem: EmblemName | null;
	/** The trip's page. */
	href: string;
	/** Where its pin goes: fractions of the sheet's width and height from the top-left corner. */
	map: [number, number] | null;
	/** IANA time zone, for its world clock on the gauge panel; null if not set. */
	timeZone: string | null;
}

/** The map sheet, as prepared at build time. */
export interface DeskMap {
	/** The texture, e.g. /map/world-pacific.webp. */
	src: string;
	/** Sheet size in metres. */
	width: number;
	depth: number;
}
