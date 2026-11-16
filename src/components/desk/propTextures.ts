import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { CAPTION_FONT_FAMILY, seededRandom } from './polaroidTexture';

/*
 * Textures for the desk props (the journal and the camera), drawn on 2D canvases like the prints.
 */

function makeCanvas(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');
	return { canvas, ctx };
}

/** Colour textures are sRGB; masks (alpha, roughness) hold data and stay linear. */
function toTexture(canvas: HTMLCanvasElement, colour = true) {
	const texture = new CanvasTexture(canvas);
	if (colour) texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Journal: an A5-ish notebook, 150 × 210 mm. */
export const JOURNAL_SIZE = { width: 0.15, length: 0.21 } as const;

/** The journal's first page: ruled lines, a margin rule, and "Travel journal" in handwriting. */
export function createJournalPage(width: number): CanvasTexture {
	const height = Math.round((width * JOURNAL_SIZE.length) / JOURNAL_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 150;
	ctx.fillStyle = '#f6f0e1';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = 'rgba(70, 110, 170, 0.28)';
	ctx.lineWidth = 0.3 * u;
	for (let y = 28 * u; y < height - 8 * u; y += 7 * u) {
		ctx.beginPath();
		ctx.moveTo(8 * u, y);
		ctx.lineTo(width - 8 * u, y);
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(200, 80, 80, 0.35)';
	ctx.beginPath();
	ctx.moveTo(24 * u, 0);
	ctx.lineTo(24 * u, height);
	ctx.stroke();
	ctx.fillStyle = 'rgba(42, 38, 34, 0.88)';
	ctx.font = `600 ${15 * u}px ${CAPTION_FONT_FAMILY}, cursive`;
	ctx.textAlign = 'left';
	ctx.save();
	ctx.translate(30 * u, 19 * u);
	ctx.rotate(-0.02);
	ctx.fillText('Travel journal', 0, 0);
	ctx.restore();
	return toTexture(canvas);
}

/** The edge of a stack of pages: fine horizontal lines on cream. */
export function createPageEdges(): CanvasTexture {
	const { canvas, ctx } = makeCanvas(64, 256);
	ctx.fillStyle = '#efe7d3';
	ctx.fillRect(0, 0, 64, 256);
	const rand = seededRandom('page-edges');
	for (let y = 0; y < 256; y += 2) {
		ctx.fillStyle = `rgba(120, 100, 70, ${0.08 + rand() * 0.12})`;
		ctx.fillRect(0, y, 64, 1);
	}
	return toTexture(canvas);
}

/**
 * The camera's wordmark, white on transparent, for the front of the prism. Set in a heavy italic
 * sans; used as the colour map of a small plane with alphaTest, so only the letters show.
 */
export function createWordmark(text: string): CanvasTexture {
	const { canvas, ctx } = makeCanvas(512, 128);
	ctx.fillStyle = '#f2f2f2';
	ctx.font = `italic 800 92px 'Helvetica Neue', Arial, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 256, 68);
	return toTexture(canvas);
}

/**
 * The ribbed rubber of a lens's zoom and focus rings: fine dark ridges around the barrel. Used as
 * a colour map wrapped around a cylinder (it repeats along the circumference).
 */
export function createGripRibs(): CanvasTexture {
	const { canvas, ctx } = makeCanvas(256, 16);
	ctx.fillStyle = '#1a1a1c';
	ctx.fillRect(0, 0, 256, 16);
	ctx.fillStyle = '#0b0b0c';
	for (let x = 0; x < 256; x += 4) ctx.fillRect(x, 0, 2, 16);
	const texture = toTexture(canvas);
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.repeat.set(6, 1);
	return texture;
}
