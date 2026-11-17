import { advance, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Matrix4, type WebGLRenderer } from 'three';

/*
 * Two ways the desk saves work (CPU and battery) when nothing much is happening.
 *
 * 1. Frame pacing. The canvas runs with frameloop="never" and FramePacer draws the frames
 *    itself, at one of two rates:
 *      - awake, about 60 a second (never more, even on a 120 or 144 Hz screen): while someone is
 *        using the desk (pointer, wheel, keys), while the camera moves, and while anything calls
 *        wake() (a trip opening, the lamp fading, the gauges switching, a shooting star passing);
 *      - idle, about 30 to 40 a second: enough for the slow drift (Earth turning, dust in the
 *        sunbeam, the clocks' second hands) at half the work.
 *
 * 2. Baked shadows. Three lights cast shadows, and each shadow map is a full extra render of the
 *    scene. Almost nothing that casts a shadow ever moves, so the maps are drawn once, when the
 *    scene has loaded, and again only while something that casts one moves (the pins lifting, a
 *    trip's photos rising), via refreshShadows().
 */

/** Shortest gap between frames while awake: at most 75 a second, so 60 on a 60 or 120 Hz screen. */
const AWAKE_GAP = 1000 / 75;
/** Shortest gap while idle: 30 a second on a 60 Hz screen, 40 on a 120 Hz one. */
const IDLE_GAP = 1000 / 40;
/** How long a pointer move, wheel turn or key press keeps the desk awake (ms). */
const INPUT_AWAKE = 600;
/** How long the camera keeps the desk awake after it last moved (ms). */
const CAMERA_AWAKE = 300;
/** The longest step the animations take in one frame (s), e.g. after the tab was hidden. */
const MAX_STEP = 0.1;

let awakeUntil = 0;
let renderer: WebGLRenderer | null = null;

/** Draw at the full frame rate for at least the next `ms` milliseconds. Call it every frame an animation runs. */
export function wake(ms = 200) {
	awakeUntil = Math.max(awakeUntil, performance.now() + ms);
}

/** Redraw the shadow maps on the next frame. Call it every frame something that casts a shadow moves. */
export function refreshShadows() {
	if (renderer) renderer.shadowMap.needsUpdate = true;
}

/** Stop redrawing the shadow maps every frame: from now on only refreshShadows() redraws them. */
export function bakeShadows() {
	if (!renderer) return;
	renderer.shadowMap.autoUpdate = false;
	renderer.shadowMap.needsUpdate = true;
}

/** Draws the frames (see above). Mount once inside a <Canvas frameloop="never">. */
export function FramePacer() {
	const gl = useThree((state) => state.gl);
	const camera = useThree((state) => state.camera);

	useEffect(() => {
		renderer = gl;
		// Shadows draw every frame until the scene has loaded (Scene's <Ready> bakes them).
		gl.shadowMap.autoUpdate = true;

		const onInput = () => wake(INPUT_AWAKE);
		const inputs = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'] as const;
		for (const type of inputs) window.addEventListener(type, onInput, { passive: true });

		const lastView = new Matrix4();
		let lastFrame = -Infinity;
		let time = 0;
		let id = requestAnimationFrame(function tick(now) {
			id = requestAnimationFrame(tick);
			const gap = now - lastFrame;
			// 1 ms of slack: rAF's timestamps jitter, and a 60 Hz frame mustn't be skipped for it.
			if (gap < (now < awakeUntil ? AWAKE_GAP : IDLE_GAP) - 1) return;
			// The animations' clock: real time, but never more than MAX_STEP a frame, so nothing
			// jumps after the tab comes back.
			time += Math.min(gap / 1000, MAX_STEP);
			lastFrame = now;
			advance(time);
			if (!camera.matrixWorld.equals(lastView)) {
				lastView.copy(camera.matrixWorld);
				wake(CAMERA_AWAKE);
			}
		});

		return () => {
			cancelAnimationFrame(id);
			for (const type of inputs) window.removeEventListener(type, onInput);
			if (renderer === gl) renderer = null;
		};
	}, [gl, camera]);

	return null;
}
