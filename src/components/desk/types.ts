/**
 * A trip as the 3D desk sees it: plain, serialisable data prepared at build time by
 * src/pages/index.astro (dates already formatted, photo already processed, map position
 * already projected). `null` means "not written yet": the desk shows a visible TODO in its place.
 */
export interface DeskTrip {
	/** URL slug and stable id, e.g. "tokyo". */
	slug: string;
	title: string;
	place: string;
	/** Handwritten on the polaroid. */
	caption: string;
	dates: string | null;
	blurb: string | null;
	/** The trip's page. */
	href: string;
	/** Processed cover photo (WebP, metadata stripped). */
	photo: { src: string; alt: string } | null;
	/** Gets a polaroid on the desk. Every trip gets a map pin. */
	featured: boolean;
	/** Where its pin goes: fractions of the map's width and height from the top-left corner. */
	map: [number, number] | null;
}

/** The map sheet, as prepared at build time. */
export interface DeskMap {
	/** The texture, e.g. /map/world-pacific.webp. */
	src: string;
	/** Paper size in metres (already fitted to the crop's aspect). */
	width: number;
	depth: number;
}

/** Something on the desk you can hover, focus and open. */
export type ItemKind = 'polaroid' | 'pin';

export interface ItemRef {
	kind: ItemKind;
	slug: string;
}

/** "polaroid:tokyo": one string to compare and to use as a DOM id. */
export const itemId = (kind: ItemKind, slug: string) => `${kind}:${slug}`;

export const sameItem = (a: ItemRef | null, b: ItemRef) => a !== null && a.kind === b.kind && a.slug === b.slug;
