import type { Vector3Tuple } from 'three';
import type { DeskTrip } from './types';

/*
 * Where things sit on the desk (metres; desk top at y = 0, +z toward the viewer).
 *
 * The middle of the desk (about 46 × 26 cm) is kept free for the world map (phase 3). Polaroids
 * go in hand-placed "slots" around it, inside the lamp's pool of light, each at a slight angle
 * like they were dropped there. Featured trips fill the slots in order (most recent first).
 *
 * Wide and tall screens get different slots: a landscape view has room beside the map, a
 * portrait phone view (which starts swung 25° to the right) only in front of and behind it.
 */
export interface PolaroidSlot {
	x: number;
	z: number;
	/** Turn in the desk plane, in degrees. */
	turn: number;
}

const WIDE_SLOTS: PolaroidSlot[] = [
	{ x: 0.36, z: -0.2, turn: -8 },
	{ x: 0.42, z: 0.04, turn: 6 },
	{ x: 0.28, z: 0.27, turn: -4 },
	{ x: -0.06, z: 0.3, turn: 9 },
	{ x: -0.32, z: 0.22, turn: -7 },
	{ x: 0.5, z: -0.3, turn: 12 },
];

const TALL_SLOTS: PolaroidSlot[] = [
	{ x: -0.12, z: -0.3, turn: -6 },
	{ x: 0.16, z: -0.3, turn: 8 },
	{ x: 0.04, z: 0.32, turn: -9 },
	{ x: -0.24, z: 0.3, turn: 5 },
	{ x: 0.3, z: 0.26, turn: 7 },
	{ x: 0.32, z: -0.1, turn: -10 },
];

export interface PlacedPolaroid {
	trip: DeskTrip;
	/** Resting position on the desk. */
	rest: Vector3Tuple;
	/** Resting turn in the desk plane, in radians. */
	turn: number;
}

export function placePolaroids(trips: DeskTrip[], portrait: boolean): PlacedPolaroid[] {
	const SLOTS = portrait ? TALL_SLOTS : WIDE_SLOTS;
	if (trips.length > SLOTS.length) {
		console.warn(
			`${trips.length} featured trips but only ${SLOTS.length} polaroid slots; the oldest are left off the desk (they still get map pins).`,
		);
	}
	return trips.slice(0, SLOTS.length).map((trip, i) => {
		const slot = SLOTS[i];
		return {
			trip,
			// Each one a hair higher than the last, so overlapping prints never flicker
			// ("z-fighting": two surfaces at the same depth, the GPU can't pick which is in front).
			rest: [slot.x, 0.0015 + i * 0.0006, slot.z],
			turn: (slot.turn * Math.PI) / 180,
		};
	});
}

/**
 * The "picked up" pose for an opened polaroid: lifted off the desk and a little toward the
 * viewer. The camera then frames it from the front, looking down at 45°.
 */
export function presentedPosition(rest: Vector3Tuple): Vector3Tuple {
	return [rest[0], 0.1, rest[2] + 0.04];
}

/** Where a prop sits: desk position (metres), optional height, and its turn in degrees. */
export interface PropSpot {
	x: number;
	z: number;
	y?: number;
	turn: number;
}

export interface PropSpots {
	passport: PropSpot;
	journal: PropSpot;
	boardingPass: PropSpot;
	trainTicket: PropSpot;
	camera: PropSpot;
}

/*
 * The props fill the gaps the polaroids leave: the camera between the lamp and the map, the
 * journal behind the map, the passport off to one side, the tickets in a little overlapping pile.
 * The train ticket sits a hair higher than the boarding pass it overlaps.
 */
const WIDE_PROPS: PropSpots = {
	camera: { x: -0.37, z: -0.08, turn: 24 },
	// Spine on the left, like a book facing you: it opens to the left and the page reads upright.
	journal: { x: -0.02, z: -0.27, turn: -6 },
	passport: { x: 0.62, z: 0.25, turn: -14 },
	boardingPass: { x: -0.5, z: 0.36, turn: 10 },
	trainTicket: { x: -0.43, z: 0.43, y: 0.0006, turn: -9 },
};

const TALL_PROPS: PropSpots = {
	camera: { x: -0.37, z: -0.07, turn: 30 },
	journal: { x: 0.04, z: -0.52, turn: -8 },
	passport: { x: 0.14, z: 0.52, turn: -14 },
	boardingPass: { x: -0.2, z: 0.52, turn: 8 },
	trainTicket: { x: -0.14, z: 0.59, y: 0.0006, turn: -10 },
};

export const propSpots = (portrait: boolean): PropSpots => (portrait ? TALL_PROPS : WIDE_PROPS);
