import { RoundedBox, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Desk size in metres: a 1.9 × 1 m writing desk, its back edge a little in front of the wall
 * (src/components/desk/Room.tsx). The map takes up most of it.
 */
export const DESK = { width: 1.9, depth: 1.0, thickness: 0.045, centerZ: -0.03, height: 0.75 } as const;

/** ambientCG "Wood051" (CC0), re-encoded to 1024px WebP; see /credits. One tile is about 1 m. */
const WOOD = {
	map: '/textures/wood-color.webp',
	normalMap: '/textures/wood-normal.webp',
	roughnessMap: '/textures/wood-roughness.webp',
};

/**
 * The desk: a walnut top on a matte-black steel frame.
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

	const steel = <meshStandardMaterial color="#141416" metalness={0.6} roughness={0.5} />;
	const legX = DESK.width / 2 - 0.05;
	const legZ = DESK.depth / 2 - 0.05;
	const legH = DESK.height - DESK.thickness;

	return (
		<group>
			{/* Steel frame: four square legs and a rail under the top on every side. */}
			{[-1, 1].flatMap((sx) =>
				[-1, 1].map((sz) => (
					<mesh key={`${sx}${sz}`} position={[sx * legX, -DESK.thickness - legH / 2, DESK.centerZ + sz * legZ]} castShadow receiveShadow>
						<boxGeometry args={[0.04, legH, 0.04]} />
						{steel}
					</mesh>
				)),
			)}
			{[-1, 1].map((sz) => (
				<mesh key={`rz${sz}`} position={[0, -DESK.thickness - 0.025, DESK.centerZ + sz * legZ]} castShadow receiveShadow>
					<boxGeometry args={[DESK.width - 0.1, 0.05, 0.03]} />
					{steel}
				</mesh>
			))}
			{[-1, 1].map((sx) => (
				<mesh key={`rx${sx}`} position={[sx * legX, -DESK.thickness - 0.025, DESK.centerZ]} castShadow receiveShadow>
					<boxGeometry args={[0.03, 0.05, DESK.depth - 0.1]} />
					{steel}
				</mesh>
			))}
			<RoundedBox
				args={[DESK.width, DESK.thickness, DESK.depth]}
				radius={0.008}
				smoothness={3}
				position={[0, -DESK.thickness / 2, DESK.centerZ]}
				// It shades the floor beneath it, from the lamp and the moon.
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
