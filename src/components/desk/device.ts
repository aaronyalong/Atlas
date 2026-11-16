/**
 * What this device can afford, decided once at startup. Phones get a lower pixel ratio and
 * smaller shadow maps and generated textures: on a 3x phone screen, rendering at full resolution means
 * 9x the pixels per frame for a difference nobody can see.
 */
export interface DeviceProfile {
	/** Touch-first or small screen. */
	isMobile: boolean;
	/** [min, max] device-pixel ratio. R3F renders at the screen's ratio, clamped to this range. */
	dpr: [number, number];
	/** Size (px) of the lamp's shadow map. Bigger = sharper shadow edges, more GPU memory. */
	shadowMapSize: number;
	/** Width (px) of the textures drawn for prints and the journal's page. */
	printTextureWidth: number;
	/** Books on the shelf (one instanced draw either way, but fewer to shade). */
	bookCount: number;
	/** Dust motes in the lamplight. */
	dustCount: number;
	/** The moonlight casts shadows (a second shadow map): desktop only. */
	moonShadows: boolean;
	/** The visitor asked their OS for less motion: camera moves snap instead of gliding. */
	reducedMotion: boolean;
}

export function getDeviceProfile(): DeviceProfile {
	const isMobile =
		window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
	return {
		isMobile,
		dpr: isMobile ? [1, 1.5] : [1, 2],
		shadowMapSize: isMobile ? 1024 : 2048,
		printTextureWidth: isMobile ? 448 : 640,
		bookCount: isMobile ? 140 : 240,
		dustCount: isMobile ? 50 : 140,
		moonShadows: !isMobile,
		reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	};
}

/** three.js renders with WebGL 2 only. */
export function hasWebGL(): boolean {
	try {
		return !!document.createElement('canvas').getContext('webgl2');
	} catch {
		return false;
	}
}
