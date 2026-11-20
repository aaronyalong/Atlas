import type { EmblemName } from '../../lib/emblems';

/**
 * A trip as the 3D desk sees it: plain, serialisable data prepared at build time by
 * src/pages/index.astro (map position already projected). Only what the pin, the boarding pass
 * and the world clock need: dates, the journal and the photos are on the trip's page.
 */
export interface DeskTrip {
	/** URL slug and stable id, e.g. "tokyo". */
	slug: string;
	title: string;
	place: string;
	/** Decimal degrees, north and east positive: printed on the boarding pass. */
	lat: number;
	lng: number;
	/** The picture on its boarding pass (TripEmblem.tsx); null gets a compass rose. */
	emblem: EmblemName | null;
	/** The trip's page. */
	href: string;
	/** Where its pin goes: fractions of the sheet's width and height from the top-left corner. */
	map: [number, number] | null;
	/** IANA time zone, for its world clock on the gauge panel and its pass; null if not set. */
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
