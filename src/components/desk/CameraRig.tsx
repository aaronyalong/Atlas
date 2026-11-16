import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import type { Vector3Tuple } from 'three';
import { establishingShot, FOCUS_POLAR, ORBIT_LIMITS, type Framing } from './camera';

const { ACTION } = CameraControlsImpl;

/** An opened place: the point to look at (the middle of its photos and card) and the distance. */
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

/**
 * The limited orbit: drag to rotate around the desk, scroll or pinch to zoom, all inside
 * ORBIT_LIMITS. Panning is switched off, so the desk always stays in the middle.
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
	useEffect(() => {
		const controls = controlsRef.current;
		if (!controls) return;

		// Gestures: one finger / left drag rotates, two fingers pinch-zoom, wheel zooms. Right drag
		// and two-finger drag would pan; both are off.
		controls.mouseButtons.left = ACTION.ROTATE;
		controls.mouseButtons.middle = ACTION.DOLLY;
		controls.mouseButtons.right = ACTION.NONE;
		controls.mouseButtons.wheel = ACTION.DOLLY;
		controls.touches.one = ACTION.TOUCH_ROTATE;
		controls.touches.two = ACTION.TOUCH_DOLLY;
		controls.touches.three = ACTION.NONE;

		// The lens for this framing (it changes when a phone is turned).
		camera.fov = framing.fov;
		camera.updateProjectionMatrix();

		// Jump (no animation) to the starting shot, then remember it as the view reset() returns to.
		controls.enabled = true;
		controls.minDistance = framing.minDistance;
		controls.setLookAt(...framing.position, ...framing.target, false);
		controls.saveState();

		// Dev builds only (stripped from production): lets scripts read and drive the camera.
		if (import.meta.env.DEV) (window as unknown as { __deskControls?: CameraControlsImpl }).__deskControls = controls;

		// Before the opening move has played, wait at the establishing shot instead.
		if (!introPlayed.current && !reducedMotion) {
			const shot = establishingShot(framing);
			controls.setLookAt(...shot.position, ...shot.target, false);
		}
	}, [controlsRef, framing, camera, reducedMotion]);

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
			const [x, y, z] = focus.target;
			const d = focus.distance;
			controls.setLookAt(x, y + Math.cos(FOCUS_POLAR) * d, z + Math.sin(FOCUS_POLAR) * d, x, y, z, true);
		} else if (hadFocus.current) {
			controls.enabled = true;
			controls.reset(true);
			controls.minDistance = framing.minDistance;
		}
		hadFocus.current = focus !== null;
	}, [controlsRef, framing, focus]);

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
