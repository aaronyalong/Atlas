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
	/** Never straight overhead... */
	minPolarAngle: deg(25),
	/** ...and never down at desk level. */
	maxPolarAngle: deg(70),
	/** 45° either side of the front: a 90° arc in total. */
	minAzimuthAngle: deg(-45),
	maxAzimuthAngle: deg(45),
} as const;

export interface Framing {
	/** A tall (portrait) screen: framed differently, and the polaroids use the tall layout. */
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

/** An opened place is viewed from the front, looking down at 45° (its photos tip up to match). */
export const FOCUS_POLAR = deg(45);

/**
 * The starting shot for a viewport's aspect ratio (width / height).
 *
 * The lens is deliberately narrow (35°, like a 60 mm lens on a full-frame camera): a wide lens
 * balloons whatever is nearest and splays the desk's parallel edges apart, which reads as "video
 * game". On a wide screen the camera looks across the desk at 55°, far enough back that the whole
 * map, the lamp, both props and the room behind fit. A tall phone screen can't show a 1.4 m map
 * across at a readable size, so it frames the stretch the trips cover (East Asia to the US, near
 * the middle of the Pacific-centred map) and lets the rest run off the sides: drag or zoom out
 * to see it all.
 */
export function framingFor(aspect: number): Framing {
	const portrait = aspect < 1;
	const fov = portrait ? 48 : 35;
	const polar = portrait ? deg(48) : deg(55);
	const distance = portrait ? 1.75 : 2.2;
	const azimuth = 0;
	const target: [number, number, number] = portrait ? [0.09, 0, -0.06] : [0, 0, -0.04];
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
		// Close enough to read the map's coastlines; not so far the desk is lost in the room.
		minDistance: portrait ? 0.8 : 0.55,
		maxDistance: portrait ? 4 : distance * 1.25,
	};
}

/**
 * The opening shot, before the camera cranes up to the starting view: low across the desk at the
 * lamp, the window and the bookshelf, from a little to the right and further back.
 */
export function establishingShot(framing: Framing): { position: [number, number, number]; target: [number, number, number] } {
	const polar = ORBIT_LIMITS.maxPolarAngle - deg(1);
	const azimuth = framing.portrait ? deg(30) : deg(18);
	const distance = framing.maxDistance;
	const target: [number, number, number] = [-0.1, 0.12, -0.25];
	const horizontal = Math.sin(polar) * distance;
	return {
		position: [target[0] + Math.sin(azimuth) * horizontal, target[1] + Math.cos(polar) * distance, target[2] + Math.cos(azimuth) * horizontal],
		target,
	};
}
