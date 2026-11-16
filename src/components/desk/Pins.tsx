import { Html, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, MathUtils, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { seededRandom } from './polaroidTexture';
import type { DeskMap, DeskTrip } from './types';
import { mapToDesk } from './WorldMap';

/*
 * Push-pins, one per trip, stuck into the map at each trip's place.
 *
 * A steel needle with a glossy blue head (the portfolio's accent, brightened to stand out on the
 * navy chart), a ring rippling out across the paper beneath it, and the place's name always on
 * show. Each pin leans a few degrees in its own direction, like pins pushed in by hand.
 */
const HEAD_RADIUS = 0.007;
const NEEDLE_LENGTH = 0.02;
const NEEDLE_RADIUS = 0.0007;
const HOVER_LIFT = 0.006;
const EASE = 8;
export const PIN_BLUE = '#5b8cff';

interface PinsProps {
	trips: DeskTrip[];
	map: DeskMap;
	/** The place under the pointer or keyboard focus, or null. */
	hovered: string | null;
	/** The opened place, or null. */
	selected: string | null;
	onHover: (slug: string | null) => void;
	onSelect: (slug: string) => void;
	reducedMotion: boolean;
}

export function Pins({ trips, map, hovered, selected, onHover, onSelect, reducedMotion }: PinsProps) {
	// Labels go above their pin, unless other places are close by (within a fifteenth of the map's
	// width, about a label's length at the starting view). Then the label moves away
	// from them: to the left if the neighbours are east, to the right if they're west, below if
	// they're on both sides (Portland, Zion and Dallas form such a cluster).
	const placed = useMemo(() => {
		const list = trips.filter((t) => t.map).map((trip) => ({ trip, position: mapToDesk(map, trip.map!) }));
		return list.map((p) => {
			const near = list.filter((q) => q !== p && Math.hypot(q.position[0] - p.position[0], q.position[2] - p.position[2]) < map.width / 15);
			const east = near.some((q) => q.position[0] > p.position[0]);
			const west = near.some((q) => q.position[0] < p.position[0]);
			const side: LabelSide = east && west ? 'below' : east ? 'left' : west ? 'right' : 'above';
			return { ...p, side };
		});
	}, [trips, map]);

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

type LabelSide = 'above' | 'below' | 'left' | 'right';

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
		if (l) l.position.y = MathUtils.damp(l.position.y, lifted ? HOVER_LIFT : 0, reducedMotion ? Infinity : EASE, delta);
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
				<ringGeometry args={[0.009, 0.0115, 48]} />
				<meshBasicMaterial color={PIN_BLUE} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
			</mesh>

			<group ref={lifter}>
				<group rotation={[lean.x, 0, lean.z]}>
					{/* Needle: polished steel, pushed in so only part of it shows. */}
					<mesh position={[0, NEEDLE_LENGTH / 2 - 0.003, 0]} castShadow>
						<cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, NEEDLE_LENGTH + 0.006, 8]} />
						<meshStandardMaterial color="#d6d6da" metalness={1} roughness={0.32} />
					</mesh>
					{/* Head: glossy plastic, with a clearcoat for the sharp highlight plastic has. */}
					<mesh position={[0, NEEDLE_LENGTH + HEAD_RADIUS * 0.8, 0]} castShadow onPointerOver={onPointerOver} onPointerOut={() => onHover(null)} onClick={onClick}>
						<sphereGeometry args={[HEAD_RADIUS, 24, 18]} />
						<meshPhysicalMaterial color={PIN_BLUE} emissive={PIN_BLUE} emissiveIntensity={lifted ? 0.35 : 0.12} roughness={0.3} clearcoat={1} clearcoatRoughness={0.08} />
					</mesh>
					{/* A larger invisible target, so the pin is easy to hit with a finger. */}
					<mesh position={[0, NEEDLE_LENGTH, 0]} onPointerOver={onPointerOver} onPointerOut={() => onHover(null)} onClick={onClick} visible={false}>
						<sphereGeometry args={[0.018, 8, 6]} />
					</mesh>
				</group>

				{!anySelected && (
					// Screen-space label (no `transform`): always upright and readable.
					<Html position={[0, NEEDLE_LENGTH + 0.016, 0]} zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
						<span className={`pin-label pin-label-${side}${lifted ? ' is-active' : ''}`}>{trip.title}</span>
					</Html>
				)}
			</group>
		</group>
	);
}
