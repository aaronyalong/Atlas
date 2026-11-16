import { RoundedBox, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Desk size in metres. The back edge sits a little in front of the wall (Room.tsx); the rest runs
 * on well past anything the camera can see, so its front and side edges (and the floor under it)
 * never come into frame, however the visitor turns or zooms. The part you see is the working
 * area around the map.
 */
export const DESK = { width: 3.2, depth: 1.98, thickness: 0.045, centerZ: 0.46 } as const;

/** ambientCG "Wood051" (CC0), re-encoded to 1024px WebP; see /credits. One tile is about 1 m. */
const WOOD = {
	map: '/textures/wood-color.webp',
	normalMap: '/textures/wood-normal.webp',
	roughnessMap: '/textures/wood-roughness.webp',
};

/**
 * The desk: a walnut top.
 *
 * Three texture maps make the wood a material rather than a picture of one:
 *   - the colour map is what you'd expect;
 *   - the normal map says which way each point of the surface faces, so the grain catches the
 *     lamp as tiny ridges and furrows, with no extra geometry;
 *   - the roughness map varies the sheen: open pores stay dull while the varnished grain between
 *     them reflects the lamp.
 * Only the colour map holds colours; the other two hold data and must stay linear (three's
 * default), or the lighting maths reads them wrong and the wood turns to plastic.
 */
export function Desk({
	onClick,
}: {
	/** A click on the bare desk (not a drag). */
	onClick?: () => void;
}) {
	const gl = useThree((state) => state.gl);
	const textures = useTexture(WOOD);

	useLayoutEffect(() => {
		textures.map.colorSpace = SRGBColorSpace;
		for (const texture of Object.values(textures) as Texture[]) {
			texture.wrapS = texture.wrapT = RepeatWrapping;
			texture.repeat.set(DESK.width, DESK.depth);
			// Keeps the grain crisp when seen at a low angle across the desk.
			texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
			texture.needsUpdate = true;
		}
	}, [textures, gl]);

	return (
		<group>
			<RoundedBox
				args={[DESK.width, DESK.thickness, DESK.depth]}
				radius={0.008}
				smoothness={3}
				position={[0, -DESK.thickness / 2, DESK.centerZ]}
				castShadow
				receiveShadow
				onClick={(e) => {
					if (e.delta <= 4) onClick?.();
				}}
			>
				<meshStandardMaterial
					map={textures.map}
					normalMap={textures.normalMap}
					normalScale={[0.6, 0.6]}
					roughnessMap={textures.roughnessMap}
					// Multiplied with the map: 1 means "use the map as is". A touch below for varnish.
					roughness={0.85}
					metalness={0}
				/>
			</RoundedBox>
		</group>
	);
}
