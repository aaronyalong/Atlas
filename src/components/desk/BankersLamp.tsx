import { Html, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { BackSide, DoubleSide, MathUtils, Object3D, type Group, type MeshStandardMaterial, type PointLight, type SpotLight, type Vector3Tuple } from 'three';
import { PALETTE } from './palette';

/*
 * A banker's lamp, the library kind: an oval brass base, a brass stem rising behind, and a
 * half-cylinder shade of emerald "cased" glass (green outside, opal white inside) held over the
 * desk. Built from primitive shapes.
 *
 * It stands at the back-left corner of the map, against the wall. Its light is broad and soft (a
 * wide spotlight with a fully soft edge from a long tube bulb) over the left of the map, and a
 * little spills up the wall panels behind it: the one warm light in a cool room. A click on the
 * lamp switches it off and on, like the pull chain.
 *
 * Positions are in metres; the desk top is y = 0, +z toward the viewer.
 */
export const LAMP_POSITION: Vector3Tuple = [-1.4, 0, -0.72];
const SHADE = { radius: 0.072, length: 0.27, height: 0.33, tilt: -0.22 };
/** Where the light is aimed: the left of the map (Africa, Europe). */
const AIM: Vector3Tuple = [-0.85, 0, -0.1];
const STEM_Z = -0.095;
const ARM_Y = SHADE.height + SHADE.radius + 0.006;
/** Brightness of the wash on the wall. */
const WASH = 0.3;

interface BankersLampProps {
	shadowMapSize: number;
	reducedMotion: boolean;
}

export function BankersLamp({ shadowMapSize, reducedMotion }: BankersLampProps) {
	// The spotlight's target must be in the scene; as a child of the lamp, its local position is
	// the aim point minus the lamp's position.
	const [target] = useState(() => new Object3D());
	const [on, setOn] = useState(true);
	const [hovered, setHovered] = useState(false);
	useCursor(hovered);

	const spot = useRef<SpotLight>(null);
	const glow = useRef<PointLight>(null);
	const wash = useRef<PointLight>(null);
	const inner = useRef<MeshStandardMaterial>(null);
	const outer = useRef<MeshStandardMaterial>(null);
	const bulb = useRef<MeshStandardMaterial>(null);
	const chain = useRef<Group>(null);
	// 1 = fully on. Eased, so switching fades over a fraction of a second like a warm filament.
	const level = useRef(1);

	useFrame(({ clock }, delta) => {
		level.current = MathUtils.damp(level.current, on ? 1 : 0, reducedMotion ? Infinity : 10, delta);
		const k = level.current;
		if (spot.current) spot.current.intensity = 2.4 * k;
		if (glow.current) glow.current.intensity = 0.2 * k;
		if (wash.current) wash.current.intensity = WASH * k;
		if (inner.current) inner.current.emissiveIntensity = 0.05 + 1.6 * k;
		if (outer.current) outer.current.emissiveIntensity = 0.02 + 0.3 * k;
		if (bulb.current) bulb.current.emissiveIntensity = 0.05 + 7 * k;
		// The pull chain sways a little.
		if (chain.current && !reducedMotion) {
			const t = clock.elapsedTime;
			chain.current.rotation.x = Math.sin(t * 1.1) * 0.05;
			chain.current.rotation.z = Math.sin(t * 0.7) * 0.035;
		}
	});

	const brass = <meshStandardMaterial color={PALETTE.brass} metalness={1} roughness={0.34} />;
	// The pull chain hangs a few centimetres from the fill light under the shade: polished, its
	// highlight overflows the effects buffer (a coloured speck). Handled brass dulls anyway.
	const chainBrass = <meshStandardMaterial color={PALETTE.brass} metalness={1} roughness={0.65} />;

	return (
		<group position={LAMP_POSITION}>
			<primitive object={target} position={[AIM[0] - LAMP_POSITION[0], AIM[1], AIM[2] - LAMP_POSITION[2]]} />

			<spotLight
				ref={spot}
				position={[0, SHADE.height - 0.005, 0.005]}
				target={target}
				color={PALETTE.lamp}
				intensity={2.4}
				decay={2}
				// Wide and soft: the shade's long opening spreads the light along the desk.
				angle={1.15}
				penumbra={1}
				castShadow
				shadow-mapSize={[shadowMapSize, shadowMapSize]}
				shadow-radius={8}
				shadow-bias={-0.0004}
				shadow-normalBias={0.02}
				// Only the desk needs the lamp's shadows: a short range keeps the walls out of the
				// shadow pass, which is re-drawn every frame.
				shadow-camera-near={0.03}
				shadow-camera-far={1.4}
			/>
			{/* A little light spills out sideways under the shade: warms the lamp's base and the desk
			    around it. Kept below the shade and clear of the brass: a light a few centimetres from
			    polished metal makes a highlight too bright for the effects buffer to hold (it shows
			    up as a streak of garbage pixels). */}
			{/* Short reach (distance): just the base and the desk round it. Any further and it lights
			    the window's brass trim edge-on from 20 cm, which overflows in the same way. */}
			<pointLight ref={glow} position={[0, SHADE.height - 0.08, 0.04]} color={PALETTE.lamp} intensity={0.2} distance={0.55} decay={2} />
			{/* The warm glow the lamp throws up the wall behind it, as light bouncing off the desk
			    would. Half a metre out from the wall (closer makes a hot spot rather than a glow),
			    and well clear of the brass (see above). */}
			<pointLight ref={wash} position={[0.02, 0.7, 0.3]} color={PALETTE.lamp} intensity={WASH} distance={2} decay={2} />

			<group
				onPointerOver={(e: ThreeEvent<PointerEvent>) => {
					e.stopPropagation();
					setHovered(true);
				}}
				onPointerOut={() => setHovered(false)}
				onClick={(e: ThreeEvent<MouseEvent>) => {
					e.stopPropagation();
					if (e.delta > 4) return;
					setOn((v) => !v);
				}}
			>
				{/* Base: an oval of brass, stepped. */}
				<group position={[0, 0, -0.05]}>
					<mesh position={[0, 0.0125, 0]} scale={[1.35, 1, 0.9]} castShadow receiveShadow>
						<cylinderGeometry args={[0.07, 0.074, 0.025, 64]} />
						{brass}
					</mesh>
					<mesh position={[0, 0.031, 0]} scale={[1.35, 1, 0.9]} castShadow>
						<cylinderGeometry args={[0.042, 0.052, 0.013, 48]} />
						{brass}
					</mesh>
				</group>

				{/* Stem, rising behind the shade, with a collar and a finial. */}
				<mesh position={[0, (0.037 + ARM_Y) / 2, STEM_Z]} castShadow>
					<cylinderGeometry args={[0.0075, 0.0085, ARM_Y - 0.037, 20]} />
					{brass}
				</mesh>
				<mesh position={[0, 0.11, STEM_Z]} scale={[1, 0.8, 1]} castShadow>
					<sphereGeometry args={[0.013, 24, 16]} />
					{brass}
				</mesh>
				<mesh position={[0, ARM_Y + 0.008, STEM_Z]} castShadow>
					<sphereGeometry args={[0.009, 20, 14]} />
					{brass}
				</mesh>
				{/* Arm forward over the shade, to a saddle on its crown. */}
				<mesh position={[0, ARM_Y, STEM_Z / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
					<cylinderGeometry args={[0.0045, 0.0045, -STEM_Z, 12]} />
					{brass}
				</mesh>

				{/* The shade, tipped a little toward the viewer. */}
				<group position={[0, SHADE.height, 0]} rotation={[SHADE.tilt, 0, 0]}>
					<mesh position={[0, SHADE.radius + 0.002, 0]}>
						<boxGeometry args={[0.035, 0.006, 0.022]} />
						{brass}
					</mesh>
					{/* Outside: emerald glass. Clearcoat for the glassy highlight; a faint emissive for the
					    light coming through it. The cylinder's half above its axis (theta from π). */}
					<mesh rotation={[0, 0, -Math.PI / 2]}>
						<cylinderGeometry args={[SHADE.radius, SHADE.radius, SHADE.length, 64, 1, true, Math.PI, Math.PI]} />
						<meshPhysicalMaterial
							ref={outer}
							color={PALETTE.shadeGreen}
							emissive={PALETTE.shadeGlow}
							emissiveIntensity={0.3}
							// Not glassier than this: sharper, and the lights above the lamp make highlights too
							// bright for the effects buffer at grazing angles (white streaks with blue-black
							// garbage in them).
							roughness={0.3}
							clearcoat={1}
							clearcoatRoughness={0.22}
						/>
					</mesh>
					{/* Inside: opal white, lit up by the bulb (drawn brighter than white, so it blooms). */}
					<mesh rotation={[0, 0, -Math.PI / 2]} scale={0.985}>
						<cylinderGeometry args={[SHADE.radius, SHADE.radius, SHADE.length, 64, 1, true, Math.PI, Math.PI]} />
						<meshStandardMaterial ref={inner} color="#f7f1e3" emissive={PALETTE.lamp} emissiveIntensity={1.6} side={BackSide} roughness={0.5} />
					</mesh>
					{/* End caps */}
					{[-1, 1].map((side) => (
						<mesh key={side} position={[(side * SHADE.length) / 2, 0, 0]} rotation={[0, side * (Math.PI / 2), 0]}>
							<circleGeometry args={[SHADE.radius, 40, 0, Math.PI]} />
							<meshPhysicalMaterial color={PALETTE.shadeGreen} roughness={0.3} clearcoat={1} clearcoatRoughness={0.22} side={DoubleSide} />
						</mesh>
					))}
					{/* Brass rims along the open edges, and knobs on the ends. */}
					{[-1, 1].map((side) => (
						<mesh key={`rim${side}`} position={[0, 0, side * SHADE.radius]} rotation={[0, 0, Math.PI / 2]}>
							<cylinderGeometry args={[0.003, 0.003, SHADE.length + 0.004, 10]} />
							{brass}
						</mesh>
					))}
					{[-1, 1].map((side) => (
						<mesh key={`knob${side}`} position={[side * (SHADE.length / 2 + 0.004), SHADE.radius * 0.55, 0]}>
							<sphereGeometry args={[0.006, 16, 12]} />
							{brass}
						</mesh>
					))}
					{/* The tube bulb. */}
					<mesh position={[0, SHADE.radius * 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.011, 0.011, SHADE.length * 0.6, 20]} />
						<meshStandardMaterial ref={bulb} color="#fff6e8" emissive={PALETTE.bulb} emissiveIntensity={7} />
					</mesh>
					{/* Pull chain: little brass beads hanging from the front edge, ending in a bob. */}
					<group ref={chain} position={[SHADE.length * 0.28, -0.002, SHADE.radius * 0.9]}>
						{Array.from({ length: 11 }, (_, i) => (
							<mesh key={i} position={[0, -0.004 - i * 0.0055, 0]}>
								<sphereGeometry args={[0.0017, 8, 6]} />
								{chainBrass}
							</mesh>
						))}
						{/* No shadow: hanging right in front of the bulb, it would throw a blot across the map. */}
						<mesh position={[0, -0.072, 0]}>
							<cylinderGeometry args={[0.0035, 0.0045, 0.012, 12]} />
							{chainBrass}
						</mesh>
					</group>
				</group>

				{hovered && (
					<Html position={[0, SHADE.height + 0.14, 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
						<span className="deco-tag desk-label">{on ? 'Desk lamp: click to switch off' : 'Desk lamp: click to switch on'}</span>
					</Html>
				)}
			</group>
		</group>
	);
}
