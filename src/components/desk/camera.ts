/**
 * Where the camera starts and how far it may move.
 *
 * Units are metres; the desk's top surface is the plane y = 0, centred on the origin, with +z
 * toward the viewer. CameraControls describes the camera by its position on a sphere around a
 * target point (spherical coordinates):
 *   - polar angle:   0 = straight down from overhead, 90° = level with the desk
 *   - azimuth angle: 0 = in front of the desk (+z), positive = swung round to the right
 *   - distance:      how far from the target (zooming changes this)
 */
const deg = (d: number) => (d * Math.PI) / 180;

/** The orbit limits (the rotation part of "limited orbit"). */
export const ORBIT_LIMITS = {
	/** Never straight overhead (and, zoomed right out, never up through the ceiling)... */
	minPolarAngle: deg(35),
	/** ...and never down at desk level. */
	maxPolarAngle: deg(70),
	/** 45° either side of the front: a 90° arc in total. */
	minAzimuthAngle: deg(-45),
	maxAzimuthAngle: deg(45),
} as const;

export interface Framing {
	/** A tall (portrait) screen: framed differently, and a trip's two cards stack instead of sitting side by side. */
	portrait: boolean;
	/** Vertical field of view, in degrees. */
	fov: number;
	/** The point the camera looks at and orbits around. */
	target: [number, number, number];
	/** Starting polar angle, in radians. */
	polar: number;
	/** Starting distance from the target. */
	distance: number;
	/** Starting azimuth, in radians. */
	azimuth: number;
	/** Starting camera position (`azimuth`, `polar`, `distance` away from the target). */
	position: [number, number, number];
	/** How far in and out the visitor can zoom. */
	minDistance: number;
	maxDistance: number;
}

/**
 * Where the point the camera orbits may be slid to (right-drag or two fingers, and zooming in
 * toward the cursor): over the map, back to the wall (so you can zoom in on the lamp and the
 * gauge panel), never off the desk. Kept narrow enough that, swung right round, the camera stays
 * inside the room.
 */
export const TARGET_BOUNDS = { min: [-1.6, -0.01, -0.9] as const, max: [1.6, 0.7, 0.8] as const };

/** An opened place is viewed from the front, looking down at 45° (its cards tip up to match). */
export const FOCUS_POLAR = deg(45);

/**
 * The starting shot for a viewport's aspect ratio (width / height).
 *
 * The lens is deliberately narrow (35°, like a 60 mm lens on a full-frame camera): a wide lens
 * balloons whatever is nearest and splays the desk's parallel edges apart, which reads as "video
 * game". The camera looks down on the desk steeply, 40° off overhead, so the map reads almost as a
 * plan and the wall is a strip across the top. On a wide screen the 3 m map runs edge to
 * edge (a little past the sides on a 16:10 screen) and down to just above the bottom, with the
 * lamp behind its back-left corner and the foot of the viewport (and Earth) above. That's about as
 * far out as the camera goes; zoom and slide to explore the map. A tall phone screen can't
 * show the map across at a readable size, so it frames the stretch the trips cover (East Asia to
 * the US, near the middle of the Pacific-centred map) and lets the rest run off the sides: drag
 * or zoom out to see it all.
 */
export function framingFor(aspect: number): Framing {
	const portrait = aspect < 1;
	const fov = portrait ? 48 : 35;
	const polar = deg(40);
	const distance = portrait ? 3.6 : 3.5;
	const azimuth = 0;
	const target: [number, number, number] = portrait ? [0.2, 0, -0.38] : [0, 0, -0.15];
	const [tx, ty, tz] = target;
	// Spherical → x/y/z: the polar angle tilts down from straight up, the azimuth swings around
	// the vertical axis from the front (+z).
	const horizontal = Math.sin(polar) * distance;
	return {
		portrait,
		fov,
		target,
		polar,
		distance,
		azimuth,
		position: [
			tx + Math.sin(azimuth) * horizontal,
			ty + Math.cos(polar) * distance,
			tz + Math.cos(azimuth) * horizontal,
		],
		// In close enough to read the map's coastlines; out barely past the starting view, which
		// already frames the map (any further and the desk turns into a sea of empty wood).
		minDistance: portrait ? 0.7 : 0.45,
		maxDistance: distance * 1.05,
	};
}

/**
 * The opening shot, before the camera cranes down to the starting view: low across the desk and
 * straight out through the viewport at Earth, from a little to the right.
 */
export function establishingShot(framing: Framing): { position: [number, number, number]; target: [number, number, number] } {
	const polar = ORBIT_LIMITS.maxPolarAngle - deg(1);
	const azimuth = framing.portrait ? deg(10) : deg(8);
	const distance = framing.portrait ? 2.6 : 2.4;
	const target: [number, number, number] = [0, 0.3, -0.6];
	const horizontal = Math.sin(polar) * distance;
	return {
		position: [target[0] + Math.sin(azimuth) * horizontal, target[1] + Math.cos(polar) * distance, target[2] + Math.cos(azimuth) * horizontal],
		target,
	};
}
