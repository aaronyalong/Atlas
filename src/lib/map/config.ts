/**
 * The world map on the desk: which part of the world it shows and how big the paper is.
 *
 * This is the one place to change when the trips spread out (say, to Europe): re-centre or widen
 * the crop, then run `npm run map` to redraw the texture. The pins reproject themselves at the
 * next build from the same numbers (src/lib/map/projection.ts).
 */
export interface MapConfig {
	/** Which map to draw; the texture is written as public/map/<name>.webp. */
	name: string;
	/**
	 * Projection rotation [longitude, latitude] in degrees: the world turns by this before being
	 * drawn, so the central meridian is at -rotation[0]. [-170, 0] puts the Pacific in the middle
	 * with the Americas on the right and East Asia on the left.
	 */
	rotation: [number, number];
	/**
	 * The crop, in degrees relative to the central meridian (so 0 is the middle of the map) and
	 * absolute latitude. `lng: [-65, 125]` with rotation -170 shows from 105°E round to 65°W.
	 */
	crop: { lng: [number, number]; lat: [number, number] };
	/** Paper size in metres: the texture's aspect follows the crop, fitted inside this box. */
	maxSize: { width: number; depth: number };
	/** Texture width in px; the height follows the crop's aspect. */
	textureWidth: number;
}

/** Pacific-centred: the US and East Asia sit together in the middle. */
export const PACIFIC: MapConfig = {
	name: 'world-pacific',
	rotation: [-170, 0],
	crop: { lng: [-62, 118], lat: [8, 64] },
	maxSize: { width: 0.46, depth: 0.28 },
	textureWidth: 2048,
};

/** Atlantic-centred (the usual atlas view), cropped to the same trips: kept for comparison. */
export const ATLANTIC: MapConfig = {
	name: 'world-atlantic',
	rotation: [0, 0],
	crop: { lng: [-130, 150], lat: [8, 64] },
	maxSize: { width: 0.46, depth: 0.28 },
	textureWidth: 2048,
};

/** The map the desk uses. */
export const MAP = PACIFIC;
