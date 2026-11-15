import { useMemo, useState } from 'react';
import { BackSide, FrontSide, Object3D, Quaternion, Vector3, type Vector3Tuple } from 'three';
import { PALETTE } from './palette';

/*
 * The desk lamp, built from primitive shapes, and the light it gives.
 *
 * It stands at the left side: a round base, a vertical pole, an arm reaching in, and a cone-shaped
 * shade aimed at the middle of the desk. A spotlight sits inside the shade where the bulb is.
 * Positions are in metres (desk top at y = 0, +z toward the viewer). They're chosen so the whole
 * lamp is in the desktop starting shot; on a tall phone screen its head leans in from the left.
 */
const BASE: Vector3Tuple = [-0.6, 0, -0.12];
const POLE_TOP: Vector3Tuple = [-0.6, 0.3, -0.12];
const BULB: Vector3Tuple = [-0.42, 0.34, -0.04];
/** Where the light is aimed: the middle of the desk. */
const AIM: Vector3Tuple = [0.05, 0, 0.05];
const SHADE = { topRadius: 0.022, bottomRadius: 0.075, height: 0.1 } as const;

interface LampProps {
	/** Shadow-map resolution (see DeviceProfile). */
	shadowMapSize: number;
}

export function Lamp({ shadowMapSize }: LampProps) {
	// A spotlight points at a "target" object. It has to be part of the scene so its world
	// position stays up to date, hence the <primitive> below.
	const [target] = useState(() => new Object3D());

	// Orientation of the shade: its wide end faces the aim point.
	const shade = useMemo(() => {
		const toAim = new Vector3(...AIM).sub(new Vector3(...BULB)).normalize();
		// The cone's narrow end is its +y; point +y away from the aim point.
		const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), toAim.clone().negate());
		// Centre the shade slightly past the bulb, so the bulb sits up inside it.
		const position = new Vector3(...BULB).addScaledVector(toAim, 0.03);
		return { quaternion, position };
	}, []);

	return (
		<group>
			<primitive object={target} position={AIM} />

			<spotLight
				position={BULB}
				target={target}
				color={PALETTE.lamp}
				// Physically based: intensity is in candela, and light falls off with distance squared
				// (decay 2), like a real bulb. The pool is brightest under the lamp and dims outward.
				intensity={2.1}
				decay={2}
				// Cone half-angle, and how much of it is a soft edge (0 = hard rim, 1 = all fade).
				// Wide enough that the pool reaches the polaroids around the map.
				angle={1}
				penumbra={0.85}
				castShadow
				shadow-mapSize={[shadowMapSize, shadowMapSize]}
				// Blur radius for the shadow edges (PCF filtering), in shadow-map texels.
				shadow-radius={6}
				// Small offsets that stop surfaces from shadowing themselves in stripes ("acne").
				shadow-bias={-0.0004}
				shadow-normalBias={0.02}
				// The shadow camera only needs to cover the desk; a tight range keeps depth precise.
				shadow-camera-near={0.05}
				shadow-camera-far={3}
			/>

			{/* Base: a heavy disc. It casts a shadow (the light is above and in front of it). */}
			<mesh position={[BASE[0], 0.011, BASE[2]]} castShadow receiveShadow>
				<cylinderGeometry args={[0.085, 0.09, 0.022, 48]} />
				<meshStandardMaterial color={PALETTE.lampPaint} roughness={0.45} metalness={0.3} />
			</mesh>

			<Rod from={BASE} to={POLE_TOP} radius={0.008} castShadow />
			<mesh position={POLE_TOP}>
				<sphereGeometry args={[0.014, 24, 16]} />
				<meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.9} />
			</mesh>
			{/* The arm and shade sit right next to the light, so they don't cast shadows: they'd
			    throw huge dark shapes across the desk. */}
			<Rod from={POLE_TOP} to={shade.position.toArray()} radius={0.007} />

			<group position={shade.position} quaternion={shade.quaternion}>
				{/* Painted outside. */}
				<mesh>
					<cylinderGeometry args={[SHADE.topRadius, SHADE.bottomRadius, SHADE.height, 48, 1, true]} />
					<meshStandardMaterial color={PALETTE.lampPaint} roughness={0.45} metalness={0.3} side={FrontSide} />
				</mesh>
				{/* Glowing inside: the same cone, drawn from the inside only (BackSide), with an
				    emissive colour so it shines without any light falling on it. */}
				<mesh scale={0.98}>
					<cylinderGeometry args={[SHADE.topRadius, SHADE.bottomRadius, SHADE.height, 48, 1, true]} />
					<meshStandardMaterial
						color={PALETTE.lampPaint}
						emissive={PALETTE.lamp}
						emissiveIntensity={0.9}
						side={BackSide}
					/>
				</mesh>
			</group>

			{/* The bulb: unlit and exempt from tone mapping, so it reads as a glowing source. */}
			<mesh position={BULB}>
				<sphereGeometry args={[0.018, 24, 16]} />
				<meshBasicMaterial color={PALETTE.bulb} toneMapped={false} />
			</mesh>
		</group>
	);
}

/** A thin metal rod from one point to another (a cylinder rotated to fit). */
function Rod({
	from,
	to,
	radius,
	castShadow = false,
}: {
	from: Vector3Tuple;
	to: Vector3Tuple;
	radius: number;
	castShadow?: boolean;
}) {
	const { position, quaternion, length } = useMemo(() => {
		const a = new Vector3(...from);
		const b = new Vector3(...to);
		const direction = b.clone().sub(a);
		return {
			position: a.clone().add(b).multiplyScalar(0.5),
			// A cylinder stands along +y; rotate +y onto the rod's direction.
			quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()),
			length: direction.length(),
		};
	}, [from, to]);

	return (
		<mesh position={position} quaternion={quaternion} castShadow={castShadow}>
			<cylinderGeometry args={[radius, radius, length, 16]} />
			<meshStandardMaterial color={PALETTE.lampPaint} roughness={0.45} metalness={0.3} />
		</mesh>
	);
}
