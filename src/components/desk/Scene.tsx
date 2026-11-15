import { Environment, Lightformer, type CameraControlsImpl } from '@react-three/drei';
import { Suspense, useEffect, type RefObject } from 'react';
import { CameraRig } from './CameraRig';
import type { Framing } from './camera';
import { Desk } from './Desk';
import type { DeviceProfile } from './device';
import { Lamp } from './Lamp';
import { PALETTE } from './palette';

interface SceneProps {
	profile: DeviceProfile;
	framing: Framing;
	controlsRef: RefObject<CameraControlsImpl | null>;
	/** Called once everything inside the Suspense boundary has loaded and been drawn. */
	onReady: () => void;
}

/**
 * Everything inside the <Canvas>: lights, objects, camera controls.
 *
 * Lighting, four layers:
 *   1. The lamp (a spotlight): the key light. Warm, casts the shadows, sets the mood.
 *   2. A hemisphere light: a dim, cool wash from above, warm-dark from below, so the shadows
 *      read as deep blue-brown instead of pure black.
 *   3. A faint cool directional light from the front-right ("moonlight"), so objects facing
 *      away from the lamp, like the lamp itself, still show their shape.
 *   4. A tiny environment map built from Lightformers (glowing panels rendered once into a cube
 *      map): no lighting of its own to speak of, but it gives shiny surfaces (varnish, brass)
 *      something to reflect. Made in-scene, so nothing is downloaded from a CDN.
 * Fog in the background colour makes the far edges of the desk melt into the dark room. It starts
 * at the camera's distance from the desk's centre, so the middle of the desk is always clear.
 */
export function Scene({ profile, framing, controlsRef, onReady }: SceneProps) {
	return (
		<>
			<color attach="background" args={[PALETTE.sceneBg]} />
			<fog attach="fog" args={[PALETTE.sceneBg, framing.distance, framing.distance + 1]} />

			<hemisphereLight args={[PALETTE.moonlight, PALETTE.bounce, 0.45]} />
			<directionalLight position={[1.2, 1.5, 1.8]} color={PALETTE.moonlight} intensity={0.3} />
			<Lamp shadowMapSize={profile.shadowMapSize} />

			{/* Suspense: anything below that loads asynchronously (models, image textures; none
			    yet in phase 1) holds back this subtree until it's ready. <Ready> mounts last,
			    so it only runs once everything else has. */}
			<Suspense fallback={null}>
				<Desk textureSize={profile.textureSize} />
				<Environment resolution={64} environmentIntensity={0.35}>
					<Lightformer form="rect" color={PALETTE.lamp} intensity={3} position={[-1, 2, -0.6]} scale={[1.5, 1, 1]} />
					<Lightformer form="rect" color={PALETTE.moonlight} intensity={0.8} position={[2, 1.5, -2]} scale={[2, 2, 1]} />
				</Environment>
				<Ready onReady={onReady} />
			</Suspense>

			<CameraRig controlsRef={controlsRef} framing={framing} reducedMotion={profile.reducedMotion} />
		</>
	);
}

/** Waits two animation frames (the first frame drawn, then painted), then reports ready. */
function Ready({ onReady }: { onReady: () => void }) {
	useEffect(() => {
		let id = requestAnimationFrame(() => {
			id = requestAnimationFrame(onReady);
		});
		return () => cancelAnimationFrame(id);
	}, [onReady]);
	return null;
}
