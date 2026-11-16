import { ContactShadows, Environment, type CameraControlsImpl } from '@react-three/drei';
import { Suspense, useEffect, useMemo, type RefObject } from 'react';
import type { Vector3Tuple } from 'three';
import { CameraRig } from './CameraRig';
import type { Framing } from './camera';
import { Desk, DESK } from './Desk';
import type { DeviceProfile } from './device';
import { Effects } from './Effects';
import { Lamp } from './Lamp';
import { placePolaroids, presentedPosition } from './layout';
import { PALETTE } from './palette';
import { Pins, TAG_OFFSET } from './Pins';
import { Polaroids } from './Polaroids';
import type { DeskMap, DeskTrip, ItemRef } from './types';
import { mapToDesk, WorldMap } from './WorldMap';

interface SceneProps {
	profile: DeviceProfile;
	framing: Framing;
	controlsRef: RefObject<CameraControlsImpl | null>;
	/** Every trip: a pin each, and a polaroid for the featured ones. */
	trips: DeskTrip[];
	map: DeskMap;
	/** The opened item, or null. */
	selected: ItemRef | null;
	/** Item id with keyboard focus, or null. */
	focused: string | null;
	onSelect: (item: ItemRef) => void;
	onClose: () => void;
	/** Called once everything inside the Suspense boundary has loaded and been drawn. */
	onReady: () => void;
}

/**
 * Everything inside the <Canvas>: lights, objects, camera controls, effects.
 *
 * Lighting, four layers:
 *   1. The lamp (a spotlight): the key light. Warm, casts the shadows, sets the mood.
 *   2. A hemisphere light: a dim, cool wash from above, warm-dark from below, so the shadows
 *      read as deep blue-brown instead of pure black.
 *   3. A faint cool directional light from the front-right ("moonlight"), so objects facing
 *      away from the lamp, like the lamp itself, still show their shape.
 *   4. An environment map: a 360° photo of a dim room (Poly Haven's "small empty room 1", CC0,
 *      downsampled to 512×256 and served from /env/). It gives shiny surfaces (varnish, brass)
 *      a real room to reflect, with the uneven brightness a real room has, and adds a faint
 *      image-based fill. Kept dim so the lamp stays in charge of the mood.
 * Fog in the background colour makes the far edges of the desk melt into the dark room. It starts
 * at the camera's distance from the desk's centre, so the middle of the desk is always clear.
 */
export function Scene({ profile, framing, controlsRef, trips, map, selected, focused, onSelect, onClose, onReady }: SceneProps) {
	const featured = useMemo(() => trips.filter((t) => t.featured), [trips]);
	const placed = useMemo(() => placePolaroids(featured, framing.portrait), [featured, framing.portrait]);

	// Where the camera should look while something is open. Memoised so the camera only moves
	// when the selection actually changes.
	const focus = useMemo<Vector3Tuple | null>(() => {
		if (!selected) return null;
		if (selected.kind === 'polaroid') {
			const p = placed.find((item) => item.trip.slug === selected.slug);
			return p ? presentedPosition(p.rest) : null;
		}
		const trip = trips.find((t) => t.slug === selected.slug);
		if (!trip?.map) return null;
		const [x, y, z] = mapToDesk(map, trip.map);
		return [x + TAG_OFFSET[0], y + TAG_OFFSET[1], z + TAG_OFFSET[2]];
	}, [placed, trips, map, selected]);

	return (
		<>
			<color attach="background" args={[PALETTE.sceneBg]} />
			<fog attach="fog" args={[PALETTE.sceneBg, framing.distance + (framing.portrait ? 0.35 : 0), framing.distance + 1.1]} />

			<hemisphereLight args={[PALETTE.moonlight, PALETTE.bounce, 0.3]} />
			<directionalLight position={[1.2, 1.5, 1.8]} color={PALETTE.moonlight} intensity={0.3} />
			<Lamp shadowMapSize={profile.shadowMapSize} />

			{/* Suspense: anything below that loads asynchronously (the handwriting font, textures,
			    cover photos) holds back this subtree until it's ready. <Ready> mounts last, so it
			    only runs once everything else has. */}
			<Suspense fallback={null}>
				<Desk onClick={onClose} />
				{/* Contact shadows: the scene is drawn from below into a small depth image, blurred,
				    and laid on the desk as a soft dark halo under everything that touches it. It
				    glues objects to the surface in a way a single light's shadow can't. Re-drawn
				    every frame on desktop so it follows a lifted polaroid; static on phones. */}
				<ContactShadows
					position={[0, 0.0005, DESK.centerZ]}
					scale={[DESK.width, DESK.depth]}
					resolution={profile.isMobile ? 256 : 512}
					frames={profile.isMobile ? 1 : Infinity}
					far={0.25}
					blur={2.2}
					opacity={0.55}
					color="#1a0e06"
				/>
				<WorldMap map={map} onClick={onClose} />
				<Pins
					trips={trips}
					map={map}
					selected={selected}
					focused={focused}
					onSelect={onSelect}
					onClose={onClose}
					reducedMotion={profile.reducedMotion}
				/>
				<Polaroids
					placed={placed}
					selected={selected}
					focused={focused}
					onSelect={onSelect}
					onClose={onClose}
					textureWidth={profile.polaroidTextureWidth}
					reducedMotion={profile.reducedMotion}
				/>
				<Environment
					files="/env/small_empty_room_1_512.hdr"
					environmentIntensity={0.1}
					// Turn the room so its window sits behind the camera: that's what the varnish
					// reflects when you look down at the desk.
					environmentRotation={[0, Math.PI * 0.75, 0]}
				/>
				<Ready onReady={onReady} />
			</Suspense>

			<CameraRig controlsRef={controlsRef} framing={framing} reducedMotion={profile.reducedMotion} focus={focus} />
			<Effects profile={profile} focus={focus} />
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
