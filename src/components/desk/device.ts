/**
 * What this device can afford, decided once at startup. Phones get smaller shadow maps and
 * generated textures, and lighter effects. Nothing renders above 1.5 pixels per CSS pixel: on a 2x
 * laptop or 3x phone screen, full resolution means 1.8x or 4x the pixels per frame for a
 * difference that's hard to see.
 */
export interface DeviceProfile {
	/** Touch-first or small screen. */
	isMobile: boolean;
	/** The highest device-pixel ratio to render at (the screen's own, if lower). */
	maxDpr: number;
	/** Size (px) of the ceiling light's shadow map. Bigger = sharper shadow edges, more GPU memory. */
	shadowMapSize: number;
	/** Width (px) of the textures drawn for photo prints. */
	printTextureWidth: number;
	/** The light through the viewport casts shadows (a second shadow map): desktop only. */
	moonShadows: boolean;
	/** Earth's texture maps: sharper on desktop, lighter on phones. */
	earthTextures: { day: string; night: string; clouds: string };
	/** The visitor asked their OS for less motion: camera moves snap instead of gliding. */
	reducedMotion: boolean;
}

export function getDeviceProfile(): DeviceProfile {
	const isMobile =
		window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
	return {
		isMobile,
		maxDpr: 1.5,
		shadowMapSize: isMobile ? 1024 : 2048,
		printTextureWidth: isMobile ? 448 : 640,
		moonShadows: !isMobile,
		earthTextures: isMobile
			? { day: '/space/earth-day-2k.webp', night: '/space/earth-night-2k.webp', clouds: '/space/earth-clouds-1k.webp' }
			: { day: '/space/earth-day-4k.webp', night: '/space/earth-night-4k.webp', clouds: '/space/earth-clouds-2k.webp' },
		reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	};
}

/** One rung of the quality ladder. */
export interface Quality {
	/** Device-pixel ratio to render at. */
	dpr: number;
	/** Ambient occlusion (the soft shading where things meet). */
	ao: boolean;
}

/**
 * The quality ladder, best first. The desk starts at the top and steps down a rung each time
 * FramePacer finds the frames too slow (pacing.ts): a lower resolution first (the biggest saving),
 * then no ambient occlusion, and last a little under the screen's own resolution (the 3D softens
 * slightly; the text and labels are HTML, so they stay sharp). It never steps back up during a
 * visit, so it can't flicker between two.
 */
export function qualityLadder(profile: DeviceProfile): Quality[] {
	const top = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
	const dprs = [top, 1.25, 1].filter((dpr, i, all) => dpr <= top && all.indexOf(dpr) === i);
	const ao = !profile.isMobile;
	const lowest = dprs[dprs.length - 1];
	return [...dprs.map((dpr) => ({ dpr, ao })), ...(ao ? [{ dpr: lowest, ao: false }] : []), { dpr: lowest * 0.85, ao: false }];
}

/**
 * Can this browser draw the desk? three.js needs WebGL 2. And if the browser would draw it on the
 * processor rather than a graphics chip (hardware acceleration turned off, a blocked driver, some
 * virtual machines), it runs at a frame or two a second: better to go straight to the list.
 */
export function webglSupport(): 'hardware' | 'software' | 'none' {
	const probe = (attributes?: WebGLContextAttributes) => {
		try {
			return document.createElement('canvas').getContext('webgl2', attributes);
		} catch {
			return null;
		}
	};
	// Asking to fail if there's a "major performance caveat" is how a page asks "is this software?".
	const gl = probe({ failIfMajorPerformanceCaveat: true });
	if (!gl) return probe() ? 'software' : 'none';
	// Some browsers don't count their software renderer as a caveat: check its name too.
	const info = gl.getExtension('WEBGL_debug_renderer_info');
	const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
	gl.getExtension('WEBGL_lose_context')?.loseContext();
	return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) ? 'software' : 'hardware';
}
