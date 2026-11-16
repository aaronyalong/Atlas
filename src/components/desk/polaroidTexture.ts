import { CanvasTexture, SRGBColorSpace } from 'three';
import { PALETTE } from './palette';

/*
 * Polaroid faces, drawn on 2D canvases.
 *
 * Proportions come from a real Polaroid 600 print: 88 × 107 mm, with a 79 × 79 mm picture, 4.5 mm
 * side borders, a 6 mm top border, and the wide strip at the bottom where people write. All the
 * drawing below is in millimetres, scaled to the canvas.
 */
const PRINT = { width: 88, height: 107, side: 4.5, top: 6, picture: 79 } as const;

/** Size in metres: a real print scaled up 1.25×, so it reads at desk-viewing distance. */
export const POLAROID_SIZE = {
	width: (PRINT.width / 1000) * 1.25,
	height: (PRINT.height / 1000) * 1.25,
	thickness: 0.0025,
} as const;

/** The canvas font for captions. Must match the @font-face loaded in index.astro. */
export const CAPTION_FONT_FAMILY = 'Caveat';
const CAPTION_WEIGHT = 600;

/**
 * Waits for the caption font, so captions aren't drawn in a fallback font. A canvas doesn't
 * trigger web-font downloads by itself; document.fonts.load does, for the characters given.
 * Cached per text, so React's `use()` gets the same promise on every render.
 */
const fontLoads = new Map<string, Promise<unknown>>();
export function loadCaptionFont(text: string): Promise<unknown> {
	let promise = fontLoads.get(text);
	if (!promise) {
		promise = document.fonts
			.load(`${CAPTION_WEIGHT} 32px ${CAPTION_FONT_FAMILY}`, text || 'A')
			.catch(() => undefined); // draw in the fallback font rather than fail
		fontLoads.set(text, promise);
	}
	return promise;
}

interface FrontOptions {
	/** Canvas width in px (height follows the print's proportions). */
	width: number;
	/** The photo, or null to draw a "TODO: photo" placeholder. */
	photo: CanvasImageSource & { width: number; height: number } | null;
	caption: string;
	/** Varies the placeholder colours and caption tilt per trip, the same on every visit. */
	seed: string;
}

/** The front: white border, the photo (cropped square), and a handwritten caption. */
export function createPolaroidFront({ width, photo, caption, seed }: FrontOptions): CanvasTexture {
	const mm = width / PRINT.width;
	const { canvas, ctx } = makeCanvas(width, Math.round(PRINT.height * mm));
	const rand = seededRandom(seed);

	// Print paper: warm white, a touch darker toward the bottom like real stock.
	const paper = ctx.createLinearGradient(0, 0, 0, canvas.height);
	paper.addColorStop(0, '#fbfaf6');
	paper.addColorStop(1, '#f1eee6');
	ctx.fillStyle = paper;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const x = PRINT.side * mm;
	const y = PRINT.top * mm;
	const size = PRINT.picture * mm;

	if (photo) {
		// Crop the middle square out of the photo ("object-fit: cover").
		const side = Math.min(photo.width, photo.height);
		const sx = (photo.width - side) / 2;
		const sy = (photo.height - side) / 2;
		ctx.drawImage(photo, sx, sy, side, side, x, y, size, size);
		// Instant-film look: slightly warm and faded.
		ctx.fillStyle = 'rgba(255, 214, 170, 0.08)';
		ctx.fillRect(x, y, size, size);
	} else {
		drawPlaceholder(ctx, x, y, size, rand);
	}

	// Inner edge where the picture meets the border.
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
	ctx.lineWidth = Math.max(1, 0.25 * mm);
	ctx.strokeRect(x, y, size, size);

	// Caption: centred in the bottom strip, slightly tilted, in "ink".
	const stripTop = y + size;
	const stripHeight = canvas.height - stripTop;
	let fontPx = 11 * mm;
	ctx.font = `${CAPTION_WEIGHT} ${fontPx}px ${CAPTION_FONT_FAMILY}, cursive`;
	const maxWidth = size * 0.92;
	const measured = ctx.measureText(caption).width;
	if (measured > maxWidth) {
		fontPx *= maxWidth / measured;
		ctx.font = `${CAPTION_WEIGHT} ${fontPx}px ${CAPTION_FONT_FAMILY}, cursive`;
	}
	ctx.save();
	ctx.translate(canvas.width / 2 + (rand() - 0.5) * 6 * mm, stripTop + stripHeight * 0.52);
	ctx.rotate(((rand() - 0.5) * 5 * Math.PI) / 180);
	ctx.fillStyle = PALETTE.ink;
	ctx.globalAlpha = 0.88;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(caption, 0, 0);
	ctx.restore();

	drawWear(ctx, canvas.width, canvas.height, mm, rand);
	return toTexture(canvas);
}

/**
 * Edge wear: the greying a print picks up from being handled. Rubbed corners, a faint scuff here
 * and there along the edges, a few specks. Seeded, so each print's wear is its own and the same
 * on every visit. All of it is faint: it should register as "not brand new", not as damage.
 */
function drawWear(ctx: CanvasRenderingContext2D, w: number, h: number, mm: number, rand: () => number) {
	// Corners: a soft grey rub, each corner a different strength.
	for (const [cx, cy] of [
		[0, 0],
		[w, 0],
		[0, h],
		[w, h],
	]) {
		const radius = (4 + rand() * 5) * mm;
		const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
		g.addColorStop(0, `rgba(70, 60, 50, ${0.1 + rand() * 0.14})`);
		g.addColorStop(1, 'rgba(70, 60, 50, 0)');
		ctx.fillStyle = g;
		ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
	}

	// Edges: short scuffs that run along an edge, a hair in from it.
	ctx.lineCap = 'round';
	for (let i = 0; i < 10; i++) {
		const edge = Math.floor(rand() * 4);
		const along = rand();
		const length = (3 + rand() * 10) * mm;
		const inset = (0.3 + rand() * 0.9) * mm;
		ctx.strokeStyle = `rgba(60, 52, 44, ${0.05 + rand() * 0.08})`;
		ctx.lineWidth = (0.3 + rand() * 0.5) * mm;
		ctx.beginPath();
		if (edge < 2) {
			const y = edge === 0 ? inset : h - inset;
			const x = along * (w - length);
			ctx.moveTo(x, y);
			ctx.lineTo(x + length, y);
		} else {
			const x = edge === 2 ? inset : w - inset;
			const y = along * (h - length);
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + length);
		}
		ctx.stroke();
	}

	// A few specks on the border.
	for (let i = 0; i < 6; i++) {
		ctx.fillStyle = `rgba(60, 52, 44, ${0.08 + rand() * 0.1})`;
		ctx.beginPath();
		ctx.arc(rand() * w, rand() * h, (0.15 + rand() * 0.25) * mm, 0, Math.PI * 2);
		ctx.fill();
	}
}

/** The back: plain cream card stock with a faint fibre texture. The trip card sits on it. */
export function createPolaroidBack(width: number): CanvasTexture {
	const mm = width / PRINT.width;
	const { canvas, ctx } = makeCanvas(width, Math.round(PRINT.height * mm));
	const rand = seededRandom('back');
	ctx.fillStyle = PALETTE.paper;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	for (let i = 0; i < 900; i++) {
		ctx.fillStyle = rand() < 0.5 ? 'rgba(120, 95, 60, 0.05)' : 'rgba(255, 255, 255, 0.08)';
		ctx.fillRect(rand() * canvas.width, rand() * canvas.height, (1 + rand() * 3) * mm * 0.3, mm * 0.25);
	}
	drawWear(ctx, canvas.width, canvas.height, mm, rand);
	return toTexture(canvas);
}

/** No photo yet: a soft dusk gradient and a visible TODO. */
function drawPlaceholder(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	rand: () => number,
) {
	const hue = 190 + rand() * 140; // blue through violet to rose
	const sky = ctx.createLinearGradient(x, y, x, y + size);
	sky.addColorStop(0, `hsl(${hue} 35% 38%)`);
	sky.addColorStop(1, `hsl(${(hue + 40) % 360} 45% 68%)`);
	ctx.fillStyle = sky;
	ctx.fillRect(x, y, size, size);

	const label = 'TODO: photo';
	ctx.font = `600 ${size * 0.075}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
	const w = ctx.measureText(label).width + size * 0.08;
	const h = size * 0.13;
	ctx.setLineDash([size * 0.02, size * 0.015]);
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
	ctx.lineWidth = size * 0.006;
	ctx.strokeRect(x + (size - w) / 2, y + (size - h) / 2, w, h);
	ctx.setLineDash([]);
	ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, x + size / 2, y + size / 2);
}

function makeCanvas(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');
	return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement) {
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** A random-number generator seeded from a string (FNV-1a hash into mulberry32). */
export function seededRandom(seed: string) {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
	let a = h >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
