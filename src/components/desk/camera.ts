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

/** The point the camera looks at and orbits around: just in front of the desk's centre. */
export const DESK_TARGET: [number, number, number] = [0, 0, 0.05];

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

/** The polar angle the camera starts at: looking down at the desk at a comfortable slant. */
const START_POLAR = deg(50);

export interface Framing {
	/** Vertical field of view, in degrees. */
	fov: number;
	/** Starting distance from DESK_TARGET. */
	distance: number;
	/** Starting azimuth, in radians. */
	azimuth: number;
	/** Starting camera position (`azimuth`, START_POLAR, `distance` away from the target). */
	position: [number, number, number];
	/** How far in and out the visitor can zoom. */
	minDistance: number;
	maxDistance: number;
}

/**
 * The starting shot for a viewport's aspect ratio (width / height). A tall phone screen is
 * narrow, so it gets a wider lens, stands further back, and starts swung 25° to the right: a
 * three-quarter view that brings the lamp (at the desk's left) into the narrow frame.
 */
export function framingFor(aspect: number): Framing {
	const portrait = aspect < 1;
	const fov = portrait ? 55 : 40;
	const distance = portrait ? 1.9 : 1.35;
	const azimuth = portrait ? deg(25) : 0;
	const [tx, ty, tz] = DESK_TARGET;
	// Spherical → x/y/z: the polar angle tilts down from straight up, the azimuth swings around
	// the vertical axis from the front (+z).
	const horizontal = Math.sin(START_POLAR) * distance;
	return {
		fov,
		distance,
		azimuth,
		position: [
			tx + Math.sin(azimuth) * horizontal,
			ty + Math.cos(START_POLAR) * distance,
			tz + Math.cos(azimuth) * horizontal,
		],
		minDistance: distance * 0.45,
		maxDistance: distance * 1.35,
	};
}
