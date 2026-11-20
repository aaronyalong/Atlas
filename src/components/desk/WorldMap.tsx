import { RoundedBox, useTexture } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { SRGBColorSpace } from 'three';
import type { DeskMap } from './types';
import { BRASS, BRONZE } from './Viewport';

/** Where the sheet lies: across the desk, a hair above it, its back edge 30 cm short of the wall
 * (room for the lamp behind its left end). */
export const MAP_POSITION: [number, number, number] = [0, 0.0008, 0.131];

interface WorldMapProps {
	map: DeskMap;
	/** The pointer moved over the sheet (u, v from its top-left), or left it (null). */
	onHover?: (uv: [number, number] | null) => void;
	/** A click on the sheet (not the end of a drag), at (u, v). */
	onPick?: (uv: [number, number]) => void;
}

/**
 * The map: a chart table. A large printed chart set into the middle of the desk under lacquer,
 * inside a stepped brass frame, so it reads as part of the furniture (a sheet simply lying on the
 * wood looked like a doormat).
 *
 * The print is the texture drawn by scripts/map.mjs. The lacquer is a clear coat over it: a hard,
 * smooth top that catches the lamp and the window (paper's fibre and matte sheen made it look
 * woven).
 *
 * It answers the pointer: moving over it highlights the nearest place, a click opens it (the
 * search for "nearest" happens in Scene, which knows the trips).
 */
export function WorldMap({ map, onHover, onPick }: WorldMapProps) {
	const gl = useThree((state) => state.gl);
	const print = useTexture(map.src);

	useLayoutEffect(() => {
		print.colorSpace = SRGBColorSpace;
		print.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
		print.needsUpdate = true;
	}, [print, gl]);

	const uvOf = (e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] | null => (e.uv ? [e.uv.x, 1 - e.uv.y] : null);

	return (
		<>
			<MapFrame map={map} />
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
				<meshPhysicalMaterial map={print} roughness={0.7} clearcoat={0.5} clearcoatRoughness={0.34} />
			</mesh>
		</>
	);
}

/** The frame's section, in metres: a brass rail, a lower bronze step inside it, and corner blocks. */
const FRAME = {
	/** The rail: how wide and how high, and how much of its width lies over the chart's margin. */
	rail: { width: 0.034, height: 0.013, overlap: 0.008 },
	/** The step between the rail and the chart. */
	step: { width: 0.012, height: 0.005 },
	/** The corner blocks: a square plinth and a smaller cap on it. */
	corner: { size: 0.062, height: 0.017, cap: 0.036, capHeight: 0.006 },
};

/**
 * The chart's frame: four brass rails with a bronze step inside them, and a stepped block at each
 * corner (which also hides where the rails meet). It lies over the outer edge of the sheet's dark
 * margin, so the chart seems to sit below it.
 */
function MapFrame({ map }: { map: DeskMap }) {
	const { rail, step, corner } = FRAME;
	const [cx, , cz] = MAP_POSITION;
	// The rail's centre line, measured out from the middle of the sheet.
	const x = map.width / 2 - rail.overlap + rail.width / 2;
	const z = map.depth / 2 - rail.overlap + rail.width / 2;
	// The step's centre line: just inside the rail.
	const sx = x - rail.width / 2 - step.width / 2;
	const sz = z - rail.width / 2 - step.width / 2;
	return (
		<group position={[cx, 0, cz]}>
			{[-1, 1].map((side) => (
				<group key={side}>
					{/* Along the back and front, then down the sides. */}
					<RoundedBox args={[2 * x, rail.height, rail.width]} radius={0.003} smoothness={3} position={[0, rail.height / 2, side * z]} material={BRASS} castShadow receiveShadow />
					<RoundedBox args={[rail.width, rail.height, 2 * z]} radius={0.003} smoothness={3} position={[side * x, rail.height / 2, 0]} material={BRASS} castShadow receiveShadow />
					<mesh position={[0, step.height / 2, side * sz]} material={BRONZE} receiveShadow>
						<boxGeometry args={[2 * sx + step.width, step.height, step.width]} />
					</mesh>
					<mesh position={[side * sx, step.height / 2, 0]} material={BRONZE} receiveShadow>
						<boxGeometry args={[step.width, step.height, 2 * sz + step.width]} />
					</mesh>
					{[-1, 1].map((end) => (
						<group key={end} position={[side * x, 0, end * z]}>
							<RoundedBox args={[corner.size, corner.height, corner.size]} radius={0.003} smoothness={3} position={[0, corner.height / 2, 0]} material={BRASS} castShadow receiveShadow />
							<RoundedBox args={[corner.cap, corner.capHeight, corner.cap]} radius={0.002} smoothness={3} position={[0, corner.height + corner.capHeight / 2, 0]} material={BRASS} castShadow />
						</group>
					))}
				</group>
			))}
		</group>
	);
}

/** Desk-space position of a point on the sheet, given as fractions (u, v) from its top-left. */
export function mapToDesk(map: DeskMap, [u, v]: [number, number]): [number, number, number] {
	return [MAP_POSITION[0] + (u - 0.5) * map.width, MAP_POSITION[1], MAP_POSITION[2] + (v - 0.5) * map.depth];
}
