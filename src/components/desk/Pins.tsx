import { Html, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MathUtils, type Group } from 'three';
import { seededRandom } from './polaroidTexture';
import { TripCard } from './TripCard';
import { itemId, sameItem, type DeskMap, type DeskTrip, type ItemRef } from './types';
import { mapToDesk } from './WorldMap';

/*
 * Push-pins, one per trip, stuck into the map at each trip's place.
 *
 * A pin is a steel needle with a glossy plastic head in the portfolio's accent blue: the same dot
 * the "Travel" pill sits on over at aaronyalong.com, so a visitor arriving from there lands on
 * something familiar. Each leans a few degrees in its own direction, like pins pushed in by hand.
 */
const HEAD_RADIUS = 0.0055;
const NEEDLE_LENGTH = 0.016;
const NEEDLE_RADIUS = 0.0006;
const HOVER_LIFT = 0.004;
const EASE = 8;
const HEAD_COLOR = '#2f5bd3';

/** The luggage tag that swings up from an opened pin: 10 cm wide, laid out at 360 CSS px. */
const TAG_WIDTH = 0.1;
const TAG_WIDTH_PX = 360;
const TAG_DISTANCE_FACTOR = (400 * TAG_WIDTH) / TAG_WIDTH_PX;
/** Where the tag's centre ends up, relative to the pin's base. */
export const TAG_OFFSET: [number, number, number] = [0, NEEDLE_LENGTH + HEAD_RADIUS + 0.03, 0.012];

interface PinsProps {
	trips: DeskTrip[];
	map: DeskMap;
	selected: ItemRef | null;
	/** Item id with keyboard focus (see DeskApp), or null. */
	focused: string | null;
	onSelect: (item: ItemRef) => void;
	onClose: () => void;
	reducedMotion: boolean;
}

export function Pins({ trips, map, selected, focused, onSelect, onClose, reducedMotion }: PinsProps) {
	return trips.map((trip) =>
		trip.map ? (
			<Pin
				key={trip.slug}
				trip={trip}
				position={mapToDesk(map, trip.map)}
				selected={sameItem(selected, { kind: 'pin', slug: trip.slug })}
				anySelected={selected !== null}
				focused={focused === itemId('pin', trip.slug)}
				onSelect={onSelect}
				onClose={onClose}
				reducedMotion={reducedMotion}
			/>
		) : null,
	);
}

interface PinProps {
	trip: DeskTrip;
	position: [number, number, number];
	selected: boolean;
	anySelected: boolean;
	focused: boolean;
	onSelect: (item: ItemRef) => void;
	onClose: () => void;
	reducedMotion: boolean;
}

function Pin({ trip, position, selected, anySelected, focused, onSelect, onClose, reducedMotion }: PinProps) {
	const lean = useMemo(() => {
		const rand = seededRandom(`${trip.slug}:pin`);
		const angle = (4 + rand() * 7) * (Math.PI / 180);
		const direction = rand() * Math.PI * 2;
		return { x: Math.sin(direction) * angle, z: Math.cos(direction) * angle };
	}, [trip.slug]);

	const lifter = useRef<Group>(null);
	const tagGroup = useRef<Group>(null);
	const [hovered, setHovered] = useState(false);
	const [tagOpen, setTagOpen] = useState(false);
	const tagOpenRef = useRef(false);
	const lifted = (hovered || focused) && !selected;
	useCursor(hovered && !selected);

	useFrame((_, delta) => {
		const l = lifter.current;
		const t = tagGroup.current;
		if (!l || !t) return;
		const k = reducedMotion ? Infinity : EASE;
		const ease = (from: number, to: number) => MathUtils.damp(from, to, k, delta);

		l.position.y = ease(l.position.y, lifted ? HOVER_LIFT : 0);

		// The tag: lies flat and tiny at the pin's base when closed; when opened it rises to
		// TAG_OFFSET, grows, and tips back to face a camera looking down at 45°.
		t.position.set(ease(t.position.x, selected ? TAG_OFFSET[0] : 0), ease(t.position.y, selected ? TAG_OFFSET[1] : 0.002), ease(t.position.z, selected ? TAG_OFFSET[2] : 0));
		const s = ease(t.scale.x, selected ? 1 : 0.01);
		t.scale.setScalar(s);
		t.rotation.x = ease(t.rotation.x, selected ? -Math.PI / 4 : -Math.PI / 2);

		const open = selected && s > 0.9;
		if (open !== tagOpenRef.current) {
			tagOpenRef.current = open;
			setTagOpen(open);
		}
	});

	// A closed tag's HTML is unmounted; the group keeps animating so re-opening is smooth.
	useEffect(() => {
		if (!selected) {
			tagOpenRef.current = false;
			setTagOpen(false);
		}
	}, [selected]);

	const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
		e.stopPropagation();
		setHovered(true);
	};
	const onClick = (e: ThreeEvent<MouseEvent>) => {
		e.stopPropagation();
		if (e.delta > 4 || selected) return;
		onSelect({ kind: 'pin', slug: trip.slug });
	};

	return (
		<group position={position}>
			<group ref={lifter}>
				<group rotation={[lean.x, 0, lean.z]}>
					{/* Needle: polished steel, pushed in so only part of it shows. */}
					<mesh position={[0, NEEDLE_LENGTH / 2 - 0.003, 0]} castShadow>
						<cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, NEEDLE_LENGTH + 0.006, 8]} />
						<meshStandardMaterial color="#d6d6da" metalness={1} roughness={0.28} />
					</mesh>
					{/* Head: glossy plastic. A clearcoat layer gives the sharp lamp highlight plastic has. */}
					<mesh
						position={[0, NEEDLE_LENGTH + HEAD_RADIUS * 0.8, 0]}
						castShadow
						onPointerOver={onPointerOver}
						onPointerOut={() => setHovered(false)}
						onClick={onClick}
					>
						<sphereGeometry args={[HEAD_RADIUS, 24, 18]} />
						<meshPhysicalMaterial color={HEAD_COLOR} roughness={0.35} clearcoat={1} clearcoatRoughness={0.1} />
					</mesh>
					{/* A larger invisible target, so the pin is easy to hit with a finger. */}
					<mesh position={[0, NEEDLE_LENGTH, 0]} onPointerOver={onPointerOver} onPointerOut={() => setHovered(false)} onClick={onClick} visible={false}>
						<sphereGeometry args={[0.014, 8, 6]} />
					</mesh>
				</group>

				{lifted && !anySelected && (
					<Html position={[0, NEEDLE_LENGTH + 0.02, 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
						<span className="desk-label">
							{trip.title}, {trip.place}
						</span>
					</Html>
				)}
			</group>

			<group ref={tagGroup} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.01}>
				{tagOpen && (
					<Html transform distanceFactor={TAG_DISTANCE_FACTOR} zIndexRange={[1, 0]}>
						<TripCard trip={trip} onClose={onClose} variant="tag" />
					</Html>
				)}
			</group>
		</group>
	);
}
