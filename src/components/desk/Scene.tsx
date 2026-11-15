import { Environment, Lightformer, type CameraControlsImpl } from '@react-three/drei';
import { Suspense, useEffect, useMemo, type RefObject } from 'react';
import { CameraRig } from './CameraRig';
import type { Framing } from './camera';
import { Desk } from './Desk';
import type { DeviceProfile } from './device';
import { Lamp } from './Lamp';
import { placePolaroids, presentedPosition } from './layout';
import { PALETTE } from './palette';
import { Polaroids } from './Polaroids';
import type { DeskTrip } from './types';

interface SceneProps {
	profile: DeviceProfile;
	framing: Framing;
	controlsRef: RefObject<CameraControlsImpl | null>;
	/** Featured trips, one polaroid each. */
	trips: DeskTrip[];
	/** Slug of the opened polaroid, or null. */
	selected: string | null;
	onSelect: (slug: string) => void;
	onClose: () => void;
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
export function Scene({ profile, framing, controlsRef, trips, selected, onSelect, onClose, onReady }: SceneProps) {
	const placed = useMemo(() => placePolaroids(trips, framing.portrait), [trips, framing.portrait]);
	// Where the camera should look while a polaroid is open. Memoised so the camera only moves
	// when the selection actually changes.
	const focus = useMemo(() => {
		const p = placed.find((item) => item.trip.slug === selected);
		return p ? presentedPosition(p.rest) : null;
	}, [placed, selected]);

	return (
		<>
			<color attach="background" args={[PALETTE.sceneBg]} />
			<fog attach="fog" args={[PALETTE.sceneBg, framing.distance, framing.distance + 1]} />

			<hemisphereLight args={[PALETTE.moonlight, PALETTE.bounce, 0.45]} />
			<directionalLight position={[1.2, 1.5, 1.8]} color={PALETTE.moonlight} intensity={0.3} />
			<Lamp shadowMapSize={profile.shadowMapSize} />

			{/* Suspense: anything below that loads asynchronously (the handwriting font, cover
			    photos) holds back this subtree until it's ready. <Ready> mounts last, so it only
			    runs once everything else has. */}
			<Suspense fallback={null}>
				<Desk textureSize={profile.textureSize} onClick={onClose} />
				<Polaroids
					placed={placed}
					selected={selected}
					onSelect={onSelect}
					onClose={onClose}
					textureWidth={profile.polaroidTextureWidth}
					reducedMotion={profile.reducedMotion}
				/>
				<Environment resolution={64} environmentIntensity={0.35}>
					<Lightformer form="rect" color={PALETTE.lamp} intensity={3} position={[-1, 2, -0.6]} scale={[1.5, 1, 1]} />
					<Lightformer form="rect" color={PALETTE.moonlight} intensity={0.8} position={[2, 1.5, -2]} scale={[2, 2, 1]} />
				</Environment>
				<Ready onReady={onReady} />
			</Suspense>

			<CameraRig controlsRef={controlsRef} framing={framing} reducedMotion={profile.reducedMotion} focus={focus} />
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
