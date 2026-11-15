import { RoundedBox } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createWoodTexture } from './woodTexture';

/**
 * Desk top size in metres. Bigger than the view: the front edge stays below the starting shot
 * (even on a tall phone screen) and the back edge fades out into the fog.
 */
export const DESK = { width: 2.4, depth: 2.05, thickness: 0.05, centerZ: 0.075 } as const;

/**
 * The desk: one slab with softly rounded edges, its top surface at y = 0.
 *
 * `receiveShadow` lets the lamp's shadows land on it. The texture is built once (useMemo) and
 * freed when the component goes away: GPU memory isn't garbage-collected like JS objects, so
 * three.js resources you create yourself need an explicit dispose().
 */
export function Desk({ textureSize }: { textureSize: number }) {
	const gl = useThree((state) => state.gl);

	const map = useMemo(() => {
		const texture = createWoodTexture(textureSize, DESK.width / DESK.depth);
		// Keeps the grain crisp when seen at a low angle across the desk.
		texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
		return texture;
	}, [textureSize, gl]);

	useEffect(() => () => map.dispose(), [map]);

	return (
		<RoundedBox
			args={[DESK.width, DESK.thickness, DESK.depth]}
			radius={0.012}
			smoothness={3}
			position={[0, -DESK.thickness / 2, DESK.centerZ]}
			receiveShadow
		>
			{/* Satin varnish: mostly matte, with a soft sheen where the lamp reflects. */}
			<meshStandardMaterial map={map} roughness={0.62} metalness={0} />
		</RoundedBox>
	);
}
