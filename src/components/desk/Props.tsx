import { Html, RoundedBox, useCursor, useTexture } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DoubleSide, MathUtils, RepeatWrapping, type Group, type PointLight, type Texture } from 'three';
import type { PropSpot, PropSpots } from './layout';
import { loadCaptionFont } from './polaroidTexture';
import {
	BOARDING_PASS_SIZE,
	createBoardingPass,
	createJournalPage,
	createPageEdges,
	createPassportFoil,
	createPassportPage,
	createTrainTicket,
	createTrainTicketBack,
	JOURNAL_SIZE,
	PASSPORT_SIZE,
	TRAIN_TICKET_SIZE,
} from './propTextures';

/*
 * The desk's props: passport, journal, boarding pass, train ticket and camera. They're there for
 * atmosphere (the trips live on the polaroids and pins), but they still answer a touch: hover
 * lifts them with a label, a click does something physical. Built from primitive shapes, with
 * the leather and paper surfaces from the CC0 texture maps.
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
			<Passport spot={spots.passport} leather={leather} textureWidth={textureWidth} reducedMotion={reducedMotion} />
			<Journal spot={spots.journal} leather={leather} textureWidth={textureWidth} reducedMotion={reducedMotion} />
			<BoardingPass spot={spots.boardingPass} textureWidth={textureWidth} reducedMotion={reducedMotion} />
			<TrainTicket spot={spots.trainTicket} textureWidth={textureWidth} reducedMotion={reducedMotion} />
			<Camera spot={spots.camera} leather={leather} reducedMotion={reducedMotion} />
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

/* ---------- Passport ---------- */

function Passport({ spot, leather, textureWidth, reducedMotion }: { spot: PropSpot; leather: Leather; textureWidth: number; reducedMotion: boolean }) {
	const foil = useCanvasTexture(() => createPassportFoil(textureWidth), [textureWidth]);
	const page = useCanvasTexture(() => createPassportPage(textureWidth, 7), [textureWidth]);
	const endpaper = useCanvasTexture(() => createPassportPage(textureWidth, 1), [textureWidth]);
	return (
		<PropShell spot={spot} label="Passport" labelHeight={0.03} reducedMotion={reducedMotion}>
			{(open) => <PassportBody open={open} leather={leather} foil={foil} page={page} endpaper={endpaper} reducedMotion={reducedMotion} />}
		</PropShell>
	);
}

const PASSPORT_BLUE = '#1d2742';

function PassportBody({
	open,
	leather,
	foil,
	page,
	endpaper,
	reducedMotion,
}: {
	open: boolean;
	leather: Leather;
	foil: Texture;
	page: Texture;
	endpaper: Texture;
	reducedMotion: boolean;
}) {
	const { width: W, length: L } = PASSPORT_SIZE;
	const COVER = 0.0008;
	const PAGES = 0.0034;
	// The front cover swings open on the spine (the left long edge), to lie almost flat.
	const hinge = useHinge(open, Math.PI - 0.06, reducedMotion);
	return (
		<group>
			{/* Back cover */}
			<mesh position={[0, COVER / 2, 0]} castShadow receiveShadow>
				<boxGeometry args={[W, COVER, L]} />
				<meshStandardMaterial color={PASSPORT_BLUE} normalMap={leather.normalMap} normalScale={[0.8, 0.8]} roughnessMap={leather.roughnessMap} roughness={0.9} />
			</mesh>
			{/* Pages. A box's six faces are material slots 0–5 (+x, −x, +y, −y, +z, −z); the top (2)
			    is the right-hand page of the open spread. */}
			<mesh position={[0.001, COVER + PAGES / 2, 0]} castShadow receiveShadow>
				<boxGeometry args={[W - 0.003, PAGES, L - 0.004]} />
				{[0, 1, 3, 4, 5].map((i) => (
					<meshStandardMaterial key={i} attach={`material-${i}`} color="#e9e4d2" roughness={0.95} />
				))}
				<meshStandardMaterial attach="material-2" map={page} roughness={0.9} />
			</mesh>
			{/* Front cover, hinged at the spine. */}
			<group ref={hinge} position={[-W / 2, COVER + PAGES, 0]}>
				<mesh position={[W / 2, COVER / 2, 0]} castShadow receiveShadow>
					<boxGeometry args={[W, COVER, L]} />
					{[0, 1, 4, 5].map((i) => (
						<meshStandardMaterial key={i} attach={`material-${i}`} color={PASSPORT_BLUE} roughness={0.9} />
					))}
					<meshStandardMaterial attach="material-2" color={PASSPORT_BLUE} normalMap={leather.normalMap} normalScale={[0.8, 0.8]} roughnessMap={leather.roughnessMap} roughness={0.9} />
					{/* The inside of the cover: the endpaper, seen once it's open. */}
					<meshStandardMaterial attach="material-3" map={endpaper} roughness={0.9} />
				</mesh>
				{/* Gold foil: a thin metal layer cut out by the foil mask. */}
				<mesh position={[W / 2, COVER + 0.00005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<planeGeometry args={[W, L]} />
					<meshStandardMaterial color="#c9a45a" metalness={1} roughness={0.32} alphaMap={foil} alphaTest={0.5} />
				</mesh>
			</group>
		</group>
	);
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
	const hinge = useHinge(open, Math.PI - 0.05, reducedMotion);
	const cover = <meshStandardMaterial color="#5a3820" normalMap={leather.normalMap} normalScale={[1, 1]} roughnessMap={leather.roughnessMap} roughness={0.85} />;
	return (
		<group>
			<RoundedBox args={[W, COVER, L]} radius={0.0007} smoothness={2} position={[0, COVER / 2, 0]} castShadow receiveShadow>
				{cover}
			</RoundedBox>
			<mesh position={[0.0015, COVER + PAGES / 2, 0]} castShadow receiveShadow>
				<boxGeometry args={[W - 0.006, PAGES, L - 0.008]} />
				{[0, 1, 4, 5].map((i) => (
					<meshStandardMaterial key={i} attach={`material-${i}`} map={edges} roughness={0.95} />
				))}
				<meshStandardMaterial attach="material-2" map={page} roughness={0.92} />
				<meshStandardMaterial attach="material-3" color="#efe7d3" roughness={0.95} />
			</mesh>
			{/* A red ribbon bookmark trailing out of the bottom of the pages. */}
			<mesh position={[0.025, COVER + 0.0004, L / 2 + 0.018]} rotation={[-Math.PI / 2, 0, 0.12]} receiveShadow castShadow>
				<planeGeometry args={[0.006, 0.05]} />
				<meshStandardMaterial color="#8c1f24" roughness={0.6} side={DoubleSide} />
			</mesh>
			<group ref={hinge} position={[-W / 2, COVER + PAGES, 0]}>
				<RoundedBox args={[W, COVER, L]} radius={0.0007} smoothness={2} position={[W / 2, COVER / 2, 0]} castShadow receiveShadow>
					{cover}
				</RoundedBox>
			</group>
		</group>
	);
}

/* ---------- Tickets ---------- */

interface TicketLook {
	size: { width: number; length: number };
	texture: Texture;
	/** The reverse side: a colour, or a texture of its own (needed if the front has holes). */
	back: string | Texture;
	alphaTest?: number;
}

/** A paper ticket lying on the desk; a click turns it over (and back). */
function Ticket({ spot, label, look, reducedMotion }: { spot: PropSpot; label: string; look: TicketLook; reducedMotion: boolean }) {
	return (
		<PropShell spot={spot} label={label} labelHeight={0.03} lift={0.01} reducedMotion={reducedMotion}>
			{(open) => <TicketBody open={open} look={look} reducedMotion={reducedMotion} />}
		</PropShell>
	);
}

function TicketBody({ open, look, reducedMotion }: { open: boolean; look: TicketLook; reducedMotion: boolean }) {
	const { size, texture, back, alphaTest } = look;
	const flipper = useRef<Group>(null);
	useFrame((_, delta) => {
		const f = flipper.current;
		if (!f) return;
		f.rotation.x = MathUtils.damp(f.rotation.x, open ? Math.PI : 0, reducedMotion ? Infinity : 6, delta);
		// Rise while turning, so it doesn't sweep through the desk.
		f.position.y = 0.0006 + Math.sin(Math.min(Math.PI, Math.abs(f.rotation.x))) * size.length * 0.5;
	});
	return (
		<group ref={flipper} position={[0, 0.0006, 0]}>
			<mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
				<planeGeometry args={[size.width, size.length]} />
				<meshStandardMaterial map={texture} roughness={0.85} alphaTest={alphaTest ?? 0} />
			</mesh>
			{/* The back: plain card, a hair below the front. */}
			<mesh position={[0, -0.0002, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
				<planeGeometry args={[size.width, size.length]} />
				{typeof back === 'string' ? (
					<meshStandardMaterial color={back} roughness={0.9} />
				) : (
					<meshStandardMaterial map={back} roughness={0.9} alphaTest={alphaTest ?? 0} />
				)}
			</mesh>
		</group>
	);
}

function BoardingPass({ spot, textureWidth, reducedMotion }: { spot: PropSpot; textureWidth: number; reducedMotion: boolean }) {
	const texture = useCanvasTexture(() => createBoardingPass(textureWidth * 1.6), [textureWidth]);
	const look = useMemo(() => ({ size: BOARDING_PASS_SIZE, texture, back: '#efece3' }), [texture]);
	return <Ticket spot={spot} label="Boarding pass" look={look} reducedMotion={reducedMotion} />;
}

function TrainTicket({ spot, textureWidth, reducedMotion }: { spot: PropSpot; textureWidth: number; reducedMotion: boolean }) {
	const texture = useCanvasTexture(() => createTrainTicket(textureWidth), [textureWidth]);
	const back = useCanvasTexture(() => createTrainTicketBack(textureWidth), [textureWidth]);
	const look = useMemo(() => ({ size: TRAIN_TICKET_SIZE, texture, back, alphaTest: 0.5 }), [texture, back]);
	return <Ticket spot={spot} label="Train ticket" look={look} reducedMotion={reducedMotion} />;
}

/* ---------- Camera ---------- */

/**
 * A rangefinder camera: leatherette body, chrome top plate, a lens barrel with a glass front,
 * viewfinder windows, shutter button and knobs. It stands on its base, lens facing +z. A click
 * fires the flash: a point light at the lens that pops and fades over a fraction of a second,
 * lighting the desk for real (skipped for reduced motion).
 */
function Camera({ spot, leather, reducedMotion }: { spot: PropSpot; leather: Leather; reducedMotion: boolean }) {
	return (
		<PropShell spot={spot} label="Camera" labelHeight={0.11} lift={0.01} reducedMotion={reducedMotion}>
			{(open) => <CameraBody open={open} leather={leather} reducedMotion={reducedMotion} />}
		</PropShell>
	);
}

function CameraBody({ open, leather, reducedMotion }: { open: boolean; leather: Leather; reducedMotion: boolean }) {
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
	}, [open]);
	useFrame(() => {
		const f = flash.current;
		if (!f) return;
		if (fired.current === null) {
			f.intensity = 0;
			return;
		}
		const t = (performance.now() - fired.current) / 1000;
		f.intensity = t < 0.04 ? 4 : Math.max(0, 4 * Math.exp(-(t - 0.04) * 18));
		if (t > 0.5) fired.current = null;
	});

	const chrome = <meshStandardMaterial color="#cfd0d4" metalness={1} roughness={0.22} />;
	const black = <meshStandardMaterial color="#17171a" metalness={0.3} roughness={0.45} />;
	const glass = <meshPhysicalMaterial color="#0b1016" roughness={0.04} clearcoat={1} clearcoatRoughness={0.02} metalness={0.1} />;
	const BODY_W = 0.13;
	const BODY_D = 0.034;
	const LENS_X = 0.01;
	const LENS_Y = 0.029;

	return (
		<group>
			{/* Leatherette body */}
			<RoundedBox args={[BODY_W - 0.002, 0.052, BODY_D]} radius={0.006} smoothness={3} position={[0, 0.026, 0]} castShadow receiveShadow>
				<meshStandardMaterial color="#141416" normalMap={leather.normalMap} normalScale={[1.2, 1.2]} roughnessMap={leather.roughnessMap} roughness={0.95} />
			</RoundedBox>
			{/* Chrome top plate */}
			<RoundedBox args={[BODY_W, 0.022, BODY_D + 0.002]} radius={0.004} smoothness={3} position={[0, 0.063, 0]} castShadow receiveShadow>
				{chrome}
			</RoundedBox>
			{/* Viewfinder and rangefinder windows */}
			<mesh position={[-0.046, 0.064, BODY_D / 2 + 0.0012]}>
				<boxGeometry args={[0.016, 0.01, 0.001]} />
				{glass}
			</mesh>
			<mesh position={[0.034, 0.064, BODY_D / 2 + 0.0012]}>
				<boxGeometry args={[0.011, 0.009, 0.001]} />
				{glass}
			</mesh>
			{/* Shutter button, rewind knob, advance lever */}
			<mesh position={[0.045, 0.076, 0]} castShadow>
				<cylinderGeometry args={[0.0042, 0.0042, 0.004, 20]} />
				{chrome}
			</mesh>
			<mesh position={[-0.048, 0.0775, 0]} castShadow>
				<cylinderGeometry args={[0.009, 0.009, 0.007, 28]} />
				{black}
			</mesh>
			<mesh position={[0.03, 0.0755, -0.008]} rotation={[0, 0.5, 0]} castShadow>
				<boxGeometry args={[0.022, 0.002, 0.005]} />
				{chrome}
			</mesh>
			{/* Lens: mount ring, barrel, front ring, glass */}
			<group position={[LENS_X, LENS_Y, BODY_D / 2]} rotation={[Math.PI / 2, 0, 0]}>
				<mesh position={[0, 0.003, 0]} castShadow>
					<cylinderGeometry args={[0.021, 0.021, 0.006, 40]} />
					{chrome}
				</mesh>
				<mesh position={[0, 0.019, 0]} castShadow>
					<cylinderGeometry args={[0.0185, 0.0195, 0.026, 40]} />
					{black}
				</mesh>
				<mesh position={[0, 0.0335, 0]} castShadow>
					<cylinderGeometry args={[0.0195, 0.0195, 0.003, 40]} />
					{chrome}
				</mesh>
				<mesh position={[0, 0.0352, 0]}>
					<cylinderGeometry args={[0.0145, 0.0145, 0.0006, 40]} />
					{glass}
				</mesh>
			</group>
			{/* The flash: off until fired. */}
			<pointLight ref={flash} position={[LENS_X, LENS_Y + 0.03, BODY_D / 2 + 0.05]} color="#f4f6ff" intensity={0} distance={1.2} decay={2} />
		</group>
	);
}
