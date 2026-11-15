import { CanvasTexture, SRGBColorSpace } from 'three';
import { PALETTE } from './palette';

/**
 * Draws a wood-grain texture on a 2D canvas and wraps it as a three.js texture. Same idea as the
 * polaroids in phase 2: an image generated in code, no download.
 *
 * The desk top is five planks running left to right. Each plank gets a slightly different tint
 * and its own wavy grain lines, clipped to the plank so the grain doesn't cross the seams. A
 * seeded random generator keeps the grain identical on every visit.
 *
 * @param width texture width in px.
 * @param aspect the desk top's width / depth, so the grain isn't stretched.
 */
export function createWoodTexture(width: number, aspect: number): CanvasTexture {
	const height = Math.round(width / aspect);
	const s = width / 2048; // line widths and wave sizes are tuned at 2048px
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');

	const rand = mulberry32(7);
	const { base, dark, light } = PALETTE.wood;

	ctx.fillStyle = base;
	ctx.fillRect(0, 0, width, height);

	const PLANKS = 5;
	const plankH = height / PLANKS;

	for (let p = 0; p < PLANKS; p++) {
		const top = p * plankH;
		ctx.save();
		ctx.beginPath();
		ctx.rect(0, top, width, plankH);
		ctx.clip();

		// Each plank a touch lighter or darker than its neighbours.
		ctx.globalAlpha = 0.06 + rand() * 0.1;
		ctx.fillStyle = rand() < 0.5 ? dark : light;
		ctx.fillRect(0, top, width, plankH);

		// Grain: long, gently wavy lines along the plank.
		for (let i = 0; i < 70; i++) {
			const y0 = top + rand() * plankH;
			const amp = (2 + rand() * 7) * s;
			const freq = ((0.6 + rand() * 2.2) * Math.PI * 2) / width;
			const phase = rand() * Math.PI * 2;
			ctx.globalAlpha = 0.06 + rand() * 0.2;
			ctx.strokeStyle = rand() < 0.7 ? dark : light;
			ctx.lineWidth = (0.5 + rand() * 1.8) * s;
			ctx.beginPath();
			for (let x = 0; x <= width; x += 8 * s) {
				const y =
					y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase * 2) * amp * 0.3;
				if (x === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
		ctx.restore();

		// The seam below this plank: a dark gap with a faint highlight on the next plank's edge.
		if (p < PLANKS - 1) {
			const y = top + plankH;
			ctx.globalAlpha = 0.55;
			ctx.fillStyle = dark;
			ctx.fillRect(0, y - 1.5 * s, width, 2 * s);
			ctx.globalAlpha = 0.12;
			ctx.fillStyle = light;
			ctx.fillRect(0, y + 0.5 * s, width, 1.5 * s);
		}
	}

	const texture = new CanvasTexture(canvas);
	// The canvas holds ordinary sRGB colours; tell three.js so lighting maths happens correctly.
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Tiny seeded random number generator: same seed, same sequence. */
function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
