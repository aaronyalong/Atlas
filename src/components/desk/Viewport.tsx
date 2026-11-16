import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import {
	AdditiveBlending,
	BufferGeometry,
	CanvasTexture,
	Color,
	DoubleSide,
	Float32BufferAttribute,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Quaternion,
	Vector3,
	type Material,
	type Vector3Tuple,
} from 'three';
import { PALETTE } from './palette';
import { FRAME, GLASS_Z, OPENING, STRUT, STRUT_X, WALL_Z, WINDOW } from './roomLayout';

/*
 * The viewport, art deco industrial: the same aged brass as the banker's lamp and the gold of the
 * map's border, on dark bronze.
 *
 *   - The recess: dark bronze reveals splaying out from the glass, each with two brass ribs
 *     running round it (the stepped outline deco loves), and a brass nosing along the sill.
 *   - A warm gold cove light tucked just inside the opening's edge, behind a brass architrave:
 *     the strip itself glows (bright enough to bloom), and its light washes down the bronze.
 *   - The frame round the glass: dark bronze with a polished brass inner lip and rows of brass
 *     dome rivets; the two struts carry brass collars.
 *   - Sunburst fans at the top corners and a stepped keystone over the middle: the classic deco
 *     ornaments, seen when you look up at the window.
 *
 * All built from primitive shapes. Materials are shared (made once, below), so the dozens of
 * ribs, rivets and rays cost one material each.
 */

/** Polished but aged brass, as on the lamp. */
export const BRASS = new MeshStandardMaterial({ color: PALETTE.brass, metalness: 1, roughness: 0.36 });
/** Dark oiled bronze: the frame and struts. */
export const BRONZE = new MeshStandardMaterial({ color: PALETTE.bronze, metalness: 0.85, roughness: 0.45 });
/** The recess's sloping sides: bronze too, a little duller. Double-sided for the sun's shadows. */
const REVEAL = new MeshStandardMaterial({ color: '#2a2119', metalness: 0.6, roughness: 0.5, side: DoubleSide });
/** The cove light's strip: far brighter than white, so it blooms gold. */
const GLOW = new MeshBasicMaterial({ color: new Color(...PALETTE.goldLight), toneMapped: false });

export function Viewport({ shadows }: { shadows: boolean }) {
	return (
		<group>
			<Recess shadows={shadows} />
			<Frame />
			<Ornaments />
		</group>
	);
}

/** A flat quad through four corners (in order round the edge), with UVs (0,0) (1,0) (1,1) (0,1). */
function quad(points: Vector3Tuple[]): BufferGeometry {
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
	g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
	g.setIndex([0, 1, 2, 0, 2, 3]);
	g.computeVertexNormals();
	return g;
}

/** A bar (a long thin box) from one point to another. */
function Bar({ from, to, width, depth = width, material, castShadow = false }: { from: Vector3Tuple; to: Vector3Tuple; width: number; depth?: number; material: Material; castShadow?: boolean }) {
	const a = new Vector3(...from);
	const b = new Vector3(...to);
	const direction = b.clone().sub(a);
	const length = direction.length();
	const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
	return (
		<mesh position={a.add(b).multiplyScalar(0.5)} quaternion={quaternion} material={material} castShadow={castShadow}>
			<boxGeometry args={[width, length, depth]} />
		</mesh>
	);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Points on the recess, a fraction `f` of the way from the wall's face (0) back to the glass (1). */
const at = (f: number) => ({
	z: lerp(WALL_Z, GLASS_Z, f),
	left: lerp(OPENING.left, WINDOW.left, f),
	right: lerp(OPENING.right, WINDOW.right, f),
	top: lerp(OPENING.top, WINDOW.top, f),
	bottom: WINDOW.bottom,
});

/** A soft vertical gradient (bright at the top of the image), for the glow washing down the bronze. */
function useWashTexture() {
	return useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 4;
		canvas.height = 128;
		const ctx = canvas.getContext('2d')!;
		const g = ctx.createLinearGradient(0, 0, 0, 128);
		g.addColorStop(0, '#ffffff');
		g.addColorStop(0.25, '#8a8a8a');
		g.addColorStop(0.6, '#262626');
		g.addColorStop(1, '#000000');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 4, 128);
		return new CanvasTexture(canvas);
	}, []);
}

function Recess({ shadows }: { shadows: boolean }) {
	const face = at(0);
	const glass = at(1);
	const faces = useMemo(
		() => [
			quad([[face.left, face.bottom, face.z], [face.left, face.top, face.z], [glass.left, glass.top, glass.z], [glass.left, glass.bottom, glass.z]]),
			quad([[face.right, face.bottom, face.z], [glass.right, glass.bottom, glass.z], [glass.right, glass.top, glass.z], [face.right, face.top, face.z]]),
			quad([[face.left, face.top, face.z], [face.right, face.top, face.z], [glass.right, glass.top, glass.z], [glass.left, glass.top, glass.z]]),
			quad([[face.left, face.bottom, face.z], [glass.left, glass.bottom, glass.z], [glass.right, glass.bottom, glass.z], [face.right, face.bottom, face.z]]),
		],
		[face, glass],
	);

	// The cove light's wash: additive quads over the first half of each reveal, brightest at the
	// strip (v = 1) and fading toward the glass. A hair off the bronze (polygon offset), so they
	// don't flicker against it.
	const washTexture = useWashTexture();
	const wash = useMemo(
		() =>
			new MeshBasicMaterial({
				color: new Color(...PALETTE.goldWash),
				map: washTexture,
				blending: AdditiveBlending,
				transparent: true,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				side: DoubleSide,
			}),
		[washTexture],
	);
	const half = at(0.55);
	const strip = at(0.06);
	const washes = useMemo(
		() => [
			// Each: the inner edge first (v = 0), then the edge by the strip (v = 1).
			quad([[half.left, half.bottom, half.z], [half.left, half.top, half.z], [strip.left, strip.top, strip.z], [strip.left, strip.bottom, strip.z]]),
			quad([[half.right, half.top, half.z], [half.right, half.bottom, half.z], [strip.right, strip.bottom, strip.z], [strip.right, strip.top, strip.z]]),
			quad([[half.right, half.top, half.z], [half.left, half.top, half.z], [strip.left, strip.top, strip.z], [strip.right, strip.top, strip.z]]),
		],
		[half, strip],
	);

	const ribs = [0.36, 0.7].map(at);
	const S = 0.009; // strip thickness
	return (
		<group>
			{faces.map((geometry, i) => (
				<mesh key={i} geometry={geometry} material={REVEAL} castShadow={shadows} receiveShadow />
			))}
			{washes.map((geometry, i) => (
				<mesh key={`w${i}`} geometry={geometry} material={wash} renderOrder={1} />
			))}
			{/* Brass ribs stepping back round the recess. */}
			{ribs.map((r, i) => (
				<group key={`r${i}`}>
					<Bar from={[r.left, r.bottom, r.z]} to={[r.left, r.top, r.z]} width={0.011} depth={0.008} material={BRASS} castShadow={shadows} />
					<Bar from={[r.right, r.bottom, r.z]} to={[r.right, r.top, r.z]} width={0.011} depth={0.008} material={BRASS} castShadow={shadows} />
					<Bar from={[r.left, r.top, r.z]} to={[r.right, r.top, r.z]} width={0.011} depth={0.008} material={BRASS} castShadow={shadows} />
				</group>
			))}
			{/* The cove light: a strip just inside the opening's edge, down both sides and across the top. */}
			<Bar from={[strip.left, strip.bottom + 0.01, strip.z]} to={[strip.left, strip.top, strip.z]} width={S} material={GLOW} />
			<Bar from={[strip.right, strip.bottom + 0.01, strip.z]} to={[strip.right, strip.top, strip.z]} width={S} material={GLOW} />
			<Bar from={[strip.left, strip.top, strip.z]} to={[strip.right, strip.top, strip.z]} width={S} material={GLOW} />
			{/* The brass architrave round the opening, on the wall's face. */}
			<Bar from={[face.left - 0.01, 0, WALL_Z + 0.012]} to={[face.left - 0.01, face.top + 0.01, WALL_Z + 0.012]} width={0.022} depth={0.016} material={BRASS} />
			<Bar from={[face.right + 0.01, 0, WALL_Z + 0.012]} to={[face.right + 0.01, face.top + 0.01, WALL_Z + 0.012]} width={0.022} depth={0.016} material={BRASS} />
			<Bar from={[face.left - 0.021, face.top + 0.01, WALL_Z + 0.012]} to={[face.right + 0.021, face.top + 0.01, WALL_Z + 0.012]} width={0.022} depth={0.016} material={BRASS} />
			{/* A rounded brass nosing along the front of the sill. */}
			<mesh position={[0, WINDOW.bottom - 0.002, WALL_Z + 0.004]} rotation={[0, 0, Math.PI / 2]} material={BRASS}>
				<cylinderGeometry args={[0.009, 0.009, face.right - face.left + 0.04, 16]} />
			</mesh>
		</group>
	);
}

function Frame() {
	const { left, right, bottom, top } = WINDOW;
	const w = right - left;
	const h = top - bottom;
	const cx = (left + right) / 2;
	const cy = (bottom + top) / 2;
	const z = GLASS_Z;
	const F = FRAME;
	const rivets: [number, number][] = [];
	for (let i = 0; i <= 14; i++) {
		const x = left + F / 2 + (i * (w - F)) / 14;
		rivets.push([x, bottom + F / 2], [x, top - F / 2]);
	}
	for (let i = 1; i < 7; i++) {
		const y = bottom + F / 2 + (i * (h - F)) / 7;
		rivets.push([left + F / 2, y], [right - F / 2, y]);
	}
	const lip = 0.008;
	return (
		<group>
			{[
				[cx, bottom + F / 2, w, F],
				[cx, top - F / 2, w, F],
				[left + F / 2, cy, F, h],
				[right - F / 2, cy, F, h],
			].map(([x, y, bw, bh], i) => (
				<RoundedBox key={i} args={[bw, bh, 0.06]} radius={0.012} smoothness={3} position={[x, y, z]} material={BRONZE} castShadow receiveShadow />
			))}
			{/* Polished brass lip round the glass. */}
			<Bar from={[left + F, bottom + F, z + 0.031]} to={[right - F, bottom + F, z + 0.031]} width={lip} material={BRASS} />
			<Bar from={[left + F, top - F, z + 0.031]} to={[right - F, top - F, z + 0.031]} width={lip} material={BRASS} />
			<Bar from={[left + F, bottom + F, z + 0.031]} to={[left + F, top - F, z + 0.031]} width={lip} material={BRASS} />
			<Bar from={[right - F, bottom + F, z + 0.031]} to={[right - F, top - F, z + 0.031]} width={lip} material={BRASS} />
			{/* Struts, with brass collars near each end and in the middle. */}
			{STRUT_X.map((sx) => (
				<group key={sx}>
					<RoundedBox args={[STRUT, h - F, 0.05]} radius={0.01} smoothness={3} position={[cx + sx, cy, z - 0.005]} material={BRONZE} castShadow />
					{[bottom + F + 0.09, cy, top - F - 0.09].map((y) => (
						<RoundedBox key={y} args={[STRUT + 0.016, 0.03, 0.062]} radius={0.006} smoothness={2} position={[cx + sx, y, z - 0.005]} material={BRASS} castShadow />
					))}
				</group>
			))}
			{rivets.map(([x, y], i) => (
				<mesh key={i} position={[x, y, z + 0.03]} scale={[1, 1, 0.55]} material={BRASS}>
					<sphereGeometry args={[0.0065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
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

/** The keystone's blocks: width, height, and how far up the step starts. */
const KEYSTONE = [
	[0.26, 0.05, 0],
	[0.17, 0.045, 0.05],
	[0.08, 0.04, 0.095],
];

/** Sunburst fans at the top corners and a stepped keystone over the middle, on the wall's face. */
function Ornaments() {
	const z = WALL_Z + 0.02;
	const fan = (cx: number, from: number, to: number) => {
		const rays = 9;
		return Array.from({ length: rays }, (_, i) => {
			const a = ((from + ((to - from) * i) / (rays - 1)) * Math.PI) / 180;
			const length = i % 2 ? 0.17 : 0.26;
			const r0 = 0.06;
			return (
				<Bar
					key={`${cx}${i}`}
					from={[cx + Math.cos(a) * r0, OPENING.top + 0.02 + Math.sin(a) * r0, z]}
					to={[cx + Math.cos(a) * (r0 + length), OPENING.top + 0.02 + Math.sin(a) * (r0 + length), z]}
					width={0.007}
					depth={0.006}
					material={BRASS}
				/>
			);
		});
	};
	return (
		<group>
			{fan(OPENING.left - 0.01, 95, 175)}
			{fan(OPENING.right + 0.01, 5, 85)}
			{[OPENING.left - 0.01, OPENING.right + 0.01].map((x, i) => (
				<mesh key={x} position={[x, OPENING.top + 0.02, z]} material={BRASS}>
					<circleGeometry args={[0.05, 32, i ? 0 : Math.PI / 2, Math.PI / 2]} />
				</mesh>
			))}
			{/* Keystone: three stepped blocks. */}
			{KEYSTONE.map(([width, height, y], i) => (
				<RoundedBox key={i} args={[width, height, 0.03]} radius={0.004} smoothness={2} position={[0, OPENING.top + 0.02 + y + height / 2, z]} material={BRASS} />
			))}
		</group>
	);
}
