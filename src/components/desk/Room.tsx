import { useTexture } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
	AdditiveBlending,
	CanvasTexture,
	Color,
	type InstancedMesh,
	Matrix4,
	Object3D,
	Quaternion,
	RepeatWrapping,
	SRGBColorSpace,
	type Texture,
	Vector3,
} from 'three';
import { PALETTE } from './palette';
import { seededRandom } from './polaroidTexture';
import { BOOK_COLOURS, createMountainView, drawTerminal } from './roomTextures';

/*
 * The room around the desk: a modern dark studio. Charcoal walls; a black steel window onto
 * mountains at night; matte-black steel shelving with dark oak boards, warm LED strips under each
 * shelf, dark hardcovers, and a monitor running a terminal with Tux keeping it company; a dark oak
 * floor. Moonlight comes in through the window.
 *
 * Layout (metres; desk top at y = 0, +z toward the viewer): the desk's back edge is at
 * z ≈ -0.53; the wall's face is at WALL_Z, the floor at FLOOR_Y. The window is centred behind the
 * left half of the desk, the shelving stands against the wall to the right.
 */
export const WALL_Z = -0.9;
export const FLOOR_Y = -0.75;
const WALL_THICKNESS = 0.12;
const WINDOW = { left: -1.15, right: 0.15, bottom: 0.06, top: 1.4 };
const SHELF = { left: 0.35, right: 1.55, depth: 0.3, top: 1.5 };
/** Shelf boards (their centre heights). The one at -0.07 sits just above the desk's line. */
const SHELVES = [-0.42, -0.07, 0.28, 0.63, 0.98, 1.33];

const WOOD = {
	map: '/textures/wood-color.webp',
	normalMap: '/textures/wood-normal.webp',
	roughnessMap: '/textures/wood-roughness.webp',
};

type Wood = Record<'map' | 'normalMap' | 'roughnessMap', Texture>;

interface RoomProps {
	/** Phones skip the moonlight's shadow map. */
	shadows: boolean;
	bookCount: number;
	/** For the terminal's `ls trips/`. */
	tripSlugs: string[];
	reducedMotion: boolean;
}

export function Room({ shadows, bookCount, tripSlugs, reducedMotion }: RoomProps) {
	const wood = useTexture(WOOD);
	// The desk uses the same wood (cached by URL); the floor and shelves need their own repeat, so
	// they get clones that share the image.
	const floorWood = useMemo(() => cloneWood(wood, 6, 6), [wood]);
	const shelfWood = useMemo(() => cloneWood(wood, 1.2, 0.3), [wood]);

	return (
		<group>
			<Floor wood={floorWood} />
			<BackWall shadows={shadows} />
			<Window />
			<Shelving wood={shelfWood} bookCount={bookCount} tripSlugs={tripSlugs} reducedMotion={reducedMotion} />
			<Moonlight shadows={shadows} />
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

const steel = () => <meshStandardMaterial color="#101113" metalness={0.55} roughness={0.45} />;

function Floor({ wood }: { wood: Wood }) {
	return (
		<mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
			<planeGeometry args={[8, 8]} />
			<meshStandardMaterial map={wood.map} normalMap={wood.normalMap} roughnessMap={wood.roughnessMap} color="#4a3c33" roughness={0.85} />
		</mesh>
	);
}

/**
 * The wall: four slabs around the window opening, so the moonlight's shadow map sees a real hole
 * and the window's light lands on the desk with the frame's shadows in it.
 */
function BackWall({ shadows }: { shadows: boolean }) {
	const zc = WALL_Z - WALL_THICKNESS / 2;
	const W = 7;
	const H = 3.4;
	const { left, right, bottom, top } = WINDOW;
	const piece = (x0: number, x1: number, y0: number, y1: number, key: string) => (
		<mesh key={key} position={[(x0 + x1) / 2, (y0 + y1) / 2, zc]} castShadow={shadows} receiveShadow>
			<boxGeometry args={[x1 - x0, y1 - y0, WALL_THICKNESS]} />
			<meshStandardMaterial color={PALETTE.wall} roughness={0.95} />
		</mesh>
	);
	return (
		<group>
			{piece(-W / 2, left, FLOOR_Y, FLOOR_Y + H, 'l')}
			{piece(right, W / 2, FLOOR_Y, FLOOR_Y + H, 'r')}
			{piece(left, right, FLOOR_Y, bottom, 'b')}
			{piece(left, right, top, FLOOR_Y + H, 't')}
		</group>
	);
}

/** The window: a black steel grid (four panes across, three down), faint glass, the night outside. */
function Window() {
	const [view] = useState(() => createMountainView(2048));
	useEffect(
		() => () => {
			view.sky.dispose();
			view.lights.dispose();
		},
		[view],
	);
	const { left, right, bottom, top } = WINDOW;
	const w = right - left;
	const h = top - bottom;
	const cx = (left + right) / 2;
	const cy = (bottom + top) / 2;
	const z = WALL_Z - WALL_THICKNESS / 2;
	const bar = (x: number, y: number, bw: number, bh: number, key: string) => (
		<mesh key={key} position={[x, y, z]} castShadow>
			<boxGeometry args={[bw, bh, 0.04]} />
			{steel()}
		</mesh>
	);
	const bars = [
		bar(cx, bottom + 0.02, w, 0.04, 'fb'),
		bar(cx, top - 0.02, w, 0.04, 'ft'),
		bar(left + 0.02, cy, 0.04, h, 'fl'),
		bar(right - 0.02, cy, 0.04, h, 'fr'),
		...[1, 2, 3].map((i) => bar(left + (i * w) / 4, cy, 0.016, h, `v${i}`)),
		...[1, 2].map((i) => bar(cx, bottom + (i * h) / 3, w, 0.016, `h${i}`)),
	];
	return (
		<group>
			{bars}
			{/* Glass: barely there, but it catches reflections. */}
			<mesh position={[cx, cy, z + 0.01]}>
				<planeGeometry args={[w, h]} />
				<meshPhysicalMaterial color="#9fb6c8" transparent opacity={0.07} roughness={0.05} metalness={0} depthWrite={false} />
			</mesh>
			{/* Outside, far back, so it shifts behind the frame as the camera moves. */}
			<mesh position={[cx, 0.85, WALL_Z - 3]}>
				<planeGeometry args={[9, 4.5]} />
				<meshBasicMaterial map={view.sky} fog={false} />
			</mesh>
			<mesh position={[cx, 0.85, WALL_Z - 2.99]}>
				<planeGeometry args={[9, 4.5]} />
				<meshBasicMaterial map={view.lights} color={[5, 4.8, 4.4]} blending={AdditiveBlending} transparent depthWrite={false} fog={false} toneMapped={false} />
			</mesh>
		</group>
	);
}

/**
 * The moon, through the window: a cool directional light from high behind the wall. It casts
 * shadows (desktop), so the wall blocks it except through the window, and the panes and bars
 * draw themselves on the desk.
 */
function Moonlight({ shadows }: { shadows: boolean }) {
	const [target] = useState(() => new Object3D());
	return (
		<>
			<primitive object={target} position={[-0.25, 0, 0.05]} />
			<directionalLight
				position={[-0.75, 2.4, WALL_Z - 1.9]}
				target={target}
				color={PALETTE.moonlight}
				intensity={0.55}
				castShadow={shadows}
				shadow-mapSize={[1024, 1024]}
				shadow-camera-left={-1.4}
				shadow-camera-right={1.4}
				shadow-camera-top={1.4}
				shadow-camera-bottom={-1.4}
				shadow-camera-near={0.5}
				shadow-camera-far={6}
				shadow-bias={-0.0005}
				shadow-normalBias={0.02}
				shadow-radius={4}
			/>
		</>
	);
}

/**
 * Open shelving: a matte-black steel frame (four uprights, no back, so the wall shows through)
 * with dark oak boards. A warm LED strip glows under the front edge of each board. The board just
 * above the desk's line holds the monitor and Tux; the rest hold books.
 */
function Shelving({ wood, bookCount, tripSlugs, reducedMotion }: { wood: Wood; bookCount: number; tripSlugs: string[]; reducedMotion: boolean }) {
	const { left, right, depth, top } = SHELF;
	const front = WALL_Z + depth;
	const zc = WALL_Z + depth / 2;
	const width = right - left;
	const board = <meshStandardMaterial map={wood.map} normalMap={wood.normalMap} roughnessMap={wood.roughnessMap} color="#5a4334" roughness={0.75} />;

	return (
		<group>
			{[left + 0.012, right - 0.012].flatMap((x) =>
				[WALL_Z + 0.02, front - 0.012].map((z) => (
					<mesh key={`${x}${z}`} position={[x, (FLOOR_Y + top) / 2, z]} castShadow receiveShadow>
						<boxGeometry args={[0.024, top - FLOOR_Y, 0.024]} />
						{steel()}
					</mesh>
				)),
			)}
			{SHELVES.map((y, i) => (
				<group key={i}>
					<mesh position={[(left + right) / 2, y, zc]} castShadow receiveShadow>
						<boxGeometry args={[width, 0.025, depth]} />
						{board}
					</mesh>
					{/* The LED strip, tucked under the board's front edge. */}
					<mesh position={[(left + right) / 2, y - 0.0145, front - 0.025]}>
						<boxGeometry args={[width - 0.06, 0.003, 0.008]} />
						<meshStandardMaterial color="#000" emissive="#ffd2a0" emissiveIntensity={3.2} />
					</mesh>
				</group>
			))}
			{/* The strips' light, approximated by two lights (one per strip would be slow). */}
			{/* A quarter-metre out from the shelves: any closer, and glossy surfaces (the screen)
			    catch a highlight too bright for the effects buffer, which shows as garbage pixels. */}
			<pointLight position={[(left + right) / 2, 0.45, front + 0.25]} color="#ffcf9a" intensity={0.6} distance={1.4} decay={2} />
			<pointLight position={[(left + right) / 2, 1.1, front + 0.25]} color="#ffcf9a" intensity={0.5} distance={1.4} decay={2} />

			<Books front={front} count={bookCount} />
			<Monitor position={[0.78, SHELVES[1] + 0.0125, front - 0.13]} tripSlugs={tripSlugs} reducedMotion={reducedMotion} />
			<Tux position={[1.22, SHELVES[1] + 0.0125 + 0.06, front - 0.12]} />
		</group>
	);
}

/** Which stretches of which shelves hold books (the monitor and Tux take the rest of shelf 1). */
const BOOK_RUNS: { shelf: number; from: number; to: number }[] = [
	{ shelf: 0, from: 0.38, to: 1.52 },
	{ shelf: 1, from: 1.36, to: 1.52 },
	{ shelf: 2, from: 0.38, to: 1.2 },
	{ shelf: 3, from: 0.6, to: 1.52 },
	{ shelf: 4, from: 0.38, to: 1.05 },
	{ shelf: 5, from: 0.38, to: 1.52 },
];

/**
 * The books: one instanced mesh (one draw call for all of them). Each gets a seeded size and
 * colour, with the odd lean and lying-flat stack, so the rows look collected rather than
 * generated. Tux stands on a short stack of two.
 */
function Books({ front, count }: { front: number; count: number }) {
	const mesh = useRef<InstancedMesh>(null);

	const books = useMemo(() => {
		const rand = seededRandom('bookshelf');
		const out: { position: Vector3; rotation: Quaternion; scale: Vector3; colour: Color }[] = [];
		const up = new Vector3(0, 0, 1);
		const pick = () => new Color(BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)]).multiplyScalar(0.85 + rand() * 0.3);
		// Tux's stand: two books lying flat.
		const tuxBase = SHELVES[1] + 0.0125;
		for (let i = 0; i < 2; i++) {
			out.push({
				position: new Vector3(1.22, tuxBase + 0.015 + i * 0.03, front - 0.12),
				rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (i ? 0.08 : -0.05) + 0.2),
				scale: new Vector3(0.17, 0.03, 0.12),
				colour: pick(),
			});
		}
		for (const run of BOOK_RUNS) {
			const base = SHELVES[run.shelf] + 0.0125;
			let x = run.from;
			while (x < run.to && out.length < count) {
				const roll = rand();
				if (roll < 0.06) {
					x += 0.05 + rand() * 0.1;
					continue;
				}
				if (roll < 0.12 && run.to - x > 0.24) {
					// A short stack lying flat.
					const pile = 2 + Math.floor(rand() * 3);
					let y = base;
					const w = 0.17 + rand() * 0.06;
					for (let i = 0; i < pile; i++) {
						const t = 0.025 + rand() * 0.02;
						out.push({
							position: new Vector3(x + w / 2 + (rand() - 0.5) * 0.01, y + t / 2, front - 0.13),
							rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (rand() - 0.5) * 0.12),
							scale: new Vector3(w, t, 0.15 + rand() * 0.05),
							colour: pick(),
						});
						y += t;
					}
					x += w + 0.02;
					continue;
				}
				const t = 0.02 + rand() * 0.035;
				const h = 0.18 + rand() * 0.12;
				const d = 0.15 + rand() * 0.08;
				const lean = roll > 0.95 ? -(0.12 + rand() * 0.15) : 0;
				out.push({
					position: new Vector3(x + t / 2 + (lean ? h * Math.sin(-lean) * 0.5 : 0), base + (h / 2) * Math.cos(lean), front - 0.01 - d / 2 - rand() * 0.02),
					rotation: new Quaternion().setFromAxisAngle(up, lean),
					scale: new Vector3(t, h, d),
					colour: pick(),
				});
				x += t + (lean ? h * Math.sin(-lean) : 0) + 0.001;
			}
		}
		return out;
	}, [front, count]);

	useLayoutEffect(() => {
		const m = mesh.current;
		if (!m) return;
		const matrix = new Matrix4();
		books.forEach((b, i) => {
			matrix.compose(b.position, b.rotation, b.scale);
			m.setMatrixAt(i, matrix);
			m.setColorAt(i, b.colour);
		});
		m.count = books.length;
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}, [books]);

	return (
		<instancedMesh ref={mesh} args={[undefined, undefined, Math.max(2, count)]} castShadow receiveShadow>
			<boxGeometry args={[1, 1, 1]} />
			<meshStandardMaterial roughness={0.7} metalness={0} />
		</instancedMesh>
	);
}

/**
 * A slim monitor on a stand, running a terminal. The screen is a canvas texture used as an
 * emissive map (it glows, it isn't lit), redrawn twice a second to blink the cursor. A faint
 * blue light in front of it washes the shelf and Tux.
 */
function Monitor({ position, tripSlugs, reducedMotion }: { position: [number, number, number]; tripSlugs: string[]; reducedMotion: boolean }) {
	const [screen] = useState(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 640;
		canvas.height = 376;
		drawTerminal(canvas, tripSlugs, true);
		const texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		return { canvas, texture };
	});
	useEffect(() => {
		if (reducedMotion) return;
		let on = true;
		const id = window.setInterval(() => {
			on = !on;
			drawTerminal(screen.canvas, tripSlugs, on);
			screen.texture.needsUpdate = true;
		}, 530);
		return () => window.clearInterval(id);
	}, [screen, tripSlugs, reducedMotion]);
	useEffect(() => () => screen.texture.dispose(), [screen]);

	const aluminium = <meshStandardMaterial color="#2a2b2f" metalness={0.8} roughness={0.4} />;
	return (
		<group position={position} rotation={[0, -0.22, 0]}>
			<mesh position={[0, 0.004, 0]} castShadow receiveShadow>
				<boxGeometry args={[0.16, 0.008, 0.11]} />
				{aluminium}
			</mesh>
			<mesh position={[0, 0.06, -0.035]} castShadow>
				<boxGeometry args={[0.03, 0.11, 0.012]} />
				{aluminium}
			</mesh>
			<mesh position={[0, 0.16, -0.02]} castShadow>
				<boxGeometry args={[0.44, 0.27, 0.014]} />
				<meshStandardMaterial color="#0c0d0f" metalness={0.3} roughness={0.5} />
			</mesh>
			<mesh position={[0, 0.162, -0.0125]}>
				<planeGeometry args={[0.42, 0.247]} />
				{/* A matte (anti-glare) screen. */}
				<meshStandardMaterial color="#000" emissive="#ffffff" emissiveMap={screen.texture} emissiveIntensity={1.3} roughness={0.7} />
			</mesh>
			<pointLight position={[0, 0.16, 0.25]} color="#9db4ff" intensity={0.15} distance={0.8} decay={2} />
		</group>
	);
}

/**
 * Tux, the Linux mascot, as a small vinyl figure: black body and flippers, white belly and eye
 * patches, orange beak and feet. About 15 cm tall, built from squashed spheres. (Tux was drawn by
 * Larry Ewing; see /credits.)
 */
function Tux({ position }: { position: [number, number, number] }) {
	const black = <meshPhysicalMaterial color="#111214" roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.3} />;
	const white = <meshPhysicalMaterial color="#efefef" roughness={0.4} clearcoat={0.4} />;
	const orange = <meshPhysicalMaterial color="#f2a72c" roughness={0.45} clearcoat={0.4} />;
	const blob = (p: [number, number, number], s: [number, number, number], m: ReactNode, key: string, rz = 0) => (
		<mesh key={key} position={p} scale={s} rotation={[0, 0, rz]} castShadow>
			<sphereGeometry args={[1, 32, 24]} />
			{m}
		</mesh>
	);
	return (
		<group position={position} rotation={[0, -0.35, 0]}>
			{blob([0, 0.058, 0], [0.045, 0.058, 0.04], black, 'body')}
			{blob([0, 0.052, 0.02], [0.034, 0.046, 0.024], white, 'belly')}
			{blob([0, 0.118, 0], [0.032, 0.03, 0.03], black, 'head')}
			{blob([-0.011, 0.126, 0.024], [0.009, 0.013, 0.006], white, 'eyeL')}
			{blob([0.011, 0.126, 0.024], [0.009, 0.013, 0.006], white, 'eyeR')}
			{blob([-0.011, 0.125, 0.029], [0.0038, 0.0045, 0.002], black, 'pupilL')}
			{blob([0.011, 0.125, 0.029], [0.0038, 0.0045, 0.002], black, 'pupilR')}
			{blob([0, 0.109, 0.028], [0.016, 0.0075, 0.014], orange, 'beak')}
			{blob([-0.045, 0.06, 0], [0.012, 0.038, 0.02], black, 'flipL', 0.35)}
			{blob([0.045, 0.06, 0], [0.012, 0.038, 0.02], black, 'flipR', -0.35)}
			{blob([-0.017, 0.005, 0.016], [0.02, 0.007, 0.026], orange, 'footL')}
			{blob([0.017, 0.005, 0.016], [0.02, 0.007, 0.026], orange, 'footR')}
		</group>
	);
}
