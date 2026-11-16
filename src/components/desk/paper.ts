/**
 * ambientCG "Paper001" (CC0), 512px WebP; see /credits. Only the data maps: the colour comes
 * from whatever is printed on the paper. The normal map gives fibre texture under the lamp, the
 * roughness map keeps the sheen uneven the way paper is. Shared by the polaroids and the map;
 * drei's useTexture caches by URL, so they load once.
 */
export const PAPER = {
	normalMap: '/textures/paper-normal.webp',
	roughnessMap: '/textures/paper-roughness.webp',
};
