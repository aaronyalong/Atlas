import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useEffect, useRef, type RefObject } from 'react';
import type { Vector3Tuple } from 'three';
import { DESK_TARGET, FOCUS_POLAR, ORBIT_LIMITS, type Framing } from './camera';

const { ACTION } = CameraControlsImpl;

interface CameraRigProps {
	/** Shared with DeskApp so the HTML "Reset view" button can drive the camera. */
	controlsRef: RefObject<CameraControlsImpl | null>;
	framing: Framing;
	reducedMotion: boolean;
	/** Where an opened polaroid is held up, or null when nothing is open. */
	focus: Vector3Tuple | null;
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
export function CameraRig({ controlsRef, framing, reducedMotion, focus }: CameraRigProps) {
	const hadFocus = useRef(false);
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

		// Jump (no animation) to the starting shot, then remember it as the view reset() returns to.
		controls.setLookAt(...framing.position, ...DESK_TARGET, false);
		controls.saveState();
	}, [controlsRef, framing]);

	// Fly to an opened polaroid, and back to the saved home view when it closes.
	useEffect(() => {
		const controls = controlsRef.current;
		if (!controls) return;
		if (focus) {
			// The zoom limit would stop the camera short of a close-up; lift it while focused, and
			// pause drag/zoom input so the visitor can't wander off mid-card. (Animations still run.)
			controls.minDistance = 0;
			controls.enabled = false;
			const [x, y, z] = focus;
			const d = framing.focusDistance;
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
