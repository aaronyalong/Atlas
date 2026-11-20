/**
 * Seeded random numbers: what gives each hand-placed thing on the desk (a pin's lean, a pass's
 * barcode, the stars) its own small variations, the same on every visit.
 *
 * A random-number generator seeded from a string (FNV-1a hash into mulberry32).
 */
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
