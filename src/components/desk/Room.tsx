import { useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Matrix4, Object3D, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type InstancedMesh, type Texture, type Vector3Tuple } from 'three';
import { PALETTE } from './palette';
import { CEILING_Y, FLOOR_Y, FRAME, FRONT_Z, GLASS_Z, OPENING, SIDE_X, STRUT, SUN_POSITION, WALL_THICKNESS, WALL_Z, WINDOW } from './roomLayout';
import { SpaceView, type EarthTextures } from './SpaceView';
import { SunBeam, type BeamWindow } from './SunBeam';
import { BRASS, Viewport } from './Viewport';

/*
 * The room around the desk: an observation deck on a station in orbit, fitted out art deco. A
 * closed room lined with dark graphite panels trimmed in brass, and one broad viewport centred in
 * the back wall, in a bronze-and-brass recess lit by a gold cove light (Viewport.tsx), looking
 * down at Earth (SpaceView.tsx). The desk runs wall to wall in front of it, like a console; the
 * gauge panel beside the window is Gauges.tsx.
 *
 * Light: sunlight pouring in through the viewport (casting the frame's shadow across the desk),
 * a soft light from a recessed fitting high in the ceiling, warm wall-washers, the banker's lamp
 * on the desk (BankersLamp.tsx), and a little blue earthlight coming up from the planet below.
 *
 * The measurements are in roomLayout.ts.
 */

const BEAM_WINDOW: BeamWindow = { ...WINDOW, z: GLASS_Z, frame: FRAME, struts: [1 / 3, 2 / 3], strutWidth: STRUT };

const WOOD = {
	map: '/textures/wood-color.webp',
	normalMap: '/textures/wood-normal.webp',
	roughnessMap: '/textures/wood-roughness.webp',
};

type Wood = Record<'map' | 'normalMap' | 'roughnessMap', Texture>;

interface RoomProps {
	/** Phones skip the sunlight's shadow map. */
	shadows: boolean;
	/** Shadow-map size for the sunlight and the ceiling light. */
	shadowMapSize: number;
	earthTextures: EarthTextures;
	/** The occasional shooting star, meteor and rocket outside. */
	skyEvents: boolean;
	reducedMotion: boolean;
	/** Phones: no light shaft, fewer motes (see SunBeam.tsx). */
	lite: boolean;
}

export function Room({ shadows, shadowMapSize, earthTextures, skyEvents, reducedMotion, lite }: RoomProps) {
	const wood = useTexture(WOOD);
	// The desk uses the same wood (cached by URL); the floor needs its own repeat, so it gets a
	// clone that shares the image.
	const floorWood = useMemo(() => cloneWood(wood, 9, 9), [wood]);

	return (
		<group>
			<Shell wood={floorWood} shadows={shadows} />
			<Panels />
			<Viewport shadows={shadows} />
			<Skirting />
			<SpaceView textures={earthTextures} reducedMotion={reducedMotion} events={skyEvents} />
			<Sunlight shadows={shadows} shadowMapSize={shadowMapSize} />
			<SunBeam sun={SUN_POSITION} window={BEAM_WINDOW} steps={lite ? 0 : 24} motes={lite ? 60 : 150} reducedMotion={reducedMotion} />
			<CeilingLight shadowMapSize={shadowMapSize} />
			<WallWashers />
			{/* Earthlight: the planet below the window, lighting the room faintly blue from below. */}
			<directionalLight position={[0, -1.2, WALL_Z - 3]} color="#7fa6ff" intensity={0.22} />
		</group>
	);
}

function cloneWood(wood: Wood, rx: number, ry: number): Wood {
	const out = {} as Wood;
	for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
		const t = wood[key].clone();
		t.wrapS = t.wrapT = RepeatWrapping;
		t.repeat.set(rx, ry);
		if (key === 'map') t.colorSpace = SRGBColorSpace;
		t.needsUpdate = true;
		out[key] = t;
	}
	return out;
}

/**
 * The room's shell: floor, ceiling, side walls, and the back wall as four slabs around the
 * opening (so the sunlight's shadow map sees a real hole and the light lands on the desk in the
 * window's shape). Closed all round: the only view out is through the viewport. The walls are the
 * dark colour of the seams; the panels (below) cover them.
 */
function Shell({ wood, shadows }: { wood: Wood; shadows: boolean }) {
	const zc = WALL_Z - WALL_THICKNESS / 2;
	const depth = FRONT_Z - WALL_Z;
	const height = CEILING_Y - FLOOR_Y;
	const backing = <meshStandardMaterial color={PALETTE.seam} roughness={0.9} />;
	const { left, right, bottom, top } = OPENING;
	const slab = (x0: number, x1: number, y0: number, y1: number, key: string) => (
		<mesh key={key} position={[(x0 + x1) / 2, (y0 + y1) / 2, zc]} castShadow={shadows} receiveShadow>
			<boxGeometry args={[x1 - x0, y1 - y0, WALL_THICKNESS]} />
			{backing}
		</mesh>
	);
	return (
		<group>
			<mesh position={[0, FLOOR_Y, (WALL_Z + FRONT_Z) / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
				<planeGeometry args={[depth, SIDE_X * 2]} />
				<meshStandardMaterial map={wood.map} normalMap={wood.normalMap} roughnessMap={wood.roughnessMap} color="#5a5e66" roughness={0.85} />
			</mesh>
			<mesh position={[0, CEILING_Y, (WALL_Z + FRONT_Z) / 2]} rotation={[Math.PI / 2, 0, 0]}>
				<planeGeometry args={[SIDE_X * 2, depth]} />
				<meshStandardMaterial color="#17181b" roughness={0.95} />
			</mesh>
			{[-1, 1].map((side) => (
				<mesh key={side} position={[side * SIDE_X, (FLOOR_Y + CEILING_Y) / 2, (WALL_Z + FRONT_Z) / 2]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow>
					<planeGeometry args={[depth, height]} />
					{backing}
				</mesh>
			))}
			{slab(-SIDE_X, left, FLOOR_Y, CEILING_Y, 'l')}
			{slab(right, SIDE_X, FLOOR_Y, CEILING_Y, 'r')}
			{slab(left, right, FLOOR_Y, bottom, 'b')}
			{slab(left, right, top, CEILING_Y, 't')}
		</group>
	);
}

/** Splits [a, b] into n equal spans. */
const spans = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => [a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n] as const);

/**
 * Wall panels: a grid of slightly raised graphite plates over the walls, with dark seams between
 * them. The lamp and the ceiling light catch their edges, so the wall reads as a surface, not a
 * void. The rows on the back wall line up with the viewport's opening. One instanced mesh (one
 * draw call) for all of them.
 */
function Panels() {
	const mesh = useRef<InstancedMesh>(null);
	const panels = useMemo(() => {
		const GAP = 0.014;
		const PROUD = 0.016; // how far the plates stand off the wall
		const out: { position: Vector3; size: Vector3Tuple; rotationY: number }[] = [];
		const { left, right, top } = OPENING;
		const rows = [...spans(0, top / 2, 1), ...spans(top / 2, top, 1), ...spans(top, CEILING_Y, 3)];
		const back = (x0: number, x1: number, y0: number, y1: number) =>
			out.push({ position: new Vector3((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z + PROUD / 2), size: [x1 - x0 - GAP, y1 - y0 - GAP, PROUD], rotationY: 0 });
		for (const [y0, y1] of rows) {
			for (const [x0, x1] of spans(-SIDE_X, left, 5)) back(x0, x1, y0, y1);
			for (const [x0, x1] of spans(right, SIDE_X, 5)) back(x0, x1, y0, y1);
		}
		for (const [y0, y1] of spans(top, CEILING_Y, 3)) for (const [x0, x1] of spans(left, right, 4)) back(x0, x1, y0, y1);
		// Side walls, from the back wall forward past where the camera can go.
		for (const side of [-1, 1])
			for (const [y0, y1] of rows)
				for (const [z0, z1] of spans(WALL_Z, FRONT_Z - 0.1, 11))
					out.push({ position: new Vector3(side * (SIDE_X - PROUD / 2), (y0 + y1) / 2, (z0 + z1) / 2), size: [z1 - z0 - GAP, y1 - y0 - GAP, PROUD], rotationY: -side * (Math.PI / 2) });
		return out;
	}, []);

	useLayoutEffect(() => {
		const m = new Matrix4();
		const q = new Quaternion();
		const up = new Vector3(0, 1, 0);
		panels.forEach(({ position, size, rotationY }, i) => {
			q.setFromAxisAngle(up, rotationY);
			mesh.current!.setMatrixAt(i, m.compose(position, q, new Vector3(...size)));
		});
		mesh.current!.instanceMatrix.needsUpdate = true;
		mesh.current!.computeBoundingSphere();
	}, [panels]);

	return (
		<instancedMesh ref={mesh} args={[undefined, undefined, panels.length]} receiveShadow>
			<boxGeometry />
			<meshStandardMaterial color={PALETTE.wall} metalness={0.2} roughness={0.55} />
		</instancedMesh>
	);
}

/**
 * Sunlight through the viewport: a cool white light from high behind the wall. A spotlight with
 * no fall-off rather than a directional light, so its cone stops at the window: it lights only
 * what the window lets it, even where the shadow map doesn't reach. It casts shadows (desktop),
 * so the frame and struts draw themselves across the desk and the map.
 */
function Sunlight({ shadows, shadowMapSize }: { shadows: boolean; shadowMapSize: number }) {
	const [target] = useState(() => new Object3D());
	return (
		<>
			<primitive object={target} position={[0.1, 0, 0.1]} />
			<spotLight
				position={SUN_POSITION}
				target={target}
				color="#e2e8ff"
				intensity={1.05}
				decay={0}
				angle={0.66}
				penumbra={0.15}
				castShadow={shadows}
				shadow-mapSize={[shadowMapSize, shadowMapSize]}
				shadow-camera-near={0.5}
				shadow-camera-far={7}
				shadow-bias={-0.0005}
				shadow-normalBias={0.02}
				shadow-radius={4}
			/>
		</>
	);
}

/**
 * A brass skirting where the wall meets the desk, either side of the window: it ties the wall's
 * brass (the window, the gauges) to the lamp's.
 */
function Skirting() {
	return (
		<group>
			{[
				[-SIDE_X, OPENING.left - 0.03],
				[OPENING.right + 0.03, SIDE_X],
			].map(([x0, x1]) => (
				<mesh key={x0} position={[(x0 + x1) / 2, 0.012, WALL_Z + 0.022]} material={BRASS}>
					<boxGeometry args={[x1 - x0, 0.024, 0.012]} />
				</mesh>
			))}
		</group>
	);
}

/**
 * Wall-washers: a soft, warm light from the ceiling either side of the viewport, falling down the
 * wall at a grazing angle so the panels' edges and seams (and the brass) show. No shadows (cheap).
 */
function WallWashers() {
	const [targets] = useState(() => [new Object3D(), new Object3D()]);
	return (
		<>
			{[-1, 1].map((side, i) => (
				<group key={side}>
					<primitive object={targets[i]} position={[side * 1.75, 0.4, WALL_Z]} />
					<spotLight position={[side * 1.75, 2.95, WALL_Z + 0.5]} target={targets[i]} color="#ffdcb0" intensity={7} decay={2} angle={0.8} penumbra={1} />
				</group>
			))}
		</>
	);
}

/**
 * A recessed light high in the ceiling over the map: a soft, warm-neutral pool that lights the
 * whole sheet evenly, gives the pins their shadows, and spills onto the wall panels. The fitting
 * itself is a dim disc in the ceiling.
 */
function CeilingLight({ shadowMapSize }: { shadowMapSize: number }) {
	const [target] = useState(() => new Object3D());
	const position: Vector3Tuple = [0, CEILING_Y - 0.01, 0.5];
	return (
		<>
			<primitive object={target} position={[0, 0, -0.1]} />
			<spotLight
				position={position}
				target={target}
				color="#ffe6cc"
				intensity={41}
				decay={2}
				angle={0.62}
				penumbra={1}
				castShadow
				shadow-mapSize={[shadowMapSize, shadowMapSize]}
				shadow-radius={6}
				shadow-bias={-0.0004}
				shadow-normalBias={0.02}
				shadow-camera-near={2}
				shadow-camera-far={6}
			/>
			<mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.08, 32]} />
				<meshBasicMaterial color={[2.2, 2.0, 1.8]} />
			</mesh>
		</>
	);
}
