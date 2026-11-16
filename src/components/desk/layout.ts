/*
 * Where the props sit on the desk (metres; desk top at y = 0, +z toward the viewer).
 *
 * The map takes the middle of the desk (1.4 × 0.68 m, centred). The banker's lamp stands behind
 * it at the back left (src/components/desk/BankersLamp.tsx); the two props flank it: the camera
 * in the gap to its left, the journal to its right.
 */

/** Where a prop sits: desk position (metres), optional height, and its turn in degrees. */
export interface PropSpot {
	x: number;
	z: number;
	y?: number;
	turn: number;
}

export interface PropSpots {
	journal: PropSpot;
	camera: PropSpot;
}

const SPOTS: PropSpots = {
	// Lens toward the viewer and a little to the right, as if just put down.
	camera: { x: -0.84, z: 0.1, turn: 28 },
	// Spine on the left, like a book facing you: it opens to the left and the page reads upright.
	journal: { x: 0.85, z: -0.06, turn: -4 },
};

export const propSpots = (_portrait: boolean): PropSpots => SPOTS;
