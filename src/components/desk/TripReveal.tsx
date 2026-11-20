import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode, type SyntheticEvent } from 'react';
import { MathUtils, type Group, type Vector3Tuple } from 'three';
import { refreshShadows, wake } from './pacing';
import { TripPoster } from './TripPoster';
import type { DeskTrip } from './types';

/*
 * What opens when a place on the map is clicked: two cards rise out of the map at its pin and tip
 * up toward the camera. On the left one photo of the trip, as a print; on the right its design
 * card (the place's emblem, its name, and the link to its page). On a phone the photo is on top
 * and the design card below. Closing plays it in reverse, back into the map.
 *
 * A preview, not the trip: the trip's page has every photo, the dates and the journal.
 *
 * The cards are HTML placed in 3D (drei's <Html transform>), not textures: the browser draws
 * them, so they stay as sharp as the page's text whatever resolution the 3D scene is drawn at
 * (the quality ladder lowers it on slower GPUs) and whatever its effects (depth of field, film
 * grain) do to everything else. Each has an invisible card of its own size behind it in the
 * scene, so it still casts its shadow on the map.
 *
 * They hang on a "presentation plane": a sheet of space that starts flat on the map at the pin
 * and rises to hang in front of the camera, tilted to face it (the camera looks down at 45° while
 * something is open, so the plane tilts up to match).
 */
/** How high the plane rises above the map, and how far it comes toward the viewer. */
const LIFT = 0.12;
const FORWARD = 0.05;
/** Facing a camera that looks down at 45°, nudged a little past it so it reads as an object. */
const TILT = -Math.PI / 4 + 0.07;
/** Metres per px of the cards' layout: each is 440 × 535 px (desk.css), 11 cm across on the desk. */
const PX = 0.00025;
const CARD = { width: 440 * PX, height: 535 * PX, thickness: 0.0025 };
/** The space between the two cards. */
const GAP = { wide: 0.025, tall: 0.012 };
/** How much of the screen's width and height the pair may fill, wide and tall. */
const FILL = { wide: { width: 0.8, height: 0.55 }, tall: { width: 0.9, height: 0.74 } } as const;

export interface RevealLayout {
	/** Where each card's middle goes on the plane, in metres from the plane's own middle. */
	print: { x: number; y: number };
	poster: { x: number; y: number };
	/** The box the camera fits on screen: the pair and the room left around it. */
	frame: { width: number; height: number };
}

/** Side by side on a wide screen (photo left, design right); stacked on a phone (photo on top). */
export function revealLayout(portrait: boolean): RevealLayout {
	if (portrait) {
		const y = (CARD.height + GAP.tall) / 2;
		return { print: { x: 0, y }, poster: { x: 0, y: -y }, frame: { width: CARD.width / FILL.tall.width, height: (2 * CARD.height + GAP.tall) / FILL.tall.height } };
	}
	const x = (CARD.width + GAP.wide) / 2;
	return { print: { x: -x, y: 0 }, poster: { x, y: 0 }, frame: { width: (2 * CARD.width + GAP.wide) / FILL.wide.width, height: CARD.height / FILL.wide.height } };
}

/** The point the camera should look at: the middle of the pair, where the plane ends up. */
export function revealCentre(anchor: Vector3Tuple): Vector3Tuple {
	return [anchor[0], anchor[1] + LIFT, anchor[2] + FORWARD];
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
	reducedMotion: boolean;
}

export function TripReveal({ trip, anchor, layout, open, onClose, onClosed, reducedMotion }: TripRevealProps) {
	const plane = useRef<Group>(null);
	const print = useRef<Group>(null);
	const poster = useRef<Group>(null);
	const rise = useRef(0);
	const closedFired = useRef(false);

	useEffect(() => {
		if (open) closedFired.current = false;
	}, [open]);
	// Gone: redraw the shadows without the cards.
	useEffect(() => () => refreshShadows(), []);

	useFrame((_, delta) => {
		const before = rise.current;
		const r = (rise.current = MathUtils.damp(before, open ? 1 : 0, reducedMotion ? Infinity : 6, delta));
		const p = plane.current;
		if (p) {
			p.position.set(0, 0.003 + LIFT * r, FORWARD * r);
			p.rotation.x = MathUtils.lerp(-Math.PI / 2, TILT, r);
			p.scale.setScalar(0.25 + 0.75 * r);
		}
		// The two leave the pin as one stack and part as they rise.
		print.current?.position.set(layout.print.x * r, layout.print.y * r, 0);
		poster.current?.position.set(layout.poster.x * r, layout.poster.y * r, 0.0015);
		// Still moving: full frame rate, and the cards' shadows follow them.
		if (Math.abs(r - before) > 1e-5) {
			wake();
			refreshShadows();
		}
		if (!open && r < 0.02 && !closedFired.current) {
			closedFired.current = true;
			onClosed();
		}
	});

	return (
		<group position={anchor}>
			<group ref={plane}>
				<group ref={print}>
					<Card layer={1}>
						<figure className="desk-print">
							{trip.photo ? (
								<img src={trip.photo.src} alt={trip.photo.alt} draggable={false} decoding="async" />
							) : (
								<span className="desk-print-placeholder">
									<span className="todo">TODO: photo</span>
								</span>
							)}
						</figure>
					</Card>
				</group>
				<group ref={poster}>
					<Card layer={2}>
						<TripPoster trip={trip} onClose={onClose} />
					</Card>
				</group>
			</group>
		</group>
	);
}

/** One card on the plane: its HTML, and an invisible card its size that casts its shadow on the map. */
function Card({ layer, children }: { layer: number; children: ReactNode }) {
	return (
		<>
			<mesh castShadow>
				<boxGeometry args={[CARD.width, CARD.height, CARD.thickness]} />
				<meshBasicMaterial colorWrite={false} depthWrite={false} />
			</mesh>
			<Html transform distanceFactor={400 * PX} position={[0, 0, CARD.thickness / 2]} zIndexRange={[layer, layer]}>
				<div onPointerDown={keepFromScene} onClick={keepFromScene}>
					{children}
				</div>
			</Html>
		</>
	);
}

/**
 * The cards are HTML over the canvas, so a press or click on them would bubble up to the scene's
 * own handlers, which would see the map underneath and close the trip (or start turning the
 * camera). They stop here.
 */
function keepFromScene(e: SyntheticEvent) {
	e.stopPropagation();
}
