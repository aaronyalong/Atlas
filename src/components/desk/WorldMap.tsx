import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { PlaneGeometry, SRGBColorSpace } from 'three';
import { PAPER } from './paper';
import type { DeskMap } from './types';

/** Where the sheet lies: the middle of the desk, a hair above it, turned a touch off square. */
export const MAP_POSITION: [number, number, number] = [0, 0.0006, 0.0];
export const MAP_TURN = 0.025;

/**
 * The map: a sheet of printed paper lying flat in the middle of the desk.
 *
 * It's a plane, subdivided so it can take a gentle curl (an unfolded map never lies quite flat;
 * the corners lift a millimetre or two). The print is the texture drawn by scripts/map.mjs; the
 * paper's fibre and matte sheen come from the same Paper001 maps the polaroids use.
 */
export function WorldMap({ map, onClick }: { map: DeskMap; onClick?: () => void }) {
	const gl = useThree((state) => state.gl);
	const print = useTexture(map.src);
	const paper = useTexture(PAPER);

	useLayoutEffect(() => {
		print.colorSpace = SRGBColorSpace;
		print.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
		print.needsUpdate = true;
	}, [print, gl]);

	const geometry = useMemo(() => {
		const g = new PlaneGeometry(map.width, map.depth, 32, 16);
		const position = g.attributes.position;
		for (let i = 0; i < position.count; i++) {
			const nx = position.getX(i) / (map.width / 2);
			const ny = position.getY(i) / (map.depth / 2);
			// Corners lift most; the fold lines (thirds) sit a touch proud as well.
			const corner = 0.0018 * (nx * nx * ny * ny);
			const fold = 0.0004 * Math.max(0, 1 - Math.abs(Math.abs(nx) - 1 / 3) * 12);
			position.setZ(i, corner + fold);
		}
		g.computeVertexNormals();
		return g;
	}, [map.width, map.depth]);
	useEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<mesh
			geometry={geometry}
			position={MAP_POSITION}
			rotation={[-Math.PI / 2, 0, MAP_TURN]}
			receiveShadow
			castShadow
			onClick={(e) => {
				e.stopPropagation();
				if (e.delta <= 4) onClick?.();
			}}
		>
			<meshStandardMaterial
				map={print}
				normalMap={paper.normalMap}
				normalScale={[0.3, 0.3]}
				roughnessMap={paper.roughnessMap}
				roughness={0.95}
			/>
		</mesh>
	);
}

/** Desk-space position of a point on the map given as fractions of its width and height. */
export function mapToDesk(map: DeskMap, [u, v]: [number, number]): [number, number, number] {
	// On the sheet: x across, z down the sheet (v = 0 is the far/top edge). Then the sheet's turn.
	const sx = (u - 0.5) * map.width;
	const sz = (v - 0.5) * map.depth;
	const cos = Math.cos(MAP_TURN);
	const sin = Math.sin(MAP_TURN);
	return [MAP_POSITION[0] + sx * cos - sz * -sin, MAP_POSITION[1], MAP_POSITION[2] + sx * -sin + sz * cos];
}
