import { Html, useCursor } from '@react-three/drei';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { ImageLoader, MathUtils, type Group, type Texture } from 'three';
import { presentedPosition, type PlacedPolaroid } from './layout';
import {
	createPolaroidBack,
	createPolaroidFront,
	loadCaptionFont,
	POLAROID_SIZE,
} from './polaroidTexture';
import type { DeskTrip } from './types';

const { width: W, height: H, thickness: T } = POLAROID_SIZE;

/** How far a polaroid rises off the desk when hovered (metres). */
const HOVER_LIFT = 0.025;
/** How quickly poses ease toward their target (higher = snappier). */
const EASE = 7;
/**
 * The trip card is HTML laid out at CARD_WIDTH_PX and pinned onto the polaroid's back with
 * drei's <Html transform>, which maps 400 / distanceFactor CSS px to one world unit. Laying it
 * out larger than it appears and letting the browser scale it down keeps the text crisp.
 */
const CARD_WIDTH_PX = 440;
const CARD_DISTANCE_FACTOR = (400 * W) / CARD_WIDTH_PX;

interface PolaroidsProps {
	placed: PlacedPolaroid[];
	/** Slug of the opened polaroid, or null. */
	selected: string | null;
	onSelect: (slug: string) => void;
	onClose: () => void;
	textureWidth: number;
	reducedMotion: boolean;
}

/**
 * The featured trips' polaroids.
 *
 * `use(loadCaptionFont(...))` suspends (pauses rendering, showing the Suspense fallback; here
 * the loading screen) until the handwriting font is ready, because a texture drawn before then
 * would be stuck with the fallback font.
 */
export function Polaroids({ placed, selected, ...rest }: PolaroidsProps) {
	use(loadCaptionFont(placed.map((p) => p.trip.caption).join('')));

	// One back texture, shared by every polaroid.
	const back = useMemo(() => createPolaroidBack(rest.textureWidth), [rest.textureWidth]);
	useEffect(() => () => back.dispose(), [back]);

	return placed.map((p) => {
		const props = { placed: p, back, selected: selected === p.trip.slug, anySelected: selected !== null, ...rest };
		return p.trip.photo ? <PhotoPolaroid key={p.trip.slug} {...props} /> : <Polaroid key={p.trip.slug} {...props} image={null} />;
	});
}

type PolaroidProps = Omit<PolaroidsProps, 'placed' | 'selected'> & {
	placed: PlacedPolaroid;
	back: Texture;
	selected: boolean;
	anySelected: boolean;
};

/**
 * Loads the cover photo, then renders the polaroid. A separate component because hooks can't be
 * called conditionally: only polaroids with a photo call useLoader. useLoader suspends until the
 * image arrives, and three's loading manager reports its progress to the loading screen.
 */
function PhotoPolaroid(props: PolaroidProps) {
	const image = useLoader(ImageLoader, props.placed.trip.photo!.src);
	return <Polaroid {...props} image={image} />;
}

/**
 * One polaroid. Two nested groups split the motion: the outer one moves (position), the inner
 * one turns (rotation). Every frame (useFrame), each value eases a little toward its target
 * pose, so any change of state (hover, open, close) becomes a smooth motion, even mid-way
 * through another one.
 *
 * Poses:
 *   resting:  flat on the desk, at its slot's angle
 *   hovered:  lifted 2.5 cm, tilted slightly toward you, with a label
 *   opened:   rises and tips up to face the camera, then flips over (once it's clear of the desk)
 *             to show the trip card on its back. Closing plays it in reverse. While open it's
 *             held at a slight angle and bobs gently, as if in a hand, so it reads as an object
 *             in the room rather than a flat popup.
 */
function Polaroid({
	placed,
	image,
	back,
	selected,
	anySelected,
	onSelect,
	onClose,
	textureWidth,
	reducedMotion,
}: PolaroidProps & { image: HTMLImageElement | null }) {
	const { trip, rest, turn } = placed;
	const gl = useThree((state) => state.gl);

	const front = useMemo(() => {
		const texture = createPolaroidFront({ width: textureWidth, photo: image, caption: trip.caption, seed: trip.slug });
		texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
		return texture;
	}, [textureWidth, image, trip.caption, trip.slug, gl]);
	useEffect(() => () => front.dispose(), [front]);

	const mover = useRef<Group>(null);
	const turner = useRef<Group>(null);
	const [hovered, setHovered] = useState(false);
	const [cardOpen, setCardOpen] = useState(false);
	const cardOpenRef = useRef(false);
	const presented = useMemo(() => presentedPosition(rest), [rest]);
	const lifted = hovered && !selected;

	// Pointer cursor while over a polaroid you can open.
	useCursor(lifted);

	useFrame(({ clock }, delta) => {
		const m = mover.current;
		const t = turner.current;
		if (!m || !t) return;
		const k = reducedMotion ? Infinity : EASE; // Infinity = jump straight to the target
		const ease = (from: number, to: number) => MathUtils.damp(from, to, k, delta);

		// Stay up while opened, and also while closing until it has flipped face-up again.
		const up = selected || t.rotation.y > 0.35;
		const clearOfDesk = m.position.y > 0.06;
		const [x, y, z] = up ? presented : [rest[0], rest[1] + (lifted ? HOVER_LIFT : 0), rest[2]];
		// The "held in a hand" bob: a few millimetres up and down, a slight sway.
		const time = clock.elapsedTime;
		const bob = selected && !reducedMotion ? Math.sin(time * 1.3) : 0;
		const sway = selected && !reducedMotion ? Math.sin(time * 0.9) : 0;

		m.position.set(ease(m.position.x, x), ease(m.position.y, y + bob * 0.0025), ease(m.position.z, z));
		t.rotation.set(
			// Flat is -90° (face up). Opened: about -45°, facing the camera, which looks down at 45°.
			ease(t.rotation.x, up ? -Math.PI / 4 + 0.07 : -Math.PI / 2 + (lifted ? 0.1 : 0)),
			// The flip: (almost) half a turn about the print's own vertical axis. Stopping a little
			// short leaves it turned slightly, so perspective shows it's a card in space.
			ease(t.rotation.y, selected && clearOfDesk ? Math.PI - 0.16 : 0),
			ease(t.rotation.z, up ? 0.035 + sway * 0.012 : turn),
		);

		// Show the card once the flip is nearly done (setState only when it changes).
		const open = selected && t.rotation.y > Math.PI * 0.85;
		if (open !== cardOpenRef.current) {
			cardOpenRef.current = open;
			setCardOpen(open);
		}
	});

	const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation(); // only the top-most object under the pointer reacts
		setHovered(true);
	};
	const onClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		// `delta`: how far (px) the pointer moved between press and release. A drag that ends
		// on a polaroid is the visitor turning the camera, not a click.
		if (e.delta > 4 || selected) return;
		onSelect(trip.slug);
	};

	return (
		<group ref={mover} position={rest}>
			<group ref={turner} rotation={[-Math.PI / 2, 0, turn]}>
				<mesh castShadow receiveShadow onPointerOver={onPointerOver} onPointerOut={() => setHovered(false)} onClick={onClick}>
					<boxGeometry args={[W, H, T]} />
					{/* A box has six faces, each with its own material slot:
					    0–3 the edges, 4 the front (+z), 5 the back (−z). */}
					{[0, 1, 2, 3].map((i) => (
						<meshStandardMaterial key={i} attach={`material-${i}`} color="#eeeae0" roughness={0.8} />
					))}
					<meshStandardMaterial attach="material-4" map={front} roughness={0.42} />
					{/* The back faces away from the lamp once flipped; a faint glow of its own keeps
					    it from going muddy. */}
					<meshStandardMaterial attach="material-5" map={back} roughness={0.9} emissive="#ffffff" emissiveMap={back} emissiveIntensity={0.15} />
				</mesh>
				{cardOpen && <TripCard trip={trip} onClose={onClose} />}
			</group>

			{lifted && !anySelected && (
				// Screen-space label (no `transform`): always upright and readable, placed just
				// beyond the polaroid's top edge.
				<Html position={[0, 0.02, -0.09]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
					<span className="desk-label">
						{trip.title}, {trip.place}
					</span>
				</Html>
			)}
		</group>
	);
}

/**
 * The trip card on the polaroid's back. Real HTML (crisp text, a real link, keyboard and screen
 * reader friendly), placed in 3D with <Html transform> so it turns with the print.
 */
function TripCard({ trip, onClose }: { trip: DeskTrip; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the card when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `trip-card-${trip.slug}`;

	return (
		<Html
			transform
			distanceFactor={CARD_DISTANCE_FACTOR}
			// Just off the back face, turned to face out from it.
			position={[0, 0, -T / 2 - 0.0004]}
			rotation={[0, Math.PI, 0]}
			zIndexRange={[1, 0]}
		>
			<article className="trip-card" role="dialog" aria-labelledby={titleId}>
				<button ref={closeRef} type="button" className="trip-card-close" onClick={onClose} aria-label="Close">
					×
				</button>
				<p className="trip-card-place">{trip.place}</p>
				<h2 id={titleId} className="trip-card-title">
					{trip.title}
				</h2>
				<p className="trip-card-dates">{trip.dates ?? <span className="todo">TODO: dates</span>}</p>
				<p className="trip-card-blurb">{trip.blurb ?? <span className="todo">TODO: blurb</span>}</p>
				<a className="trip-card-open" href={trip.href}>
					Open trip <span aria-hidden="true">→</span>
				</a>
			</article>
		</Html>
	);
}
