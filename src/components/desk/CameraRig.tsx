import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { AdditiveBlending, Box3, MathUtils, Plane, Raycaster, Vector2, Vector3, type Intersection, type Mesh, type PerspectiveCamera, type Vector3Tuple } from 'three';
import { ESTABLISHING_POLAR, establishingShot, FOCUS_POLAR, ORBIT_LIMITS, TARGET_BOUNDS, targetBoundsFor, type Framing } from './camera';

const { ACTION } = CameraControlsImpl;

/** An opened place: the point to look at (the middle of its preview panel) and the distance. */
export interface CameraFocus {
	target: Vector3Tuple;
	distance: number;
}

interface CameraRigProps {
	/** Shared with DeskApp so the HTML "Reset view" button can drive the camera. */
	controlsRef: RefObject<CameraControlsImpl | null>;
	framing: Framing;
	reducedMotion: boolean;
	/** Where to look while a place is open, and from how far; null when nothing is open. */
	focus: CameraFocus | null;
	/** The loading screen has gone: play the opening move. */
	ready: boolean;
}

const DESK_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const BOUNDS = new Box3(new Vector3(...TARGET_BOUNDS.min), new Vector3(...TARGET_BOUNDS.max));
const SCRATCH = { position: new Vector3(), target: new Vector3(), box: new Box3() };

/**
 * The limited orbit: drag to rotate around the desk, scroll or pinch to zoom, right-drag or two
 * fingers to slide across the map, all inside ORBIT_LIMITS and TARGET_BOUNDS. How far it can
 * slide depends on the zoom (targetBoundsFor): zoomed out, the view is held over the map, so the
 * map stays the subject and the room's dark ends stay out of the picture.
 *
 * Scrolling zooms toward whatever is under the pointer, the way a map app does: the point under
 * the cursor (on the map, the lamp, the gauges...) stays under the cursor while everything else
 * grows around it. (The library's own dolly-to-cursor moves the orbit point off the desk, up
 * toward the window, so this does it by hand: see zoomAt.)
 *
 * Why CameraControls (drei's wrapper of the camera-controls library) rather than OrbitControls:
 * it can animate the camera to any position and target with one call (`setLookAt(..., true)`)
 * and remember a "home" view to return to (`saveState()` / `reset(true)`). Phase 2's fly-to-item
 * and this phase's reset button both come from that.
 */
export function CameraRig({ controlsRef, framing, reducedMotion, focus, ready }: CameraRigProps) {
	const hadFocus = useRef(false);
	const introPlayed = useRef(false);
	const camera = useThree((state) => state.camera) as PerspectiveCamera;
	const scene = useThree((state) => state.scene);

	// The box the orbit point is held in at a given zoom.
	const boundsAt = useCallback(
		(distance: number, out: Box3) => {
			const { min, max } = targetBoundsFor(framing, camera.aspect, distance);
			out.min.set(...min);
			out.max.set(...max);
			return out;
		},
		[framing, camera],
	);
	// The visitor's limits (how low the camera tilts, how far it slides for its zoom) are lifted
	// while the opening shot plays, which starts lower and further back than they allow.
	const limited = useRef(false);
	const held = useRef(new Box3());
	const holdTarget = useCallback(() => {
		const controls = controlsRef.current;
		if (!controls || !limited.current) return;
		// Where the camera is heading (not where it is mid-glide), so the box doesn't chase it.
		const distance = controls.getPosition(SCRATCH.position, true).distanceTo(controls.getTarget(SCRATCH.target, true));
		const box = boundsAt(distance, SCRATCH.box);
		if (box.equals(held.current)) return;
		held.current.copy(box);
		controls.setBoundary(box);
	}, [controlsRef, boundsAt]);
	const limit = useCallback(
		(on: boolean) => {
			const controls = controlsRef.current;
			if (!controls) return;
			limited.current = on;
			controls.maxPolarAngle = on ? ORBIT_LIMITS.maxPolarAngle : ESTABLISHING_POLAR + 0.01;
			if (on) holdTarget();
			else controls.setBoundary(held.current.copy(BOUNDS));
		},
		[controlsRef, holdTarget],
	);
	// The latest `limit`, for callbacks that outlive a render (it changes when the screen's shape does).
	const limitRef = useRef(limit);
	limitRef.current = limit;
	// Re-fit the box whenever the camera moves (zooming, by any gesture, changes it).
	useEffect(() => {
		const controls = controlsRef.current;
		if (!controls) return;
		controls.addEventListener('update', holdTarget);
		return () => controls.removeEventListener('update', holdTarget);
	}, [controlsRef, holdTarget]);

	useEffect(() => {
		const controls = controlsRef.current;
		if (!controls) return;

		// Gestures: one finger / left drag rotates; right drag and two fingers slide along the desk
		// (SCREEN_PAN: sideways and forward/back, never up off it); two fingers also pinch-zoom.
		// The wheel is handled below (zoom toward the cursor).
		controls.mouseButtons.left = ACTION.ROTATE;
		controls.mouseButtons.middle = ACTION.DOLLY;
		controls.mouseButtons.right = ACTION.SCREEN_PAN;
		controls.mouseButtons.wheel = ACTION.NONE;
		controls.touches.one = ACTION.TOUCH_ROTATE;
		// (camera-controls handles TOUCH_DOLLY_SCREEN_PAN but leaves it out of its own type.)
		controls.touches.two = ACTION.TOUCH_DOLLY_SCREEN_PAN as unknown as typeof ACTION.TOUCH_DOLLY_TRUCK;
		controls.touches.three = ACTION.NONE;

		// The lens for this framing (it changes when a phone is turned).
		camera.fov = framing.fov;
		camera.updateProjectionMatrix();

		// Jump (no animation) to the starting shot, then remember it as the view reset() returns to.
		controls.enabled = true;
		controls.minDistance = framing.minDistance;
		limit(true);
		controls.setLookAt(...framing.position, ...framing.target, false);
		controls.saveState();

		// Dev builds only (stripped from production): lets scripts read and drive the camera, and
		// reach the scene.
		if (import.meta.env.DEV) Object.assign(window, { __deskControls: controls, __deskScene: scene });

		// Before the opening move has played, wait at the establishing shot instead.
		if (!introPlayed.current && !reducedMotion) {
			limit(false);
			const shot = establishingShot(framing);
			controls.setLookAt(...shot.position, ...shot.target, false);
		}
	}, [controlsRef, framing, camera, scene, reducedMotion, limit]);

	// The opening move: once the loading screen has faded, crane slowly up from the room shot to
	// the starting view (the saved "home" state), then go back to the normal easing.
	useEffect(() => {
		const controls = controlsRef.current;
		if (!ready || introPlayed.current || !controls) return;
		introPlayed.current = true;
		if (reducedMotion) return;
		const usual = controls.smoothTime;
		controls.smoothTime = 1.5;
		const restore = () => {
			controls.smoothTime = usual;
			controls.removeEventListener('rest', restore);
			// Arrived at the starting view: the visitor's limits apply from here on.
			limitRef.current(true);
		};
		controls.addEventListener('rest', restore);
		const id = window.setTimeout(() => controls.reset(true), 700);
		return () => window.clearTimeout(id);
	}, [controlsRef, ready, reducedMotion]);

	// Fly to an opened place, and back to the saved home view when it closes.
	useEffect(() => {
		const controls = controlsRef.current;
		if (!controls) return;
		if (focus) {
			// The zoom limit would stop the camera short of a close-up; lift it while focused, and
			// pause drag/zoom input so the visitor can't wander off mid-card. (Animations still run.)
			controls.minDistance = 0;
			controls.enabled = false;
			// A place at the map's edge is outside where the orbit point is otherwise held.
			limitRef.current(false);
			const [x, y, z] = focus.target;
			const d = focus.distance;
			controls.setLookAt(x, y + Math.cos(FOCUS_POLAR) * d, z + Math.sin(FOCUS_POLAR) * d, x, y, z, true);
		} else if (hadFocus.current) {
			controls.enabled = true;
			limitRef.current(true);
			controls.reset(true);
			controls.minDistance = framing.minDistance;
		}
		hadFocus.current = focus !== null;
	}, [controlsRef, framing, focus]);

	// Scroll to zoom toward the cursor.
	const gl = useThree((state) => state.gl);
	useEffect(() => {
		// Solid things only: not the glows, the sunbeam or the dust (all drawn additively), nor
		// anything that isn't a mesh (stars, motes).
		const solid = (h: Intersection) => (h.object as Mesh).isMesh && h.object.visible && (h.object as Mesh & { material: { blending?: number } }).material.blending !== AdditiveBlending;
		const element = gl.domElement;
		const raycaster = new Raycaster();
		const pointer = new Vector2();
		const hit = new Vector3();
		const position = new Vector3();
		const target = new Vector3();
		const box = new Box3();
		const onWheel = (event: WheelEvent) => {
			const controls = controlsRef.current;
			if (!controls || !controls.enabled) return;
			event.preventDefault();
			// Lines and pages (some mice, Firefox) → roughly pixels.
			const pixels = event.deltaY * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1);
			const rect = element.getBoundingClientRect();
			pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
			raycaster.setFromCamera(pointer, camera);
			controls.getPosition(position, true);
			controls.getTarget(target, true);
			const distance = position.distanceTo(target);
			const wanted = distance * Math.exp(MathUtils.clamp(pixels, -120, 120) * 0.0018);
			const scale = MathUtils.clamp(wanted, controls.minDistance, controls.maxDistance) / distance;
			// The point under the cursor: the nearest solid thing there, else the desk's plane,
			// else (pointing out of the window) the orbit point, which makes it an ordinary zoom.
			const first = raycaster.intersectObjects(scene.children, true).find(solid);
			const anchor = first ? hit.copy(first.point) : raycaster.ray.intersectPlane(DESK_PLANE, hit) && BOUNDS.containsPoint(hit.setY(0)) ? hit : target;
			zoomAt(position, target, anchor, scale, limited.current ? boundsAt(distance * scale, box) : BOUNDS);
			controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, true);
		};
		element.addEventListener('wheel', onWheel, { passive: false });
		return () => element.removeEventListener('wheel', onWheel);
	}, [gl, camera, scene, controlsRef, boundsAt]);

	return (
		<CameraControls
			ref={controlsRef}
			// Registers as the scene's controls, so other components can find it via useThree.
			makeDefault
			{...ORBIT_LIMITS}
			minDistance={framing.minDistance}
			maxDistance={framing.maxDistance}
			// Seconds to ease into a new position. 0 = snap, for visitors who asked for less motion.
			smoothTime={reducedMotion ? 0 : 0.35}
			draggingSmoothTime={reducedMotion ? 0 : 0.12}
		/>
	);
}

/**
 * Scales the camera's position and its orbit point toward `anchor` (both in place). Everything on
 * the ray from the camera through the anchor stays on it, so the anchor stays under the cursor,
 * the view direction (and so the orbit angles) doesn't change, and an orbit point on the desk
 * stays on the desk. The orbit point is then kept inside `bounds` (where it may be at the new
 * zoom), moving the camera with it.
 */
function zoomAt(position: Vector3, target: Vector3, anchor: Vector3, scale: number, bounds: Box3) {
	const a = anchor.clone();
	position.sub(a).multiplyScalar(scale).add(a);
	target.sub(a).multiplyScalar(scale).add(a);
	const shift = bounds.clampPoint(target, new Vector3()).sub(target);
	position.add(shift);
	target.add(shift);
}
