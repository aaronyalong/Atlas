import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type SyntheticEvent } from 'react';
import { MathUtils, type Group, type Vector3Tuple } from 'three';
import { refreshShadows, wake } from './pacing';
import { PREVIEW_PX, TripPreview } from './TripPreview';
import type { DeskTrip } from './types';

/*
 * What opens when a place on the map is clicked: the trip's preview panel rises out of the map at
 * its pin and tips up toward the camera. One photo of the trip on the left, its design on the
 * right (the place's emblem, its name, and the link to its page); on a phone, the photo on top
 * and the design below. Closing plays it in reverse, back into the map.
 *
 * A preview, not the trip: the trip's page has every photo, the dates and the journal.
 *
 * The panel is HTML placed in 3D (drei's <Html transform>), not a texture: the browser draws it,
 * so it stays as sharp as the page's text whatever resolution the 3D scene is drawn at (the
 * quality ladder lowers it on slower GPUs) and whatever its effects (depth of field, film grain)
 * do to everything else. An invisible card of its own size sits behind it in the scene, so it
 * still casts its shadow on the map.
 *
 * It hangs on a "presentation plane": a sheet of space that starts flat on the map at the pin and
 * rises to hang in front of the camera, tilted to face it (the camera looks down at 45° while
 * something is open, so the plane tilts up to match).
 */
/** How high the plane rises above the map, and how far it comes toward the viewer. */
const LIFT = 0.12;
const FORWARD = 0.05;
/** Facing a camera that looks down at 45°, nudged a little past it so it reads as an object. */
const TILT = -Math.PI / 4 + 0.07;
/** Metres per px of the panel's layout: 900 px across comes to 22.5 cm on the desk. */
const PX = 0.00025;
const THICKNESS = 0.0025;
/** How much of the screen's width and height the panel may fill, wide and tall. */
const FILL = { wide: { width: 0.72, height: 0.58 }, tall: { width: 0.9, height: 0.74 } } as const;

export interface RevealLayout {
	/** The phone's layout: the panel stands on end. */
	tall: boolean;
	/** The panel's size on the plane, in metres. */
	width: number;
	height: number;
	/** The box the camera fits on screen: the panel and the room left around it. */
	frame: { width: number; height: number };
}

/** The panel's size, and the frame the camera fits, for a wide or a tall (phone) screen. */
export function revealLayout(portrait: boolean): RevealLayout {
	const px = portrait ? PREVIEW_PX.tall : PREVIEW_PX.wide;
	const fill = portrait ? FILL.tall : FILL.wide;
	const width = px.width * PX;
	const height = px.height * PX;
	return { tall: portrait, width, height, frame: { width: width / fill.width, height: height / fill.height } };
}

/** The point the camera should look at: the middle of the panel, where the plane ends up. */
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
	const rise = useRef(0);
	const closedFired = useRef(false);

	useEffect(() => {
		if (open) closedFired.current = false;
	}, [open]);
	// Gone: redraw the shadows without the panel.
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
		// Still moving: full frame rate, and the panel's shadow follows it.
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
				{/* Its shadow on the map: an invisible card the panel's size. */}
				<mesh castShadow>
					<boxGeometry args={[layout.width, layout.height, THICKNESS]} />
					<meshBasicMaterial colorWrite={false} depthWrite={false} />
				</mesh>
				<Html transform distanceFactor={400 * PX} position={[0, 0, THICKNESS / 2]} zIndexRange={[1, 0]}>
					<div onPointerDown={keepFromScene} onClick={keepFromScene}>
						<TripPreview trip={trip} tall={layout.tall} onClose={onClose} />
					</div>
				</Html>
			</group>
		</group>
	);
}

/**
 * The panel is HTML over the canvas, so a press or click on it would bubble up to the scene's own
 * handlers, which would see the map underneath and close the trip (or start turning the camera).
 * They stop here.
 */
function keepFromScene(e: SyntheticEvent) {
	e.stopPropagation();
}
