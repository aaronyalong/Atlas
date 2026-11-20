import { Html, useCursor } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, MathUtils, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { Framing } from './camera';
import { LABEL_HEIGHT, placeLabels, type LabelSide } from './labels';
import { refreshShadows, wake } from './pacing';
import { seededRandom } from './random';
import type { DeskMap, DeskTrip } from './types';
import { mapToDesk } from './WorldMap';

/*
 * Map pins, one per trip, stuck into the map at each trip's place.
 *
 * Brass, like the lamp and the window: a polished dome head on a stepped collar (the deco
 * ziggurat in miniature) and a steel needle; a ring of gold light rippling out across the paper
 * beneath it, and the place's name always on show. Each pin leans a few degrees in its own
 * direction, like pins pushed in by hand.
 */
// About one and a half times life size: true to size, on a 3 m map seen from 4 m away, they'd
// be specks.
const HEAD_RADIUS = 0.011;
const NEEDLE_LENGTH = 0.028;
const NEEDLE_RADIUS = 0.0007;
const HOVER_LIFT = 0.006;
const EASE = 8;
/** The ripple's gold, and the brass. */
const RIPPLE_GOLD = '#e8b85c';
const BRASS = '#c29a4b';

interface PinsProps {
	trips: DeskTrip[];
	map: DeskMap;
	/** The starting view: the labels are placed so none overlap in it. */
	framing: Framing;
	/** The place under the pointer or keyboard focus, or null. */
	hovered: string | null;
	/** The opened place, or null. */
	selected: string | null;
	onHover: (slug: string | null) => void;
	onSelect: (slug: string) => void;
	reducedMotion: boolean;
}

export function Pins({ trips, map, framing, hovered, selected, onHover, onSelect, reducedMotion }: PinsProps) {
	// Each place's name goes beside its pin, on whichever side keeps it clear of the other names
	// and pins at the starting view (labels.ts).
	const size = useThree((state) => state.size);
	const placed = useMemo(() => {
		const list = trips.filter((t) => t.map).map((trip) => ({ trip, position: mapToDesk(map, trip.map!) }));
		const sides = placeLabels(list.map(({ trip, position }) => ({ position, title: trip.title })), framing, size);
		return list.map((p, i) => ({ ...p, side: sides[i] }));
	}, [trips, map, framing, size]);

	return placed.map(({ trip, position, side }) => (
		<Pin
			key={trip.slug}
			trip={trip}
			position={position}
			side={side}
			hovered={hovered === trip.slug}
			selected={selected === trip.slug}
			anySelected={selected !== null}
			onHover={onHover}
			onSelect={onSelect}
			reducedMotion={reducedMotion}
		/>
	));
}

interface PinProps {
	trip: DeskTrip;
	position: [number, number, number];
	side: LabelSide;
	hovered: boolean;
	selected: boolean;
	anySelected: boolean;
	onHover: (slug: string | null) => void;
	onSelect: (slug: string) => void;
	reducedMotion: boolean;
}

function Pin({ trip, position, side, hovered, selected, anySelected, onHover, onSelect, reducedMotion }: PinProps) {
	const lean = useMemo(() => {
		const rand = seededRandom(`${trip.slug}:pin`);
		const angle = (4 + rand() * 7) * (Math.PI / 180);
		const direction = rand() * Math.PI * 2;
		return { x: Math.sin(direction) * angle, z: Math.cos(direction) * angle, phase: rand() * 3 };
	}, [trip.slug]);

	const lifter = useRef<Group>(null);
	const ring = useRef<Mesh>(null);
	const lifted = hovered || selected;
	useCursor(hovered && !selected);

	useFrame(({ clock }, delta) => {
		const l = lifter.current;
		if (l) {
			const y = MathUtils.damp(l.position.y, lifted ? HOVER_LIFT : 0, reducedMotion ? Infinity : EASE, delta);
			// Moving: full frame rate, and the pin's shadow follows it.
			if (Math.abs(y - l.position.y) > 1e-6) {
				wake();
				refreshShadows();
			}
			l.position.y = y;
		}
		// The ripple: a ring that grows and fades every 2.6 s; faster and brighter when hovered.
		const r = ring.current;
		if (r) {
			const material = r.material as MeshBasicMaterial;
			if (reducedMotion) {
				r.scale.setScalar(1.6);
				material.opacity = lifted ? 0.6 : 0.35;
			} else {
				const t = ((clock.elapsedTime + lean.phase) / (lifted ? 1.4 : 2.6)) % 1;
				r.scale.setScalar(1 + t * 2.2);
				material.opacity = (1 - t) * (lifted ? 0.85 : 0.55);
			}
		}
	});

	const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		onHover(trip.slug);
	};
	const onClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		if (e.delta > 4 || selected) return;
		onSelect(trip.slug);
	};

	return (
		<group position={position}>
			{/* The ripple, lying on the paper. */}
			<mesh ref={ring} position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<ringGeometry args={[0.013, 0.0165, 48]} />
				<meshBasicMaterial color={RIPPLE_GOLD} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
			</mesh>

			<group ref={lifter}>
				<group rotation={[lean.x, 0, lean.z]}>
					{/* Needle: polished steel, pushed in so only part of it shows. */}
					<mesh position={[0, NEEDLE_LENGTH / 2 - 0.003, 0]} castShadow>
						<cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, NEEDLE_LENGTH + 0.006, 8]} />
						<meshStandardMaterial color="#d6d6da" metalness={1} roughness={0.32} />
					</mesh>
					{/* Stepped collar: two brass discs, the lower one wider. */}
					<mesh position={[0, NEEDLE_LENGTH + 0.0018, 0]} castShadow>
						<cylinderGeometry args={[HEAD_RADIUS * 0.95, HEAD_RADIUS * 1.05, 0.0036, 24]} />
						<meshStandardMaterial color={BRASS} metalness={1} roughness={0.38} />
					</mesh>
					<mesh position={[0, NEEDLE_LENGTH + 0.0051, 0]} castShadow>
						<cylinderGeometry args={[HEAD_RADIUS * 0.72, HEAD_RADIUS * 0.8, 0.003, 24]} />
						<meshStandardMaterial color={BRASS} metalness={1} roughness={0.38} />
					</mesh>
					{/* Head: a polished brass dome. A faint warm glow (stronger while hovered) keeps it
					    from going dark against the navy sea. */}
					<mesh position={[0, NEEDLE_LENGTH + 0.0066, 0]} castShadow onPointerOver={onPointerOver} onPointerOut={() => onHover(null)} onClick={onClick}>
						<sphereGeometry args={[HEAD_RADIUS * 0.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
						<meshStandardMaterial color={BRASS} metalness={1} roughness={0.3} emissive="#7a5520" emissiveIntensity={lifted ? 0.9 : 0.35} />
					</mesh>
					{/* A larger invisible target, so the pin is easy to hit with a finger. */}
					<mesh position={[0, NEEDLE_LENGTH, 0]} onPointerOver={onPointerOver} onPointerOut={() => onHover(null)} onClick={onClick} visible={false}>
						<sphereGeometry args={[0.018, 8, 6]} />
					</mesh>
				</group>

				{!anySelected && (
					// Screen-space label (no `transform`): always upright and readable. Clicking or hovering
					// it does what the pin does. Hidden from screen readers and the tab order: DeskApp's
					// list of places already gives each place a button.
					<Html position={[0, LABEL_HEIGHT, 0]} zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
						<span
							className={`deco-tag pin-label pin-label-${side}${lifted ? ' is-active' : ''}`}
							aria-hidden="true"
							onPointerEnter={() => onHover(trip.slug)}
							onPointerLeave={() => onHover(null)}
							onClick={() => onSelect(trip.slug)}
						>
							{trip.title}
						</span>
					</Html>
				)}
			</group>
		</group>
	);
}
