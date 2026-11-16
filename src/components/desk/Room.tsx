import { RoundedBox, useTexture } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Object3D, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type InstancedMesh, type Texture, type Vector3Tuple } from 'three';
import { PALETTE } from './palette';
import { SpaceView, type EarthTextures } from './SpaceView';
import { SunBeam, type BeamWindow } from './SunBeam';

/*
 * The room around the desk: an observation deck on a station in orbit. A closed room lined with
 * dark graphite panels, and one broad viewport centred in the back wall, set deep in a flared
 * recess edged with a strip of blue light, looking down at Earth (SpaceView.tsx). The desk runs
 * wall to wall in front of it, like a console.
 *
 * Light: sunlight pouring in through the viewport (casting the frame's shadow across the desk),
 * a soft light from a recessed fitting high in the ceiling, the banker's lamp on the desk
 * (BankersLamp.tsx), and a little blue earthlight coming up from the planet below the window.
 *
 * Layout (metres; desk top at y = 0, +z toward the viewer): the wall's face is at WALL_Z, the
 * floor at FLOOR_Y, the ceiling at CEILING_Y, the side walls at ±SIDE_X. The room is sized so
 * the camera can't leave it: zoomed right out at the steepest angle it stays under the ceiling,
 * and swung round to either side it stays inside the side walls (see camera.ts).
 */
export const WALL_Z = -0.9;
export const FLOOR_Y = -0.75;
export const CEILING_Y = 4.2;
export const SIDE_X = 4.4;
const FRONT_Z = 5.6;
const WALL_THICKNESS = 0.26;
/** The glass, at the back of the recess. */
const WINDOW = { left: -1.05, right: 1.05, bottom: 0.04, top: 1.5 };
/** The recess: how deep the glass sits behind the wall's face, and how far the sides and top
 *  splay out toward the room. The bottom is a flat sill, level with the glass. */
const RECESS = { depth: 0.22, flare: 0.14 };
/** The opening in the wall's face. */
const OPENING = { left: WINDOW.left - RECESS.flare, right: WINDOW.right + RECESS.flare, bottom: WINDOW.bottom, top: WINDOW.top + RECESS.flare };
const GLASS_Z = WALL_Z - RECESS.depth;
/** The viewport frame's width, and its two struts (centred a sixth of the way either side). */
const FRAME = 0.07;
const STRUT = 0.035;
/** Where the sunlight comes from: high behind the wall, a little to the left. */
const SUN_POSITION: Vector3Tuple = [-0.5, 2.6, WALL_Z - 2];
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
			<Recess shadows={shadows} />
			<Viewport />
			<StatusPanel />
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

/** A flat quad through four corners (in order round the edge). */
function quad(points: Vector3Tuple[]): BufferGeometry {
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
	g.setIndex([0, 1, 2, 0, 2, 3]);
	g.computeVertexNormals();
	return g;
}

/**
 * The recess: the wall is thick here, and the opening splays out from the glass toward the room,
 * so the viewport reads as a heavy port in a hull rather than a hole. A flat sill along the
 * bottom, and a strip of light (the portfolio's blue) all the way round the opening's edge.
 */
function Recess({ shadows }: { shadows: boolean }) {
	const o = OPENING;
	const w = WINDOW;
	const faces = useMemo(
		() => [
			quad([[o.left, o.bottom, WALL_Z], [o.left, o.top, WALL_Z], [w.left, w.top, GLASS_Z], [w.left, w.bottom, GLASS_Z]]),
			quad([[o.right, o.bottom, WALL_Z], [w.right, w.bottom, GLASS_Z], [w.right, w.top, GLASS_Z], [o.right, o.top, WALL_Z]]),
			quad([[o.left, o.top, WALL_Z], [o.right, o.top, WALL_Z], [w.right, w.top, GLASS_Z], [w.left, w.top, GLASS_Z]]),
			quad([[o.left, o.bottom, WALL_Z], [w.left, w.bottom, GLASS_Z], [w.right, w.bottom, GLASS_Z], [o.right, o.bottom, WALL_Z]]),
		],
		[o, w],
	);
	const S = 0.008; // strip thickness
	const z = WALL_Z - 0.006;
	const height = o.top - o.bottom;
	const width = o.right - o.left;
	return (
		<group>
			{faces.map((geometry, i) => (
				<mesh key={i} geometry={geometry} castShadow={shadows} receiveShadow>
					<meshStandardMaterial color="#2a2d33" metalness={0.55} roughness={0.42} side={DoubleSide} />
				</mesh>
			))}
			{/* The light strip, just inside the opening's edge. */}
			{[
				[o.left + S / 2, o.bottom + height / 2, S, height],
				[o.right - S / 2, o.bottom + height / 2, S, height],
				[0, o.top - S / 2, width, S],
				[0, o.bottom + S / 2, width, S],
			].map(([x, y, sw, sh], i) => (
				<mesh key={i} position={[x, y, z]}>
					<boxGeometry args={[sw, sh, S]} />
					<meshBasicMaterial color={PALETTE.accentLight} toneMapped={false} />
				</mesh>
			))}
		</group>
	);
}

/**
 * The viewport: a broad pane in a thick gunmetal frame with bevelled edges, two slim struts, and
 * rows of bolts, at the back of the recess. The glass is barely there.
 */
function Viewport() {
	const { left, right, bottom, top } = WINDOW;
	const w = right - left;
	const h = top - bottom;
	const cx = (left + right) / 2;
	const cy = (bottom + top) / 2;
	const z = GLASS_Z;
	const F = FRAME;
	const gunmetal = <meshStandardMaterial color="#1a1c20" metalness={0.75} roughness={0.38} />;
	const bolts: [number, number][] = [];
	for (let i = 0; i <= 12; i++) {
		const x = left + F / 2 + (i * (w - F)) / 12;
		bolts.push([x, bottom + F / 2], [x, top - F / 2]);
	}
	for (let i = 1; i < 6; i++) {
		const y = bottom + F / 2 + (i * (h - F)) / 6;
		bolts.push([left + F / 2, y], [right - F / 2, y]);
	}
	return (
		<group>
			{[
				[cx, bottom + F / 2, w, F],
				[cx, top - F / 2, w, F],
				[left + F / 2, cy, F, h],
				[right - F / 2, cy, F, h],
			].map(([x, y, bw, bh], i) => (
				<RoundedBox key={i} args={[bw, bh, 0.06]} radius={0.012} smoothness={3} position={[x, y, z]} castShadow receiveShadow>
					{gunmetal}
				</RoundedBox>
			))}
			{[-1, 1].map((s) => (
				<RoundedBox key={s} args={[STRUT, h - F, 0.05]} radius={0.01} smoothness={3} position={[cx + (s * w) / 6, cy, z - 0.005]} castShadow>
					{gunmetal}
				</RoundedBox>
			))}
			{bolts.map(([x, y], i) => (
				<mesh key={i} position={[x, y, z + 0.032]} rotation={[Math.PI / 2, 0, 0]}>
					<cylinderGeometry args={[0.006, 0.006, 0.006, 6]} />
					<meshStandardMaterial color="#3a3d43" metalness={0.9} roughness={0.3} />
				</mesh>
			))}
			{/* Glass: barely there, but it catches reflections. */}
			<mesh position={[cx, cy, z - 0.02]}>
				<planeGeometry args={[w, h]} />
				<meshPhysicalMaterial color="#9fb6c8" transparent opacity={0.06} roughness={0.04} metalness={0} depthWrite={false} />
			</mesh>
		</group>
	);
}

/**
 * A small status plate on the wall to the right of the viewport: a dark plate with a column of
 * indicator lights, the kind a station has beside every port. Purely decoration.
 */
function StatusPanel() {
	const x = OPENING.right + 0.26;
	const lights: [number, [number, number, number]][] = [
		[0.06, [0.4, 3.2, 1.0]],
		[0.02, [0.4, 3.2, 1.0]],
		[-0.02, [0.4, 3.2, 1.0]],
		[-0.06, [3.4, 1.6, 0.2]],
	];
	return (
		<group position={[x, 0.42, WALL_Z + 0.018]}>
			<RoundedBox args={[0.09, 0.2, 0.012]} radius={0.004} smoothness={2} position={[0, 0, 0.006]}>
				<meshStandardMaterial color="#111215" metalness={0.5} roughness={0.5} />
			</RoundedBox>
			{lights.map(([y, colour], i) => (
				<mesh key={i} position={[-0.018, y, 0.013]}>
					<circleGeometry args={[0.0045, 16]} />
					<meshBasicMaterial color={colour} toneMapped={false} />
				</mesh>
			))}
			{lights.map(([y], i) => (
				<mesh key={`l${i}`} position={[0.016, y, 0.0125]}>
					<planeGeometry args={[0.032, 0.004]} />
					<meshBasicMaterial color="#3a3e46" />
				</mesh>
			))}
		</group>
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
 * Wall-washers: a soft, cool light from the ceiling either side of the viewport, falling down the
 * wall at a grazing angle so the panels' edges and seams show. No shadows (cheap).
 */
function WallWashers() {
	const [targets] = useState(() => [new Object3D(), new Object3D()]);
	return (
		<>
			{[-1, 1].map((side, i) => (
				<group key={side}>
					<primitive object={targets[i]} position={[side * 1.75, 0.4, WALL_Z]} />
					<spotLight position={[side * 1.75, 2.95, WALL_Z + 0.5]} target={targets[i]} color="#cdd8ff" intensity={8} decay={2} angle={0.8} penumbra={1} />
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
