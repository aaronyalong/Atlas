import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useEffect, type RefObject } from 'react';
import { DESK_TARGET, ORBIT_LIMITS, type Framing } from './camera';

const { ACTION } = CameraControlsImpl;

interface CameraRigProps {
	/** Shared with DeskApp so the HTML "Reset view" button can drive the camera. */
	controlsRef: RefObject<CameraControlsImpl | null>;
	framing: Framing;
	reducedMotion: boolean;
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
export function CameraRig({ controlsRef, framing, reducedMotion }: CameraRigProps) {
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
