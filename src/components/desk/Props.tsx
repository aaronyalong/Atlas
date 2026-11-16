import { Html, RoundedBox, useCursor, useTexture } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DoubleSide, MathUtils, RepeatWrapping, type Group, type PointLight, type Texture } from 'three';
import type { PropSpot, PropSpots } from './layout';
import { loadCaptionFont } from './polaroidTexture';
import { createGripRibs, createJournalPage, createPageEdges, createWordmark, JOURNAL_SIZE } from './propTextures';

/*
 * The desk's two props: a leather travel journal and a Nikon DSLR. Hover lifts them with a label;
 * a click does something physical (the journal opens, the camera fires its flash). Built from
 * primitive shapes, with the leather surfaces from the CC0 texture maps.
 *
 * Not in the keyboard list (DeskApp): they carry no information a keyboard user would miss.
 */

/** ambientCG "Leather037" (CC0), 512px WebP; see /credits. Colour comes from each prop. */
const LEATHER = {
	normalMap: '/textures/leather-normal.webp',
	roughnessMap: '/textures/leather-roughness.webp',
};

type Leather = { normalMap: Texture; roughnessMap: Texture };

const EASE = 8;

interface PropsProps {
	spots: PropSpots;
	textureWidth: number;
	reducedMotion: boolean;
}

export function DeskProps({ spots, textureWidth, reducedMotion }: PropsProps) {
	const leather = useTexture(LEATHER);
	useLayoutEffect(() => {
		for (const t of [leather.normalMap, leather.roughnessMap]) {
			t.wrapS = t.wrapT = RepeatWrapping;
			t.repeat.set(2, 2);
			t.needsUpdate = true;
		}
	}, [leather]);

	return (
		<>
			<Journal spot={spots.journal} leather={leather} textureWidth={textureWidth} reducedMotion={reducedMotion} />
			<NikonCamera spot={spots.camera} leather={leather} reducedMotion={reducedMotion} />
		</>
	);
}

/**
 * Shared behaviour: a group that sits at the prop's spot, lifts on hover (eased every frame),
 * shows a label, and toggles `open` on a click that isn't the end of a drag.
 */
function PropShell({
	spot,
	label,
	labelHeight,
	lift = 0.012,
	reducedMotion,
	children,
}: {
	spot: PropSpot;
	label: string;
	labelHeight: number;
	lift?: number;
	reducedMotion: boolean;
	children: (open: boolean) => ReactNode;
}) {
	const lifter = useRef<Group>(null);
	const [hovered, setHovered] = useState(false);
	const [open, setOpen] = useState(false);
	useCursor(hovered);

	useFrame((_, delta) => {
		const l = lifter.current;
		if (!l) return;
		l.position.y = MathUtils.damp(l.position.y, hovered ? lift : 0, reducedMotion ? Infinity : EASE, delta);
	});

	return (
		<group position={[spot.x, spot.y ?? 0, spot.z]} rotation={[0, (spot.turn * Math.PI) / 180, 0]}>
			<group
				ref={lifter}
				onPointerOver={(e: ThreeEvent<PointerEvent>) => {
					e.stopPropagation();
					setHovered(true);
				}}
				onPointerOut={() => setHovered(false)}
				onClick={(e: ThreeEvent<MouseEvent>) => {
					e.stopPropagation();
					if (e.delta > 4) return;
					setOpen((o) => !o);
				}}
			>
				{children(open)}
				{hovered && (
					<Html position={[0, labelHeight, 0]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
						<span className="desk-label">{label}</span>
					</Html>
				)}
			</group>
		</group>
	);
}

/** A canvas texture made once and freed with the component. */
function useCanvasTexture(make: () => Texture, deps: unknown[]) {
	const gl = useThree((s) => s.gl);
	const texture = useMemo(() => {
		const t = make();
		t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
		return t;
	}, deps);
	useEffect(() => () => texture.dispose(), [texture]);
	return texture;
}

/** Eases a hinge (a group's rotation about z) between closed and open. */
function useHinge(open: boolean, openAngle: number, reducedMotion: boolean) {
	const hinge = useRef<Group>(null);
	useFrame((_, delta) => {
		const h = hinge.current;
		if (!h) return;
		h.rotation.z = MathUtils.damp(h.rotation.z, open ? openAngle : 0, reducedMotion ? Infinity : 5, delta);
	});
	return hinge;
}

/* ---------- Journal ---------- */

function Journal({ spot, leather, textureWidth, reducedMotion }: { spot: PropSpot; leather: Leather; textureWidth: number; reducedMotion: boolean }) {
	// The first page is handwritten, so wait for the handwriting font before drawing it.
	use(loadCaptionFont('Travel journal'));
	const page = useCanvasTexture(() => createJournalPage(textureWidth), [textureWidth]);
	const edges = useCanvasTexture(() => createPageEdges(), []);
	return (
		<PropShell spot={spot} label="Travel journal" labelHeight={0.045} reducedMotion={reducedMotion}>
			{(open) => <JournalBody open={open} leather={leather} page={page} edges={edges} reducedMotion={reducedMotion} />}
		</PropShell>
	);
}

function JournalBody({ open, leather, page, edges, reducedMotion }: { open: boolean; leather: Leather; page: Texture; edges: Texture; reducedMotion: boolean }) {
	const { width: W, length: L } = JOURNAL_SIZE;
	const COVER = 0.0016;
	const PAGES = 0.017;
	// The cover swings open on the spine (the left long edge), to lie almost flat.
	const hinge = useHinge(open, Math.PI - 0.05, reducedMotion);
	const cover = <meshStandardMaterial color="#2a1d16" normalMap={leather.normalMap} normalScale={[1, 1]} roughnessMap={leather.roughnessMap} roughness={0.85} />;
	return (
		<group>
			<RoundedBox args={[W, COVER, L]} radius={0.0007} smoothness={2} position={[0, COVER / 2, 0]} castShadow receiveShadow>
				{cover}
			</RoundedBox>
			{/* Pages. A box's six faces are material slots 0–5 (+x, −x, +y, −y, +z, −z); the top
			    (2) is the first page, seen once the cover is open. */}
			<mesh position={[0.0015, COVER + PAGES / 2, 0]} castShadow receiveShadow>
				<boxGeometry args={[W - 0.006, PAGES, L - 0.008]} />
				{[0, 1, 4, 5].map((i) => (
					<meshStandardMaterial key={i} attach={`material-${i}`} map={edges} roughness={0.95} />
				))}
				<meshStandardMaterial attach="material-2" map={page} roughness={0.92} />
				<meshStandardMaterial attach="material-3" color="#efe7d3" roughness={0.95} />
			</mesh>
			{/* A black elastic-band closure's worth of ribbon: a dark bookmark from the bottom. */}
			<mesh position={[0.025, COVER + 0.0004, L / 2 + 0.018]} rotation={[-Math.PI / 2, 0, 0.12]} receiveShadow castShadow>
				<planeGeometry args={[0.006, 0.05]} />
				<meshStandardMaterial color="#1c1c1e" roughness={0.6} side={DoubleSide} />
			</mesh>
			<group ref={hinge} position={[-W / 2, COVER + PAGES, 0]}>
				<RoundedBox args={[W, COVER, L]} radius={0.0007} smoothness={2} position={[W / 2, COVER / 2, 0]} castShadow receiveShadow>
					{cover}
				</RoundedBox>
			</group>
		</group>
	);
}

/* ---------- Nikon DSLR ---------- */

function NikonCamera({ spot, leather, reducedMotion }: { spot: PropSpot; leather: Leather; reducedMotion: boolean }) {
	const wordmark = useCanvasTexture(() => createWordmark('Nikon'), []);
	const ribs = useCanvasTexture(() => createGripRibs(), []);
	return (
		<PropShell spot={spot} label="Nikon" labelHeight={0.15} lift={0.01} reducedMotion={reducedMotion}>
			{(open) => <NikonBody open={open} leather={leather} wordmark={wordmark} ribs={ribs} reducedMotion={reducedMotion} />}
		</PropShell>
	);
}

/**
 * A Nikon DSLR, standing on its base with the lens facing +z: a rubberised body with a deep grip
 * (Nikon's red stripe on it), the pentaprism hump with the white wordmark, a top-plate mode dial
 * and shutter button, and a pro zoom lens with ribbed rubber rings, a gold ring, and coated glass
 * that throws a faint rainbow sheen (iridescence). A click fires the flash: a point light at the
 * lens that pops and fades, lighting the desk for real (skipped for reduced motion).
 */
function NikonBody({ open, leather, wordmark, ribs, reducedMotion }: { open: boolean; leather: Leather; wordmark: Texture; ribs: Texture; reducedMotion: boolean }) {
	const flash = useRef<PointLight>(null);
	const fired = useRef<number | null>(null);
	const first = useRef(true);
	// Every click toggles `open`; either way, that's a shot.
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		if (!reducedMotion) fired.current = performance.now();
	}, [open, reducedMotion]);
	useFrame(() => {
		const f = flash.current;
		if (!f) return;
		if (fired.current === null) {
			f.intensity = 0;
			return;
		}
		const t = (performance.now() - fired.current) / 1000;
		f.intensity = t < 0.04 ? 3 : Math.max(0, 3 * Math.exp(-(t - 0.04) * 18));
		if (t > 0.5) fired.current = null;
	});

	const rubber = <meshStandardMaterial color="#121214" normalMap={leather.normalMap} normalScale={[1.4, 1.4]} roughnessMap={leather.roughnessMap} roughness={0.95} />;
	const paint = <meshStandardMaterial color="#17171a" metalness={0.25} roughness={0.5} />;
	const ribbed = <meshStandardMaterial map={ribs} roughness={0.9} />;
	const BODY = { w: 0.14, h: 0.082, d: 0.048 };
	const LENS_X = 0.008;
	const LENS_Y = 0.044;
	const FRONT = BODY.d / 2;

	return (
		<group>
			{/* Body and grip */}
			<RoundedBox args={[BODY.w, BODY.h, BODY.d]} radius={0.01} smoothness={4} position={[0, BODY.h / 2, 0]} castShadow receiveShadow>
				{rubber}
			</RoundedBox>
			<RoundedBox args={[0.042, 0.088, 0.072]} radius={0.014} smoothness={4} position={[-0.052, 0.044, 0.01]} castShadow receiveShadow>
				{rubber}
			</RoundedBox>
			{/* Nikon's red stripe at the top of the grip. */}
			<mesh position={[-0.054, 0.072, 0.0465]} rotation={[0, 0, -0.35]}>
				<boxGeometry args={[0.006, 0.03, 0.002]} />
				<meshStandardMaterial color="#c8102e" roughness={0.4} />
			</mesh>
			{/* Pentaprism hump, with the wordmark on its face. */}
			<RoundedBox args={[0.056, 0.032, 0.046]} radius={0.008} smoothness={3} position={[LENS_X, BODY.h + 0.012, -0.002]} castShadow>
				{paint}
			</RoundedBox>
			<mesh position={[LENS_X, BODY.h + 0.013, 0.0215]}>
				<planeGeometry args={[0.036, 0.009]} />
				<meshStandardMaterial map={wordmark} alphaTest={0.4} roughness={0.5} />
			</mesh>
			{/* Top plate: mode dial (left), shutter button on the grip (right). */}
			<mesh position={[0.045, BODY.h + 0.004, -0.004]} castShadow>
				<cylinderGeometry args={[0.012, 0.012, 0.008, 32]} />
				{ribbed}
			</mesh>
			<mesh position={[-0.052, 0.09, 0.022]} castShadow>
				<cylinderGeometry args={[0.0055, 0.0055, 0.004, 20]} />
				<meshStandardMaterial color="#2a2a2e" metalness={0.6} roughness={0.35} />
			</mesh>
			{/* Lens: mount, ribbed zoom ring, gold ring, focus ring, front barrel, coated glass. */}
			<group position={[LENS_X, LENS_Y, FRONT]} rotation={[Math.PI / 2, 0, 0]}>
				<mesh position={[0, 0.004, 0]} castShadow>
					<cylinderGeometry args={[0.031, 0.031, 0.008, 48]} />
					<meshStandardMaterial color="#6f7076" metalness={1} roughness={0.38} />
				</mesh>
				<mesh position={[0, 0.019, 0]} castShadow>
					<cylinderGeometry args={[0.033, 0.033, 0.022, 48]} />
					{paint}
				</mesh>
				<mesh position={[0, 0.042, 0]} castShadow>
					<cylinderGeometry args={[0.0355, 0.0355, 0.026, 64]} />
					{ribbed}
				</mesh>
				<mesh position={[0, 0.056, 0]}>
					<cylinderGeometry args={[0.0358, 0.0358, 0.0018, 64]} />
					<meshStandardMaterial color="#c9a54e" metalness={1} roughness={0.3} />
				</mesh>
				<mesh position={[0, 0.07, 0]} castShadow>
					<cylinderGeometry args={[0.035, 0.035, 0.026, 64]} />
					{ribbed}
				</mesh>
				<mesh position={[0, 0.089, 0]} castShadow>
					<cylinderGeometry args={[0.037, 0.0355, 0.012, 64]} />
					{paint}
				</mesh>
				<mesh position={[0, 0.0952, 0]}>
					<cylinderGeometry args={[0.029, 0.029, 0.0005, 64]} />
					<meshPhysicalMaterial color="#07090d" roughness={0.04} clearcoat={1} iridescence={0.8} iridescenceIOR={1.6} iridescenceThicknessMinimum={200} iridescenceThicknessMaximum={500} />
				</mesh>
			</group>
			{/* The flash: off until fired. */}
			<pointLight ref={flash} position={[LENS_X, BODY.h + 0.05, FRONT + 0.06]} color="#f4f6ff" intensity={0} distance={1.2} decay={2} />
		</group>
	);
}
