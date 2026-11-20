/**
 * The emblems a trip can carry in its preview on the desk (the `emblem` field in a trip's
 * file). Each is a small deco picture of the place, drawn in src/components/desk/TripEmblem.tsx;
 * a trip without one gets a compass rose.
 *
 * To add one: add its name here, draw it in TripEmblem.tsx, and set `emblem: <name>` on the trip.
 */
export const EMBLEMS = [
	'torii',
	'tower',
	'falls',
	'star',
	'canyon',
	'redwoods',
	'church',
	'palm',
	'bridge',
	'sign',
	'dunes',
	'needle',
	'spires',
	'clock',
	'arches',
	'temple',
] as const;

export type EmblemName = (typeof EMBLEMS)[number];
