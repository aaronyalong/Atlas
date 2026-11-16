/**
 * The world map on the desk: which part of the world it shows, how it's laid out on its sheet,
 * and how big the sheet is.
 *
 * This is the one place to change when re-centring the map: edit it, then run `npm run map` to
 * redraw the texture (and `npm run og` for the link-preview card). The pins reproject themselves
 * at the next build from the same numbers (src/lib/map/projection.ts).
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
	 * absolute latitude.
	 */
	crop: { lng: [number, number]; lat: [number, number] };
	/**
	 * Margins around the chart: `side` as a fraction of the sheet's width, `top` (the title band)
	 * and `bottom` (the scale band) as fractions of the chart's height.
	 */
	margins: { side: number; top: number; bottom: number };
	/** Sheet width in metres on the desk (its depth follows the layout's aspect). */
	sheetWidth: number;
	/** Texture width in px; the height follows. */
	textureWidth: number;
}

/**
 * The whole world, Pacific-centred: the US and East Asia sit either side of the middle, Europe and
 * Africa at the edges. Antarctica and the far Arctic are cut (nobody pins them, and they'd take a
 * fifth of the sheet). A 1.8 m sheet: the whole width of the desk you see in the starting view.
 */
export const PACIFIC: MapConfig = {
	name: 'world-pacific',
	rotation: [-170, 0],
	crop: { lng: [-179.9, 179.9], lat: [-56, 78] },
	margins: { side: 0.035, top: 0.15, bottom: 0.1 },
	sheetWidth: 3,
	textureWidth: 4096,
};

/** The whole world, Atlantic-centred (the usual atlas view). `npm run map atlantic` to draw it. */
export const ATLANTIC: MapConfig = { ...PACIFIC, name: 'world-atlantic', rotation: [0, 0] };

/** The map the desk uses. */
export const MAP = PACIFIC;
