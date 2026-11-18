import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { MathUtils, type Group, type Vector3Tuple } from 'three';
import { refreshShadows, wake } from './pacing';
import { POLAROID_SIZE, seededRandom } from './polaroid';
import { TripCard } from './TripCard';
import type { DeskMap, DeskTrip } from './types';

/*
 * What opens when a place on the map is clicked: the trip's cover rises out of the map at its pin
 * as a print and tips up toward the camera, and the trip's card (dates, how long, how many photos,
 * the link to its page) appears beside it, like a postcard. A click on the print brings it forward;
 * another puts it back. Closing plays it all in reverse, back into the map.
 *
 * A preview, not the whole trip: just the cover. The trip's page has every photo, large. (The
 * layout can still fan out several prints: raise MAX_PRINTS.)
 *
 * The prints and the card are HTML placed in 3D (drei's <Html transform>), not textures: the
 * browser draws them, so they stay as sharp as the page's text whatever resolution the 3D scene
 * is drawn at (the quality ladder lowers it on slower GPUs) and whatever its effects (depth of
 * field, film grain) do to everything else. Each print has an invisible card of its own size
 * behind it in the scene, so it still casts its shadow on the map.
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
/** The preview: the cover alone. */
const MAX_PRINTS = 1;
/** The card and each print are laid out 440 px wide (desk.css) and scaled to a print's width. */
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
	/** The map sheet: the card's locator stamp is cut from it. */
	map: DeskMap;
	/** The pin's base, on the map. */
	anchor: Vector3Tuple;
	layout: RevealLayout;
	/** False plays the closing animation; onClosed fires when it has finished. */
	open: boolean;
	onClose: () => void;
	onClosed: () => void;
	reducedMotion: boolean;
}

export function TripReveal({ trip, map, anchor, layout, open, onClose, onClosed, reducedMotion }: TripRevealProps) {
	const plane = useRef<Group>(null);
	const prints = useRef<(Group | null)[]>([]);
	const rise = useRef(0);
	const spread = useRef(0);
	const zoom = useRef<number[]>([]);
	const closedFired = useRef(false);
	const [cardShown, setCardShown] = useState(false);
	const [zoomed, setZoomed] = useState<number | null>(null);
	// The print last brought forward stays on top of the others while it goes back.
	const [onTop, setOnTop] = useState<number | null>(null);
	const toggleZoom = (i: number) => {
		setOnTop(i);
		setZoomed((z) => (z === i ? null : i));
	};

	useEffect(() => {
		if (open) closedFired.current = false;
		else setZoomed(null);
	}, [open]);
	// Gone: redraw the shadows without the prints.
	useEffect(() => () => refreshShadows(), []);

	useFrame((_, delta) => {
		const k = reducedMotion ? Infinity : 6;
		const before = rise.current + spread.current + zoom.current.reduce((sum, z) => sum + z, 0);
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

		// Still moving: full frame rate, and the prints' shadows follow them.
		if (Math.abs(rise.current + spread.current + zoom.current.reduce((sum, z) => sum + z, 0) - before) > 1e-5) {
			wake();
			refreshShadows();
		}

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
				{layout.prints.map((_, i) => (
					<group key={i} ref={(g) => void (prints.current[i] = g)}>
						<Print
							photo={photos[i] ?? null}
							seed={`${trip.slug}:${i}`}
							// Later prints over earlier ones; the one last brought forward over them all.
							layer={onTop === i ? 10 : 2 + i}
							zoomed={zoomed === i}
							onClick={() => toggleZoom(i)}
						/>
					</group>
				))}
				{cardShown && (
					<Html transform distanceFactor={CARD_DISTANCE_FACTOR} position={[layout.card.x, layout.card.y, 0.002]} zIndexRange={[1, 0]}>
						<div onPointerDown={keepFromScene} onClick={keepFromScene}>
							<TripCard trip={trip} map={map} onClose={onClose} />
						</div>
					</Html>
				)}
			</group>
		</group>
	);
}

/** One print: a white-bordered photo (or the TODO placeholder) with its caption, as HTML. */
function Print({ photo, seed, layer, zoomed, onClick }: { photo: DeskTrip['photos'][number] | null; seed: string; layer: number; zoomed: boolean; onClick: () => void }) {
	// The caption, written by hand: a little off centre and off level, the same on every visit.
	const hand = useMemo(() => {
		const rand = seededRandom(seed);
		return `translateX(${((rand() - 0.5) * 30).toFixed(1)}px) rotate(${((rand() - 0.5) * 5).toFixed(2)}deg)`;
	}, [seed]);
	const caption = photo?.caption ?? '';
	return (
		<>
			{/* Its shadow on the map: an invisible card the print's size. */}
			<mesh castShadow>
				<boxGeometry args={[W, H, T]} />
				<meshBasicMaterial colorWrite={false} depthWrite={false} />
			</mesh>
			<Html transform distanceFactor={CARD_DISTANCE_FACTOR} position={[0, 0, T / 2]} zIndexRange={[layer, layer]}>
				<button
					type="button"
					className={`desk-print${zoomed ? ' is-zoomed' : ''}`}
					onPointerDown={keepFromScene}
					onClick={(e) => {
						keepFromScene(e);
						onClick();
					}}
					aria-pressed={zoomed}
					aria-label={photo ? `${zoomed ? 'Put back' : 'Bring forward'}: ${photo.alt}` : 'No photo yet'}
				>
					{photo ? (
						<img src={photo.src} alt="" draggable={false} decoding="async" />
					) : (
						<span className="desk-print-placeholder">
							<span className="todo">TODO: photo</span>
						</span>
					)}
					<span className="desk-print-caption" style={{ transform: hand, fontSize: captionSize(caption) }} aria-hidden="true">
						{caption}
					</span>
				</button>
			</Html>
		</>
	);
}

/**
 * The prints and the card are HTML over the canvas, so a press or click on them would bubble up
 * to the scene's own handlers, which would see the map underneath and close the trip (or start
 * turning the camera). They stop here.
 */
function keepFromScene(e: SyntheticEvent) {
	e.stopPropagation();
}

/** Caveat at up to 52 px, smaller for a long caption so it fits the strip (about 360 px). */
function captionSize(caption: string) {
	return `${Math.min(52, Math.round(360 / (Math.max(1, caption.length) * 0.43)))}px`;
}
