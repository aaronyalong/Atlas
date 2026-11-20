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
import { MAP_LIFT, WALL_Z } from './roomLayout';

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * The orbit limits (the rotation part of "limited orbit"), zoomed right in. Tight enough that the
 * map stays the subject: looking down at least this steeply, and from no further round than this,
 * a close view never reaches the horizon. Further out they tighten: see orbitLimitsFor.
 */
export const ORBIT_LIMITS = {
	/** Never straight overhead (and, zoomed right out, never up through the ceiling)... */
	minPolarAngle: deg(35),
	/** ...and never low enough to look across the desk into the room. */
	maxPolarAngle: deg(60),
	/** 30° either side of the front: a 60° arc in total. */
	minAzimuthAngle: deg(-30),
	maxAzimuthAngle: deg(30),
} as const;

/** The opening shot looks lower than the visitor may afterwards: the limit is lifted while it plays. */
export const ESTABLISHING_POLAR = deg(69);

export interface Framing {
	/** A tall (portrait) screen: framed differently, and a trip's preview panel stands on end. */
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
 * toward the cursor) when zoomed right in: over the map, back to the wall (so you can zoom in on
 * the lamp and the gauge panel), never off the desk. Kept narrow enough that, swung right round,
 * the camera stays inside the room. Further out the box shrinks: see targetBoundsFor.
 */
export const TARGET_BOUNDS = { min: [-1.6, -0.01, -0.9] as const, max: [1.6, 0.7, 0.8] as const };

/** How far past the middle of the map the edge of the view may reach: its end and a little space. */
const VIEW_REACH = 1.95;
/** Zoomed right out, how far the orbit point may still be nudged (so sliding doesn't feel dead). */
const SLACK = 0.1;

/**
 * Where the orbit point may be at a given zoom. Zoomed right in it has the run of TARGET_BOUNDS;
 * the further out, the closer it is held to the starting view's, so that zoomed out the map
 * always fills the picture and sliding can't bring the room's dark ends into view. (A phone
 * shows only part of the map's width even zoomed right out, so there it can still slide along.)
 */
export function targetBoundsFor(framing: Framing, aspect: number, distance: number): { min: [number, number, number]; max: [number, number, number] } {
	const out = clamp01((distance - framing.minDistance) / (framing.distance - framing.minDistance));
	const [hx, hy, hz] = framing.target;
	// Half the view's width at the orbit point, zoomed right out.
	const halfView = framing.distance * Math.tan(deg(framing.fov) / 2) * aspect;
	const farX = Math.min(TARGET_BOUNDS.max[0], Math.max(SLACK, VIEW_REACH - halfView));
	const far = { min: [Math.min(hx, -farX), hy, hz - SLACK], max: [Math.max(hx, farX), hy, hz + SLACK] };
	const mix = (near: number, held: number) => near + (held - near) * out;
	return {
		min: [mix(TARGET_BOUNDS.min[0], far.min[0]), mix(TARGET_BOUNDS.min[1], far.min[1]), mix(TARGET_BOUNDS.min[2], far.min[2])],
		max: [mix(TARGET_BOUNDS.max[0], far.max[0]), mix(TARGET_BOUNDS.max[1], far.max[1]), mix(TARGET_BOUNDS.max[2], far.max[2])],
	};
}

/** Zoomed right out, the camera tilts no lower than this... */
const FAR_POLAR = deg(50);
/** ...and swings no further than keeps the view's corner this close to the middle of the back
 * wall (the window and the clocks, not the bare panels and the room's corners beyond them). */
const WALL_REACH = 3.2;
/** However wide the screen, it can still swing this much. */
const LEAST_SWING = deg(6);

/**
 * How far round and how low the camera may go at a given zoom. Zoomed right in it has all of
 * ORBIT_LIMITS (a close view looks down at the map whichever way it's turned). Zoomed out, a low
 * view from one side looks along the wall into the room's dark end, so the limits tighten with
 * the zoom: the swing to whatever keeps the view's far corner within WALL_REACH on this screen (a
 * wide screen sees further sideways, so it swings less), the tilt to FAR_POLAR.
 */
export function orbitLimitsFor(framing: Framing, aspect: number, distance: number): { maxAzimuth: number; maxPolar: number } {
	const out = clamp01((distance - framing.minDistance) / (framing.distance - framing.minDistance));
	const far = targetBoundsFor(framing, aspect, framing.maxDistance);
	// The widest swing whose view stays within reach, found by halving (reach grows with the swing).
	let low = LEAST_SWING;
	let high = ORBIT_LIMITS.maxAzimuthAngle;
	if (viewReach(framing, aspect, high, far.max[0]) <= WALL_REACH) low = high;
	else if (viewReach(framing, aspect, low, far.max[0]) < WALL_REACH) {
		for (let i = 0; i < 12; i++) {
			const middle = (low + high) / 2;
			if (viewReach(framing, aspect, middle, far.max[0]) <= WALL_REACH) low = middle;
			else high = middle;
		}
	}
	return {
		maxAzimuth: ORBIT_LIMITS.maxAzimuthAngle + (low - ORBIT_LIMITS.maxAzimuthAngle) * out,
		maxPolar: ORBIT_LIMITS.maxPolarAngle + (FAR_POLAR - ORBIT_LIMITS.maxPolarAngle) * out,
	};
}

/**
 * Zoomed right out and tilted as low as that allows, with the camera swung `swing` to the left
 * and the orbit point slid `targetX` to the right: how far right (x) the top-right corner of the
 * view lands, on the back wall or on the desk in front of it.
 */
function viewReach(framing: Framing, aspect: number, swing: number, targetX: number) {
	const distance = framing.maxDistance;
	const pitch = Math.PI / 2 - FAR_POLAR;
	const [, ty, tz] = framing.target;
	const horizontal = Math.cos(pitch) * distance;
	const eye = { x: targetX - Math.sin(swing) * horizontal, y: ty + Math.sin(pitch) * distance, z: tz + Math.cos(swing) * horizontal };
	// The camera's forward, right and up, then the ray through the picture's top-right corner.
	const forward = { x: Math.sin(swing) * Math.cos(pitch), y: -Math.sin(pitch), z: -Math.cos(swing) * Math.cos(pitch) };
	const right = { x: Math.cos(swing), z: Math.sin(swing) };
	const up = { x: Math.sin(swing) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(swing) * Math.sin(pitch) };
	const v = Math.tan(deg(framing.fov) / 2);
	const h = v * aspect;
	const ray = { x: forward.x + h * right.x + v * up.x, y: forward.y + v * up.y, z: forward.z + h * right.z + v * up.z };
	// Whichever comes first: the desk (if the ray points down) or the wall (if it points back).
	const toDesk = ray.y < 0 ? eye.y / -ray.y : Infinity;
	const toWall = ray.z < 0 ? (eye.z - WALL_Z) / -ray.z : Infinity;
	return eye.x + ray.x * Math.min(toDesk, toWall);
}

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}

/** An opened place is viewed from the front, looking down at 45° (its preview panel tips up to match). */
export const FOCUS_POLAR = deg(45);

/**
 * The starting shot for a viewport's aspect ratio (width / height).
 *
 * The lens is deliberately narrow (35°, like a 60 mm lens on a full-frame camera): a wide lens
 * balloons whatever is nearest and splays the desk's parallel edges apart, which reads as "video
 * game". The camera looks down on the desk steeply, 40° off overhead, so the map reads almost as a
 * plan and the wall is a strip across the top. The camera orbits a point on the map, which
 * stands a little above the desk on its plinth. On a wide screen the 3 m map and the slab it
 * lies on run nearly edge to edge and down to just above the hint at the bottom, with the lamp behind its back-left corner and the foot of the viewport (and Earth) above. That's about as
 * far out as the camera goes; zoom and slide to explore the map. A tall phone screen can't
 * show the map across at a readable size, so it frames the stretch the trips cover (East Asia to
 * the US, near the middle of the Pacific-centred map) and lets the rest run off the sides: drag
 * or zoom out to see it all.
 */
export function framingFor(aspect: number): Framing {
	const portrait = aspect < 1;
	const fov = portrait ? 48 : 35;
	const polar = deg(40);
	const distance = portrait ? 3.6 : 3.8;
	const azimuth = 0;
	const target: [number, number, number] = portrait ? [0.2, MAP_LIFT, -0.26] : [0, MAP_LIFT, 0.01];
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
	const polar = ESTABLISHING_POLAR;
	const azimuth = framing.portrait ? deg(10) : deg(8);
	const distance = framing.portrait ? 2.6 : 2.4;
	const target: [number, number, number] = [0, 0.3, -0.6];
	const horizontal = Math.sin(polar) * distance;
	return {
		position: [target[0] + Math.sin(azimuth) * horizontal, target[1] + Math.cos(polar) * distance, target[2] + Math.cos(azimuth) * horizontal],
		target,
	};
}
