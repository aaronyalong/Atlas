import type { Vector3Tuple } from 'three';

/*
 * The room's measurements, shared by Room.tsx, Viewport.tsx and Gauges.tsx. Metres; the desk top
 * is y = 0, +z toward the viewer.
 *
 * The room is sized so the camera can't leave it: zoomed right out at the steepest angle it stays
 * under the ceiling, and swung round to either side it stays inside the side walls (camera.ts).
 */

/** The back wall's face. */
export const WALL_Z = -0.9;
export const FLOOR_Y = -0.75;
export const CEILING_Y = 4.2;
/** The side walls, at ±SIDE_X. */
export const SIDE_X = 4.4;
/** How far toward the viewer the floor, ceiling and side walls run. */
export const FRONT_Z = 5.6;
export const WALL_THICKNESS = 0.26;

/** The glass, at the back of the recess. */
export const WINDOW = { left: -1.05, right: 1.05, bottom: 0.04, top: 1.5 };
/**
 * The recess: how deep the glass sits behind the wall's face, and how far the sides and top
 * splay out toward the room. The bottom is a flat sill, level with the glass.
 */
export const RECESS = { depth: 0.22, flare: 0.14 };
/** The opening in the wall's face. */
export const OPENING = { left: WINDOW.left - RECESS.flare, right: WINDOW.right + RECESS.flare, bottom: WINDOW.bottom, top: WINDOW.top + RECESS.flare };
export const GLASS_Z = WALL_Z - RECESS.depth;
/** The viewport frame's width, and its two struts (centred a sixth of the way either side). */
export const FRAME = 0.07;
export const STRUT = 0.035;
export const STRUT_X = [-(WINDOW.right - WINDOW.left) / 6, (WINDOW.right - WINDOW.left) / 6];

/** Where the sunlight comes from: high behind the wall, a little to the left. */
export const SUN_POSITION: Vector3Tuple = [-0.5, 2.6, WALL_Z - 2];
