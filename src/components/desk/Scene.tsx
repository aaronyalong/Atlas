import { Environment, type CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { BankersLamp } from './BankersLamp';
import { CameraRig, type CameraFocus } from './CameraRig';
import type { Framing } from './camera';
import { Desk } from './Desk';
import { GaugePanel } from './Gauges';
import type { DeviceProfile } from './device';
import { PALETTE } from './palette';
import { bakeShadows } from './pacing';
import { Pins } from './Pins';
import { Room } from './Room';
import { revealCentre, revealLayout, TripReveal } from './TripReveal';
import type { DeskMap, DeskTrip } from './types';
import { mapToDesk, WorldMap } from './WorldMap';

/**
 * The post-processing stack (about 130 KB of code) is loaded on its own, after the scene: the
 * desk appears as soon as it's ready, and the effects fade in a moment later. The renderer's own
 * AgX tone mapping matches the effects' final pass, so the switch-over doesn't jump.
 */
const Effects = lazy(() => import('./Effects').then((m) => ({ default: m.Effects })));

/** How close (metres, on the map) the pointer must be to a place to pick it. */
const PICK_RADIUS = 0.06;

interface SceneProps {
	profile: DeviceProfile;
	/** Ambient occlusion on (from the quality ladder). */
	ao: boolean;
	framing: Framing;
	controlsRef: RefObject<CameraControlsImpl | null>;
	trips: DeskTrip[];
	map: DeskMap;
	/** The opened place, or null. */
	selected: string | null;
	/** The place under the pointer or keyboard focus, or null. */
	hovered: string | null;
	onHover: (slug: string | null) => void;
	onSelect: (slug: string) => void;
	onClose: () => void;
	/** Called once everything inside the Suspense boundary has loaded and been drawn. */
	onReady: () => void;
	/** The loading screen has gone: time for the opening camera move. */
	ready: boolean;
}

/**
 * Everything inside the <Canvas>: lights, room, desk, map, camera, effects.
 *
 * Lighting (in Room.tsx, except the lamp, the hemisphere and the environment):
 *   1. Sunlight through the viewport: cool white, from behind the wall, casting the viewport's
 *      shape onto the desk. Outside, Earth and the passing objects have their own sunlit shading
 *      (SpaceView.tsx).
 *   2. A recessed ceiling light over the map: the even key light that makes the map readable.
 *   3. The banker's lamp (BankersLamp.tsx): a warm pool over the left of the map and up the wall
 *      behind it. Warm wall-washers either side of the window bring out the panels and the brass,
 *      and the viewport's gold cove light glows in its recess (Viewport.tsx): warm against the
 *      cool sunlight.
 *   4. Earthlight: a faint blue light from below the window.
 *   5. A hemisphere light: a dim, cool wash from above, warm-dark from below, so the shadows
 *      read as deep blue-grey instead of pure black.
 *   6. An environment map: a 360° photo of a dim room (Poly Haven's "small empty room 1", CC0,
 *      downsampled to 512×256 and served from /env/). It gives shiny surfaces a real room to
 *      reflect, and adds a faint image-based fill.
 * A light fog, starting well behind the desk, lets the far room recede without hiding it.
 */
export function Scene({ profile, ao, framing, controlsRef, trips, map, selected, hovered, onHover, onSelect, onClose, onReady, ready }: SceneProps) {
	const size = useThree((state) => state.size);
	const pinned = useMemo(() => trips.filter((t) => t.map).map((trip) => ({ trip, position: mapToDesk(map, trip.map!) })), [trips, map]);

	// The nearest place to a point on the map (u, v), if it's within PICK_RADIUS.
	const nearest = useCallback(
		([u, v]: [number, number]) => {
			let best: string | null = null;
			let bestDistance = PICK_RADIUS;
			for (const { trip } of pinned) {
				const d = Math.hypot((trip.map![0] - u) * map.width, (trip.map![1] - v) * map.depth);
				if (d < bestDistance) {
					bestDistance = d;
					best = trip.slug;
				}
			}
			return best;
		},
		[pinned, map],
	);

	// The reveal stays mounted after `selected` clears, until its closing animation has played.
	const [revealing, setRevealing] = useState<string | null>(null);
	useEffect(() => {
		if (selected) setRevealing(selected);
	}, [selected]);
	const reveal = pinned.find((p) => p.trip.slug === revealing);
	const layout = useMemo(() => revealLayout(framing.portrait), [framing.portrait]);

	// Where the camera goes while a place is open: square on to its boarding pass, far enough back
	// that the pass and the room left around it (layout.frame) just fit the screen.
	const focus = useMemo<CameraFocus | null>(() => {
		const p = pinned.find((item) => item.trip.slug === selected);
		if (!p) return null;
		const vfov = (framing.fov * Math.PI) / 180;
		const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
		const distance = Math.max(layout.frame.width / (2 * Math.tan(hfov / 2)), layout.frame.height / (2 * Math.tan(vfov / 2)));
		return { target: revealCentre(p.position), distance };
	}, [pinned, selected, framing, size, layout]);

	return (
		<>
			<color attach="background" args={[PALETTE.sceneBg]} />
			<fog attach="fog" args={[PALETTE.sceneBg, framing.distance + 1.2, framing.distance + 6]} />

			<hemisphereLight args={[PALETTE.moonlight, PALETTE.bounce, 0.28]} />

			{/* Suspense: anything below that loads asynchronously (textures, the handwriting font)
			    holds back this subtree until it's ready. <Ready> mounts last, so it only runs once
			    everything else has. */}
			<Suspense fallback={null}>
				<Room
					shadows={profile.moonShadows}
					shadowMapSize={profile.shadowMapSize}
					earthTextures={profile.earthTextures}
					skyEvents={ready}
					reducedMotion={profile.reducedMotion}
					lite={profile.isMobile}
				/>
				<Desk onClick={onClose} reflections={!profile.isMobile} />
				<BankersLamp shadowMapSize={profile.shadowMapSize} reducedMotion={profile.reducedMotion} />
				<GaugePanel trips={trips} framing={framing} reducedMotion={profile.reducedMotion} />
				<WorldMap
					map={map}
					onHover={(uv) => onHover(uv ? nearest(uv) : null)}
					onPick={(uv) => {
						const slug = nearest(uv);
						if (slug) onSelect(slug);
						else onClose();
					}}
				/>
				<Pins trips={trips} map={map} framing={framing} hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} reducedMotion={profile.reducedMotion} />
				<Environment
					files="/env/small_empty_room_1_512.hdr"
					environmentIntensity={0.14}
					// Turn the room so its window sits behind the camera: that's what the varnish
					// reflects when you look down at the desk.
					environmentRotation={[0, Math.PI * 0.75, 0]}
				/>
				<Ready onReady={onReady} />
			</Suspense>

			{/* The opened place's boarding pass. */}
			{reveal && (
				<TripReveal
					key={reveal.trip.slug}
					trip={reveal.trip}
					anchor={reveal.position}
					layout={layout}
					open={selected === reveal.trip.slug}
					onClose={onClose}
					onClosed={() => setRevealing((r) => (r === reveal.trip.slug ? null : r))}
					reducedMotion={profile.reducedMotion}
				/>
			)}

			<CameraRig controlsRef={controlsRef} framing={framing} reducedMotion={profile.reducedMotion} focus={focus} ready={ready} />
			<Suspense fallback={null}>
				<Effects profile={profile} ao={ao} focus={focus?.target ?? null} target={framing.target} />
			</Suspense>
		</>
	);
}

/**
 * Waits two animation frames (the first frame drawn, then painted), then reports ready. Everything
 * that casts a shadow is in place by then, so the shadow maps stop being redrawn every frame.
 */
function Ready({ onReady }: { onReady: () => void }) {
	useEffect(() => {
		let id = requestAnimationFrame(() => {
			id = requestAnimationFrame(() => {
				bakeShadows();
				onReady();
			});
		});
		return () => cancelAnimationFrame(id);
	}, [onReady]);
	return null;
}
