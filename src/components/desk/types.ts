/**
 * A trip as the 3D desk sees it: plain, serialisable data prepared at build time by
 * src/pages/index.astro (dates already formatted, photos already processed, map position
 * already projected). `null` means "not written yet": the desk shows a visible TODO in its place.
 */
export interface DeskTrip {
	/** URL slug and stable id, e.g. "tokyo". */
	slug: string;
	title: string;
	place: string;
	dates: string | null;
	/** How many days it ran (both ends counted), or null without dates. */
	days: number | null;
	blurb: string | null;
	/** The trip's page. */
	href: string;
	/** The cover, then the gallery: processed WebP (metadata stripped). Empty until added. */
	photos: { src: string; alt: string; caption: string | null }[];
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
