import { useTexture } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { SRGBColorSpace } from 'three';
import { PAPER } from './paper';
import type { DeskMap } from './types';

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
 * The map: a large printed sheet lying flat across the middle of the desk.
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
			<meshStandardMaterial
				map={print}
				normalMap={paper.normalMap}
				normalScale={[0.3, 0.3]}
				roughnessMap={paper.roughnessMap}
				roughness={0.9}
			/>
		</mesh>
	);
}

/** Desk-space position of a point on the sheet, given as fractions (u, v) from its top-left. */
export function mapToDesk(map: DeskMap, [u, v]: [number, number]): [number, number, number] {
	return [MAP_POSITION[0] + (u - 0.5) * map.width, MAP_POSITION[1], MAP_POSITION[2] + (v - 0.5) * map.depth];
}
