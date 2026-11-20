import { RoundedBox, useTexture } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { PALETTE } from './palette';
import { PAPER } from './paper';
import { MAP_LIFT } from './roomLayout';
import type { DeskMap } from './types';
import { BRASS, BRONZE, GLOW } from './Viewport';

/** How far the sheet's face stands off the slab under it. */
const SHEET = 0.0008;

/** Where the chart lies: across the desk on its plinth, MAP_LIFT above the wood, its back edge
 * 35 cm short of the wall (room for the lamp behind its left end). */
export const MAP_POSITION: [number, number, number] = [0, MAP_LIFT + SHEET, 0.181];

interface WorldMapProps {
	map: DeskMap;
	/** The pointer moved over the sheet (u, v from its top-left), or left it (null). */
	onHover?: (uv: [number, number] | null) => void;
	/** A click on the sheet (not the end of a drag), at (u, v). */
	onPick?: (uv: [number, number]) => void;
}

/**
 * The map: shown the way a museum shows one. A large printed chart on a dark slab that stands off
 * the desk on a narrower plinth with a line of gold light under its edge, so it seems to float (a
 * sheet simply lying on the wood looked like a doormat). Nothing stands above the chart: its only
 * frame is a thin brass trim round its edge, level with it.
 *
 * The print is the texture drawn by scripts/map.mjs; the paper's fibre and matte sheen come from
 * the Paper001 texture maps.
 *
 * It answers the pointer: moving over it highlights the nearest place, a click opens it (the
 * search for "nearest" happens in Scene, which knows the trips).
 */
export function WorldMap({ map, onHover, onPick }: WorldMapProps) {
	const gl = useThree((state) => state.gl);
	const print = useTexture(map.src);
	const paper = useTexture(PAPER);

	useLayoutEffect(() => {
		print.colorSpace = SRGBColorSpace;
		print.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
		print.needsUpdate = true;
	}, [print, gl]);

	const uvOf = (e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] | null => (e.uv ? [e.uv.x, 1 - e.uv.y] : null);

	return (
		<>
			<MapPlinth map={map} />
			<mesh
				position={MAP_POSITION}
				rotation={[-Math.PI / 2, 0, 0]}
				receiveShadow
				onPointerMove={(e) => {
					e.stopPropagation();
					onHover?.(uvOf(e));
				}}
				onPointerOut={() => onHover?.(null)}
				onClick={(e) => {
					e.stopPropagation();
					const uv = uvOf(e);
					if (e.delta <= 4 && uv) onPick?.(uv);
				}}
			>
				<planeGeometry args={[map.width, map.depth]} />
				<meshStandardMaterial map={print} normalMap={paper.normalMap} normalScale={[0.3, 0.3]} roughnessMap={paper.roughnessMap} roughness={0.9} />
			</mesh>
		</>
	);
}

/** Desk-space position of a point on the sheet, given as fractions (u, v) from its top-left. */
export function mapToDesk(map: DeskMap, [u, v]: [number, number]): [number, number, number] {
	return [MAP_POSITION[0] + (u - 0.5) * map.width, MAP_POSITION[1], MAP_POSITION[2] + (v - 0.5) * map.depth];
}

/** The plinth's section, in metres, from the top down. Insets are measured in from the sheet's edge (negative: out past it). */
const PLINTH = {
	/** The slab the chart lies on: a little wider than the sheet. */
	slab: { inset: -0.02, thickness: 0.036 },
	/** The trim: a flat brass strip round the sheet's edge, its top level with the chart. */
	trim: { width: 0.006 },
	/** The neck: well in under the slab, dark, so the slab seems to float. */
	neck: { inset: 0.045 },
	/** The foot, on the desk: a little wider than the neck. */
	foot: { inset: 0.02, height: 0.02 },
	/** The strip of light round the top of the neck, and how far its glow reaches across the desk. */
	light: { height: 0.005, reach: 0.16 },
};

/** The neck: near-black, so only the light under the slab shows. */
const NECK = new MeshStandardMaterial({ color: '#120e0b', metalness: 0.4, roughness: 0.6 });

/**
 * What the chart stands on: a bronze slab (with the chart's flush brass trim) on a narrower dark
 * plinth, with a strip of gold light
 * under the slab's edge and its glow on the desk below (painted on, like the viewport's: no real
 * light, so it costs nothing).
 */
function MapPlinth({ map }: { map: DeskMap }) {
	const { slab, trim, neck, foot, light } = PLINTH;
	const [cx, , cz] = MAP_POSITION;
	const size = (inset: number): [number, number] => [map.width - 2 * inset, map.depth - 2 * inset];
	const [slabX, slabZ] = size(slab.inset);
	const [neckX, neckZ] = size(neck.inset);
	const [footX, footZ] = size(foot.inset);
	const under = MAP_LIFT - slab.thickness;

	// The glow on the desk: the neck's footprint in gold, blurred out to `reach` on every side.
	const [glowX, glowZ] = [neckX + 2 * light.reach * 1.5, neckZ + 2 * light.reach * 1.5];
	const glow = useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 1024;
		canvas.height = Math.round((1024 * glowZ) / glowX);
		const ctx = canvas.getContext('2d')!;
		const px = canvas.width / glowX;
		ctx.filter = `blur(${(light.reach * px) / 2}px)`;
		ctx.fillStyle = '#fff';
		ctx.fillRect(((glowX - neckX) / 2) * px, ((glowZ - neckZ) / 2) * px, neckX * px, neckZ * px);
		return new CanvasTexture(canvas);
	}, [glowX, glowZ, neckX, neckZ, light.reach]);
	useLayoutEffect(() => () => glow.dispose(), [glow]);

	return (
		<group position={[cx, 0, cz]}>
			<RoundedBox args={[slabX, slab.thickness, slabZ]} radius={0.004} smoothness={3} position={[0, under + slab.thickness / 2, 0]} material={BRONZE} castShadow receiveShadow />
			{/* The trim: four flat strips just outside the sheet, as thick as the sheet stands off the slab. */}
			{[-1, 1].map((side) => (
				<group key={side} position={[0, MAP_LIFT + SHEET / 2, 0]}>
					<mesh position={[0, 0, side * (map.depth / 2 + trim.width / 2)]} material={BRASS} receiveShadow>
						<boxGeometry args={[map.width + 2 * trim.width, SHEET, trim.width]} />
					</mesh>
					<mesh position={[side * (map.width / 2 + trim.width / 2), 0, 0]} material={BRASS} receiveShadow>
						<boxGeometry args={[trim.width, SHEET, map.depth]} />
					</mesh>
				</group>
			))}
			<mesh position={[0, (foot.height + under) / 2, 0]} material={NECK}>
				<boxGeometry args={[neckX, under - foot.height, neckZ]} />
			</mesh>
			<mesh position={[0, under - light.height / 2 - 0.001, 0]} material={GLOW}>
				<boxGeometry args={[neckX + 0.004, light.height, neckZ + 0.004]} />
			</mesh>
			<mesh position={[0, foot.height / 2, 0]} material={BRONZE} castShadow receiveShadow>
				<boxGeometry args={[footX, foot.height, footZ]} />
			</mesh>
			<mesh position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[glowX, glowZ]} />
				<meshBasicMaterial map={glow} color={PALETTE.goldWash} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
			</mesh>
		</group>
	);
}
