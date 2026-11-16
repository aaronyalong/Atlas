import { Html, useCursor } from '@react-three/drei';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { ImageLoader, MathUtils, type Group, type Vector3Tuple } from 'three';
import { createPolaroidFront, loadCaptionFont, POLAROID_SIZE } from './polaroidTexture';
import { TripCard } from './TripCard';
import type { DeskTrip } from './types';

/*
 * What opens when a place on the map is clicked: the trip's photos rise out of the map at its
 * pin, the stack tips up toward the camera and fans out into a spread of prints, and the trip's
 * card (dates, blurb, the link to its page) appears beside them. A click on a print brings it
 * forward; another puts it back. Closing plays it all in reverse, back into the map.
 *
 * Everything is laid out on a "presentation plane": a sheet of space that starts flat on the map
 * at the pin and rises to hang in front of the camera, tilted to face it (the camera looks down
 * at 45° while something is open, so the plane tilts up to match).
 */
const { width: W, height: H, thickness: T } = POLAROID_SIZE;
/** How high the plane rises above the map, and how far it comes toward the viewer. */
const LIFT = 0.12;
const FORWARD = 0.05;
/** Facing a camera that looks down at 45°, nudged a little past it so it reads as an object. */
const TILT = -Math.PI / 4 + 0.07;
const MAX_PRINTS = 6;
const CARD_WIDTH_PX = 440;
const CARD_DISTANCE_FACTOR = (400 * W) / CARD_WIDTH_PX;

export interface RevealLayout {
	prints: { x: number; y: number; turn: number }[];
	card: { x: number; y: number };
	/** The content's bounding box on the plane, for framing the camera. */
	bounds: { x: number; y: number; width: number; height: number };
}

/** Where the prints and card go on the plane: a fan with the card beside it (below on a phone). */
export function revealLayout(photoCount: number, portrait: boolean): RevealLayout {
	const n = Math.max(1, Math.min(MAX_PRINTS, photoCount));
	const step = n > 3 ? (portrait ? 0.045 : 0.07) : 0.085;
	const fanWidth = (n - 1) * step + W;
	const prints = Array.from({ length: n }, (_, i) => {
		const o = i - (n - 1) / 2;
		// A fan: the outer prints dip a little and turn outward.
		return { x: o * step, y: -Math.abs(o) * 0.008 + (portrait ? H / 2 + 0.02 : 0), turn: -o * 0.07 };
	});
	if (portrait) {
		const card = { x: 0, y: -H / 2 - 0.01 };
		const top = H + 0.02 + 0.01;
		const bottom = card.y - H / 2;
		return { prints, card, bounds: { x: 0, y: (top + bottom) / 2, width: Math.max(fanWidth, W) + 0.02, height: top - bottom } };
	}
	const card = { x: fanWidth / 2 + 0.025 + W / 2, y: 0 };
	const left = -fanWidth / 2;
	const right = card.x + W / 2;
	return { prints, card, bounds: { x: (left + right) / 2, y: 0, width: right - left, height: H + 0.03 } };
}

/** The point the camera should look at: the middle of the content, where the plane ends up. */
export function revealCentre(anchor: Vector3Tuple, layout: RevealLayout): Vector3Tuple {
	const { x, y } = layout.bounds;
	return [anchor[0] + x, anchor[1] + LIFT + Math.cos(TILT) * y, anchor[2] + FORWARD - Math.sin(TILT) * y];
}

interface TripRevealProps {
	trip: DeskTrip;
	/** The pin's base, on the map. */
	anchor: Vector3Tuple;
	layout: RevealLayout;
	/** False plays the closing animation; onClosed fires when it has finished. */
	open: boolean;
	onClose: () => void;
	onClosed: () => void;
	textureWidth: number;
	reducedMotion: boolean;
}

export function TripReveal({ trip, anchor, layout, open, onClose, onClosed, textureWidth, reducedMotion }: TripRevealProps) {
	// Captions are handwritten: wait for the font before drawing any print.
	use(loadCaptionFont(trip.photos.map((p) => p.caption ?? '').join('') || 'A'));

	const plane = useRef<Group>(null);
	const prints = useRef<(Group | null)[]>([]);
	const rise = useRef(0);
	const spread = useRef(0);
	const zoom = useRef<number[]>([]);
	const closedFired = useRef(false);
	const [cardShown, setCardShown] = useState(false);
	const [zoomed, setZoomed] = useState<number | null>(null);

	useEffect(() => {
		if (open) closedFired.current = false;
		else setZoomed(null);
	}, [open]);

	useFrame((_, delta) => {
		const k = reducedMotion ? Infinity : 6;
		// Opening: rise first, then spread. Closing: gather first, then sink.
		rise.current = MathUtils.damp(rise.current, open || spread.current > 0.08 ? 1 : 0, k, delta);
		spread.current = MathUtils.damp(spread.current, open && rise.current > 0.6 ? 1 : 0, k, delta);
		const r = rise.current;
		const s = spread.current;

		const p = plane.current;
		if (p) {
			p.position.set(0, 0.003 + LIFT * r, FORWARD * r);
			p.rotation.x = MathUtils.lerp(-Math.PI / 2, TILT, r);
			p.scale.setScalar(0.25 + 0.75 * r);
		}
		const n = layout.prints.length;
		const fanY = layout.prints.reduce((sum, t) => sum + t.y, 0) / n;
		layout.prints.forEach((target, i) => {
			const g = prints.current[i];
			if (!g) return;
			// Stagger: each print follows the one before it out of the stack.
			const si = MathUtils.clamp(s * (1 + n * 0.12) - i * 0.12, 0, 1);
			// A zoomed print comes forward to the middle of the fan and grows by half.
			const z = (zoom.current[i] = MathUtils.damp(zoom.current[i] ?? 0, zoomed === i ? 1 : 0, k, delta));
			g.position.set(MathUtils.lerp(target.x * si, 0, z), MathUtils.lerp(target.y * si, fanY, z), i * 0.0015 + z * 0.04);
			g.rotation.z = target.turn * si * (1 - z);
			g.scale.setScalar(1 + z * 0.5);
		});

		const show = open && s > 0.95;
		if (show !== cardShown) setCardShown(show);
		if (!open && r < 0.02 && !closedFired.current) {
			closedFired.current = true;
			onClosed();
		}
	});

	const photos = trip.photos.slice(0, MAX_PRINTS);

	return (
		<group position={anchor}>
			<group ref={plane}>
				{layout.prints.map((_, i) => {
					const photo = photos[i];
					const print = (
						<Print
							seed={`${trip.slug}:${i}`}
							caption={photo?.caption ?? ''}
							textureWidth={textureWidth}
							onClick={() => setZoomed((z) => (z === i ? null : i))}
						/>
					);
					return (
						<group key={i} ref={(g) => void (prints.current[i] = g)}>
							{photo ? (
								<Suspense fallback={<Print seed={`${trip.slug}:${i}`} caption="" textureWidth={textureWidth} blank />}>
									<PhotoPrint src={photo.src} seed={`${trip.slug}:${i}`} caption={photo.caption ?? ''} textureWidth={textureWidth} onClick={() => setZoomed((z) => (z === i ? null : i))} />
								</Suspense>
							) : (
								print
							)}
						</group>
					);
				})}
				{cardShown && (
					<Html transform distanceFactor={CARD_DISTANCE_FACTOR} position={[layout.card.x, layout.card.y, 0.002]} zIndexRange={[1, 0]}>
						<TripCard trip={trip} onClose={onClose} />
					</Html>
				)}
			</group>
		</group>
	);
}

interface PrintProps {
	seed: string;
	caption: string;
	textureWidth: number;
	image?: HTMLImageElement | null;
	/** A plain print while the photo loads. */
	blank?: boolean;
	onClick?: () => void;
}

/** Loads the photo, then draws the print. useLoader suspends until the image has arrived. */
function PhotoPrint({ src, ...props }: PrintProps & { src: string }) {
	const image = useLoader(ImageLoader, src);
	return <Print {...props} image={image} />;
}

/** One print: a white-bordered photo (or the TODO placeholder) on thin card. */
function Print({ seed, caption, textureWidth, image = null, blank = false, onClick }: PrintProps) {
	const gl = useThree((state) => state.gl);
	const [hovered, setHovered] = useState(false);
	useCursor(hovered && !!onClick);
	const front = useMemo(() => {
		if (blank) return null;
		const t = createPolaroidFront({ width: textureWidth, photo: image, caption, seed });
		t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
		return t;
	}, [blank, textureWidth, image, caption, seed, gl]);
	useEffect(() => () => front?.dispose(), [front]);

	return (
		<mesh
			castShadow
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
			}}
			onPointerOut={() => setHovered(false)}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				if (e.delta <= 4) onClick?.();
			}}
		>
			<boxGeometry args={[W, H, T]} />
			{[0, 1, 2, 3, 5].map((i) => (
				<meshStandardMaterial key={i} attach={`material-${i}`} color="#eeeae0" roughness={0.85} />
			))}
			{/* Held up to the camera, a print faces away from the lamp behind it; a faint glow of its
			    own (the print as its own emissive map) keeps the photo readable. */}
			{front ? (
				<meshStandardMaterial attach="material-4" map={front} emissive="#ffffff" emissiveMap={front} emissiveIntensity={0.45} roughness={0.6} />
			) : (
				<meshStandardMaterial attach="material-4" color="#f3f0e8" roughness={0.8} />
			)}
		</mesh>
	);
}
