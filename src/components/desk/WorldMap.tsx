import { useTexture } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { PlaneGeometry, SRGBColorSpace } from 'three';
import { PAPER } from './paper';
import type { DeskMap } from './types';

/** Where the sheet lies: across the desk, a hair above it, its back edge 30 cm short of the wall
 * (room for the lamp behind its left end). */
export const MAP_POSITION: [number, number, number] = [0, 0.0008, 0.131];

/*
 * The sheet was folded to carry: in four across and once down. Unfolded on the desk, the creases
 * still stand: the outer two across are mountain folds (ridges), the middle one a valley, and the
 * one down the middle a ridge. Each panel lies flat between its creases, and the corners lift.
 * Heights in metres.
 */
const FOLD_RIDGE = 0.005;
const FOLD_DOWN = 0.003;
const CORNER_LIFT = 0.004;

/** Height of the sheet's surface above its base at a point (u, v: fractions from the top-left). */
export function mapSurfaceHeight(u: number, v: number): number {
	// Across: a zigzag through the creases at 1/4 (up), 1/2 (down), 3/4 (up), softened.
	const x = u * 4;
	const zig = [0, 1, 0, 1, 0];
	const i = Math.min(3, Math.floor(x));
	const t = x - i;
	const across = FOLD_RIDGE * (zig[i] + (zig[i + 1] - zig[i]) * (t * t * (3 - 2 * t)));
	// Down: a tent peaking at the middle crease.
	const down = FOLD_DOWN * (1 - Math.abs(2 * v - 1));
	// Corners curl up.
	const cu = Math.max(0, Math.abs(2 * u - 1) - 0.8) / 0.2;
	const cv = Math.max(0, Math.abs(2 * v - 1) - 0.7) / 0.3;
	return across + down + CORNER_LIFT * cu * cu * cv * cv;
}

interface WorldMapProps {
	map: DeskMap;
	/** The pointer moved over the sheet (u, v from its top-left), or left it (null). */
	onHover?: (uv: [number, number] | null) => void;
	/** A click on the sheet (not the end of a drag), at (u, v). */
	onPick?: (uv: [number, number]) => void;
}

/**
 * The map: a large printed sheet lying across the middle of the desk, with its fold creases.
 *
 * A finely subdivided plane, displaced by mapSurfaceHeight, so the creases are real geometry and
 * catch the ceiling light and the sunlight at an angle. The print is the texture drawn by
 * scripts/map.mjs; the paper's fibre and matte sheen come from the Paper001 texture maps.
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

	const geometry = useMemo(() => {
		const g = new PlaneGeometry(map.width, map.depth, 160, 64);
		const position = g.attributes.position;
		for (let i = 0; i < position.count; i++) {
			// Plane x/y → sheet u/v (v measured from the top, which lies toward the back).
			const u = position.getX(i) / map.width + 0.5;
			const v = 0.5 - position.getY(i) / map.depth;
			position.setZ(i, mapSurfaceHeight(u, v));
		}
		g.computeVertexNormals();
		return g;
	}, [map.width, map.depth]);
	useEffect(() => () => geometry.dispose(), [geometry]);

	const uvOf = (e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] | null => (e.uv ? [e.uv.x, 1 - e.uv.y] : null);

	return (
		<mesh
			geometry={geometry}
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

/** Desk-space position of a point on the sheet's surface, given as fractions (u, v). */
export function mapToDesk(map: DeskMap, [u, v]: [number, number]): [number, number, number] {
	return [MAP_POSITION[0] + (u - 0.5) * map.width, MAP_POSITION[1] + mapSurfaceHeight(u, v), MAP_POSITION[2] + (v - 0.5) * map.depth];
}
