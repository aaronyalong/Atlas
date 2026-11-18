/*
 * The polaroid prints a trip's photos are shown on, on the desk (TripReveal.tsx), and the seeded
 * random numbers that give each print (and other hand-placed things) its own small variations.
 *
 * Proportions come from a real Polaroid 600 print: 88 × 107 mm, with a 79 × 79 mm picture, 4.5 mm
 * side borders, a 6 mm top border, and the wide strip at the bottom where people write. The
 * print itself is HTML (.desk-print in desk.css), laid out at 5 px a millimetre.
 */
export const PRINT = { width: 88, height: 107, side: 4.5, top: 6, picture: 79 } as const;

/** Size in metres: a real print scaled up 1.25×, so it reads at desk-viewing distance. */
export const POLAROID_SIZE = {
	width: (PRINT.width / 1000) * 1.25,
	height: (PRINT.height / 1000) * 1.25,
	thickness: 0.0025,
} as const;

/** A random-number generator seeded from a string (FNV-1a hash into mulberry32). */
export function seededRandom(seed: string) {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
	let a = h >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
