import { MeshReflectorMaterial, RoundedBox, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Desk size in metres: a console running wall to wall (the room's side walls are at ±4.4 m), its
 * back edge against the viewport wall (WALL_Z = -0.9, just under the sill), its front well past
 * anything the camera can see, even zoomed right out and tilted low. So no edge of it, and
 * nothing under it, ever comes into frame.
 */
export const DESK = { width: 8.8, depth: 4.5, thickness: 0.045, centerZ: 1.35 } as const;

/**
 * ambientCG "Wood051" (CC0), re-encoded to 1024px WebP (see the README). One tile is about 1 m. The
 * colour map is graded from the original walnut to a smoked oak: most of the colour taken out and
 * a cool cast added, so the desk sits with the graphite room and the navy map.
 */
const WOOD = {
	map: '/textures/wood-color.webp',
	normalMap: '/textures/wood-normal.webp',
	roughnessMap: '/textures/wood-roughness.webp',
};

/**
 * The desk: a smoked-oak top under a deep lacquer.
 *
 * Three texture maps make the wood a material rather than a picture of one:
 *   - the colour map is what you'd expect;
 *   - the normal map says which way each point of the surface faces, so the grain catches the
 *     light as tiny ridges and furrows, with no extra geometry;
 *   - the roughness map varies the sheen: open pores stay dull while the varnished grain between
 *     them reflects the light.
 * Only the colour map holds colours; the other two hold data and must stay linear (three's
 * default), or the lighting maths reads them wrong and the wood turns to plastic.
 *
 * On desktop the lacquer reflects: a second, mirrored camera draws the room from below the desk
 * each frame, and that picture is blurred and laid into the top, so Earth, the viewport's gold
 * strip and the lamp shimmer in the wood. Phones skip it (it draws the scene twice).
 */
export function Desk({
	onClick,
	reflections,
}: {
	/** A click on the bare desk (not a drag). */
	onClick?: () => void;
	reflections: boolean;
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
			{reflections && (
				// The reflecting top: a plane a hair above the box's top face (the reflection needs a flat
				// surface facing up), taking the clicks the box would.
				<mesh
					rotation={[-Math.PI / 2, 0, 0]}
					position={[0, 0.0002, DESK.centerZ]}
					receiveShadow
					onClick={(e) => {
						if (e.delta <= 4) onClick?.();
					}}
				>
					<planeGeometry args={[DESK.width, DESK.depth]} />
					<MeshReflectorMaterial
						map={textures.map}
						normalMap={textures.normalMap}
						normalScale={[0.6, 0.6]}
						roughnessMap={textures.roughnessMap}
						roughness={0.75}
						metalness={0}
						// The reflection: drawn at 1024 px, blurred (wider across than along, like a
						// reflection in grain), and added on top of the wood.
						resolution={1024}
						blur={[500, 160]}
						mixBlur={1}
						mixStrength={1.3}
						mixContrast={1}
						mirror={0}
						// Fade the reflection out with distance from the desk, as a lacquer's does.
						depthScale={1.2}
						minDepthThreshold={0.2}
						maxDepthThreshold={1.4}
					/>
				</mesh>
			)}
		</group>
	);
}
